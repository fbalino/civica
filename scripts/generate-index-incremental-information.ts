import { mkdirSync, writeFileSync } from "node:fs";
import {
  runAllTournamentBaselines,
  type BaselinePanelObservation,
} from "../src/lib/ci/tournament-baselines";
import {
  runK1TournamentCandidate,
  type K1PanelInput,
} from "../src/lib/ci/tournament-candidate-k1";
import {
  CI_TOURNAMENT_PANEL_V3_RELEASE_ID,
  researchPanelHash,
} from "../src/lib/ci/research-panel";
import {
  fitOls,
  fitScalar,
  predictOls,
  predictionBootstrap,
  predictionMetrics,
  type PredictionRow,
} from "../src/lib/ci/incremental-information-analysis";
import {
  INCREMENTAL_INFORMATION_PREREGISTRATION,
  INCREMENTAL_INFORMATION_PROTOCOL_VERSION,
} from "../src/lib/ci/incremental-information-preregistration";
import { readIndexAnalysisReplayInputs } from "../src/lib/ci/index-analysis-inputs";
type Panel = BaselinePanelObservation & { dimension: string };
const key = (r: { iso3: string; periodYear: number }) =>
  `${r.iso3}:${r.periodYear}`;
export async function buildIncrementalInformationAnalysis() {
  const rows = readIndexAnalysisReplayInputs().panel.filter((row) =>
    [
      "vdem:v2x_libdem",
      "worldbank_wgi:va.est",
      "worldbank_wgi:rl.est",
      "freedom_house:pr_cl_total",
      "transparency_intl:score",
    ].includes(`${row.sourceId}:${row.indicatorId}`),
  ) as Panel[];
  const normalized = rows.map((r) => ({
    ...r,
    value: r.value === null ? null : Number(r.value),
    nativeMin: Number(r.nativeMin),
    nativeMax: Number(r.nativeMax),
  }));
  const k1 = runK1TournamentCandidate(normalized as K1PanelInput[]);
  const baseline = runAllTournamentBaselines(normalized);
  const maps = Object.fromEntries(
    Object.entries(baseline.outputs).map(([id, out]) => [
      id,
      new Map(out.map((r) => [r.unitId, r])),
    ]),
  ) as Record<string, Map<string, any>>;
  const k1map = new Map(k1.map((r) => [r.unitId, r]));
  const groups = new Map<string, Panel[]>();
  for (const r of normalized)
    groups.set(key(r), [...(groups.get(key(r)) ?? []), r]);
  const features = new Map<string, number[]>();
  for (const [k, g] of groups) {
    const ids = new Map(g.map((r) => [`${r.sourceId}:${r.indicatorId}`, r]));
    const d =
      ids.get("vdem:v2x_libdem")?.value !== null &&
      ids.get("vdem:v2x_libdem")?.value !== undefined
        ? ids.get("vdem:v2x_libdem")
        : ids.get("worldbank_wgi:va.est");
    const selected = [
      d,
      ids.get("worldbank_wgi:rl.est"),
      ids.get("freedom_house:pr_cl_total"),
      ids.get("transparency_intl:score"),
    ];
    if (selected.every((r) => r?.value !== null && r?.value !== undefined))
      features.set(
        k,
        selected.map((r) => {
          const v = (r!.value! - r!.nativeMin) / (r!.nativeMax - r!.nativeMin);
          return r!.isInverted ? 100 * (1 - v) : 100 * v;
        }),
      );
  }
  const development = k1.filter(
    (r) =>
      r.split === "development" &&
      r.completeness === "full" &&
      features.has(r.unitId) &&
      ["B1", "B2", "B3"].every((id) => maps[id].has(r.unitId)),
  );
  const final = k1.filter(
    (r) =>
      r.split === "final_holdout" &&
      r.completeness === "full" &&
      features.has(r.unitId) &&
      ["B1", "B2", "B3"].every((id) => maps[id].has(r.unitId)),
  );
  const scalar = Object.fromEntries(
    ["B1", "B2", "B3"].map((id) => [
      id,
      fitScalar(
        development.map((r) => ({
          target: r.scoreInteger,
          value: maps[id].get(r.unitId).value,
        })),
      ),
    ]),
  );
  const ols = fitOls(
    development.map((r) => ({
      target: r.scoreInteger,
      features: features.get(r.unitId)!,
    })),
  );
  const predictions = (id: string): PredictionRow[] =>
    final.map((r) => ({
      iso3: r.iso3,
      year: r.periodYear,
      actual: r.scoreInteger,
      predicted:
        id === "P1"
          ? predictOls(ols, features.get(r.unitId)!)
          : scalar[id].intercept +
            scalar[id].slope * maps[id].get(r.unitId).value,
    }));
  const models = ["B1", "B2", "B3", "P1"].map((id) => {
    const p = predictions(id);
    return {
      id,
      fit: id === "P1" ? { coefficients: ols } : { ...scalar[id] },
      metrics: predictionMetrics(p),
      intervals: predictionBootstrap(p, id),
      predictionSha256: researchPanelHash(p),
    };
  });
  const b1 = models.find((m) => m.id === "B1")!;
  const result = {
    schemaVersion: "civica-index-incremental-information-result/v1",
    releaseId: "index-incremental-information-v1",
    protocolVersion: INCREMENTAL_INFORMATION_PROTOCOL_VERSION,
    panelReleaseId: CI_TOURNAMENT_PANEL_V3_RELEASE_ID,
    samples: {
      development: development.length,
      finalHoldout: final.length,
      jurisdictions: new Set(final.map((r) => r.iso3)).size,
    },
    models: models.map((m) => ({
      ...m,
      deltaR2VsB1: m.metrics.r2 - b1.metrics.r2,
    })),
    originality: {
      threshold: 0.9,
      publicInputModelR2: models.find((m) => m.id === "P1")!.metrics.r2,
      passes: models.find((m) => m.id === "P1")!.metrics.r2 < 0.9,
    },
    decisionUtility: "not_tested_requires_preregistered_human_tasks",
    otherCandidates: INCREMENTAL_INFORMATION_PREREGISTRATION.otherCandidates,
    noGovernanceOutcomePredicted: true,
  };
  return { ...result, resultSha256: researchPanelHash(result) };
}
async function main() {
  const result = await buildIncrementalInformationAnalysis();
  const dir = "data/releases/index-incremental-information-v1";
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    `${dir}/result.v1.json`,
    `${JSON.stringify(result, null, 2)}\n`,
  );
  console.log(
    JSON.stringify(
      {
        resultSha256: result.resultSha256,
        samples: result.samples,
        models: result.models.map((m) => ({
          id: m.id,
          ...m.metrics,
          deltaR2VsB1: m.deltaR2VsB1,
        })),
        originality: result.originality,
      },
      null,
      2,
    ),
  );
}
if (process.argv[1]?.endsWith("generate-index-incremental-information.ts"))
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
