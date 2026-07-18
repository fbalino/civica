import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import {
  CI_TOURNAMENT_PANEL_V3_RELEASE_ID,
  K1_UNCERTAINTY_INPUT_RELEASE_ID,
  researchPanelHash,
} from "../src/lib/ci/research-panel";
import {
  compareSensitivity,
  averageRankPercentiles,
  type SensitivityScore,
} from "../src/lib/ci/sensitivity-analysis";
import { V2_WEIGHTS } from "../src/lib/ci/dimensions-v2";
import { median, quantile } from "../src/lib/ci/longitudinal-analysis";
import { readIndexAnalysisReplayInputs } from "../src/lib/ci/index-analysis-inputs";
const features = [
    "democratic_quality",
    "rule_of_law",
    "freedom_rights",
    "corruption_control",
  ] as const;
type Feature = (typeof features)[number];
type Row = {
  iso3: string;
  dimension: Feature;
  sourceId: string;
  indicatorId: string;
  value: number | null;
  nativeMin: number;
  nativeMax: number;
  isInverted: boolean;
  lower: number | null;
  upper: number | null;
};
type Profile = {
  iso3: string;
  values: Partial<Record<Feature, number>>;
  exact: Partial<Record<Feature, number>>;
  bounds: Partial<Record<Feature, { low: number; high: number }>>;
  wgiVa: number | null;
};
const norm = (r: Row, v: number) => {
    const x = (v - r.nativeMin) / (r.nativeMax - r.nativeMin);
    return (r.isInverted ? 1 - x : x) * 100;
  },
  weights = V2_WEIGHTS as Record<Feature, number>,
  score = (
    p: Profile,
    w: Record<string, number>,
    mode: "mean" | "median" = "mean",
  ) => {
    const present = features.filter(
      (f) => p.values[f] !== undefined && w[f] !== 0,
    );
    if (
      !present.includes("democratic_quality") ||
      !present.includes("rule_of_law") ||
      present.length < 3
    )
      return null;
    const vals = present.map((f) => p.values[f]!);
    if (mode === "median") {
      const ordered = [...vals].sort((a, b) => a - b);
      const middle = Math.floor(ordered.length / 2);
      return Math.round(
        ordered.length % 2
          ? ordered[middle]
          : (ordered[middle - 1] + ordered[middle]) / 2,
      );
    }
    const total = present.reduce((s, f) => s + w[f], 0);
    return Math.round(
      present.reduce((s, f) => s + (p.values[f]! * w[f]) / total, 0),
    );
  };
export async function buildIndexSensitivityAnalysis() {
  const replayInputs = readIndexAnalysisReplayInputs();
  const selected = new Set([
    "vdem:v2x_libdem",
    "worldbank_wgi:va.est",
    "worldbank_wgi:rl.est",
    "freedom_house:pr_cl_total",
    "transparency_intl:score",
  ]);
  const panel = replayInputs.panel
    .filter(
      (row) =>
        row.periodYear === 2024 && selected.has(`${row.sourceId}:${row.indicatorId}`),
    )
    .map((row) => ({ ...row, lower: null, upper: null })) as Row[];
  const uncertainty = replayInputs.uncertainty as Row[];
  const uMap = new Map(
    uncertainty.map((r) => [`${r.iso3}:${r.sourceId}:${r.indicatorId}`, r]),
  );
  const profiles: Profile[] = [...new Set(panel.map((r) => r.iso3))]
    .sort()
    .map((iso3) => {
      const rows = panel.filter((r) => r.iso3 === iso3),
        values: Partial<Record<Feature, number>> = {},
        exact: Partial<Record<Feature, number>> = {},
        bounds: Partial<Record<Feature, { low: number; high: number }>> = {};
      const by = new Map(
        rows.map((r) => [`${r.sourceId}:${r.indicatorId}`, r]),
      );
      const selected = [
        by.get("vdem:v2x_libdem")?.value !== null &&
        by.get("vdem:v2x_libdem")?.value !== undefined
          ? by.get("vdem:v2x_libdem")
          : by.get("worldbank_wgi:va.est"),
        by.get("worldbank_wgi:rl.est"),
        by.get("freedom_house:pr_cl_total"),
        by.get("transparency_intl:score"),
      ];
      for (const r of selected)
        if (r?.value !== null && r?.value !== undefined) {
          values[r.dimension] = norm(r, Number(r.value));
          const u = uMap.get(`${iso3}:${r.sourceId}:${r.indicatorId}`);
          if (u?.value !== null && u?.value !== undefined) {
            exact[r.dimension] = norm(u, Number(u.value));
            if (u.lower !== null && u.upper !== null)
              bounds[r.dimension] = {
                low: norm(u, Number(u.lower)),
                high: norm(u, Number(u.upper)),
              };
          }
        }
      const va = by.get("worldbank_wgi:va.est");
      return {
        iso3,
        values,
        exact,
        bounds,
        wgiVa:
          va?.value === null || va?.value === undefined
            ? null
            : norm(va, Number(va.value)),
      };
    });
  const base = profiles.flatMap((p) => {
    const s = score(p, weights);
    return s === null ? [] : [{ iso3: p.iso3, score: s }];
  });
  const variants: {
    id: string;
    category: string;
    rows: SensitivityScore[];
    note: string;
  }[] = [];
  const add = (
    id: string,
    category: string,
    fn: (p: Profile) => number | null,
    note: string,
  ) =>
    variants.push({
      id,
      category,
      rows: profiles.flatMap((p) => {
        const s = fn(p);
        return s === null ? [] : [{ iso3: p.iso3, score: s }];
      }),
      note,
    });
  add(
    "equal_weights",
    "weights",
    (p) => score(p, Object.fromEntries(features.map((f) => [f, 0.25]))),
    "equal weights",
  );
  const dim = JSON.parse(
      readFileSync(
        "data/releases/index-dimensionality-analysis-v1/result.v1.json",
        "utf8",
      ),
    ),
    sq = dim.pooled.pc1Loadings.map((x: number) => x * x),
    sum = sq.reduce((a: number, b: number) => a + b, 0),
    pcaW = Object.fromEntries(features.map((f, i) => [f, sq[i] / sum]));
  add(
    "full_panel_pca_weights",
    "weights",
    (p) => score(p, pcaW),
    "squared pooled PC1 loadings",
  );
  for (const dropped of features)
    add(
      `drop_${dropped}`,
      "indicator_inclusion",
      (p) => {
        const retained = features.filter((f) => f !== dropped);
        if (!retained.every((f) => p.values[f] !== undefined)) return null;
        const total = retained.reduce((sum, f) => sum + weights[f], 0);
        return Math.round(
          retained.reduce(
            (sum, f) => sum + (p.values[f]! * weights[f]) / total,
            0,
          ),
        );
      },
      `leave out ${dropped}`,
    );
  add(
    "wgi_va_for_all",
    "source_substitution",
    (p) => {
      const q = {
        ...p,
        values: { ...p.values, democratic_quality: p.wgiVa ?? undefined },
      };
      return score(q, weights);
    },
    "substitute WGI Voice for V-Dem whenever WGI is observed",
  );
  add(
    "exact_publisher_points",
    "source_substitution",
    (p) => score({ ...p, values: { ...p.values, ...p.exact } }, weights),
    "replace republisher points with exact publisher points where captured",
  );
  const complete = profiles.filter((p) =>
    features.every((f) => p.values[f] !== undefined),
  );
  const percentiles = Object.fromEntries(
    features.map((f) => [
      f,
      averageRankPercentiles(
        profiles
          .filter((p) => p.values[f] !== undefined)
          .map((p) => ({ iso3: p.iso3, value: p.values[f]! })),
      ),
    ]),
  ) as Record<Feature, Map<string, number>>;
  add(
    "within_year_percentiles",
    "normalization",
    (p) =>
      score(
        {
          ...p,
          values: Object.fromEntries(
            features.flatMap((f) => {
              const value = percentiles[f].get(p.iso3);
              return value === undefined ? [] : [[f, value]];
            }),
          ),
        },
        weights,
      ),
    "within-year average-rank percentile normalization",
  );
  add(
    "median_aggregation",
    "aggregation",
    (p) => score(p, weights, "median"),
    "unweighted median of four normalized inputs",
  );
  const cuts = Object.fromEntries(
    features.map((f) => [
      f,
      {
        lo: quantile(
          complete.map((p) => p.values[f]!),
          0.05,
        ),
        hi: quantile(
          complete.map((p) => p.values[f]!),
          0.95,
        ),
      },
    ]),
  ) as Record<Feature, { lo: number; hi: number }>;
  add(
    "winsor_5_95",
    "outliers",
    (p) =>
      score(
        {
          ...p,
          values: Object.fromEntries(
            features.flatMap((f) =>
              p.values[f] === undefined
                ? []
                : [
                    [
                      f,
                      Math.max(cuts[f].lo, Math.min(cuts[f].hi, p.values[f]!)),
                    ],
                  ],
            ),
          ),
        },
        weights,
      ),
    "within-year 5th/95th percentile winsorization",
  );
  add(
    "complete_case_only",
    "missingness",
    (p) =>
      features.every((f) => p.values[f] !== undefined)
        ? score(p, weights)
        : null,
    "withhold every partial profile",
  );
  add(
    "mandatory_two_allowed",
    "missingness",
    (p) => {
      const present = features.filter((f) => p.values[f] !== undefined);
      if (
        !present.includes("democratic_quality") ||
        !present.includes("rule_of_law")
      )
        return null;
      const total = present.reduce((s, f) => s + weights[f], 0);
      return Math.round(
        present.reduce((s, f) => s + (p.values[f]! * weights[f]) / total, 0),
      );
    },
    "permit mandatory two-dimension estimates; no imputation",
  );
  const featureMedians = Object.fromEntries(
    features.map((f) => [f, median(complete.map((p) => p.values[f]!))]),
  ) as Record<Feature, number>;
  add(
    "median_imputation",
    "imputation",
    (p) =>
      score(
        {
          ...p,
          values: Object.fromEntries(
            features.map((f) => [f, p.values[f] ?? featureMedians[f]]),
          ),
        },
        weights,
      ),
    "exploratory within-year median imputation; prohibited for production",
  );
  const comparisons = variants.map((v) => ({
    id: v.id,
    category: v.category,
    note: v.note,
    ...compareSensitivity(base, v.rows),
  }));
  const boundProfiles = profiles.filter(
    (p) =>
      features.every((f) => p.exact[f] !== undefined) &&
      ["democratic_quality", "rule_of_law", "corruption_control"].every(
        (f) => p.bounds[f as Feature] !== undefined,
      ),
  );
  const scenario = (kind: "lower" | "upper" | "alternating") =>
    boundProfiles.map((p) => {
      const values = { ...p.exact };
      for (const f of [
        "democratic_quality",
        "rule_of_law",
        "corruption_control",
      ] as Feature[]) {
        const b = p.bounds[f]!;
        values[f] =
          kind === "lower"
            ? b.low
            : kind === "upper"
              ? b.high
              : f === "rule_of_law"
                ? b.high
                : b.low;
      }
      return { iso3: p.iso3, score: score({ ...p, values }, weights)! };
    });
  const exactBase = boundProfiles.map((p) => ({
      iso3: p.iso3,
      score: score({ ...p, values: p.exact }, weights)!,
    })),
    uncertaintyScenarios = ["lower", "upper", "alternating"].map((kind) => ({
      id: kind,
      interpretation:
        kind === "alternating"
          ? "counter-direction dependence stress"
          : "perfect same-direction bound stress",
      ...compareSensitivity(exactBase, scenario(kind as any)),
    }));
  const longitudinal = JSON.parse(
    readFileSync(
      "data/releases/index-longitudinal-analysis-v1/result.v1.json",
      "utf8",
    ),
  );
  const dominant = [...comparisons]
    .filter(
      (row) =>
        Number.isFinite(row.rankSpearman) &&
        Number.isFinite(row.p95AbsoluteRankShift),
    )
    .sort(
      (a, b) =>
        a.rankSpearman - b.rankSpearman ||
        b.p95AbsoluteRankShift - a.p95AbsoluteRankShift,
    )
    .slice(0, 5)
    .map((r) => ({
      id: r.id,
      category: r.category,
      rankSpearman: r.rankSpearman,
      p95AbsoluteRankShift: r.p95AbsoluteRankShift,
      coverage: r.coverage,
    }));
  const result = {
    schemaVersion: "civica-index-sensitivity-result/v1",
    releaseId: "index-sensitivity-analysis-v1",
    panelReleaseId: CI_TOURNAMENT_PANEL_V3_RELEASE_ID,
    uncertaintyReleaseId: K1_UNCERTAINTY_INPUT_RELEASE_ID,
    referenceYear: 2024,
    base: { coverage: base.length, hash: researchPanelHash(base) },
    comparisons,
    uncertainty: {
      eligibleCountries: boundProfiles.length,
      scenarios: uncertaintyScenarios,
      freedomHouseTreatment:
        "point held fixed because no per-country probability distribution is published",
      covarianceInterpretation:
        "bound stress under same-direction and counter-direction dependence; not a calibrated probability interval",
    },
    vintage: {
      vdemV14V15: longitudinal.revision.vdem,
      qogLabelEditions: longitudinal.revision.qog,
    },
    temporalAndGeographic: {
      source: "index-oos-validation-v1",
      note: "frozen joint folds evaluated separately; no post-result fold changes",
    },
    dominantChoices: dominant,
    noImputation: true,
    noConfidenceIntervalClaim: true,
  };
  return { ...result, resultSha256: researchPanelHash(result) };
}
async function main() {
  const r = await buildIndexSensitivityAnalysis();
  const dir = "data/releases/index-sensitivity-analysis-v1";
  mkdirSync(dir, { recursive: true });
  writeFileSync(`${dir}/result.v1.json`, `${JSON.stringify(r, null, 2)}\n`);
  console.log(
    JSON.stringify(
      {
        resultSha256: r.resultSha256,
        base: r.base,
        dominantChoices: r.dominantChoices,
        uncertainty: r.uncertainty,
        vintage: r.vintage,
      },
      null,
      2,
    ),
  );
}
if (process.argv[1]?.endsWith("generate-index-sensitivity-analysis.ts"))
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
