import { createHash } from "node:crypto";

/**
 * PLT-022 — one closed contract for every code path that can purchase a
 * model response. Values here are ceilings, not forecasts. A model job must
 * satisfy both its local ceiling and the provider-side workspace spend cap
 * documented in data/MODEL-OPERATIONS.md.
 */
export const MODEL_OPERATIONS_CONTRACT_VERSION =
  "civica-model-operations/v1" as const;

export type ModelOperationId =
  | "ask-civica"
  | "pulse-classify"
  | "pulse-verify"
  | "pulse-subject-attribution"
  | "pulse-review-summary"
  | "pulse-backtest"
  | "bills-summarize"
  | "stats-sa-reconciliation";

export type ModelProvider =
  | "anthropic"
  | "deepseek"
  | "glm"
  | "openai"
  | "xai"
  | "moonshot";

export interface ModelOperationControl {
  credentialEnv: string;
  provider: ModelProvider | "configurable";
  /** A named model or the closed Pulse provider/model allowlist. */
  model: string | "approved-pulse-provider-model";
  /** Prevents a malformed source row from becoming an unbounded prompt. */
  maxInputChars: number;
  /** Upper limit sent to the provider, including any reasoning allowance. */
  maxOutputTokens: number;
  /** Maximum paid calls one execution can make for this operation. */
  maxCallsPerExecution: number;
  /** Retries are part of the call ceiling, never an unbounded fallback. */
  maxAttemptsPerCall: number;
  /** Provider-console hard cap for the scoped workspace, in USD/month. */
  monthlySpendCapUsd: number;
  /** Operator alert threshold, in USD/month. Must remain below the cap. */
  alertAtUsd: number;
  unavailableBehavior: string;
}

export const MODEL_OPERATION_CONTROLS: Record<
  ModelOperationId,
  ModelOperationControl
> = {
  "ask-civica": {
    credentialEnv: "ANTHROPIC_API_KEY_CHAT",
    provider: "anthropic",
    model: "claude-sonnet-4-6",
    maxInputChars: 12_000,
    maxOutputTokens: 1_024,
    maxCallsPerExecution: 1,
    maxAttemptsPerCall: 1,
    monthlySpendCapUsd: 25,
    alertAtUsd: 20,
    unavailableBehavior: "return a fixed unavailable response; never use another model or source",
  },
  "pulse-classify": {
    credentialEnv: "PULSE_PROVIDER_KEY",
    provider: "configurable",
    model: "approved-pulse-provider-model",
    maxInputChars: 24_000,
    maxOutputTokens: 4_096,
    maxCallsPerExecution: 150,
    maxAttemptsPerCall: 4,
    monthlySpendCapUsd: 50,
    alertAtUsd: 40,
    unavailableBehavior: "leave the cluster pending or route it to review; never substitute a provider",
  },
  "pulse-verify": {
    credentialEnv: "PULSE_PROVIDER_KEY",
    provider: "configurable",
    model: "approved-pulse-provider-model",
    maxInputChars: 26_000,
    maxOutputTokens: 4_096,
    maxCallsPerExecution: 50,
    maxAttemptsPerCall: 4,
    monthlySpendCapUsd: 50,
    alertAtUsd: 40,
    unavailableBehavior: "treat verification as unavailable and route conservatively to review",
  },
  "pulse-subject-attribution": {
    credentialEnv: "ANTHROPIC_API_KEY_PULSE_CLASSIFIER",
    provider: "anthropic",
    model: "claude-sonnet-4-6",
    maxInputChars: 24_000,
    maxOutputTokens: 700,
    maxCallsPerExecution: 50,
    maxAttemptsPerCall: 1,
    monthlySpendCapUsd: 50,
    alertAtUsd: 40,
    unavailableBehavior: "mark subject attribution unresolved; never infer a country from the provider failure",
  },
  "pulse-review-summary": {
    credentialEnv: "ANTHROPIC_API_KEY_PULSE_SUMMARIZE",
    provider: "anthropic",
    model: "claude-haiku-4-5-20251001",
    maxInputChars: 10_000,
    maxOutputTokens: 280,
    maxCallsPerExecution: 1,
    maxAttemptsPerCall: 1,
    monthlySpendCapUsd: 5,
    alertAtUsd: 4,
    unavailableBehavior: "show the source description without an AI summary",
  },
  "pulse-backtest": {
    credentialEnv: "PULSE_PROVIDER_KEY",
    provider: "configurable",
    model: "approved-pulse-provider-model",
    maxInputChars: 24_000,
    maxOutputTokens: 4_096,
    maxCallsPerExecution: 40,
    maxAttemptsPerCall: 4,
    monthlySpendCapUsd: 10,
    alertAtUsd: 8,
    unavailableBehavior: "manual diagnostic stops without writing a partial quality conclusion",
  },
  "bills-summarize": {
    credentialEnv: "ANTHROPIC_API_KEY_BILLS_SUMMARIZE",
    provider: "anthropic",
    model: "claude-haiku-4-5-20251001",
    maxInputChars: 8_000,
    maxOutputTokens: 1_500,
    maxCallsPerExecution: 25,
    maxAttemptsPerCall: 1,
    monthlySpendCapUsd: 10,
    alertAtUsd: 8,
    unavailableBehavior: "store no generated summary and retain the source title",
  },
  "stats-sa-reconciliation": {
    credentialEnv: "ANTHROPIC_API_KEY_RECONCILIATION",
    provider: "anthropic",
    model: "claude-haiku-4-5-20251001",
    maxInputChars: 8_000_000,
    maxOutputTokens: 1_024,
    maxCallsPerExecution: 4,
    maxAttemptsPerCall: 1,
    monthlySpendCapUsd: 10,
    alertAtUsd: 8,
    unavailableBehavior: "skip the affected reconciliation candidate and retain the existing canonical fact",
  },
};

export const APPROVED_PULSE_PROVIDER_MODELS = {
  // The subscription-CLI voter panel entries (claude-sonnet-5, gpt-5.6-terra,
  // grok-4.5, kimi-k3) are the owner's written 2026-08-17 model authority
  // (`plan/pulse-subscription-runtime-resolution-v1.md`, approval record).
  // They run only through the subscription-cli transport at $0 marginal
  // cost; xai and moonshot have no HTTP/API path in this codebase.
  anthropic: [
    "claude-sonnet-4-6",
    "claude-haiku-4-5",
    "claude-sonnet-5",
  ] as const,
  deepseek: ["deepseek-v4-flash", "deepseek-v4-pro"] as const,
  glm: ["glm-4.7", "glm-4.7-flashx", "glm-4.7-flash", "glm-5.2"] as const,
  openai: ["gpt-4.1-mini", "gpt-5.6-terra"] as const,
  xai: ["grok-4.5"] as const,
  moonshot: ["kimi-k3"] as const,
} satisfies Record<ModelProvider, readonly string[]>;

export function modelOperationControl(
  operation: ModelOperationId,
): ModelOperationControl {
  return MODEL_OPERATION_CONTROLS[operation];
}

export function isApprovedPulseProviderModel(
  provider: ModelProvider,
  model: string,
): boolean {
  return APPROVED_PULSE_PROVIDER_MODELS[provider].includes(
    model as never,
  );
}

export function modelOperationVersion(
  operation: ModelOperationId,
  provider: string,
  model: string,
): string {
  const control = modelOperationControl(operation);
  const identity = JSON.stringify({
    contract: MODEL_OPERATIONS_CONTRACT_VERSION,
    operation,
    provider,
    model,
    maxInputChars: control.maxInputChars,
    maxOutputTokens: control.maxOutputTokens,
    maxCallsPerExecution: control.maxCallsPerExecution,
    maxAttemptsPerCall: control.maxAttemptsPerCall,
  });
  return `model-operation/sha256:${createHash("sha256")
    .update(identity)
    .digest("hex")}`;
}

/**
 * Enforce request-size and output ceilings immediately before a paid call.
 * Values and prompt text never enter the error, logs, or evidence.
 */
export function assertModelOperationRequest(
  operation: ModelOperationId,
  inputChars: number,
  maxOutputTokens: number,
): void {
  const control = modelOperationControl(operation);
  if (!Number.isSafeInteger(inputChars) || inputChars < 0) {
    throw new Error(`Invalid ${operation} input length`);
  }
  if (inputChars > control.maxInputChars) {
    throw new Error(`${operation} input exceeds its approved ceiling`);
  }
  if (!Number.isSafeInteger(maxOutputTokens) || maxOutputTokens < 1) {
    throw new Error(`Invalid ${operation} output ceiling`);
  }
  if (maxOutputTokens > control.maxOutputTokens) {
    throw new Error(`${operation} output exceeds its approved ceiling`);
  }
}

/** A model credential is scoped only when it is nonblank for its operation. */
export function modelOperationCredentialConfigured(
  operation: ModelOperationId,
  env: Readonly<Record<string, string | undefined>> = process.env,
): boolean {
  const credential = modelOperationControl(operation).credentialEnv;
  return credential !== "PULSE_PROVIDER_KEY" && Boolean(env[credential]?.trim());
}
