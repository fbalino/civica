CREATE TABLE "pulse_event_decisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"schema_version" text NOT NULL,
	"decision_key" text NOT NULL,
	"cluster_id" uuid NOT NULL,
	"event_id" uuid,
	"kind" text NOT NULL,
	"verdict" text NOT NULL,
	"payload" jsonb NOT NULL,
	"actor" jsonb NOT NULL,
	"stage_run_id" uuid NOT NULL,
	"method_version" text NOT NULL,
	"rationale" text NOT NULL,
	"evidence_refs" text[] NOT NULL,
	"supersedes_decision_key" text,
	"decided_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "pulse_event_decisions_contract_check" CHECK ("pulse_event_decisions"."schema_version" = 'pulse-decision-ledger/v1' AND "pulse_event_decisions"."decision_key" ~ '^pulse-decision/sha256:[a-f0-9]{64}$' AND "pulse_event_decisions"."kind" IN ('event_existence','subject_attribution','category_labels','severity','calibration','corroboration','publication') AND "pulse_event_decisions"."verdict" IN ('affirmed','refuted','abstained','unresolved') AND "pulse_event_decisions"."rationale" <> '' AND jsonb_typeof("pulse_event_decisions"."payload") = 'object' AND NOT ("pulse_event_decisions"."payload" ? 'confidence') AND (("pulse_event_decisions"."kind" = 'event_existence' AND "pulse_event_decisions"."payload" ? 'disposition') OR ("pulse_event_decisions"."kind" = 'subject_attribution' AND "pulse_event_decisions"."payload" ?& ARRAY['status','primaryJurisdictionId','affectedJurisdictionIds']) OR ("pulse_event_decisions"."kind" = 'category_labels' AND "pulse_event_decisions"."payload" ?& ARRAY['categoryIds','dimensionIds']) OR ("pulse_event_decisions"."kind" = 'severity' AND "pulse_event_decisions"."payload" ?& ARRAY['tier','value','direction']) OR ("pulse_event_decisions"."kind" = 'calibration' AND "pulse_event_decisions"."payload" ?& ARRAY['standing','signals','targetDecisionKinds','validationReleaseId'] AND "pulse_event_decisions"."payload"->>'standing' = 'not_calibrated') OR ("pulse_event_decisions"."kind" = 'corroboration' AND "pulse_event_decisions"."payload" ?& ARRAY['independentEvidenceGroups','contributingReports','confidenceWeight','calibrationStanding'] AND "pulse_event_decisions"."payload"->>'calibrationStanding' = 'heuristic_not_probability') OR ("pulse_event_decisions"."kind" = 'publication' AND "pulse_event_decisions"."payload" ?& ARRAY['eligible','origin','gateReasons'])) AND jsonb_typeof("pulse_event_decisions"."actor") = 'object' AND "pulse_event_decisions"."actor"->>'type' IN ('classifier','verifier','subject_attributor','calibration_assessor','corroborator','publication_gate','human_reviewer','legacy_projection'))
);
--> statement-breakpoint
ALTER TABLE "pulse_event_decisions" ADD CONSTRAINT "pulse_event_decisions_event_id_pulse_events_v2_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."pulse_events_v2"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pulse_event_decisions" ADD CONSTRAINT "pulse_event_decisions_stage_run_id_pulse_pipeline_runs_id_fk" FOREIGN KEY ("stage_run_id") REFERENCES "public"."pulse_pipeline_runs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_pulse_event_decisions_key" ON "pulse_event_decisions" USING btree ("decision_key");--> statement-breakpoint
ALTER TABLE "pulse_event_decisions" ADD CONSTRAINT "pulse_event_decisions_supersedes_decision_key_fk" FOREIGN KEY ("supersedes_decision_key") REFERENCES "public"."pulse_event_decisions"("decision_key") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_pulse_event_decisions_event_kind_time" ON "pulse_event_decisions" USING btree ("event_id","kind","decided_at");--> statement-breakpoint
CREATE INDEX "idx_pulse_event_decisions_cluster_kind_time" ON "pulse_event_decisions" USING btree ("cluster_id","kind","decided_at");--> statement-breakpoint
CREATE INDEX "idx_pulse_event_decisions_run" ON "pulse_event_decisions" USING btree ("stage_run_id");
--> statement-breakpoint
INSERT INTO "pulse_event_decisions" (
  "schema_version", "decision_key", "cluster_id", "event_id", "kind",
  "verdict", "payload", "actor", "stage_run_id", "method_version",
  "rationale", "evidence_refs", "decided_at"
)
SELECT
  'pulse-decision-ledger/v1',
  'pulse-decision/sha256:' || encode(digest(concat_ws('|', 'legacy_projection_v1', p.id::text, decision.kind), 'sha256'), 'hex'),
  p.cluster_id,
  p.id,
  decision.kind,
  CASE WHEN decision.kind = 'event_existence' THEN 'affirmed' ELSE 'unresolved' END,
  CASE decision.kind
    WHEN 'event_existence' THEN jsonb_build_object('disposition', 'event')
    WHEN 'subject_attribution' THEN jsonb_build_object(
      'status', 'single',
      'primaryJurisdictionId', p.jurisdiction_id,
      'affectedJurisdictionIds', jsonb_build_array(p.jurisdiction_id)
    )
    WHEN 'category_labels' THEN jsonb_build_object(
      'categoryIds', jsonb_build_array(p.category),
      'dimensionIds', jsonb_build_array(p.dimension)
    )
    WHEN 'severity' THEN jsonb_build_object(
      'tier', p.severity_tier,
      'value', p.severity_value,
      'direction', CASE WHEN p.severity_value > 0 THEN 'positive' WHEN p.severity_value < 0 THEN 'negative' ELSE 'neutral' END
    )
    WHEN 'calibration' THEN jsonb_build_object(
      'standing', 'not_calibrated',
      'signals', jsonb_build_array('legacy_classifier_agreement'),
      'targetDecisionKinds', jsonb_build_array('event_existence', 'subject_attribution', 'category_labels', 'severity', 'publication'),
      'validationReleaseId', NULL
    )
    WHEN 'corroboration' THEN jsonb_build_object(
      'independentEvidenceGroups', NULL,
      'contributingReports', (SELECT count(*)::int FROM pulse_sources ps WHERE ps.event_id = p.id),
      'confidenceWeight', p.corroboration_confidence,
      'calibrationStanding', 'heuristic_not_probability'
    )
    ELSE jsonb_build_object(
      'eligible', p.published,
      'origin', CASE
        WHEN NOT p.published AND p.review_status <> 'rejected' THEN 'queued'
        WHEN NOT p.published AND p.human_reviewed THEN 'human_rejected'
        WHEN NOT p.published THEN 'legacy_rejected_unverified'
        WHEN NOT p.human_reviewed THEN 'auto'
        WHEN p.review_status = 'edited' THEN 'human_edited'
        ELSE 'human_approved'
      END,
      'gateReasons', jsonb_build_array('legacy_current_state_projection')
    )
  END,
  jsonb_build_object(
    'type', 'legacy_projection',
    'provider', NULL,
    'model', NULL,
    'reviewerId', CASE WHEN p.human_reviewed THEN p.reviewer_id ELSE NULL END
  ),
  CASE decision.kind
    WHEN 'corroboration' THEN COALESCE(p.corroboration_run_id, p.classification_run_id)
    WHEN 'publication' THEN COALESCE(p.publication_run_id, p.classification_run_id)
    ELSE p.classification_run_id
  END,
  'legacy_unversioned',
  CASE decision.kind
    WHEN 'event_existence' THEN 'Retained event row establishes that the cluster entered the event ledger.'
    WHEN 'subject_attribution' THEN 'Current subject projection retained; no independent historical attribution decision can be reconstructed.'
    WHEN 'category_labels' THEN 'Current category projection retained; no independent historical category decision can be reconstructed.'
    WHEN 'severity' THEN 'Current severity projection retained; no independent historical severity decision can be reconstructed.'
    WHEN 'calibration' THEN 'Historical confidence and agreement signals have no representative calibration release and remain diagnostics only.'
    WHEN 'corroboration' THEN 'Current heuristic weight retained without treating it as a calibrated probability or reconstructing an independent historical verdict.'
    ELSE 'Current publication projection retained; the complete historical gate decision cannot be reconstructed.'
  END,
  ARRAY(
    SELECT 'raw-event:' || ps.raw_event_id::text
    FROM pulse_sources ps
    WHERE ps.event_id = p.id
    ORDER BY ps.raw_event_id
  ),
  COALESCE(p.updated_at, p.created_at)
FROM pulse_events_v2 p
CROSS JOIN (VALUES
  ('event_existence'::text),
  ('subject_attribution'::text),
  ('category_labels'::text),
  ('severity'::text),
  ('calibration'::text),
  ('corroboration'::text),
  ('publication'::text)
) AS decision(kind);
--> statement-breakpoint
INSERT INTO "pulse_event_decisions" (
  "schema_version", "decision_key", "cluster_id", "event_id", "kind",
  "verdict", "payload", "actor", "stage_run_id", "method_version",
  "rationale", "evidence_refs", "decided_at"
)
SELECT
  'pulse-decision-ledger/v1',
  'pulse-decision/sha256:' || encode(digest(concat_ws('|', 'legacy_non_event_v1', r.cluster_id::text), 'sha256'), 'hex'),
  r.cluster_id,
  NULL,
  'event_existence',
  'refuted',
  jsonb_build_object('disposition', 'non_event'),
  jsonb_build_object('type', 'legacy_projection', 'provider', NULL, 'model', NULL, 'reviewerId', NULL),
  (array_agg(r.classification_run_id ORDER BY r.classified_at DESC NULLS LAST))[1],
  'legacy_unversioned',
  'Retained terminal classifier disposition identifies this cluster as non-governance.',
  array_agg(DISTINCT 'raw-event:' || r.id::text ORDER BY 'raw-event:' || r.id::text),
  max(COALESCE(r.classified_at, r.created_at))
FROM raw_events r
WHERE r.cluster_id IS NOT NULL
  AND r.classification_disposition = 'non_governance'
  AND r.classification_run_id IS NOT NULL
GROUP BY r.cluster_id;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION civica_protect_pulse_event_decisions()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Pulse decisions are append-only; record a superseding decision instead';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER pulse_event_decisions_append_only
BEFORE UPDATE OR DELETE ON "pulse_event_decisions"
FOR EACH ROW EXECUTE FUNCTION civica_protect_pulse_event_decisions();
