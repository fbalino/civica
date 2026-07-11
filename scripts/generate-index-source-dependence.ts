import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { K1_SOURCE_ECOSYSTEM_MAP, sourceEcosystemHash } from "../src/lib/ci/source-ecosystem-dependence";

type SensitivityComparison = {
  id: string;
  common: number;
  coverage: number;
  rankSpearman: number;
  medianAbsoluteRankShift: number;
  p95AbsoluteRankShift: number;
  maxAbsoluteRankShift: number;
  topDecileJaccard: number;
};

export function buildIndexSourceDependenceResult() {
  const sensitivity = JSON.parse(readFileSync("data/releases/index-sensitivity-analysis-v1/result.v1.json", "utf8"));
  const dimensionality = JSON.parse(readFileSync("data/releases/index-dimensionality-analysis-v1/result.v1.json", "utf8"));
  const incremental = JSON.parse(readFileSync("data/releases/index-incremental-information-v1/result.v1.json", "utf8"));
  const ids = ["drop_democratic_quality", "drop_rule_of_law", "drop_freedom_rights", "drop_corruption_control"];
  const leaveOnePublisherOut = ids.map((id) => {
    const row = sensitivity.comparisons.find((item: SensitivityComparison) => item.id === id);
    if (!row) throw new Error(`Missing sensitivity result ${id}`);
    return row;
  });
  const level = dimensionality.pooled;
  const payload = {
    schemaVersion: "civica-index-source-dependence-result/v1",
    releaseId: "index-source-dependence-v1",
    panelReleaseId: sensitivity.panelReleaseId,
    ecosystemMap: K1_SOURCE_ECOSYSTEM_MAP,
    publisherLayer: {
      nominalPublisherCount: 4,
      civicaObservedInputCount: 0,
      leaveOnePublisherOut,
      interpretation: "Removing one published input changes some ranks substantially, but does not create independent Civica information in the remaining derivative score.",
    },
    upstreamLayer: {
      sharedFamilies: ["vdem", "freedom_house", "eiu", "bertelsmann"],
      leaveOneFamilyOut: "not_identifiable_from_published_aggregates",
      reason: K1_SOURCE_ECOSYSTEM_MAP.deletionLimit,
      safeInference: "The four publisher labels are an upper bound, not a count of independent evidence streams.",
    },
    similarityDecomposition: {
      completePanelN: level.n,
      pairwiseInputCorrelation: level.correlation,
      firstComponentExplainedVariance: level.explainedVariance[0],
      firstComponentLoadings: level.pc1Loadings,
      publicInputReconstructionR2: incremental.originality.publicInputModelR2,
      originalityThreshold: incremental.originality.threshold,
      passesOriginality: incremental.originality.passes,
      deterministicInputShare: 1,
      civicaObservationShare: 0,
      interpretation: "The score is a deterministic transform of four public inputs; a linear model reconstructs it almost exactly and a single common level factor explains most complete-panel variance.",
    },
    claimRules: {
      independentCorroborationAllowed: false,
      allowedDescription: "a Civica transformation of overlapping third-party governance assessments",
      prohibitedDescriptions: ["four independent sources", "independent corroboration", "original country measurement"],
    },
    limitations: [
      "Shared source names prove overlap, but do not reveal country-level coder overlap or the covariance attributable to each upstream source.",
      "WGI and CPI would need publisher-side recomputation to estimate true leave-one-upstream-family-out effects.",
      "High correlations alone do not prove shared errors; the deterministic construction and documented source reuse establish the narrower dependence claim.",
    ],
  };
  return { ...payload, resultSha256: sourceEcosystemHash(payload) };
}

if (process.argv[1]?.endsWith("generate-index-source-dependence.ts")) {
  const result = buildIndexSourceDependenceResult();
  const directory = "data/releases/index-source-dependence-v1";
  mkdirSync(directory, { recursive: true });
  writeFileSync(`${directory}/result.v1.json`, `${JSON.stringify(result, null, 2)}\n`);
  console.log(`Wrote ${directory}/result.v1.json (${result.resultSha256})`);
}
