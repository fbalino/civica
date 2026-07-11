import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";
import { allocatePrimaryStrata, PULSE_EVALUATION_SAMPLING_PROTOCOL, stableSample } from "../src/lib/pulse/v2/evaluation-sampling";

config({ path: ".env.local", override: true });
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
const sql = neon(process.env.DATABASE_URL);

function sha(value: unknown) { return createHash("sha256").update(JSON.stringify(value)).digest("hex"); }
function priority(value: string) { return createHash("sha256").update(value).digest("hex"); }
function nextDate(value: string) { return new Date(new Date(`${value}T00:00:00Z`).getTime() + 86_400_000).toISOString().slice(0, 10); }
function isoWeek(value: string) {
  const date = new Date(`${value}T00:00:00Z`);
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return `${date.getUTCFullYear()}-W${String(Math.ceil((((date.getTime() - yearStart.getTime()) / 86_400_000) + 1) / 7)).padStart(2, "0")}`;
}

async function main() {
  const protocol = PULSE_EVALUATION_SAMPLING_PROTOCOL;
  const populationArtifact = JSON.parse(readFileSync(resolve("data/research/pulse-evaluation-frame-population-v1.json"), "utf8"));
  const countries = await sql`SELECT j.id::text id,j.name,j.iso3,j.continent,COALESCE(gt.regime_type_cgv,'unclassified') regime FROM jurisdictions j LEFT JOIN LATERAL (SELECT regime_type_cgv FROM government_taxonomies g WHERE g.jurisdiction_id=j.id ORDER BY regime_year DESC NULLS LAST LIMIT 1) gt ON true WHERE j.type='sovereign_state' ORDER BY j.id`;
  const evidence = await sql`SELECT jurisdiction_id::text id,retrieved_at::date::text observation_date,count(*)::int documents,count(DISTINCT evidence_publisher->>'sourceFamilyId')::int families,array_agg(DISTINCT evidence_language ORDER BY evidence_language) languages,array_agg(DISTINCT source_type ORDER BY source_type) source_types,array_agg(evidence_identity_key ORDER BY evidence_identity_key) evidence_refs FROM raw_events WHERE retrieved_at<=${protocol.populationFreezeAt}::timestamptz GROUP BY jurisdiction_id,retrieved_at::date`;
  const evidenceMap = new Map(evidence.map((row) => [`${row.id}|${row.observation_date}`, row]));
  const dates: string[] = [];
  for (let cursor = new Date(`${protocol.period.start}T00:00:00Z`); cursor <= new Date(`${protocol.period.end}T00:00:00Z`); cursor = new Date(cursor.getTime() + 86_400_000)) dates.push(cursor.toISOString().slice(0, 10));
  const countryDayFrameSha256 = sha({ jurisdictions: countries.map((row) => row.id), dates });
  if (populationArtifact.protocolVersion !== protocol.schemaVersion || populationArtifact.populationFreezeAt !== protocol.populationFreezeAt || populationArtifact.identityHashes?.countryDayCartesianFrame !== countryDayFrameSha256) throw new Error("checked country-day population does not match the preregistered frame");
  const rows = countries.flatMap((country) => dates.map((date) => {
    const observed = evidenceMap.get(`${country.id}|${date}`) as Record<string, unknown> | undefined;
    const documents = Number(observed?.documents ?? 0);
    const families = Number(observed?.families ?? 0);
    const mediaEnvironment = documents === 0 ? "no_retained_documents" : documents >= 5 && families >= 2 ? "multi_family_5plus" : "observed_below_threshold";
    const month = date.slice(0, 7);
    return {
      id: `${country.id}:${date}`,
      stratum: `${country.continent ?? "Unclassified"}|${month}`,
      jurisdictionId: String(country.id),
      country: String(country.name),
      iso3: country.iso3 ? String(country.iso3) : null,
      continent: country.continent ? String(country.continent) : "Unclassified",
      regime: String(country.regime),
      date,
      month,
      week: isoWeek(date),
      mediaEvidenceEnvironment: mediaEnvironment,
      retainedDocuments: documents,
      retainedSourceFamilies: families,
      languages: (observed?.languages as string[] | undefined) ?? [],
      sourceTypes: (observed?.source_types as string[] | undefined) ?? [],
      evidenceRefs: (observed?.evidence_refs as string[] | undefined) ?? [],
      searchQueries: {
        institutions: `"${String(country.name).replaceAll('"', '')}" (government OR parliament OR election OR court OR constitution OR minister OR president) after:${date} before:${nextDate(date)}`,
        accountabilitySecurity: `"${String(country.name).replaceAll('"', '')}" (coup OR protest OR corruption OR emergency OR rights OR media OR arrest OR law) after:${date} before:${nextDate(date)}`,
        broadCountryDay: `"${String(country.name).replaceAll('"', '')}" after:${date} before:${nextDate(date)}`,
      },
    };
  }));
  const populations = Object.fromEntries([...new Set(rows.map((row) => row.stratum))].sort().map((stratum) => [stratum, rows.filter((row) => row.stratum === stratum).length]));
  const quotas = allocatePrimaryStrata(populations, protocol.precision.initialDrawPerProbabilityFrame, 5);
  let sampled = stableSample({ rows, quotas, seed: protocol.selection.seed, frameId: "country_day_retrieval_probability" });
  let selectedIds = new Set(sampled.map((row) => row.id));
  for (const [environment, requested] of [["multi_family_5plus", 30], ["observed_below_threshold", 30]] as const) {
    const population = rows.filter((row) => row.mediaEvidenceEnvironment === environment);
    const target = Math.min(requested, population.length);
    let current = sampled.filter((row) => row.mediaEvidenceEnvironment === environment).length;
    const additions = population.filter((row) => !selectedIds.has(row.id)).sort((a, b) => priority(`${protocol.selection.seed}|margin|${environment}|${a.id}`).localeCompare(priority(`${protocol.selection.seed}|margin|${environment}|${b.id}`)));
    for (const add of additions) {
      if (current >= target) break;
      const removable = sampled.filter((row) => row.stratum === add.stratum && row.mediaEvidenceEnvironment === "no_retained_documents").sort((a, b) => priority(`${protocol.selection.seed}|remove|${b.id}`).localeCompare(priority(`${protocol.selection.seed}|remove|${a.id}`)))[0];
      if (!removable) continue;
      sampled = sampled.map((row) => row.id === removable.id ? add : row);
      selectedIds = new Set([...selectedIds].filter((id) => id !== removable.id));
      selectedIds.add(add.id);
      current++;
    }
  }
  const analysisQuotas = allocatePrimaryStrata(populations, protocol.precision.validRequiredPerProbabilityFrame, 5);
  sampled = sampled.sort((a, b) => a.stratum.localeCompare(b.stratum) || (a.mediaEvidenceEnvironment === "no_retained_documents" ? 1 : -1) - (b.mediaEvidenceEnvironment === "no_retained_documents" ? 1 : -1) || priority(`${protocol.selection.seed}|final|${a.id}`).localeCompare(priority(`${protocol.selection.seed}|final|${b.id}`)));
  const stratumRank = new Map<string, number>();
  const sampleRows = sampled.map((row, index) => {
    const rank = (stratumRank.get(row.stratum) ?? 0) + 1;
    stratumRank.set(row.stratum, rank);
    const quota = quotas[row.stratum];
    const population = populations[row.stratum];
    return { ...row, drawOrder: index + 1, withinStratumRank: rank, analysisStatus: rank <= analysisQuotas[row.stratum] ? "analysis_candidate" : "reserve", stratumPopulation: population, stratumDraw: quota, stratumAnalysisTarget: analysisQuotas[row.stratum], primaryStratumDrawFraction: quota / population, primaryBaseWeight: population / quota, analysisWeightStatus: "requires_calibration_for_secondary_margin_repair" };
  });
  const payload = {
    schemaVersion: "pulse-country-day-evaluation-sample/v1",
    protocolVersion: protocol.schemaVersion,
    populationFreezeAt: protocol.populationFreezeAt,
    populationArtifactSha256: populationArtifact.semanticSha256,
    countryDayFrameSha256,
    seed: protocol.selection.seed,
    frame: "country_day_retrieval_probability",
    population: rows.length,
    initialDraw: sampleRows.length,
    analysisTarget: protocol.precision.validRequiredPerProbabilityFrame,
    reserveTarget: sampleRows.length - protocol.precision.validRequiredPerProbabilityFrame,
    quotas,
    rows: sampleRows,
  };
  const artifact = { ...payload, semanticSha256: sha(payload) };
  const output = resolve("data/research/pulse-country-day-sample-v1.json");
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, `${JSON.stringify(artifact, null, 2)}\n`);
  console.log(`Wrote ${output}: ${sampleRows.length} rows; hash ${artifact.semanticSha256}`);
}

main().catch((error) => { console.error(error); process.exit(1); });
