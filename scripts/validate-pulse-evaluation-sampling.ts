import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";
import { PULSE_EVALUATION_SAMPLING_PROTOCOL, PULSE_EVALUATION_SAMPLING_VERSION, pulseEvaluationSamplingErrors } from "../src/lib/pulse/v2/evaluation-sampling";

config({ path: ".env.local", override: true });
const OUTPUT = resolve("data/research/pulse-evaluation-frame-population-v1.json");
const write = process.argv.includes("--write");

function hash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

async function buildPopulation() {
  assert.ok(process.env.DATABASE_URL, "DATABASE_URL is required");
  const sql = neon(process.env.DATABASE_URL!);
  const freeze = PULSE_EVALUATION_SAMPLING_PROTOCOL.populationFreezeAt;
  const start = PULSE_EVALUATION_SAMPLING_PROTOCOL.period.start;
  const end = PULSE_EVALUATION_SAMPLING_PROTOCOL.period.end;
  const accepted = await sql`SELECT id::text id FROM pulse_events_v2 WHERE created_at <= ${freeze}::timestamptz AND event_date BETWEEN ${start}::date AND ${end}::date ORDER BY id`;
  const outcomes = await sql`SELECT outcome_key id FROM pulse_candidate_outcomes o WHERE occurred_at <= ${freeze}::timestamptz AND NOT (candidate_kind='event' AND EXISTS (SELECT 1 FROM pulse_events_v2 e WHERE e.id::text=o.candidate_id AND e.created_at <= ${freeze}::timestamptz AND e.event_date BETWEEN ${start}::date AND ${end}::date)) ORDER BY outcome_key`;
  const unresolved = await sql`SELECT evidence_identity_key id FROM raw_events r WHERE retrieved_at <= ${freeze}::timestamptz AND COALESCE(event_date,retrieved_at::date) BETWEEN ${start}::date AND ${end}::date AND NOT EXISTS (SELECT 1 FROM pulse_sources ps WHERE ps.raw_event_id=r.id) ORDER BY evidence_identity_key`;
  const countries = await sql`SELECT id::text id, continent FROM jurisdictions WHERE type='sovereign_state' ORDER BY id`;
  const [coverage] = await sql`SELECT count(DISTINCT evidence_language)::int languages, count(DISTINCT source_type)::int source_types, count(DISTINCT j.continent)::int continents, count(DISTINCT COALESCE(gt.regime_type_cgv,'unclassified'))::int regimes FROM raw_events r LEFT JOIN jurisdictions j ON j.id=r.jurisdiction_id LEFT JOIN LATERAL (SELECT regime_type_cgv FROM government_taxonomies g WHERE g.jurisdiction_id=j.id ORDER BY regime_year DESC NULLS LAST LIMIT 1) gt ON true WHERE r.retrieved_at <= ${freeze}::timestamptz`;
  const mediaRows = await sql`WITH RECURSIVE date_series(observation_date) AS (SELECT ${start}::date UNION ALL SELECT observation_date+1 FROM date_series WHERE observation_date<${end}::date), frame_days AS (SELECT j.id, d.observation_date FROM jurisdictions j CROSS JOIN date_series d WHERE j.type='sovereign_state'), counts AS (SELECT jurisdiction_id,retrieved_at::date AS observation_date,count(*)::int docs,count(DISTINCT evidence_publisher->>'sourceFamilyId')::int families FROM raw_events WHERE retrieved_at <= ${freeze}::timestamptz GROUP BY jurisdiction_id,retrieved_at::date) SELECT CASE WHEN COALESCE(c.docs,0)=0 THEN 'no_retained_documents' WHEN c.docs>=5 AND c.families>=2 THEN 'multi_family_5plus' ELSE 'observed_below_threshold' END environment,count(*)::int n FROM frame_days d LEFT JOIN counts c ON c.jurisdiction_id=d.id AND c.observation_date=d.observation_date GROUP BY environment ORDER BY environment`;
  const negativeIds = [...outcomes.map((row) => `outcome:${row.id}`), ...unresolved.map((row) => `raw:${row.id}`)].sort();
  const dates: string[] = [];
  for (let cursor = new Date(`${start}T00:00:00Z`); cursor <= new Date(`${end}T00:00:00Z`); cursor = new Date(cursor.getTime() + 86_400_000)) dates.push(cursor.toISOString().slice(0, 10));
  const payload = {
    schemaVersion: "pulse-evaluation-frame-population/v1",
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
      mediaEvidenceEnvironments: Object.fromEntries(mediaRows.map((row) => [String(row.environment), Number(row.n)])),
      mediaEvidenceEnvironmentRule: "five_documents_and_two_source_families_else_observed_below_threshold_or_no_documents",
      politicalMediaContext: "missing_until_rights_cleared_sourced_context_exists",
    },
    identityHashes: {
      acceptedEvents: hash(accepted.map((row) => row.id)),
      systemNegatives: hash(negativeIds),
      countryDayCartesianFrame: hash({ jurisdictions: countries.map((row) => row.id), dates }),
    },
  };
  return { ...payload, semanticSha256: hash(payload) };
}

async function main() {
  assert.deepEqual(pulseEvaluationSamplingErrors(), []);
  const generatedProtocol = JSON.parse(readFileSync(resolve("data/research/pulse-evaluation-sampling-protocol-v1.json"), "utf8"));
  assert.deepEqual(generatedProtocol, PULSE_EVALUATION_SAMPLING_PROTOCOL);
  const population = await buildPopulation();
  assert.equal(population.counts.retainedEventCandidateCensus, 384);
  assert.ok(population.counts.systemNegativePopulation >= PULSE_EVALUATION_SAMPLING_PROTOCOL.precision.initialDrawPerProbabilityFrame);
  assert.ok(population.counts.countryDays >= PULSE_EVALUATION_SAMPLING_PROTOCOL.precision.initialDrawPerProbabilityFrame);
  assert.ok(population.balanceCoverage.languages > 1 && population.balanceCoverage.sourceTypes === 2 && population.balanceCoverage.continents >= 6 && population.balanceCoverage.regimesIncludingUnclassified >= 6);
  assert.deepEqual(Object.keys(population.balanceCoverage.mediaEvidenceEnvironments).sort(), ["multi_family_5plus", "no_retained_documents", "observed_below_threshold"]);
  if (write) {
    mkdirSync(dirname(OUTPUT), { recursive: true });
    writeFileSync(OUTPUT, `${JSON.stringify(population, null, 2)}\n`);
  } else {
    assert.ok(existsSync(OUTPUT), "checked population artifact is missing");
    assert.deepEqual(JSON.parse(readFileSync(OUTPUT, "utf8")), population);
  }
  console.log(`PASS — ${PULSE_EVALUATION_SAMPLING_VERSION}: ${population.counts.retainedEventCandidateCensus} event-candidate census, ${population.counts.systemNegativePopulation} system-negative candidates, ${population.counts.countryDays} country-days; hash ${population.semanticSha256}.`);
}

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
