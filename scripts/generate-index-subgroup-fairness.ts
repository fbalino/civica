import { config } from "dotenv";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";
import { V2_WEIGHTS, type CIDimensionV2 } from "../src/lib/ci/dimensions-v2";
import { researchPanelHash, CI_TOURNAMENT_PANEL_V3_RELEASE_ID, K1_UNCERTAINTY_INPUT_RELEASE_ID, K4_PRACTICE_PANEL_RELEASE_ID } from "../src/lib/ci/research-panel";
import { summarizeSubgroups, terciles, type FairnessProfile } from "../src/lib/ci/subgroup-fairness";
import { spearman } from "../src/lib/ci/validity-analysis";
import { median } from "../src/lib/ci/longitudinal-analysis";

config({ path: ".env.local" });
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL required");
const sql = neon(process.env.DATABASE_URL);
const dimensions: CIDimensionV2[] = ["democratic_quality", "rule_of_law", "freedom_rights", "corruption_control"];
type Row = { iso3: string; dimension: CIDimensionV2; sourceId: string; indicatorId: string; value: number | null; nativeMin: number; nativeMax: number; isInverted: boolean };
type Meta = { iso3: string; region: string; population: number; disputed: boolean; regime: string | null };
const normalize = (row: Row) => {
  const value = (Number(row.value) - Number(row.nativeMin)) / (Number(row.nativeMax) - Number(row.nativeMin));
  return (row.isInverted ? 1 - value : value) * 100;
};
const calculate = (values: Partial<Record<CIDimensionV2, number>>) => {
  const present = dimensions.filter((dimension) => values[dimension] !== undefined);
  if (!present.includes("democratic_quality") || !present.includes("rule_of_law") || present.length < 3) return null;
  const weight = present.reduce((sum, dimension) => sum + V2_WEIGHTS[dimension], 0);
  return Math.round(present.reduce((sum, dimension) => sum + values[dimension]! * V2_WEIGHTS[dimension] / weight, 0));
};

export async function buildIndexSubgroupFairness() {
  const [panel, uncertainty, media, metadata] = await Promise.all([
    sql`SELECT j.iso3,p.dimension,p.source_id AS "sourceId",p.indicator_id AS "indicatorId",p.value,p.native_min AS "nativeMin",p.native_max AS "nativeMax",p.is_inverted AS "isInverted" FROM ci_research_panel_rows p JOIN jurisdictions j ON j.id=p.jurisdiction_id WHERE p.release_id=${CI_TOURNAMENT_PANEL_V3_RELEASE_ID} AND p.period_year=2024 ORDER BY j.iso3,p.source_id,p.indicator_id` as unknown as Promise<Row[]>,
    sql`SELECT j.iso3,p.dimension,p.uncertainty_lower AS lower,p.uncertainty_upper AS upper FROM ci_research_panel_rows p JOIN jurisdictions j ON j.id=p.jurisdiction_id WHERE p.release_id=${K1_UNCERTAINTY_INPUT_RELEASE_ID} ORDER BY j.iso3,p.dimension` as unknown as Promise<{ iso3: string; dimension: string; lower: number | null; upper: number | null }[]>,
    sql`SELECT j.iso3,p.value FROM ci_research_panel_rows p JOIN jurisdictions j ON j.id=p.jurisdiction_id WHERE p.release_id=${K4_PRACTICE_PANEL_RELEASE_ID} AND p.period_year=2024 AND p.indicator_id='v2x_freexp_altinf' AND p.value IS NOT NULL ORDER BY j.iso3` as unknown as Promise<{ iso3: string; value: number }[]>,
    sql`SELECT j.iso3,j.continent AS region,j.population,j.status_disputed AS disputed,gt.regime_type_cgv AS regime FROM jurisdictions j LEFT JOIN LATERAL(SELECT regime_type_cgv FROM government_taxonomies g WHERE g.jurisdiction_id=j.id ORDER BY g.regime_year DESC NULLS LAST,g.updated_at DESC NULLS LAST LIMIT 1)gt ON true WHERE j.type='sovereign_state' AND j.iso3 IS NOT NULL ORDER BY j.iso3` as unknown as Promise<Meta[]>,
  ]);
  const classifications = JSON.parse(readFileSync("data/releases/index-subgroup-classifications-2026-07-11-v1/classifications.v1.json", "utf8"));
  const income = new Map(classifications.countries.map((row: { iso3: string; incomeId: string }) => [row.iso3, row.incomeId]));
  const mediaBands = terciles(media.map((row) => ({ iso3: row.iso3, value: Number(row.value) })), "high");
  const observedByIso = new Map<string, number>();
  for (const row of panel) if (row.value !== null) observedByIso.set(row.iso3, (observedByIso.get(row.iso3) ?? 0) + 1);
  const availabilityBands = terciles(metadata.map((row) => ({ iso3: row.iso3, value: observedByIso.get(row.iso3) ?? 0 })), "high");
  const sourceCounts = new Map<string, number>();
  const profiles: FairnessProfile[] = metadata.map((meta) => {
    const rows = panel.filter((row) => row.iso3 === meta.iso3);
    const by = new Map(rows.map((row) => [`${row.sourceId}:${row.indicatorId}`, row]));
    const selected = [
      by.get("vdem:v2x_libdem")?.value != null ? by.get("vdem:v2x_libdem")! : by.get("worldbank_wgi:va.est"),
      by.get("worldbank_wgi:rl.est"), by.get("freedom_house:pr_cl_total"), by.get("transparency_intl:score"),
    ].filter((row): row is Row => Boolean(row?.value != null));
    const values: Partial<Record<CIDimensionV2, number>> = {};
    for (const row of selected) values[row.dimension] = normalize(row);
    const score = calculate(values);
    const sourceCount = selected.length;
    sourceCounts.set(meta.iso3, sourceCount);
    const bounded = new Set(uncertainty.filter((row) => row.iso3 === meta.iso3 && row.lower !== null && row.upper !== null).map((row) => row.dimension)).size;
    const complete = dimensions.every((dimension) => values[dimension] !== undefined);
    const scarce = complete ? calculate({ democratic_quality: values.democratic_quality, rule_of_law: values.rule_of_law, freedom_rights: values.freedom_rights }) : null;
    return {
      iso3: meta.iso3, score, sourceCount, uncertaintyCount: bounded,
      scarcityDelta: score !== null && scarce !== null ? scarce - score : null,
      groups: {
        region: meta.region ?? "missing", income: String(income.get(meta.iso3) ?? "missing"), regime: meta.regime ?? "unknown",
        media_environment: mediaBands.get(meta.iso3) ?? "missing", small_state: meta.population < 1_500_000 ? "small_under_1.5m" : "other",
        disputed_status: meta.disputed ? "disputed" : "not_disputed", data_availability: availabilityBands.get(meta.iso3) ?? "missing",
        source_count: `sources_${sourceCount}`,
      },
    };
  });
  const families = ["region", "income", "regime", "media_environment", "small_state", "disputed_status", "data_availability", "source_count"];
  const published = profiles.filter((row) => row.score !== null);
  const scarcityPairs = published.map((row) => ({ x: row.sourceCount, y: row.score! }));
  const completeDeltas = profiles.flatMap((row) => row.scarcityDelta === null ? [] : [row.scarcityDelta]);
  const mechanicalFailure = median(completeDeltas) < -1 || completeDeltas.filter((value) => value < 0).length / completeDeltas.length > 0.6;
  const payload = {
    schemaVersion: "civica-index-subgroup-fairness-result/v1", releaseId: "index-subgroup-fairness-v1",
    panelReleaseId: CI_TOURNAMENT_PANEL_V3_RELEASE_ID, classificationReleaseId: classifications.releaseId,
    scope: { eligibleSovereignStates: profiles.length, published: published.length, withheld: profiles.length - published.length },
    definitions: { smallState: "cached population below 1,500,000", mediaEnvironment: "terciles of frozen 2024 V-Dem expression-practice measure; missing retained", dataAvailability: "terciles of observed 2024 panel source rows; missing is not zero", sourceCount: "number of selected 2024 K1 dimensions", minimumPerformanceN: 30 },
    subgroupFamilies: Object.fromEntries(families.map((family) => [family, summarizeSubgroups(profiles, family)])),
    evidenceScarcity: { scoreSourceCountSpearman: spearman(scarcityPairs), completeCaseMaskN: completeDeltas.length, maskedOptionalCpiMedianDelta: median(completeDeltas), maskedOptionalCpiNegativeShare: completeDeltas.filter((value) => value < 0).length / completeDeltas.length, failureRule: "fail if median masked-minus-full score is below -1 or more than 60% of complete profiles move downward", failsMechanicalScarcityGate: mechanicalFailure, interpretation: "association between coverage and score is descriptive; the mask test isolates the scoring mechanism" },
    uncertainty: { meaning: "count of inputs with publisher bounds, not a composite confidence interval", freedomHouseBoundStatus: "absent", performanceBySubgroup: "not_estimable_without_external_country-quality_truth; descriptive publication, score, bound, and mask results reported" },
    exclusions: { disputedSovereignRows: profiles.filter((row) => row.groups.disputed_status === "disputed").length, outOfScopeTerritoriesNotAdded: true, imputation: "none" },
  };
  return { ...payload, resultSha256: researchPanelHash(payload) };
}

if (process.argv[1]?.endsWith("generate-index-subgroup-fairness.ts")) buildIndexSubgroupFairness().then((result) => { const directory = "data/releases/index-subgroup-fairness-v1"; mkdirSync(directory, { recursive: true }); writeFileSync(`${directory}/result.v1.json`, `${JSON.stringify(result, null, 2)}\n`); console.log(`Wrote ${result.resultSha256}`); }).catch((error) => { console.error(error); process.exit(1); });
