import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";
import {
  buildPulseEvaluationPacketFrozenInputs,
  buildPulseEvaluationPacketManifest,
  buildPulseEvaluationPacketManifestFromFrozenInputs,
  pulseEvaluationPacketFrozenInputErrors,
  pulseEvaluationPacketManifestErrors,
  type PulseEvaluationEvidenceRef,
  type PulseEvaluationPacketFrozenInputs,
  type PulseEvaluationPacketInput,
  type PulseEvaluationPacketManifest,
  type PulseEvaluationPacketPopulationReference,
} from "../src/lib/pulse/v2/evaluation-packets";
import { PULSE_EVALUATION_SAMPLING_PROTOCOL } from "../src/lib/pulse/v2/evaluation-sampling";

config({ path: ".env.local", override: true });

const OUTPUT = resolve("data/research/pulse-evaluation-packet-manifest-v1.json");
const POPULATION = resolve("data/research/pulse-evaluation-frame-population-v1.json");
const FROZEN_INPUTS = resolve(
  "data/research/pulse-evaluation-packet-frozen-inputs-v1.json",
);
const WRITE = process.argv.includes("--write");
const CAPTURE_FROZEN_INPUTS = process.argv.includes("--capture-frozen-inputs");

type EvaluationPopulation = PulseEvaluationPacketPopulationReference & {
  counts: PulseEvaluationPacketPopulationReference["counts"] & {
    retainedExclusionOutcomes: number;
    unresolvedRawCandidates: number;
  };
};

type EvidenceRow = {
  row_id?: string;
  unit_ref: string;
  reference_date: string;
  primary_stratum: string;
  evidence: PulseEvaluationEvidenceRef[];
};

type ClassificationHistoryRow = {
  entity_id: string;
  before_stratum: string;
  after_stratum: string;
  recorded_at: string;
};

function loadPopulation(): EvaluationPopulation {
  return JSON.parse(readFileSync(POPULATION, "utf8")) as EvaluationPopulation;
}

function packetInput(row: EvidenceRow): PulseEvaluationPacketInput {
  return {
    unitRef: String(row.unit_ref),
    referenceDate: String(row.reference_date),
    primaryStratum: String(row.primary_stratum),
    evidence: row.evidence.map((item) => ({
      evidenceIdentityKey: String(item.evidenceIdentityKey),
      evidenceContentHash: String(item.evidenceContentHash),
      sourceFamilyId: String(item.sourceFamilyId),
      sourceType: item.sourceType,
      language: String(item.language),
      reportedDate: item.reportedDate ? String(item.reportedDate) : null,
      retrievedAt: new Date(item.retrievedAt).toISOString(),
    })),
  };
}

async function loadLiveEvidenceRows(): Promise<{
  events: EvidenceRow[];
  negatives: EvidenceRow[];
}> {
  assert.ok(process.env.DATABASE_URL, "DATABASE_URL is required");
  const sql = neon(process.env.DATABASE_URL);
  const population = loadPopulation();
  const freeze = population.populationFreezeAt;
  const start = PULSE_EVALUATION_SAMPLING_PROTOCOL.period.start;
  const end = PULSE_EVALUATION_SAMPLING_PROTOCOL.period.end;
  const events = (await sql`
    SELECT
      e.id::text AS unit_ref,
      e.event_date::text AS reference_date,
      to_char(e.event_date, 'YYYY-MM') AS primary_stratum,
      json_agg(
        json_build_object(
          'evidenceIdentityKey', r.evidence_identity_key,
          'evidenceContentHash', r.evidence_content_hash,
          'sourceFamilyId', r.evidence_publisher->>'sourceFamilyId',
          'sourceType', r.source_type,
          'language', r.evidence_language,
          'reportedDate', r.event_date::text,
          'retrievedAt', to_char(r.retrieved_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
        ) ORDER BY r.evidence_identity_key
      ) AS evidence
    FROM pulse_events_v2 e
    JOIN pulse_sources ps ON ps.event_id = e.id
    JOIN raw_events r ON r.id = ps.raw_event_id
    WHERE e.created_at <= ${freeze}::timestamptz
      AND e.event_date BETWEEN ${start}::date AND ${end}::date
    GROUP BY e.id, e.event_date
    ORDER BY e.id
  `) as EvidenceRow[];
  const negatives = (await sql`
    SELECT
      r.id::text AS row_id,
      r.evidence_identity_key AS unit_ref,
      COALESCE(r.event_date, r.retrieved_at::date)::text AS reference_date,
      r.classification_disposition AS primary_stratum,
      json_build_array(
        json_build_object(
          'evidenceIdentityKey', r.evidence_identity_key,
          'evidenceContentHash', r.evidence_content_hash,
          'sourceFamilyId', r.evidence_publisher->>'sourceFamilyId',
          'sourceType', r.source_type,
          'language', r.evidence_language,
          'reportedDate', r.event_date::text,
          'retrievedAt', to_char(r.retrieved_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
        )
      ) AS evidence
    FROM raw_events r
    WHERE r.retrieved_at <= ${freeze}::timestamptz
      AND COALESCE(r.event_date, r.retrieved_at::date) BETWEEN ${start}::date AND ${end}::date
      AND NOT EXISTS (SELECT 1 FROM pulse_sources ps WHERE ps.raw_event_id = r.id)
    ORDER BY r.evidence_identity_key
  `) as EvidenceRow[];
  return { events, negatives };
}

export async function loadPulseEvaluationPacketInputsFromDatabase(): Promise<{
  eventCandidates: PulseEvaluationPacketInput[];
  systemNegativePopulation: PulseEvaluationPacketInput[];
}> {
  const rows = await loadLiveEvidenceRows();
  return {
    eventCandidates: rows.events.map(packetInput),
    systemNegativePopulation: rows.negatives.map(packetInput),
  };
}

export async function buildPulseEvaluationPacketsFromDatabase(): Promise<PulseEvaluationPacketManifest> {
  const population = loadPopulation();
  const live = await loadPulseEvaluationPacketInputsFromDatabase();
  assert.equal(
    population.populationFreezeAt,
    PULSE_EVALUATION_SAMPLING_PROTOCOL.populationFreezeAt,
    "population freeze drifted",
  );
  assert.equal(
    population.counts.retainedExclusionOutcomes,
    0,
    "the frozen frame now has retained outcomes; add their evidence resolver before regenerating",
  );
  assert.equal(live.eventCandidates.length, population.counts.retainedEventCandidateCensus);
  assert.equal(live.systemNegativePopulation.length, population.counts.unresolvedRawCandidates);
  assert.equal(live.systemNegativePopulation.length, population.counts.systemNegativePopulation);
  return buildPulseEvaluationPacketManifest({
    populationArtifactSha256: population.semanticSha256,
    acceptedEventIdentityHash: population.identityHashes.acceptedEvents,
    systemNegativeIdentityHash: population.identityHashes.systemNegatives,
    eventCandidates: live.eventCandidates,
    systemNegativePopulation: live.systemNegativePopulation,
  });
}

export function buildPulseEvaluationPacketsFromFrozenInputs(): PulseEvaluationPacketManifest {
  const frozen = JSON.parse(
    readFileSync(FROZEN_INPUTS, "utf8"),
  ) as PulseEvaluationPacketFrozenInputs;
  return buildPulseEvaluationPacketManifestFromFrozenInputs(frozen);
}

async function captureFrozenInputs(): Promise<PulseEvaluationPacketFrozenInputs> {
  const population = loadPopulation();
  const checked = JSON.parse(readFileSync(OUTPUT, "utf8")) as PulseEvaluationPacketManifest;
  const rows = await loadLiveEvidenceRows();
  assert.ok(process.env.DATABASE_URL, "DATABASE_URL is required");
  const sql = neon(process.env.DATABASE_URL);
  const rowIds = rows.negatives.map(({ row_id }) => row_id).filter(Boolean) as string[];
  const history = (await sql`
    SELECT
      entity_id,
      before->>'classification_disposition' AS before_stratum,
      after->>'classification_disposition' AS after_stratum,
      to_char(recorded_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS recorded_at
    FROM research_evidence_history
    WHERE entity_table = 'raw_events'
      AND entity_id = ANY(${rowIds}::text[])
      AND recorded_at > ${population.populationFreezeAt}::timestamptz
      AND before->>'classification_disposition'
        IS DISTINCT FROM after->>'classification_disposition'
    ORDER BY recorded_at, id
  `) as ClassificationHistoryRow[];
  const firstBefore = new Map<string, string>();
  for (const row of history)
    if (!firstBefore.has(row.entity_id)) firstBefore.set(row.entity_id, row.before_stratum);
  const stratumByRowId = new Map(
    rows.negatives.map((row) => [
      String(row.row_id),
      firstBefore.get(String(row.row_id)) ?? row.primary_stratum,
    ]),
  );
  const eventCandidates = rows.events.map(packetInput);
  const matches: Array<{
    retainedInputSnapshotAt: string;
    systemNegativePopulation: PulseEvaluationPacketInput[];
  }> = [];
  const testSnapshot = (retainedInputSnapshotAt: string) => {
    const systemNegativePopulation = rows.negatives.map((row) =>
      packetInput({
        ...row,
        primary_stratum: stratumByRowId.get(String(row.row_id)) ?? row.primary_stratum,
      }),
    );
    const candidate = buildPulseEvaluationPacketManifest({
      populationArtifactSha256: population.semanticSha256,
      acceptedEventIdentityHash: population.identityHashes.acceptedEvents,
      systemNegativeIdentityHash: population.identityHashes.systemNegatives,
      eventCandidates,
      systemNegativePopulation,
    });
    if (JSON.stringify(candidate) === JSON.stringify(checked))
      matches.push({ retainedInputSnapshotAt, systemNegativePopulation });
  };
  testSnapshot(new Date(population.populationFreezeAt).toISOString());
  for (const row of history) {
    stratumByRowId.set(row.entity_id, row.after_stratum);
    testSnapshot(new Date(row.recorded_at).toISOString());
  }
  assert.equal(
    matches.length,
    1,
    `expected one append-only history state to reproduce the checked release; found ${matches.length}`,
  );
  const frozen = buildPulseEvaluationPacketFrozenInputs({
    populationArtifactSha256: population.semanticSha256,
    acceptedEventIdentityHash: population.identityHashes.acceptedEvents,
    systemNegativeIdentityHash: population.identityHashes.systemNegatives,
    packetManifestSemanticSha256: checked.semanticSha256,
    retainedInputSnapshotAt: matches[0].retainedInputSnapshotAt,
    eventCandidates,
    systemNegativePopulation: matches[0].systemNegativePopulation,
  });
  assert.deepEqual(pulseEvaluationPacketFrozenInputErrors(frozen, population), []);
  assert.deepEqual(buildPulseEvaluationPacketManifestFromFrozenInputs(frozen), checked);
  return frozen;
}

async function main() {
  if (CAPTURE_FROZEN_INPUTS) {
    const frozen = await captureFrozenInputs();
    if (existsSync(FROZEN_INPUTS)) {
      assert.deepEqual(
        JSON.parse(readFileSync(FROZEN_INPUTS, "utf8")),
        frozen,
        "retained frozen inputs already exist and must not be rewritten",
      );
    } else {
      mkdirSync(dirname(FROZEN_INPUTS), { recursive: true });
      writeFileSync(FROZEN_INPUTS, `${JSON.stringify(frozen, null, 2)}\n`);
    }
    console.log(
      `PASS — retained ${frozen.counts.eventCandidates} event and ${frozen.counts.systemNegativePopulation} system-negative inputs at ${frozen.retainedInputSnapshotAt}; ${frozen.semanticSha256}.`,
    );
    return;
  }
  assert.ok(existsSync(FROZEN_INPUTS), "retained frozen packet inputs are missing");
  assert.ok(existsSync(OUTPUT), "checked packet manifest is missing");
  const checked = JSON.parse(readFileSync(OUTPUT, "utf8")) as PulseEvaluationPacketManifest;
  const manifest = buildPulseEvaluationPacketsFromFrozenInputs();
  assert.deepEqual(pulseEvaluationPacketManifestErrors(manifest), []);
  assert.deepEqual(
    checked,
    manifest,
    "checked packet manifest drifted from retained frozen inputs",
  );
  if (WRITE)
    console.log("Immutable checked manifest already exists; verified without rewriting it.");
  console.log(
    `PASS — ${manifest.counts.eventCensus} event-census and ${manifest.counts.systemNegativeInitialDraw} system-negative packets; ${manifest.semanticSha256}.`,
  );
}

if (import.meta.url === `file://${process.argv[1]}`)
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
