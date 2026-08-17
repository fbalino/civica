/**
 * Phase 5.5 — Pulse Beta foundation types.
 *
 * Defines the canonical shapes used across the v2 pulse pipeline:
 * connectors return `RawEventInput[]`, the orchestrator writes them
 * to the `raw_events` staging table, clustering produces `EventCluster`
 * groupings, and the classify→verify classifier produces `ClassifierRun[]`
 * (the classify pass and the verify pass).
 */

/** CI-aligned dimensions the Pulse can affect. Stability is published
 *  separately per spec §3.2 — it spills over to other dimensions but
 *  never gets merged into a single CI delta. */
export type PulseDimension =
  | "democratic_quality"
  | "rule_of_law"
  | "freedom_rights"
  | "corruption_control"
  | "stability";

export const PULSE_DIMENSIONS: PulseDimension[] = [
  "democratic_quality",
  "rule_of_law",
  "freedom_rights",
  "corruption_control",
  "stability",
];

/** Severity tiers per spec §3.3. Each tier maps to a numeric range. */
export type SeverityTier =
  | "low_pos"
  | "moderate_pos"
  | "high_pos"
  | "low_neg"
  | "moderate_neg"
  | "severe_neg"
  | "catastrophic_neg";

export type SourceType = "specialist" | "news";

/** Output of a single feed connector — written to `raw_events`. */
export interface RawEventInput {
  /** sources.id (e.g. "acled", "civicus_monitor", "gdelt") */
  sourceId: string;
  /** Source-native id where available, for upsert idempotency */
  externalId?: string | null;
  sourceUrl?: string | null;
  sourceType: SourceType;
  /** Resolved jurisdiction id, or null if name resolution failed */
  jurisdictionId?: string | null;
  /** Country name as the source reported it (for diagnostics + later resolution) */
  rawCountryName?: string | null;
  /** YYYY-MM-DD format. Null if the source doesn't expose an event date. */
  eventDate?: string | null;
  title: string;
  body?: string | null;
  /** Full source payload, JSON-serializable */
  raw: Record<string, unknown>;
}

/** A single reasoning-pass output. Recorded per event for audit.
 *
 *  Shape history (all fields are ADDITIVE — legacy rows stay readable and
 *  every historical writer's rows continue to parse):
 *   - Retired 3-temperature scheme: three classify runs (`run` 1–3), `temp`
 *     the sampling temperature, one `model`.
 *   - Single-engine classify→verify: run 1 = classify, run 2 = verify;
 *     `temp` is 0.
 *   - Cross-model ENSEMBLE (owner decision 2026-07-05): one classify run per
 *     configured vendor engine (`run` 1..N), plus a single verify run
 *     (`run` 10). `provider` names the vendor; `model` the model id;
 *     `confidence` carries the verify pass's high/medium/low verdict on the
 *     verify row. `temp` stays 0 (deterministic decode).
 *
 *  `run` is a plain number (was `1 | 2 | 3`) so the ensemble's classify +
 *  verify rows have distinct React keys and audit ordinals. */
export interface ClassifierRun {
  run: number;
  temp: number;
  model: string;
  /** Vendor engine that produced this run (ensemble rows). Optional so
   *  legacy rows without it still satisfy the type. */
  provider?: ClassifierProvider;
  /** "subscription-cli" for owner-Mac subscription runs (always human
   *  review, never auto-publish — PUL-036); absent/"http" for API runs. */
  transport?: "http" | "subscription-cli";
  /** Explicit pass role. Missing on retained legacy rows. */
  role?: "classify" | "verify";
  /** Exact classifier prompt bundle used for this pass. */
  promptVersion?: string;
  /** Public Pulse method in force for this pass. */
  methodVersion?: string;
  /** Complete classifier-configuration hash shared by one voter panel. */
  configurationHash?: string;
  /** Number of classify engines configured for the panel, including failures. */
  configuredEngineCount?: number;
  category: string;
  dimension: PulseDimension;
  severityTier: SeverityTier;
  severityValue: number;
  /** Self-reported confidence. Not used for scoring (LLM self-confidence
   *  is uncalibrated) but preserved for audit. */
  selfConfidence: number;
  /** Verify-pass confidence verdict (high | medium | low), on the verify
   *  row only. Absent on classify rows. */
  confidence?: "high" | "medium" | "low";
  rationale: string;
  raw: string;
}

/** Provider engines the classifier layer can call. Mirrors
 *  `ClassifierProvider` in `provider.ts`; duplicated here (a string-literal
 *  union, no runtime cost) to keep `types.ts` free of a provider-module
 *  import cycle. */
export type ClassifierProvider =
  | "anthropic"
  | "deepseek"
  | "glm"
  | "openai"
  | "xai"
  | "moonshot";

/** Persisted voter-agreement signal on `pulse_events_v2.classifier_agreement`.
 *  Current rows derive it only from provider-distinct, prompt-versioned
 *  classify runs. The legacy labels remain for historical compatibility. */
export type ClassifierAgreement = "all" | "two_of_three" | "none";

/** A clustered event — what gets written to `pulse_events_v2`. */
export interface ClassifiedEvent {
  jurisdictionId: string;
  eventDate: string;
  category: string;
  dimension: PulseDimension;
  severityTier: SeverityTier;
  severityValue: number;
  classifierRuns: ClassifierRun[];
  classifierAgreement: ClassifierAgreement;
  headline: string;
  description: string;
}
