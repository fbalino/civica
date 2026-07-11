import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

export const RESEARCH_EVIDENCE_RETENTION_VERSION =
  "research-evidence-retention/v1" as const;

/** Every UPDATE or DELETE on these relations is captured synchronously by a
 * database trigger before the mutation can proceed. */
export const RETAINED_EVIDENCE_RELATIONS = [
  "backtest_cases",
  "backtest_events",
  "backtest_runs",
  "ci_composite_scores",
  "ci_dimension_scores",
  "ci_ingestion_runs",
  "civica_conditions_scores",
  "constitutions",
  "constitution_topic_excerpts",
  "correction_log",
  "country_facts",
  "country_metrics",
  "data_disputes",
  "data_facts_audit_log",
  "election_results",
  "elections",
  "government_bodies",
  "government_taxonomies",
  "indicator_history",
  "legislature_parties",
  "offices",
  "organization_memberships",
  "persons",
  "pulse_dimensional_deltas",
  "pulse_events_v2",
  "pulse_review_audit_log",
  "pulse_sources",
  "raw_events",
  "statements",
  "terms",
] as const;

export type RetainedEvidenceRelation =
  (typeof RETAINED_EVIDENCE_RELATIONS)[number];

/** Closed inventory of checked-in code that can delete database evidence.
 * `rate_limits` is the sole exemption: it is ephemeral abuse-control state,
 * not source, interpretation, review, or evaluation evidence. */
export const DESTRUCTIVE_WRITE_PATHS = [
  { path: "scripts/ingest-ci-all.ts", relations: ["ci_dimension_scores"] },
  { path: "scripts/cleanup-bad-offices.ts", relations: ["government_bodies", "offices", "persons", "terms"] },
  { path: "scripts/seed-backtest-cases.ts", relations: ["backtest_events"] },
  { path: "scripts/seed-organizations.ts", relations: ["organization_memberships"] },
  { path: "scripts/sync-elections-ipu.ts", relations: ["elections"] },
  { path: "src/lib/constitute/sync-constitutions.ts", relations: ["constitution_topic_excerpts"] },
  { path: "src/lib/elections/writer.ts", relations: ["election_results"] },
  { path: "src/lib/legislatures/composition-writer.ts", relations: ["legislature_parties"] },
  { path: "src/lib/api/rate-limit.ts", relations: ["rate_limits"], exemption: "ephemeral abuse-control counters expire by design" },
] as const;

export interface EvaluationEvidenceRow {
  evidenceKind: string;
  evidenceId: string;
  outcome: string;
  payload: unknown;
  recordedAt: string;
}

function rows(result: unknown): Record<string, unknown>[] {
  return (Array.isArray(result)
    ? result
    : ((result as { rows?: Record<string, unknown>[] }).rows ?? [])) as Record<
    string,
    unknown
  >[];
}

function mapEvidence(result: unknown): EvaluationEvidenceRow[] {
  return rows(result).map((row) => ({
    evidenceKind: String(row.evidence_kind),
    evidenceId: String(row.evidence_id),
    outcome: String(row.outcome),
    payload: row.payload,
    recordedAt:
      row.recorded_at instanceof Date
        ? row.recorded_at.toISOString()
        : String(row.recorded_at),
  }));
}

/** Internal research query. The view includes classifier rejections/invalid
 * cases and human-reviewed events, including false-positive candidates. */
export async function getPulseEvaluationEvidence(): Promise<
  EvaluationEvidenceRow[]
> {
  return mapEvidence(
    await db.execute(sql`
      SELECT evidence_kind, evidence_id, outcome, payload, recorded_at
      FROM pulse_evaluation_evidence
      ORDER BY recorded_at DESC, evidence_id
    `),
  );
}

/** Internal research query. Non-active fact candidates and all recorded
 * disputes remain available for resolver error analysis and replay. */
export async function getReconciliationEvaluationEvidence(): Promise<
  EvaluationEvidenceRow[]
> {
  return mapEvidence(
    await db.execute(sql`
      SELECT evidence_kind, evidence_id, outcome, payload, recorded_at
      FROM reconciliation_evaluation_evidence
      ORDER BY recorded_at DESC, evidence_id
    `),
  );
}
