import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import {
  PULSE_EVALUATION_FRAME_POPULATION_VERSION,
  PULSE_EVALUATION_SAMPLING_PROTOCOL,
  PULSE_EVALUATION_SAMPLING_VERSION,
  pulseEvaluationFramePopulationErrors,
  pulseEvaluationPopulationSemanticSha256,
  pulseEvaluationSamplingErrors,
  type PulseEvaluationFramePopulation,
} from "../src/lib/pulse/v2/evaluation-sampling";

const OUTPUT = resolve(
  "data/research/pulse-evaluation-frame-population-v1.json",
);
const PROTOCOL_OUTPUT = resolve(
  "data/research/pulse-evaluation-sampling-protocol-v1.json",
);
const FROZEN_INPUT_OUTPUT = resolve(
  "data/research/pulse-evaluation-packet-frozen-inputs-v1.json",
);
const write = process.argv.includes("--write");
const live = process.argv.includes("--live");

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8")) as unknown;
}

function assertCheckedPopulation(
  value: unknown,
): asserts value is PulseEvaluationFramePopulation {
  assert.deepEqual(pulseEvaluationFramePopulationErrors(value), []);
}

function assertFrozenInputLinkage(
  population: PulseEvaluationFramePopulation,
): void {
  assert.ok(
    existsSync(FROZEN_INPUT_OUTPUT),
    "PUL-042 frozen packet inputs are missing",
  );
  const frozen = readJson(FROZEN_INPUT_OUTPUT) as {
    protocolVersion?: unknown;
    populationFreezeAt?: unknown;
    populationArtifactSha256?: unknown;
    acceptedEventIdentityHash?: unknown;
    systemNegativeIdentityHash?: unknown;
    counts?: {
      eventCandidates?: unknown;
      systemNegativePopulation?: unknown;
    };
  };
  assert.equal(frozen.protocolVersion, population.protocolVersion);
  assert.equal(frozen.populationFreezeAt, population.populationFreezeAt);
  assert.equal(
    frozen.populationArtifactSha256,
    population.semanticSha256,
    "PUL-042 inputs no longer bind the checked PUL-014 population",
  );
  assert.equal(
    frozen.acceptedEventIdentityHash,
    population.identityHashes.acceptedEvents,
  );
  assert.equal(
    frozen.systemNegativeIdentityHash,
    population.identityHashes.systemNegatives,
  );
  assert.equal(
    frozen.counts?.eventCandidates,
    population.counts.retainedEventCandidateCensus,
  );
  assert.equal(
    frozen.counts?.systemNegativePopulation,
    population.counts.systemNegativePopulation,
  );
}

async function buildPopulation(): Promise<PulseEvaluationFramePopulation> {
  const [{ neon }, { config }] = await Promise.all([
    import("@neondatabase/serverless"),
    import("dotenv"),
  ]);
  config({ path: ".env.local", override: true, quiet: true });
  assert.ok(process.env.DATABASE_URL, "DATABASE_URL is required for --live");
  const sql = neon(process.env.DATABASE_URL);
  const freeze = PULSE_EVALUATION_SAMPLING_PROTOCOL.populationFreezeAt;
  const start = PULSE_EVALUATION_SAMPLING_PROTOCOL.period.start;
  const end = PULSE_EVALUATION_SAMPLING_PROTOCOL.period.end;
  const accepted = await sql`
    SELECT id::text id
    FROM pulse_events_v2
    WHERE created_at <= ${freeze}::timestamptz
      AND event_date BETWEEN ${start}::date AND ${end}::date
    ORDER BY id
  `;
  const outcomes = await sql`
    SELECT outcome_key id
    FROM pulse_candidate_outcomes o
    WHERE occurred_at <= ${freeze}::timestamptz
      AND NOT (
        candidate_kind = 'event'
        AND EXISTS (
          SELECT 1
          FROM pulse_events_v2 e
          WHERE e.id::text = o.candidate_id
            AND e.created_at <= ${freeze}::timestamptz
            AND e.event_date BETWEEN ${start}::date AND ${end}::date
        )
      )
    ORDER BY outcome_key
  `;
  const unresolved = await sql`
    SELECT evidence_identity_key id
    FROM raw_events r
    WHERE retrieved_at <= ${freeze}::timestamptz
      AND COALESCE(event_date, retrieved_at::date)
        BETWEEN ${start}::date AND ${end}::date
      AND NOT EXISTS (
        SELECT 1 FROM pulse_sources ps WHERE ps.raw_event_id = r.id
      )
    ORDER BY evidence_identity_key
  `;
  const countries = await sql`
    SELECT id::text id, continent
    FROM jurisdictions
    WHERE type = 'sovereign_state'
    ORDER BY id
  `;
  const [coverage] = await sql`
    SELECT
      count(DISTINCT evidence_language)::int languages,
      count(DISTINCT source_type)::int source_types,
      count(DISTINCT j.continent)::int continents,
      count(DISTINCT COALESCE(gt.regime_type_cgv, 'unclassified'))::int regimes
    FROM raw_events r
    LEFT JOIN jurisdictions j ON j.id = r.jurisdiction_id
    LEFT JOIN LATERAL (
      SELECT regime_type_cgv
      FROM government_taxonomies g
      WHERE g.jurisdiction_id = j.id
      ORDER BY regime_year DESC NULLS LAST
      LIMIT 1
    ) gt ON true
    WHERE r.retrieved_at <= ${freeze}::timestamptz
  `;
  const mediaRows = await sql`
    WITH RECURSIVE date_series(observation_date) AS (
      SELECT ${start}::date
      UNION ALL
      SELECT observation_date + 1
      FROM date_series
      WHERE observation_date < ${end}::date
    ), frame_days AS (
      SELECT j.id, d.observation_date
      FROM jurisdictions j
      CROSS JOIN date_series d
      WHERE j.type = 'sovereign_state'
    ), counts AS (
      SELECT
        jurisdiction_id,
        retrieved_at::date AS observation_date,
        count(*)::int docs,
        count(DISTINCT evidence_publisher->>'sourceFamilyId')::int families
      FROM raw_events
      WHERE retrieved_at <= ${freeze}::timestamptz
      GROUP BY jurisdiction_id, retrieved_at::date
    )
    SELECT
      CASE
        WHEN COALESCE(c.docs, 0) = 0 THEN 'no_retained_documents'
        WHEN c.docs >= 5 AND c.families >= 2 THEN 'multi_family_5plus'
        ELSE 'observed_below_threshold'
      END environment,
      count(*)::int n
    FROM frame_days d
    LEFT JOIN counts c
      ON c.jurisdiction_id = d.id
      AND c.observation_date = d.observation_date
    GROUP BY environment
    ORDER BY environment
  `;
  const negativeIds = [
    ...outcomes.map((row) => `outcome:${row.id}`),
    ...unresolved.map((row) => `raw:${row.id}`),
  ].sort();
  const dates: string[] = [];
  for (
    let cursor = new Date(`${start}T00:00:00Z`);
    cursor <= new Date(`${end}T00:00:00Z`);
    cursor = new Date(cursor.getTime() + 86_400_000)
  ) {
    dates.push(cursor.toISOString().slice(0, 10));
  }
  const body = {
    schemaVersion: PULSE_EVALUATION_FRAME_POPULATION_VERSION,
    protocolVersion: PULSE_EVALUATION_SAMPLING_VERSION,
    populationFreezeAt: freeze,
    period: { start, end, days: dates.length },
    counts: {
      retainedEventCandidateCensus: accepted.length,
      retainedExclusionOutcomes: outcomes.length,
      unresolvedRawCandidates: unresolved.length,
      systemNegativePopulation: negativeIds.length,
      sovereignJurisdictions: countries.length,
      countryDays: countries.length * dates.length,
    },
    balanceCoverage: {
      languages: Number(coverage.languages),
      sourceTypes: Number(coverage.source_types),
      continents: Number(coverage.continents),
      regimesIncludingUnclassified: Number(coverage.regimes),
      mediaEvidenceEnvironments: Object.fromEntries(
        mediaRows.map((row) => [String(row.environment), Number(row.n)]),
      ),
      mediaEvidenceEnvironmentRule:
        "five_documents_and_two_source_families_else_observed_below_threshold_or_no_documents",
      politicalMediaContext:
        "missing_until_rights_cleared_sourced_context_exists",
    },
    identityHashes: {
      acceptedEvents: pulseEvaluationPopulationSemanticSha256(
        accepted.map((row) => row.id),
      ),
      systemNegatives: pulseEvaluationPopulationSemanticSha256(negativeIds),
      countryDayCartesianFrame: pulseEvaluationPopulationSemanticSha256({
        jurisdictions: countries.map((row) => row.id),
        dates,
      }),
    },
  };
  return {
    ...body,
    semanticSha256: pulseEvaluationPopulationSemanticSha256(body),
  };
}

async function main(): Promise<void> {
  const unknownArguments = process.argv
    .slice(2)
    .filter((argument) => argument !== "--live" && argument !== "--write");
  if (unknownArguments.length > 0) {
    throw new Error(`Unknown argument(s): ${unknownArguments.join(", ")}`);
  }
  assert.deepEqual(pulseEvaluationSamplingErrors(), []);
  assert.deepEqual(
    readJson(PROTOCOL_OUTPUT),
    PULSE_EVALUATION_SAMPLING_PROTOCOL,
  );
  assert.ok(existsSync(OUTPUT), "checked population artifact is missing");
  const checked = readJson(OUTPUT);
  assertCheckedPopulation(checked);
  assertFrozenInputLinkage(checked);

  if (write && !live) {
    throw new Error(
      "--write requires --live; frozen releases cannot self-refresh",
    );
  }

  if (live) {
    const reconstructed = await buildPopulation();
    assertCheckedPopulation(reconstructed);
    if (write) {
      mkdirSync(dirname(OUTPUT), { recursive: true });
      writeFileSync(OUTPUT, `${JSON.stringify(reconstructed, null, 2)}\n`);
    } else {
      assert.deepEqual(
        reconstructed,
        checked,
        "live reconstruction differs from the checked PUL-014 release",
      );
    }
    console.log(
      `PASS — live ${PULSE_EVALUATION_SAMPLING_VERSION} reconstruction matches ${reconstructed.counts.retainedEventCandidateCensus} event candidates, ${reconstructed.counts.systemNegativePopulation} system negatives, and ${reconstructed.counts.countryDays} country-days; hash ${reconstructed.semanticSha256}.`,
    );
    return;
  }

  console.log(
    `PASS — checked ${PULSE_EVALUATION_SAMPLING_VERSION} release is internally valid and PUL-042-bound: ${checked.counts.retainedEventCandidateCensus} event candidates, ${checked.counts.systemNegativePopulation} system negatives, ${checked.counts.countryDays} country-days; hash ${checked.semanticSha256}. Run the explicit :live audit to compare Neon.`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
