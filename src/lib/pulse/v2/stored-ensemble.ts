import type { ClassifyResultLite } from "./classifier-prompt";
import { computeConsensus, type EnsembleConsensus, type EnsembleRun } from "./ensemble";
import type { ClassifierRun } from "./types";

export const STORED_ENSEMBLE_CONTRACT_VERSION =
  "pulse-stored-ensemble/v1" as const;

export interface StoredEnsembleDerivation {
  contractVersion: typeof STORED_ENSEMBLE_CONTRACT_VERSION;
  consensus: EnsembleConsensus;
  valid: boolean;
  reasons: string[];
  classifyRunCount: number;
  configuredEngineCount: number;
}

function unresolvedConsensus(voterCount = 0): EnsembleConsensus {
  return {
    category: "none",
    runnerUp: "none",
    severityTier: "low_neg",
    severityValue: 0,
    selfConfidence: 0,
    agreement: "none",
    voterCount,
    agreeingCount: 0,
    degraded: true,
  };
}

function runnerUp(run: ClassifierRun): string {
  try {
    const parsed = JSON.parse(run.raw) as { runnerUp?: unknown };
    return typeof parsed.runnerUp === "string" ? parsed.runnerUp : "none";
  } catch {
    return "none";
  }
}

/** Reconstruct agreement from the exact classify evidence stored on a row. */
export function deriveStoredEnsemble(
  storedRuns: readonly ClassifierRun[],
): StoredEnsembleDerivation {
  const classifyRuns = storedRuns.filter((run) => run.role === "classify");
  const reasons: string[] = [];
  if (classifyRuns.length < 2) reasons.push("fewer_than_two_independent_classify_runs");

  const requiredText = [
    "provider",
    "model",
    "promptVersion",
    "methodVersion",
    "configurationHash",
  ] as const;
  for (const run of classifyRuns) {
    for (const field of requiredText) {
      const value = run[field];
      if (typeof value !== "string" || !value.trim()) {
        reasons.push(`missing_${field}`);
      }
    }
    if (
      !Number.isSafeInteger(run.configuredEngineCount) ||
      (run.configuredEngineCount ?? 0) < 2
    ) {
      reasons.push("invalid_configured_engine_count");
    }
  }

  const providers = classifyRuns.map((run) => run.provider ?? "");
  if (new Set(providers).size !== providers.length) {
    reasons.push("duplicate_provider_not_independent");
  }
  const identities = classifyRuns.map((run) => `${run.provider}:${run.model}`);
  if (new Set(identities).size !== identities.length) {
    reasons.push("duplicate_provider_model_run");
  }
  for (const field of [
    "promptVersion",
    "methodVersion",
    "configurationHash",
    "configuredEngineCount",
  ] as const) {
    if (new Set(classifyRuns.map((run) => String(run[field] ?? ""))).size > 1) {
      reasons.push(`mixed_${field}`);
    }
  }

  const configuredEngineCount = classifyRuns[0]?.configuredEngineCount ?? 0;
  if (classifyRuns.length > configuredEngineCount) {
    reasons.push("more_runs_than_configured_engines");
  }
  const uniqueReasons = [...new Set(reasons)].sort();
  if (uniqueReasons.length > 0) {
    return {
      contractVersion: STORED_ENSEMBLE_CONTRACT_VERSION,
      consensus: unresolvedConsensus(classifyRuns.length),
      valid: false,
      reasons: uniqueReasons,
      classifyRunCount: classifyRuns.length,
      configuredEngineCount,
    };
  }

  const runs: EnsembleRun[] = classifyRuns.map((run) => ({
    config: { provider: run.provider!, model: run.model },
    result: {
      category: run.category,
      runnerUp: runnerUp(run),
      severityTier: run.severityTier,
      severityValue: run.severityValue,
      selfConfidence: run.selfConfidence,
      rationale: run.rationale,
    } satisfies ClassifyResultLite,
  }));
  return {
    contractVersion: STORED_ENSEMBLE_CONTRACT_VERSION,
    consensus: computeConsensus(runs, configuredEngineCount),
    valid: true,
    reasons: [],
    classifyRunCount: classifyRuns.length,
    configuredEngineCount,
  };
}

export function storedRunsPermitAutomaticPublication(
  storedRuns: readonly ClassifierRun[],
): boolean {
  const derived = deriveStoredEnsemble(storedRuns);
  return (
    derived.valid &&
    derived.consensus.category !== "none" &&
    derived.consensus.agreement !== "none"
  );
}
