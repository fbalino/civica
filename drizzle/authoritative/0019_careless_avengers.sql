CREATE TABLE "pulse_candidate_outcomes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"schema_version" text NOT NULL,
	"outcome_key" text NOT NULL,
	"candidate_kind" text NOT NULL,
	"candidate_id" text NOT NULL,
	"outcome" text NOT NULL,
	"reason_code" text NOT NULL,
	"reason" text NOT NULL,
	"actor" jsonb NOT NULL,
	"method_version" text NOT NULL,
	"stage_run_id" uuid NOT NULL,
	"decision_key" text,
	"canonical_candidate_id" text,
	"evidence_refs" text[] NOT NULL,
	"metadata" jsonb NOT NULL,
	"occurred_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "pulse_candidate_outcomes_contract_check" CHECK ("pulse_candidate_outcomes"."schema_version" = 'pulse-candidate-outcome/v1' AND "pulse_candidate_outcomes"."outcome_key" ~ '^pulse-candidate-outcome/sha256:[a-f0-9]{64}$' AND "pulse_candidate_outcomes"."candidate_kind" IN ('raw_item','cluster','event','decision') AND "pulse_candidate_outcomes"."outcome" IN ('duplicate','non_event','insufficient_evidence','invalid','refuted','rejected') AND "pulse_candidate_outcomes"."reason_code" <> '' AND "pulse_candidate_outcomes"."reason" <> '' AND "pulse_candidate_outcomes"."method_version" <> '' AND cardinality("pulse_candidate_outcomes"."evidence_refs") > 0 AND jsonb_typeof("pulse_candidate_outcomes"."actor") = 'object' AND "pulse_candidate_outcomes"."actor"->>'type' IN ('classifier','verifier','subject_attributor','calibration_assessor','corroborator','publication_gate','human_reviewer','legacy_projection') AND jsonb_typeof("pulse_candidate_outcomes"."metadata") = 'object' AND (("pulse_candidate_outcomes"."outcome" = 'duplicate' AND "pulse_candidate_outcomes"."canonical_candidate_id" IS NOT NULL) OR ("pulse_candidate_outcomes"."outcome" <> 'duplicate')))
);
--> statement-breakpoint
ALTER TABLE "pulse_candidate_outcomes" ADD CONSTRAINT "pulse_candidate_outcomes_stage_run_id_pulse_pipeline_runs_id_fk" FOREIGN KEY ("stage_run_id") REFERENCES "public"."pulse_pipeline_runs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pulse_candidate_outcomes" ADD CONSTRAINT "pulse_candidate_outcomes_decision_key_pulse_event_decisions_decision_key_fk" FOREIGN KEY ("decision_key") REFERENCES "public"."pulse_event_decisions"("decision_key") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_pulse_candidate_outcomes_key" ON "pulse_candidate_outcomes" USING btree ("outcome_key");--> statement-breakpoint
CREATE INDEX "idx_pulse_candidate_outcomes_sample" ON "pulse_candidate_outcomes" USING btree ("outcome","occurred_at");--> statement-breakpoint
CREATE INDEX "idx_pulse_candidate_outcomes_candidate" ON "pulse_candidate_outcomes" USING btree ("candidate_kind","candidate_id");--> statement-breakpoint
CREATE INDEX "idx_pulse_candidate_outcomes_run" ON "pulse_candidate_outcomes" USING btree ("stage_run_id");
--> statement-breakpoint
CREATE OR REPLACE FUNCTION materialize_pulse_candidate_outcome()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  outcome_value text;
  reason_code_value text;
  candidate_kind_value text;
  candidate_id_value text;
BEGIN
  IF NEW.kind = 'event_existence' AND NEW.verdict = 'refuted'
     AND NEW.actor->>'type' = 'human_reviewer' THEN
    outcome_value := 'rejected';
    reason_code_value := 'human_event_rejection';
  ELSIF NEW.kind = 'event_existence' AND NEW.payload->>'disposition' = 'non_event' THEN
    outcome_value := 'non_event';
    reason_code_value := 'event_existence_non_event';
  ELSIF NEW.kind = 'event_existence'
        AND NEW.payload->>'disposition' IN ('insufficient_evidence','unresolved') THEN
    outcome_value := 'insufficient_evidence';
    reason_code_value := 'event_existence_insufficient_evidence';
  ELSIF NEW.verdict = 'refuted' THEN
    outcome_value := 'refuted';
    reason_code_value := 'decision_axis_refuted';
  ELSE
    RETURN NEW;
  END IF;

  candidate_kind_value := CASE WHEN NEW.event_id IS NULL THEN 'cluster' ELSE 'event' END;
  candidate_id_value := COALESCE(NEW.event_id::text, NEW.cluster_id::text);
  INSERT INTO pulse_candidate_outcomes (
    schema_version, outcome_key, candidate_kind, candidate_id, outcome,
    reason_code, reason, actor, method_version, stage_run_id, decision_key,
    canonical_candidate_id, evidence_refs, metadata, occurred_at
  ) VALUES (
    'pulse-candidate-outcome/v1',
    'pulse-candidate-outcome/sha256:' || encode(digest(
      NEW.decision_key || '|' || outcome_value, 'sha256'
    ), 'hex'),
    candidate_kind_value,
    candidate_id_value,
    outcome_value,
    reason_code_value,
    NEW.rationale,
    NEW.actor,
    NEW.method_version,
    NEW.stage_run_id,
    NEW.decision_key,
    NULL,
    NEW.evidence_refs,
    jsonb_build_object(
      'decisionKind', NEW.kind,
      'decisionVerdict', NEW.verdict,
      'decisionPayload', NEW.payload
    ),
    NEW.decided_at
  ) ON CONFLICT (outcome_key) DO NOTHING;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER pulse_event_decisions_materialize_candidate_outcome
AFTER INSERT ON pulse_event_decisions
FOR EACH ROW EXECUTE FUNCTION materialize_pulse_candidate_outcome();
--> statement-breakpoint
INSERT INTO pulse_candidate_outcomes (
  schema_version, outcome_key, candidate_kind, candidate_id, outcome,
  reason_code, reason, actor, method_version, stage_run_id, decision_key,
  canonical_candidate_id, evidence_refs, metadata, occurred_at
)
SELECT
  'pulse-candidate-outcome/v1',
  'pulse-candidate-outcome/sha256:' || encode(digest(
    d.decision_key || '|' || mapped.outcome, 'sha256'
  ), 'hex'),
  CASE WHEN d.event_id IS NULL THEN 'cluster' ELSE 'event' END,
  COALESCE(d.event_id::text, d.cluster_id::text),
  mapped.outcome,
  mapped.reason_code,
  d.rationale,
  d.actor,
  d.method_version,
  d.stage_run_id,
  d.decision_key,
  NULL,
  d.evidence_refs,
  jsonb_build_object(
    'decisionKind', d.kind,
    'decisionVerdict', d.verdict,
    'decisionPayload', d.payload,
    'backfilled', true
  ),
  d.decided_at
FROM pulse_event_decisions d
CROSS JOIN LATERAL (
  SELECT
    CASE
      WHEN d.kind = 'event_existence' AND d.verdict = 'refuted'
           AND d.actor->>'type' = 'human_reviewer' THEN 'rejected'
      WHEN d.kind = 'event_existence' AND d.payload->>'disposition' = 'non_event' THEN 'non_event'
      WHEN d.kind = 'event_existence' AND d.payload->>'disposition' IN ('insufficient_evidence','unresolved') THEN 'insufficient_evidence'
      WHEN d.verdict = 'refuted' THEN 'refuted'
      ELSE NULL
    END AS outcome,
    CASE
      WHEN d.kind = 'event_existence' AND d.verdict = 'refuted'
           AND d.actor->>'type' = 'human_reviewer' THEN 'human_event_rejection'
      WHEN d.kind = 'event_existence' AND d.payload->>'disposition' = 'non_event' THEN 'event_existence_non_event'
      WHEN d.kind = 'event_existence' AND d.payload->>'disposition' IN ('insufficient_evidence','unresolved') THEN 'event_existence_insufficient_evidence'
      WHEN d.verdict = 'refuted' THEN 'decision_axis_refuted'
      ELSE NULL
    END AS reason_code
) mapped
WHERE mapped.outcome IS NOT NULL
ON CONFLICT (outcome_key) DO NOTHING;
--> statement-breakpoint
INSERT INTO pulse_candidate_outcomes (
  schema_version, outcome_key, candidate_kind, candidate_id, outcome,
  reason_code, reason, actor, method_version, stage_run_id, decision_key,
  canonical_candidate_id, evidence_refs, metadata, occurred_at
)
SELECT
  'pulse-candidate-outcome/v1',
  'pulse-candidate-outcome/sha256:' || encode(digest(
    'legacy-raw|' || r.id::text || '|' || r.classification_disposition, 'sha256'
  ), 'hex'),
  'raw_item',
  r.evidence_identity_key,
  CASE r.classification_disposition
    WHEN 'non_governance' THEN 'non_event'
    ELSE 'invalid'
  END,
  CASE r.classification_disposition
    WHEN 'non_governance' THEN 'retained_raw_non_governance'
    ELSE 'retained_raw_invalid'
  END,
  r.classification_reason,
  jsonb_build_object('type','legacy_projection','provider',NULL,'model',NULL,'reviewerId',NULL),
  COALESCE(r.classification_decision->>'methodVersion', 'legacy-unversioned'),
  r.classification_run_id,
  NULL,
  NULL,
  ARRAY['raw-event:' || r.id::text, r.evidence_identity_key],
  jsonb_build_object('rawEventId', r.id, 'classificationDisposition', r.classification_disposition, 'backfilled', true),
  r.classified_at
FROM raw_events r
WHERE r.classification_disposition IN ('non_governance','invalid')
  AND r.classification_run_id IS NOT NULL
  AND r.classified_at IS NOT NULL
  AND r.classification_reason IS NOT NULL
ON CONFLICT (outcome_key) DO NOTHING;
--> statement-breakpoint
INSERT INTO pulse_candidate_outcomes (
  schema_version, outcome_key, candidate_kind, candidate_id, outcome,
  reason_code, reason, actor, method_version, stage_run_id, decision_key,
  canonical_candidate_id, evidence_refs, metadata, occurred_at
)
SELECT
  'pulse-candidate-outcome/v1',
  'pulse-candidate-outcome/sha256:' || encode(digest(
    'legacy-rejected-event|' || e.id::text, 'sha256'
  ), 'hex'),
  'event', e.id::text, 'rejected', 'retained_human_rejection',
  COALESCE(NULLIF(e.review_notes, ''), 'Human reviewer rejected the event candidate.'),
  jsonb_build_object('type','legacy_projection','provider',NULL,'model',NULL,'reviewerId',e.reviewer_id),
  'legacy-unversioned',
  COALESCE(e.publication_run_id, e.classification_run_id),
  NULL, NULL,
  ARRAY['event:' || e.id::text],
  jsonb_build_object('reviewStatus', e.review_status, 'backfilled', true),
  e.updated_at
FROM pulse_events_v2 e
WHERE e.review_status = 'rejected'
  AND NOT EXISTS (
    SELECT 1 FROM pulse_candidate_outcomes o
    WHERE o.candidate_kind = 'event' AND o.candidate_id = e.id::text AND o.outcome = 'rejected'
  )
ON CONFLICT (outcome_key) DO NOTHING;
--> statement-breakpoint
CREATE OR REPLACE VIEW pulse_exclusion_evaluation_candidates AS
SELECT
  o.outcome_key,
  CASE WHEN o.outcome IN ('rejected','refuted')
    THEN 'false_positive_candidate'
    ELSE 'false_negative_candidate'
  END AS evaluation_stratum,
  o.candidate_kind,
  o.candidate_id,
  o.canonical_candidate_id,
  o.outcome,
  o.reason_code,
  o.reason,
  o.actor,
  o.method_version,
  o.stage_run_id,
  o.decision_key,
  o.evidence_refs,
  o.metadata,
  o.occurred_at,
  encode(digest(o.outcome_key, 'sha256'), 'hex') AS stable_sample_key
FROM pulse_candidate_outcomes o;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION reject_pulse_candidate_outcome_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'pulse_candidate_outcomes is append-only';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER pulse_candidate_outcomes_append_only
BEFORE UPDATE OR DELETE ON pulse_candidate_outcomes
FOR EACH ROW EXECUTE FUNCTION reject_pulse_candidate_outcome_mutation();
