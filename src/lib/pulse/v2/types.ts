/**
 * Phase 5.5 — Pulse Beta foundation types.
 *
 * Defines the canonical shapes used across the v2 pulse pipeline:
 * connectors return `RawEventInput[]`, the orchestrator writes them
 * to the `raw_events` staging table, clustering produces `EventCluster`
 * groupings, and the multi-run classifier produces `ClassifierRun[]`.
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

/** A single classifier run output — three of these per cluster. */
export interface ClassifierRun {
  run: 1 | 2 | 3;
  temp: number;
  model: string;
  category: string;
  dimension: PulseDimension;
  severityTier: SeverityTier;
  severityValue: number;
  /** Self-reported confidence. Not used for scoring (spec §5.2 — LLM
   *  self-confidence is uncalibrated) but preserved for audit. */
  selfConfidence: number;
  rationale: string;
  raw: string;
}

/** Result of comparing 3 runs. */
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

