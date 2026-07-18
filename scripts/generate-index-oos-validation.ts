import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import {
  researchPanelHash,
} from "../src/lib/ci/research-panel";
import {
  K2_RATERS,
  runK2Concordance,
  type K2PanelInput,
} from "../src/lib/ci/tournament-candidate-k2";
import {
  geographicTournamentBucket,
  INDEX_TOURNAMENT_PREREGISTRATION,
} from "../src/lib/ci/tournament-preregistration";
import {
  clusterInterval,
  type LongitudinalDatum,
  quantile,
} from "../src/lib/ci/longitudinal-analysis";
import { readIndexAnalysisReplayInputs } from "../src/lib/ci/index-analysis-inputs";
const read = (p: string) => JSON.parse(readFileSync(p, "utf8"));
export async function buildIndexOosValidation() {
  const baseline = read("data/releases/ci-index-baselines-v3/manifest.v3.json"),
    k1 = read(
      "data/releases/k1-current-composite-tournament-v1/manifest.v1.json",
    ),
    incremental = read(
      "data/releases/index-incremental-information-v1/result.v1.json",
    ),
    k3 = read(
      "data/releases/k3-power-transfer-ledger-prototype-v1/manifest.v1.json",
    ),
    k4 = read(
      "data/releases/k4-constitution-practice-pairings-2024-v1/manifest.v1.json",
    ),
    k5 = read(
      "data/releases/k5-institutional-relation-candidates-v1/manifest.v1.json",
    );
  const replayInputs = readIndexAnalysisReplayInputs();
  const rows = replayInputs.panel.filter((row) =>
    K2_RATERS.includes(`${row.sourceId}:${row.indicatorId}` as (typeof K2_RATERS)[number]),
  ) as K2PanelInput[];
  const outputs = runK2Concordance(
    rows.map((r) => ({
      ...r,
      value: r.value === null ? null : Number(r.value),
      nativeMin: Number(r.nativeMin),
      nativeMax: Number(r.nativeMax),
    })),
  );
  const dev = outputs.filter((r) => r.split === "development"),
    final = outputs.filter((r) => r.split === "final_holdout");
  const thresholds = [
    quantile(
      dev.map((r) => r.spreadRange),
      1 / 3,
    ),
    quantile(
      dev.map((r) => r.spreadRange),
      2 / 3,
    ),
  ];
  const tercile = (v: number) =>
    v <= thresholds[0] ? 0 : v <= thresholds[1] ? 1 : 2;
  const stability: LongitudinalDatum[] = final.map((r) => {
    const values = r.placements.map((p) => p.percentile),
      full = tercile(r.spreadRange),
      leave = values.map((_, i) => {
        const kept = values.filter((__, j) => i !== j);
        return Math.max(...kept) - Math.min(...kept);
      });
    return {
      iso3: r.iso3,
      value: leave.some((v) => tercile(v) !== full) ? 1 : 0,
    };
  });
  const changeRate =
    stability.reduce((s, r) => s + r.value, 0) / stability.length;
  const spine = replayInputs.metadata;
  const geoFinal = spine.filter(
    (r) => geographicTournamentBucket(r.iso3) === 9,
  );
  const counts = (field: "region" | "regime") =>
    [...new Set(geoFinal.map((r) => r[field] ?? "unknown"))]
      .sort()
      .map((group) => ({
        group,
        n: geoFinal.filter((r) => (r[field] ?? "unknown") === group).length,
        performanceEstimateAllowed:
          geoFinal.filter((r) => (r[field] ?? "unknown") === group).length >=
          30,
      }));
  const result = {
    schemaVersion: "civica-index-oos-validation/v1",
    releaseId: "index-oos-validation-v1",
    protocolVersion: INDEX_TOURNAMENT_PREREGISTRATION.protocolVersion,
    splitContract: INDEX_TOURNAMENT_PREREGISTRATION.splits,
    openedAfterCandidateFreezeCommit: "4e15744",
    artifacts: {
      K0: {
        splitCounts: baseline.baselines.B0.coverage,
        status: "reference_coverage_only",
      },
      K1: {
        splitCounts: k1.outputs.bySplit,
        finalCommonSample: incremental.samples.finalHoldout,
        publicInputReproductionR2: incremental.originality.publicInputModelR2,
        interval: incremental.models.find((m: any) => m.id === "P1").intervals
          .r2,
        status: "fails_original_information",
      },
      K2: {
        splitCounts: {
          development: outputs.filter((r) => r.split === "development").length,
          validation: outputs.filter((r) => r.split === "validation").length,
          final_holdout: final.length,
        },
        finalDropOneTercileChangeRate: changeRate,
        interval: clusterInterval(
          stability,
          (r) => r.reduce((s, x) => s + x.value, 0) / r.length,
          "k2-oos-stability",
        ),
        threshold: 0.15,
        status: changeRate <= 0.15 ? "passes_stability" : "fails_stability",
      },
      K3: { splitCounts: k3.bySplit, status: "insufficient_external_labels" },
      K4: { splitCounts: k4.bySplit, status: "insufficient_blinded_labels" },
      K5: {
        splitCounts: Object.fromEntries(
          k5.bySplit.map((r: any) => [r.split, r.candidates]),
        ),
        status: "insufficient_adjudicated_labels",
      },
    },
    geographicFinalHoldout: {
      jurisdictions: geoFinal.length,
      byRegion: counts("region"),
      byRegime: counts("regime"),
      minimumSubgroupN: 30,
    },
    temporalFinalHoldout: {
      years: INDEX_TOURNAMENT_PREREGISTRATION.splits.temporal.finalHoldout,
    },
    uncertaintyPolicy:
      "K1 and K2 report cluster intervals; candidates without labels report insufficiency rather than an interval",
    winnerSelected: false,
  };
  return { ...result, resultSha256: researchPanelHash(result) };
}
async function main() {
  const r = await buildIndexOosValidation();
  const dir = "data/releases/index-oos-validation-v1";
  mkdirSync(dir, { recursive: true });
  writeFileSync(`${dir}/result.v1.json`, `${JSON.stringify(r, null, 2)}\n`);
  console.log(
    JSON.stringify(
      {
        resultSha256: r.resultSha256,
        K1: r.artifacts.K1,
        K2: r.artifacts.K2,
        geographic: r.geographicFinalHoldout,
      },
      null,
      2,
    ),
  );
}
if (process.argv[1]?.endsWith("generate-index-oos-validation.ts"))
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
