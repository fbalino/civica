import { createHash } from "node:crypto";

import { stableStringify } from "@/lib/data/frozen-vintage";
import { adapterVersion, productionPipelineContracts } from "@/lib/data/source-input-manifest";
import { getFactKey } from "./fact-keys";
import { resolveFromRows } from "./resolver";
import type { FactRow, ResolverOutput } from "./types";

export const CANDIDATE_SNAPSHOT_SCHEMA_VERSION = "reconciliation-candidate-snapshot/v1";
export const CANDIDATE_RELEASE_SCHEMA_VERSION = "reconciliation-candidate-release/v1";

/** Exact resolver input plus the immutable evidence that identifies its source input. */
export interface FrozenCandidateObservation {
  schemaVersion: typeof CANDIDATE_SNAPSHOT_SCHEMA_VERSION;
  vintageLabel: string;
  cutAt: string;
  candidate: FactRow;
  sourceRowId: string;
  sourceHash: string | null;
  sourceSnapshotId: string | null;
  inputEvidenceKind: "source_payload_hash" | "normalized_observation_hash";
  inputEvidenceHash: string;
  adapterVersionHash: string;
  candidateContentHash: string;
}

export interface CandidateReleaseManifest {
  schemaVersion: typeof CANDIDATE_RELEASE_SCHEMA_VERSION;
  vintageLabel: string;
  cutAt: string;
  methodologyVersion: string;
  resolverVersionHash: string;
  candidateCount: number;
  winnerCount: number;
  candidateSetChecksum: string;
  winnerSetChecksum: string;
}

export interface CandidateReplayResult {
  manifest: CandidateReleaseManifest;
  resolutions: Record<string, ResolverOutput>;
}

export interface CandidateReleasePackage extends CandidateReplayResult {
  candidates: FrozenCandidateObservation[];
  inputManifest: {
    schemaVersion: "reconciliation-candidate-input-manifest/v1";
    sources: Array<{ sourceId: string; candidateCount: number; payloadHashes: number; normalizedObservationHashes: number; adapterVersionHash: string }>;
  };
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function plainHash(value: string): string {
  return value.startsWith("sha256:") ? value.slice(7) : value;
}

export function resolverVersionHash(): string {
  return plainHash(adapterVersion([
    "src/lib/factbook/reconcile/resolver.ts",
    "src/lib/factbook/reconcile/fact-keys.ts",
    "src/lib/factbook/reconcile/types.ts",
    "src/lib/data/growth-methodology.ts",
  ]));
}

export function adapterVersionHashes(sourceIds: readonly string[]): Map<string, string> {
  const pipelines = productionPipelineContracts();
  const output = new Map<string, string>();
  for (const sourceId of [...new Set(sourceIds)].sort()) {
    const paths = [...new Set(pipelines.filter((pipeline) => pipeline.sourceIds.includes(sourceId)).flatMap((pipeline) => pipeline.implementationPaths))].sort();
    if (!paths.length) throw new Error(`No registered production adapter for candidate source ${sourceId}`);
    output.set(sourceId, plainHash(adapterVersion(paths)));
  }
  return output;
}

/** Hashes every field consumed by the resolver; mutable source-row identity is only lineage. */
export function candidateContentHash(candidate: FactRow): string {
  return sha256(stableStringify(candidate));
}

export function freezeCandidateObservation(input: {
  vintageLabel: string;
  cutAt: string;
  candidate: FactRow;
  sourceHash: string | null;
  sourceSnapshotId: string | null;
  adapterVersionHash: string;
}): FrozenCandidateObservation {
  const contentHash = candidateContentHash(input.candidate);
  return {
    schemaVersion: CANDIDATE_SNAPSHOT_SCHEMA_VERSION,
    vintageLabel: input.vintageLabel,
    cutAt: input.cutAt,
    candidate: structuredClone(input.candidate),
    sourceRowId: input.candidate.id,
    sourceHash: input.sourceHash,
    sourceSnapshotId: input.sourceSnapshotId,
    inputEvidenceKind: input.sourceHash ? "source_payload_hash" : "normalized_observation_hash",
    inputEvidenceHash: input.sourceHash ?? contentHash,
    adapterVersionHash: input.adapterVersionHash,
    candidateContentHash: contentHash,
  };
}

export function candidateSetChecksum(candidates: readonly FrozenCandidateObservation[]): string {
  return sha256(stableStringify([...candidates]
    .map((row) => ({
      jurisdictionId: row.candidate.jurisdictionId,
      factKey: row.candidate.factKey,
      sourceId: row.candidate.sourceId,
      sourceRowId: row.sourceRowId,
      candidateContentHash: row.candidateContentHash,
      inputEvidenceHash: row.inputEvidenceHash,
      adapterVersionHash: row.adapterVersionHash,
    }))
    .sort((a, b) => stableStringify(a).localeCompare(stableStringify(b)))));
}

function resolutionKey(jurisdictionId: string, factKey: string): string {
  return `${jurisdictionId}\0${factKey}`;
}

export function replayCandidateRelease(input: {
  vintageLabel: string;
  cutAt: string;
  methodologyVersion: string;
  resolverVersionHash: string;
  candidates: readonly FrozenCandidateObservation[];
}): CandidateReplayResult {
  if (input.candidates.length === 0) throw new Error("Candidate release is empty");
  const groups = new Map<string, FactRow[]>();
  const identities = new Set<string>();
  for (const frozen of input.candidates) {
    if (frozen.vintageLabel !== input.vintageLabel || frozen.cutAt !== input.cutAt) throw new Error("Candidate release mixes vintage identity or cutoff");
    if (candidateContentHash(frozen.candidate) !== frozen.candidateContentHash) throw new Error(`Candidate content hash drift: ${frozen.sourceRowId}`);
    const identity = `${frozen.candidate.jurisdictionId}\0${frozen.candidate.factKey}\0${frozen.candidate.sourceId}`;
    if (identities.has(identity)) throw new Error(`Duplicate candidate identity: ${identity}`);
    identities.add(identity);
    const key = resolutionKey(frozen.candidate.jurisdictionId, frozen.candidate.factKey);
    groups.set(key, [...(groups.get(key) ?? []), structuredClone(frozen.candidate)]);
  }

  const resolutions: Record<string, ResolverOutput> = {};
  const winners: Array<{ key: string; sourceRowId: string; candidateContentHash: string; decisionReason: string }> = [];
  for (const [key, rows] of [...groups].sort(([a], [b]) => a.localeCompare(b))) {
    const definition = getFactKey(rows[0].factKey);
    if (!definition) throw new Error(`Unknown frozen fact key: ${rows[0].factKey}`);
    const core = resolveFromRows(rows, definition);
    const resolution: ResolverOutput = {
      jurisdictionId: rows[0].jurisdictionId,
      factKey: rows[0].factKey,
      isDisputed: false,
      ...core,
    };
    resolutions[key] = resolution;
    if (resolution.canonical) {
      const frozen = input.candidates.find((row) => row.sourceRowId === resolution.canonical!.id);
      if (!frozen) throw new Error(`Winner is absent from frozen candidates: ${resolution.canonical.id}`);
      winners.push({ key, sourceRowId: resolution.canonical.id, candidateContentHash: frozen.candidateContentHash, decisionReason: resolution.decisionReason });
    }
  }
  const winnerSetChecksum = sha256(stableStringify(winners));
  return {
    resolutions,
    manifest: {
      schemaVersion: CANDIDATE_RELEASE_SCHEMA_VERSION,
      vintageLabel: input.vintageLabel,
      cutAt: input.cutAt,
      methodologyVersion: input.methodologyVersion,
      resolverVersionHash: input.resolverVersionHash,
      candidateCount: input.candidates.length,
      winnerCount: winners.length,
      candidateSetChecksum: candidateSetChecksum(input.candidates),
      winnerSetChecksum,
    },
  };
}

export function buildCandidateReleasePackage(input: {
  vintageLabel: string;
  cutAt: string;
  methodologyVersion: string;
  rows: ReadonlyArray<{ candidate: FactRow; sourceHash: string | null; sourceSnapshotId: string | null }>;
  adapterHashes?: ReadonlyMap<string, string>;
  resolverHash?: string;
}): CandidateReleasePackage {
  const cut = Date.parse(input.cutAt);
  if (!Number.isFinite(cut)) throw new Error("Candidate release cutoff is invalid");
  if (!input.rows.length) throw new Error("Candidate release is empty");
  for (const row of input.rows) {
    if (Date.parse(row.candidate.retrievedAt) > cut) throw new Error(`Post-cut candidate cannot enter release: ${row.candidate.id}`);
  }
  const hashes = input.adapterHashes ?? adapterVersionHashes(input.rows.map((row) => row.candidate.sourceId));
  const candidates = input.rows.map((row) => {
    const adapterVersionHash = hashes.get(row.candidate.sourceId);
    if (!adapterVersionHash) throw new Error(`Missing adapter version for ${row.candidate.sourceId}`);
    return freezeCandidateObservation({
      vintageLabel: input.vintageLabel,
      cutAt: input.cutAt,
      candidate: row.candidate,
      sourceHash: row.sourceHash,
      sourceSnapshotId: row.sourceSnapshotId,
      adapterVersionHash,
    });
  });
  const replay = replayCandidateRelease({
    vintageLabel: input.vintageLabel,
    cutAt: input.cutAt,
    methodologyVersion: input.methodologyVersion,
    resolverVersionHash: input.resolverHash ?? resolverVersionHash(),
    candidates,
  });
  const sources = [...new Set(candidates.map((row) => row.candidate.sourceId))].sort().map((sourceId) => {
    const rows = candidates.filter((row) => row.candidate.sourceId === sourceId);
    return {
      sourceId,
      candidateCount: rows.length,
      payloadHashes: rows.filter((row) => row.inputEvidenceKind === "source_payload_hash").length,
      normalizedObservationHashes: rows.filter((row) => row.inputEvidenceKind === "normalized_observation_hash").length,
      adapterVersionHash: hashes.get(sourceId)!,
    };
  });
  return { ...replay, candidates, inputManifest: { schemaVersion: "reconciliation-candidate-input-manifest/v1", sources } };
}
