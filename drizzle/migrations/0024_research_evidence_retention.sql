-- civica-affected-relations: country_facts,data_disputes,data_facts_audit_log,statements,ci_dimension_scores,ci_composite_scores,civica_conditions_scores,country_metrics,indicator_history,government_taxonomies,raw_events,pulse_events_v2,pulse_sources,pulse_dimensional_deltas,pulse_review_audit_log,correction_log,elections,election_results,legislature_parties,constitutions,constitution_topic_excerpts,organization_memberships,government_bodies,offices,persons,terms,backtest_cases,backtest_events,backtest_runs,research_evidence_history
CREATE TABLE IF NOT EXISTS "research_evidence_history" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "entity_table" text NOT NULL,
  "entity_id" text NOT NULL,
  "operation" text NOT NULL,
  "before" jsonb NOT NULL,
  "after" jsonb,
  "reason" text NOT NULL,
  "actor_id" text NOT NULL,
  "recorded_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "research_evidence_history_operation_allowed"
    CHECK ("operation" IN ('update', 'delete')),
  CONSTRAINT "research_evidence_history_reason_nonempty"
    CHECK (length(btrim("reason")) > 0),
  CONSTRAINT "research_evidence_history_actor_nonempty"
    CHECK (length(btrim("actor_id")) > 0)
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_research_evidence_entity"
  ON "research_evidence_history" ("entity_table", "entity_id", "recorded_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_research_evidence_operation"
  ON "research_evidence_history" ("operation", "recorded_at");
--> statement-breakpoint

ALTER TABLE "raw_events"
  ADD COLUMN IF NOT EXISTS "classification_disposition" text DEFAULT 'pending' NOT NULL,
  ADD COLUMN IF NOT EXISTS "classification_reason" text,
  ADD COLUMN IF NOT EXISTS "classification_decision" jsonb,
  ADD COLUMN IF NOT EXISTS "classified_at" timestamp;
--> statement-breakpoint

ALTER TABLE "raw_events"
  DROP CONSTRAINT IF EXISTS "raw_events_classification_disposition_allowed";
--> statement-breakpoint
ALTER TABLE "raw_events"
  ADD CONSTRAINT "raw_events_classification_disposition_allowed"
  CHECK ("classification_disposition" IN ('pending', 'event', 'non_governance', 'invalid'));
--> statement-breakpoint

ALTER TABLE "pulse_review_audit_log"
  DROP CONSTRAINT IF EXISTS "pulse_review_audit_log_event_id_pulse_events_v2_id_fk";
--> statement-breakpoint
ALTER TABLE "pulse_review_audit_log"
  ADD CONSTRAINT "pulse_review_audit_log_event_id_pulse_events_v2_id_fk"
  FOREIGN KEY ("event_id") REFERENCES "pulse_events_v2"("id")
  ON DELETE RESTRICT ON UPDATE NO ACTION;
--> statement-breakpoint

ALTER TABLE "pulse_sources"
  DROP CONSTRAINT IF EXISTS "pulse_sources_event_id_pulse_events_v2_id_fk";
--> statement-breakpoint
ALTER TABLE "pulse_sources"
  ADD CONSTRAINT "pulse_sources_event_id_pulse_events_v2_id_fk"
  FOREIGN KEY ("event_id") REFERENCES "pulse_events_v2"("id")
  ON DELETE RESTRICT ON UPDATE NO ACTION;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION civica_capture_research_evidence_history()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  before_row jsonb := to_jsonb(OLD);
  after_row jsonb := CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(NEW) ELSE NULL END;
  evidence_id text;
  evidence_actor text;
  evidence_reason text;
BEGIN
  evidence_id := COALESCE(after_row->>'id', before_row->>'id', md5(before_row::text));
  evidence_actor := COALESCE(
    NULLIF(after_row->>'reviewer_id', ''),
    NULLIF(after_row->>'actor_id', ''),
    NULLIF(before_row->>'reviewer_id', ''),
    current_user
  );
  evidence_reason := COALESCE(
    NULLIF(after_row->>'status_reason', ''),
    NULLIF(after_row->>'review_notes', ''),
    NULLIF(after_row->>'disposition', ''),
    NULLIF(after_row->>'classification_reason', ''),
    NULLIF(before_row->>'status_reason', ''),
    lower(TG_OP) || '_retained_by_dat_016'
  );

  INSERT INTO research_evidence_history (
    entity_table, entity_id, operation, before, after, reason, actor_id
  ) VALUES (
    TG_TABLE_NAME, evidence_id, lower(TG_OP), before_row, after_row,
    evidence_reason, evidence_actor
  );

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION civica_reject_research_evidence_history_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'research_evidence_history is append-only';
END;
$$;
--> statement-breakpoint

DROP TRIGGER IF EXISTS research_evidence_history_append_only ON "research_evidence_history";
--> statement-breakpoint
CREATE TRIGGER research_evidence_history_append_only
  BEFORE UPDATE OR DELETE ON "research_evidence_history"
  FOR EACH ROW EXECUTE FUNCTION civica_reject_research_evidence_history_mutation();
--> statement-breakpoint

DO $$
DECLARE
  relation_name text;
BEGIN
  FOREACH relation_name IN ARRAY ARRAY[
    'country_facts', 'data_disputes', 'data_facts_audit_log', 'statements',
    'ci_dimension_scores', 'ci_composite_scores', 'civica_conditions_scores',
    'country_metrics', 'indicator_history', 'government_taxonomies',
    'raw_events', 'pulse_events_v2', 'pulse_sources',
    'pulse_dimensional_deltas', 'pulse_review_audit_log', 'correction_log',
    'elections', 'election_results', 'legislature_parties', 'constitutions',
    'constitution_topic_excerpts', 'organization_memberships',
    'government_bodies', 'offices', 'persons', 'terms',
    'backtest_cases', 'backtest_events', 'backtest_runs'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS dat_016_retain_mutation ON %I', relation_name);
    EXECUTE format(
      'CREATE TRIGGER dat_016_retain_mutation BEFORE UPDATE OR DELETE ON %I '
      'FOR EACH ROW EXECUTE FUNCTION civica_capture_research_evidence_history()',
      relation_name
    );
  END LOOP;
END;
$$;
--> statement-breakpoint

CREATE OR REPLACE VIEW pulse_evaluation_evidence AS
SELECT
  'classifier_disposition'::text AS evidence_kind,
  re.id::text AS evidence_id,
  CASE
    WHEN re.classification_disposition = 'non_governance' THEN 'false_negative_candidate'
    WHEN re.classification_disposition = 'invalid' THEN 'invalid_classification_candidate'
    ELSE re.classification_disposition
  END AS outcome,
  jsonb_build_object(
    'raw_event', to_jsonb(re),
    'decision', re.classification_decision,
    'reason', re.classification_reason
  ) AS payload,
  COALESCE(re.classified_at, re.created_at) AS recorded_at
FROM raw_events re
WHERE re.classification_disposition <> 'pending'
UNION ALL
SELECT
  'human_review'::text,
  pe.id::text,
  CASE WHEN pe.review_status = 'rejected' THEN 'false_positive_candidate'
       ELSE 'reviewed_event' END,
  to_jsonb(pe),
  pe.updated_at
FROM pulse_events_v2 pe
WHERE pe.human_reviewed = true OR pe.review_status = 'rejected';
--> statement-breakpoint

CREATE OR REPLACE VIEW reconciliation_evaluation_evidence AS
SELECT
  'non_active_fact'::text AS evidence_kind,
  cf.id::text AS evidence_id,
  cf.status AS outcome,
  to_jsonb(cf) AS payload,
  cf.updated_at AS recorded_at
FROM country_facts cf
WHERE cf.status <> 'active'
UNION ALL
SELECT
  'dispute'::text,
  dd.id::text,
  dd.status,
  to_jsonb(dd),
  COALESCE(dd.resolved_at, dd.created_at)
FROM data_disputes dd;
