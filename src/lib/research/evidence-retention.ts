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
  "civica_conditions_calculations",
  "civica_conditions_components",
  "civica_conditions_normalization_parameters",
  "civica_conditions_reference_sets",
  "civica_conditions_releases",
  "civica_conditions_scores",
  "constitutions",
  "constitution_passages",
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
  "political_parties",
  "pulse_dimensional_deltas",
  "pulse_events_v2",
  "pulse_incidents",
  "pulse_candidate_outcomes",
  "pulse_cluster_classification_states",
  "pulse_review_obligations",
  "pulse_review_audit_log",
  "pulse_sources",
  "raw_events",
  "statements",
  "terms",
] as const;

/** Relations whose evidence rows reject UPDATE and DELETE outright rather
 * than copying a mutable projection into the generic history ledger. */
export const APPEND_ONLY_EVIDENCE_RELATIONS = [
  "party_composition_runs",
  "party_identity_events",
  "pulse_dimensional_delta_history",
  "pulse_event_absorptions",
  "pulse_event_information_environment_pins",
  "pulse_drift_baselines",
  "pulse_drift_observations",
  "pulse_drift_alerts",
  "pulse_event_decisions",
  "pulse_incident_assignments",
  "pulse_incident_resolutions",
  "pulse_classification_attempts",
  "pulse_review_sla_events",
  "pulse_information_environment_releases",
  "pulse_information_environment_values",
] as const;

export type RetainedEvidenceRelation =
  (typeof RETAINED_EVIDENCE_RELATIONS)[number];

/** Closed inventory of checked-in code that can delete database evidence.
 * Any exemption must be explicitly documented as short-lived operational
 * state, never source, interpretation, review, or evaluation evidence. */
export const DESTRUCTIVE_WRITE_PATHS = [
  { path: "scripts/ingest-ci-all.ts", relations: ["ci_dimension_scores"] },
  {
    path: "scripts/cleanup-bad-offices.ts",
    relations: ["government_bodies", "offices", "persons", "terms"],
  },
  { path: "scripts/seed-backtest-cases.ts", relations: ["backtest_events"] },
  {
    path: "src/lib/constitute/sync-constitutions.ts",
    relations: ["constitution_topic_excerpts"],
  },
  {
    path: "src/lib/elections/writer.ts",
    relations: ["election_results", "elections", "statements"],
  },
  {
    path: "src/lib/api/rate-limit.ts",
    relations: ["rate_limits"],
    exemption: "ephemeral abuse-control counters expire by design",
  },
  {
    path: "src/lib/platform/route-performance-telemetry.ts",
    relations: ["route_performance_observations"],
    exemption:
      "short-lived privacy-bounded operational telemetry is not research evidence",
  },
  {
    path: "src/lib/platform/error-monitoring.ts",
    relations: ["error_monitoring_events"],
    exemption:
      "short-lived scrubbed operational error signatures are not research evidence",
  },
] as const;

export interface EvaluationEvidenceRow {
  evidenceKind: string;
  evidenceId: string;
  outcome: string;
  payload: unknown;
  recordedAt: string;
}

export interface PulseExclusionEvaluationCandidate {
  outcomeKey: string;
  evaluationStratum: "false_positive_candidate" | "false_negative_candidate";
  candidateKind: string;
  candidateId: string;
  canonicalCandidateId: string | null;
  outcome: string;
  reasonCode: string;
  reason: string;
  actor: unknown;
  methodVersion: string;
  stageRunId: string;
  decisionKey: string | null;
  evidenceRefs: string[];
  metadata: unknown;
  occurredAt: string;
  stableSampleKey: string;
}

function rows(result: unknown): Record<string, unknown>[] {
  return (
    Array.isArray(result)
      ? result
      : ((result as { rows?: Record<string, unknown>[] }).rows ?? [])
  ) as Record<string, unknown>[];
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

/** Direct, stable sampling frame for Pulse exclusions. Callers can filter by
 * stratum/outcome and order by `stableSampleKey`; no joins to production
 * projections or interpretation of classifier payloads are required. */
export async function getPulseExclusionEvaluationCandidates(): Promise<
  PulseExclusionEvaluationCandidate[]
> {
  const result = await db.execute(sql`
    SELECT * FROM pulse_exclusion_evaluation_candidates
    ORDER BY stable_sample_key
  `);
  return rows(result).map((row) => ({
    outcomeKey: String(row.outcome_key),
    evaluationStratum: String(
      row.evaluation_stratum,
    ) as PulseExclusionEvaluationCandidate["evaluationStratum"],
    candidateKind: String(row.candidate_kind),
    candidateId: String(row.candidate_id),
    canonicalCandidateId: row.canonical_candidate_id
      ? String(row.canonical_candidate_id)
      : null,
    outcome: String(row.outcome),
    reasonCode: String(row.reason_code),
    reason: String(row.reason),
    actor: row.actor,
    methodVersion: String(row.method_version),
    stageRunId: String(row.stage_run_id),
    decisionKey: row.decision_key ? String(row.decision_key) : null,
    evidenceRefs: row.evidence_refs as string[],
    metadata: row.metadata,
    occurredAt:
      row.occurred_at instanceof Date
        ? row.occurred_at.toISOString()
        : String(row.occurred_at),
    stableSampleKey: String(row.stable_sample_key),
  }));
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
