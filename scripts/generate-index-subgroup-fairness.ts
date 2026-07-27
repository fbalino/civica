import { config } from "dotenv";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";

import { V2_WEIGHTS, type CIDimensionV2 } from "../src/lib/ci/dimensions-v2";
import {
  K1_UNCERTAINTY_INPUT_RELEASE_ID,
  K4_PRACTICE_PANEL_RELEASE_ID,
  CI_TOURNAMENT_PANEL_V3_RELEASE_ID,
  researchPanelHash,
} from "../src/lib/ci/research-panel";
import {
  normalizeSubgroupFairnessInputs,
  readProtectedSubgroupFairnessInputs,
  retainProtectedSubgroupFairnessInputs,
  type SubgroupFairnessInputs,
  type SubgroupFairnessMetadataRow,
  type SubgroupFairnessMediaRow,
  type SubgroupFairnessPanelRow,
  type SubgroupFairnessUncertaintyRow,
} from "../src/lib/ci/subgroup-fairness-inputs";
import { summarizeSubgroups, terciles, type FairnessProfile } from "../src/lib/ci/subgroup-fairness";
import { spearman } from "../src/lib/ci/validity-analysis";
import { median } from "../src/lib/ci/longitudinal-analysis";

const RELEASE_ID = "index-subgroup-fairness-v2";
const RELEASE_DIRECTORY = `data/releases/${RELEASE_ID}`;
const MANIFEST_PATH = `${RELEASE_DIRECTORY}/manifest.v1.json`;
const CAPTURE_LIVE_INPUTS = process.argv.includes("--capture-live-inputs");
const dimensions: CIDimensionV2[] = [
  "democratic_quality",
  "rule_of_law",
  "freedom_rights",
  "corruption_control",
];

interface ClassificationRelease {
  releaseId: string;
  countries: { iso3: string; incomeId: string }[];
}

interface SubgroupFairnessReleaseManifest {
  schemaVersion: "civica-index-subgroup-fairness-release/v1";
  releaseId: typeof RELEASE_ID;
  protectedInput: {
    schemaVersion: "civica-index-subgroup-fairness-inputs/v1";
    contentSha256: string;
  };
}

function releaseManifest(): SubgroupFairnessReleaseManifest {
  const manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf8")) as Partial<SubgroupFairnessReleaseManifest>;
  if (
    manifest.schemaVersion !== "civica-index-subgroup-fairness-release/v1" ||
    manifest.releaseId !== RELEASE_ID ||
    !manifest.protectedInput ||
    manifest.protectedInput.schemaVersion !== "civica-index-subgroup-fairness-inputs/v1" ||
    !/^[a-f0-9]{64}$/.test(manifest.protectedInput.contentSha256 ?? "")
  ) {
    throw new Error(`Invalid frozen subgroup fairness release manifest ${MANIFEST_PATH}`);
  }
  return manifest as SubgroupFairnessReleaseManifest;
}

function classifications(): ClassificationRelease {
  const value = JSON.parse(
    readFileSync(
      "data/releases/index-subgroup-classifications-2026-07-11-v1/classifications.v1.json",
      "utf8",
    ),
  ) as Partial<ClassificationRelease>;
  if (
    value.releaseId !== "index-subgroup-classifications-2026-07-11-v1" ||
    !Array.isArray(value.countries)
  ) {
    throw new Error("Invalid frozen subgroup classification release");
  }
  return value as ClassificationRelease;
}

function normalize(row: SubgroupFairnessPanelRow) {
  const value = (row.value! - row.nativeMin) / (row.nativeMax - row.nativeMin);
  return (row.isInverted ? 1 - value : value) * 100;
}

function calculate(values: Partial<Record<CIDimensionV2, number>>) {
  const present = dimensions.filter((dimension) => values[dimension] !== undefined);
  if (!present.includes("democratic_quality") || !present.includes("rule_of_law") || present.length < 3) {
    return null;
  }
  const weight = present.reduce((sum, dimension) => sum + V2_WEIGHTS[dimension], 0);
  return Math.round(
    present.reduce(
      (sum, dimension) => sum + (values[dimension]! * V2_WEIGHTS[dimension]) / weight,
      0,
    ),
  );
}

export function buildIndexSubgroupFairnessFromInputs(
  inputs: SubgroupFairnessInputs,
  protectedInputSha256: string,
  classificationRelease = classifications(),
) {
  if (!/^[a-f0-9]{64}$/.test(protectedInputSha256)) {
    throw new Error("Invalid protected subgroup fairness input hash");
  }
  const income = new Map(classificationRelease.countries.map((row) => [row.iso3, row.incomeId]));
  const mediaBands = terciles(inputs.media.map((row) => ({ iso3: row.iso3, value: row.value })), "high");
  const observedByIso = new Map<string, number>();
  const panelByIso = new Map<string, SubgroupFairnessPanelRow[]>();
  const uncertaintyByIso = new Map<string, SubgroupFairnessUncertaintyRow[]>();
  for (const row of inputs.panel) {
    if (row.value !== null) observedByIso.set(row.iso3, (observedByIso.get(row.iso3) ?? 0) + 1);
    panelByIso.set(row.iso3, [...(panelByIso.get(row.iso3) ?? []), row]);
  }
  for (const row of inputs.uncertainty) {
    uncertaintyByIso.set(row.iso3, [...(uncertaintyByIso.get(row.iso3) ?? []), row]);
  }
  const availabilityBands = terciles(
    inputs.metadata.map((row) => ({ iso3: row.iso3, value: observedByIso.get(row.iso3) ?? 0 })),
    "high",
  );
  const profiles: FairnessProfile[] = inputs.metadata.map((meta) => {
    const rows = panelByIso.get(meta.iso3) ?? [];
    const by = new Map(rows.map((row) => [`${row.sourceId}:${row.indicatorId}`, row]));
    const selected = [
      by.get("vdem:v2x_libdem")?.value != null
        ? by.get("vdem:v2x_libdem")!
        : by.get("worldbank_wgi:va.est"),
      by.get("worldbank_wgi:rl.est"),
      by.get("freedom_house:pr_cl_total"),
      by.get("transparency_intl:score"),
    ].filter((row): row is SubgroupFairnessPanelRow => Boolean(row?.value != null));
    const values: Partial<Record<CIDimensionV2, number>> = {};
    for (const row of selected) values[row.dimension] = normalize(row);
    const score = calculate(values);
    const sourceCount = selected.length;
    const bounded = new Set(
      (uncertaintyByIso.get(meta.iso3) ?? [])
        .filter((row) => row.lower !== null && row.upper !== null)
        .map((row) => row.dimension),
    ).size;
    const complete = dimensions.every((dimension) => values[dimension] !== undefined);
    const scarce = complete
      ? calculate({
          democratic_quality: values.democratic_quality,
          rule_of_law: values.rule_of_law,
          freedom_rights: values.freedom_rights,
        })
      : null;
    return {
      iso3: meta.iso3,
      score,
      sourceCount,
      uncertaintyCount: bounded,
      scarcityDelta: score !== null && scarce !== null ? scarce - score : null,
      groups: {
        region: meta.region,
        income: String(income.get(meta.iso3) ?? "missing"),
        regime: meta.regime ?? "unknown",
        media_environment: mediaBands.get(meta.iso3) ?? "missing",
        small_state: meta.population < 1_500_000 ? "small_under_1.5m" : "other",
        disputed_status: meta.disputed ? "disputed" : "not_disputed",
        data_availability: availabilityBands.get(meta.iso3) ?? "missing",
        source_count: `sources_${sourceCount}`,
      },
    };
  });
  const families = [
    "region",
    "income",
    "regime",
    "media_environment",
    "small_state",
    "disputed_status",
    "data_availability",
    "source_count",
  ];
  const published = profiles.filter((row) => row.score !== null);
  const scarcityPairs = published.map((row) => ({ x: row.sourceCount, y: row.score! }));
  const completeDeltas = profiles.flatMap((row) =>
    row.scarcityDelta === null ? [] : [row.scarcityDelta],
  );
  const mechanicalFailure =
    median(completeDeltas) < -1 ||
    completeDeltas.filter((value) => value < 0).length / completeDeltas.length > 0.6;
  const payload = {
    schemaVersion: "civica-index-subgroup-fairness-result/v1",
    releaseId: RELEASE_ID,
    protectedInputSha256,
    panelReleaseId: CI_TOURNAMENT_PANEL_V3_RELEASE_ID,
    classificationReleaseId: classificationRelease.releaseId,
    scope: {
      eligibleSovereignStates: profiles.length,
      published: published.length,
      withheld: profiles.length - published.length,
    },
    definitions: {
      smallState: "protected frozen population below 1,500,000",
      mediaEnvironment: "terciles of protected frozen 2024 V-Dem expression-practice measure; missing retained",
      dataAvailability: "terciles of protected frozen observed 2024 panel source rows; missing is not zero",
      sourceCount: "number of selected 2024 K1 dimensions",
      minimumPerformanceN: 30,
    },
    subgroupFamilies: Object.fromEntries(
      families.map((family) => [family, summarizeSubgroups(profiles, family)]),
    ),
    evidenceScarcity: {
      scoreSourceCountSpearman: spearman(scarcityPairs),
      completeCaseMaskN: completeDeltas.length,
      maskedOptionalCpiMedianDelta: median(completeDeltas),
      maskedOptionalCpiNegativeShare:
        completeDeltas.filter((value) => value < 0).length / completeDeltas.length,
      failureRule:
        "fail if median masked-minus-full score is below -1 or more than 60% of complete profiles move downward",
      failsMechanicalScarcityGate: mechanicalFailure,
      interpretation:
        "association between coverage and score is descriptive; the mask test isolates the scoring mechanism",
    },
    uncertainty: {
      meaning: "count of inputs with publisher bounds, not a composite confidence interval",
      freedomHouseBoundStatus: "absent",
      performanceBySubgroup:
        "not_estimable_without_external_country-quality_truth; descriptive publication, score, bound, and mask results reported",
    },
    exclusions: {
      disputedSovereignRows: profiles.filter((row) => row.groups.disputed_status === "disputed").length,
      outOfScopeTerritoriesNotAdded: true,
      imputation: "none",
    },
  };
  return { ...payload, resultSha256: researchPanelHash(payload) };
}

export function buildIndexSubgroupFairness() {
  const manifest = releaseManifest();
  const inputs = readProtectedSubgroupFairnessInputs(manifest.protectedInput.contentSha256);
  return buildIndexSubgroupFairnessFromInputs(inputs, manifest.protectedInput.contentSha256);
}

async function captureLiveSubgroupFairnessInputs(): Promise<SubgroupFairnessInputs> {
  config({ path: ".env.local" });
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL required for --capture-live-inputs");
  const sql = neon(process.env.DATABASE_URL);
  const [panel, uncertainty, media, metadata] = await Promise.all([
    sql`SELECT j.iso3,p.dimension,p.source_id AS "sourceId",p.indicator_id AS "indicatorId",p.value,p.native_min AS "nativeMin",p.native_max AS "nativeMax",p.is_inverted AS "isInverted" FROM ci_research_panel_rows p JOIN jurisdictions j ON j.id=p.jurisdiction_id WHERE p.release_id=${CI_TOURNAMENT_PANEL_V3_RELEASE_ID} AND p.period_year=2024 ORDER BY j.iso3,p.source_id,p.indicator_id` as unknown as Promise<SubgroupFairnessPanelRow[]>,
    sql`SELECT j.iso3,p.dimension,p.uncertainty_lower AS lower,p.uncertainty_upper AS upper FROM ci_research_panel_rows p JOIN jurisdictions j ON j.id=p.jurisdiction_id WHERE p.release_id=${K1_UNCERTAINTY_INPUT_RELEASE_ID} ORDER BY j.iso3,p.dimension` as unknown as Promise<SubgroupFairnessUncertaintyRow[]>,
    sql`SELECT j.iso3,p.value FROM ci_research_panel_rows p JOIN jurisdictions j ON j.id=p.jurisdiction_id WHERE p.release_id=${K4_PRACTICE_PANEL_RELEASE_ID} AND p.period_year=2024 AND p.indicator_id='v2x_freexp_altinf' AND p.value IS NOT NULL ORDER BY j.iso3` as unknown as Promise<SubgroupFairnessMediaRow[]>,
    sql`SELECT j.iso3,j.continent AS region,j.population,j.status_disputed AS disputed,gt.regime_type_cgv AS regime FROM jurisdictions j LEFT JOIN LATERAL(SELECT regime_type_cgv FROM government_taxonomies g WHERE g.jurisdiction_id=j.id ORDER BY g.regime_year DESC NULLS LAST,g.updated_at DESC NULLS LAST LIMIT 1)gt ON true WHERE j.type='sovereign_state' AND j.iso3 IS NOT NULL ORDER BY j.iso3` as unknown as Promise<SubgroupFairnessMetadataRow[]>,
  ]);
  return normalizeSubgroupFairnessInputs({
    schemaVersion: "civica-index-subgroup-fairness-inputs/v1",
    panel: panel.map((row) => ({
      ...row,
      value: row.value === null ? null : Number(row.value),
      nativeMin: Number(row.nativeMin),
      nativeMax: Number(row.nativeMax),
      isInverted: Boolean(row.isInverted),
    })),
    uncertainty: uncertainty.map((row) => ({
      ...row,
      lower: row.lower === null ? null : Number(row.lower),
      upper: row.upper === null ? null : Number(row.upper),
    })),
    media: media.map((row) => ({ ...row, value: Number(row.value) })),
    metadata: metadata.map((row) => ({
      ...row,
      population: Number(row.population),
      disputed: Boolean(row.disputed),
    })),
  });
}

if (process.argv[1]?.endsWith("generate-index-subgroup-fairness.ts")) {
  if (CAPTURE_LIVE_INPUTS) {
    captureLiveSubgroupFairnessInputs()
      .then((inputs) => retainProtectedSubgroupFairnessInputs(inputs))
      .then(({ contentSha256, path }) => console.log(`Retained ${contentSha256} at ${path}`))
      .catch((error) => {
        console.error(error);
        process.exit(1);
      });
  } else {
    try {
      const result = buildIndexSubgroupFairness();
      mkdirSync(RELEASE_DIRECTORY, { recursive: true });
      writeFileSync(`${RELEASE_DIRECTORY}/result.v1.json`, `${JSON.stringify(result, null, 2)}\n`);
      console.log(`Wrote ${result.resultSha256}`);
    } catch (error) {
      console.error(error);
      process.exit(1);
    }
  }
}
