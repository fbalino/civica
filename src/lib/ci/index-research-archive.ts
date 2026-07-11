import { createHash } from "node:crypto";

export const INDEX_RESEARCH_ARCHIVE = Object.freeze({
  schemaVersion: "civica-index-research-archive/v1",
  releaseId: "civica-index-research-archive-2026-07-v1",
  sourceCommit: "577dca29d816a0c781281ba843ad577e326e3d67",
  codeSnapshotPath:
    "data/releases/civica-index-research-archive-2026-07-v1/code-snapshot.v1.tar.gz",
  candidates: [
    {
      id: "K1",
      standing: "failed_current_candidate_preserved_not_recommended",
      artifactIds: ["k1", "out-of-sample", "sensitivity", "source-dependence", "subgroup-fairness", "misuse-audit"],
      failureThresholdIds: ["K1-originality"],
      insufficientThresholdIds: ["K1-utility", "K1-subgroup-gap"],
      reason: "Original-measurement claim rejected; bounded derivative utility unresolved; current league-table presentation failed misuse audit.",
    },
    {
      id: "K2",
      standing: "failed_current_candidate_preserved_not_recommended",
      artifactIds: ["k2", "out-of-sample", "source-dependence"],
      failureThresholdIds: ["K2-drop-one"],
      insufficientThresholdIds: ["K2-expert-auc"],
      reason: "The current concordance candidate fails the frozen drop-one-rater stability threshold.",
    },
    {
      id: "K3",
      standing: "null_result_insufficient_evidence_preserved_not_recommended",
      artifactIds: ["k3", "evaluation-suite"],
      failureThresholdIds: [],
      insufficientThresholdIds: ["K3-citations", "K3-alpha", "K3-history", "K3-freshness"],
      reason: "Historical, reliability, citation, and prospective-freshness evidence remains insufficient.",
    },
    {
      id: "K4",
      standing: "null_result_insufficient_evidence_preserved_not_recommended",
      artifactIds: ["k4", "evaluation-suite"],
      failureThresholdIds: [],
      insufficientThresholdIds: ["K4-alpha", "K4-scholar", "K4-reader-nonclaim"],
      reason: "Blinded coding, constitutional-scholar review, and qualified-reader evidence remain insufficient.",
    },
    {
      id: "K5",
      standing: "null_result_insufficient_evidence_preserved_not_recommended",
      artifactIds: ["k5", "evaluation-suite"],
      failureThresholdIds: [],
      insufficientThresholdIds: ["K5-alpha", "K5-expert", "K5-citations"],
      reason: "Relation coding, external expert review, and citation-audit evidence remain insufficient.",
    },
  ],
  publicStanding: {
    selectedProduct: "source_native_dashboard_only",
    recommendedCandidateIds: [],
    historicalApi: "deprecated_until_2026-07-31_then_410",
    publicScoreSurfaces: "removed",
  },
  rights: {
    publicSourceValuesIncluded: false,
    posture: "Code, manifests, aggregate results, and reasons are retained; restricted country-level publisher observations remain outside the archive.",
  },
  revivalProtocol: [
    "Create a new candidate and methodology version; never mutate this archive.",
    "Rerun every applicable frozen and newly preregistered validation gate.",
    "Record adverse, null, and subgroup results without compensation.",
    "Adopt a new disposition resolution before any public recommendation.",
    "Run the public-surface quarantine and claims gates before release.",
  ],
  validationCommand: "npm run validate:index-research-archive",
} as const);

export type IndexResearchArchiveManifest = Record<string, unknown> & {
  schemaVersion: string;
  releaseId: string;
  sourceCommit: string;
  tournament: { winnerSelected: boolean; artifacts: Array<{ id: string; path: string; sha256: string; bytes: number }> };
  code: { files: Array<{ path: string; sha256: string }>; snapshot: { path: string; sha256: string; bytes: number } };
  failedThresholds: Array<{ id: string; candidate: string; status: string }>;
  nullResults: Array<{ id: string; candidate: string; status: string }>;
  candidates: ReadonlyArray<{ id: string; standing: string; artifactIds: readonly string[]; failureThresholdIds: readonly string[]; insufficientThresholdIds: readonly string[]; reason: string }>;
  publicStanding: { selectedProduct: string; recommendedCandidateIds: readonly string[]; publicScoreSurfaces: string };
  rights: { publicSourceValuesIncluded: boolean };
  revivalProtocol: readonly string[];
  archiveSemanticSha256?: string;
};

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, child]) => [key, canonicalize(child)]),
    );
  }
  return value;
}

export function indexResearchArchiveSemanticHash(manifest: IndexResearchArchiveManifest): string {
  const { archiveSemanticSha256: _ignored, ...base } = manifest;
  return createHash("sha256").update(JSON.stringify(canonicalize(base))).digest("hex");
}

export function indexResearchArchiveErrors(manifest: IndexResearchArchiveManifest): string[] {
  const errors: string[] = [];
  if (manifest.schemaVersion !== INDEX_RESEARCH_ARCHIVE.schemaVersion) errors.push("schema version drifted");
  if (manifest.releaseId !== INDEX_RESEARCH_ARCHIVE.releaseId) errors.push("release id drifted");
  if (manifest.sourceCommit !== INDEX_RESEARCH_ARCHIVE.sourceCommit) errors.push("frozen source commit drifted");
  if (manifest.tournament.winnerSelected !== false) errors.push("archive claims a tournament winner");
  if (manifest.code.files.length < 70) errors.push("frozen code inventory is incomplete");
  if (!manifest.code.snapshot.sha256.match(/^[a-f0-9]{64}$/)) errors.push("code snapshot is not checksummed");
  if (manifest.failedThresholds.length !== 2) errors.push("failed threshold inventory is incomplete");
  if (manifest.nullResults.length < 10) errors.push("null/insufficient result inventory is incomplete");
  if (manifest.candidates.map((row) => row.id).join(",") !== "K1,K2,K3,K4,K5") errors.push("candidate archive is incomplete or reordered");
  const artifactIds = new Set(manifest.tournament.artifacts.map((row) => row.id));
  const failureIds = new Set(manifest.failedThresholds.map((row) => row.id));
  const nullIds = new Set(manifest.nullResults.map((row) => row.id));
  for (const candidate of manifest.candidates) {
    if (!candidate.standing.includes("not_recommended")) errors.push(`${candidate.id} lacks non-recommendation standing`);
    if (!candidate.reason.trim()) errors.push(`${candidate.id} lacks a preservation reason`);
    for (const id of candidate.artifactIds) if (!artifactIds.has(id)) errors.push(`${candidate.id} references missing artifact ${id}`);
    for (const id of candidate.failureThresholdIds) if (!failureIds.has(id)) errors.push(`${candidate.id} references missing failure ${id}`);
    for (const id of candidate.insufficientThresholdIds) if (!nullIds.has(id)) errors.push(`${candidate.id} references missing null result ${id}`);
  }
  if (manifest.publicStanding.selectedProduct !== "source_native_dashboard_only") errors.push("selected public product drifted");
  if (manifest.publicStanding.recommendedCandidateIds.length !== 0) errors.push("an archived candidate became recommended");
  if (manifest.publicStanding.publicScoreSurfaces !== "removed") errors.push("public score surfaces were revived");
  if (manifest.rights.publicSourceValuesIncluded !== false) errors.push("restricted source values entered the archive");
  if (manifest.revivalProtocol.length < 5) errors.push("silent-revival prevention is incomplete");
  if (manifest.archiveSemanticSha256 !== indexResearchArchiveSemanticHash(manifest)) errors.push("archive semantic hash drifted");
  return errors;
}
