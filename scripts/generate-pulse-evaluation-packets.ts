import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";
import {
  buildPulseEvaluationPacketManifest,
  pulseEvaluationPacketManifestErrors,
  type PulseEvaluationEvidenceRef,
  type PulseEvaluationPacketInput,
} from "../src/lib/pulse/v2/evaluation-packets";
import { PULSE_EVALUATION_SAMPLING_PROTOCOL } from "../src/lib/pulse/v2/evaluation-sampling";

config({ path: ".env.local", override: true });

const OUTPUT = resolve("data/research/pulse-evaluation-packet-manifest-v1.json");
const POPULATION = resolve("data/research/pulse-evaluation-frame-population-v1.json");
const WRITE = process.argv.includes("--write");

function sha256(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

type EvidenceRow = {
  unit_ref: string;
  reference_date: string;
  primary_stratum: string;
  evidence: PulseEvaluationEvidenceRef[];
};

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

export async function buildPulseEvaluationPacketsFromDatabase() {
  assert.ok(process.env.DATABASE_URL, "DATABASE_URL is required");
  const sql = neon(process.env.DATABASE_URL);
  const population = JSON.parse(readFileSync(POPULATION, "utf8")) as {
    semanticSha256: string;
    populationFreezeAt: string;
    counts: {
      retainedEventCandidateCensus: number;
      retainedExclusionOutcomes: number;
      unresolvedRawCandidates: number;
      systemNegativePopulation: number;
    };
    identityHashes: { acceptedEvents: string; systemNegatives: string };
  };
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
  assert.equal(events.length, population.counts.retainedEventCandidateCensus);
  assert.equal(negatives.length, population.counts.unresolvedRawCandidates);
  assert.equal(negatives.length, population.counts.systemNegativePopulation);
  return buildPulseEvaluationPacketManifest({
    populationArtifactSha256: population.semanticSha256,
    acceptedEventIdentityHash: population.identityHashes.acceptedEvents,
    systemNegativeIdentityHash: population.identityHashes.systemNegatives,
    eventCandidates: events.map(packetInput),
    systemNegativePopulation: negatives.map(packetInput),
  });
}

async function main() {
  const manifest = await buildPulseEvaluationPacketsFromDatabase();
  assert.deepEqual(pulseEvaluationPacketManifestErrors(manifest), []);
  if (WRITE) {
    mkdirSync(dirname(OUTPUT), { recursive: true });
    writeFileSync(OUTPUT, `${JSON.stringify(manifest, null, 2)}\n`);
  } else {
    assert.ok(existsSync(OUTPUT), "checked packet manifest is missing; run with --write");
    assert.deepEqual(JSON.parse(readFileSync(OUTPUT, "utf8")), manifest);
  }
  assert.equal(sha256(manifest.packets.map(({ packetKey }) => packetKey)).length, 64);
  console.log(
    `PASS — ${manifest.counts.eventCensus} event-census and ${manifest.counts.systemNegativeInitialDraw} system-negative packets; ${manifest.semanticSha256}.`,
  );
}

if (import.meta.url === `file://${process.argv[1]}`)
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
