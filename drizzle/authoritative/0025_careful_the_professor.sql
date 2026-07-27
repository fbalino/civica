CREATE TABLE "pulse_review_obligations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"schema_version" text NOT NULL,
	"event_id" uuid NOT NULL,
	"incident_id" uuid NOT NULL,
	"sla_version" text NOT NULL,
	"priority" text NOT NULL,
	"trigger_reason" text NOT NULL,
	"queued_at" timestamp NOT NULL,
	"queued_at_basis" text NOT NULL,
	"escalate_at" timestamp NOT NULL,
	"due_at" timestamp NOT NULL,
	"state" text NOT NULL,
	"claimed_by" text,
	"claimed_at" timestamp,
	"claim_expires_at" timestamp,
	"disposition" text,
	"dispositioned_by" text,
	"dispositioned_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "pulse_review_obligation_contract_check" CHECK ("pulse_review_obligations"."schema_version" = 'pulse-review-obligation/v1' AND "pulse_review_obligations"."sla_version" = 'pulse-review-sla/v1' AND "pulse_review_obligations"."priority" IN ('critical','urgent','standard') AND "pulse_review_obligations"."queued_at_basis" IN ('recorded','created_at_proxy') AND "pulse_review_obligations"."state" IN ('open','claimed','dispositioned','legacy_quarantined') AND btrim("pulse_review_obligations"."trigger_reason") <> '' AND "pulse_review_obligations"."queued_at" <= "pulse_review_obligations"."escalate_at" AND "pulse_review_obligations"."escalate_at" <= "pulse_review_obligations"."due_at" AND (("pulse_review_obligations"."state" = 'open' AND "pulse_review_obligations"."claimed_by" IS NULL AND "pulse_review_obligations"."claimed_at" IS NULL AND "pulse_review_obligations"."claim_expires_at" IS NULL AND "pulse_review_obligations"."disposition" IS NULL AND "pulse_review_obligations"."dispositioned_by" IS NULL AND "pulse_review_obligations"."dispositioned_at" IS NULL) OR ("pulse_review_obligations"."state" = 'claimed' AND btrim("pulse_review_obligations"."claimed_by") <> '' AND "pulse_review_obligations"."claimed_at" IS NOT NULL AND "pulse_review_obligations"."claim_expires_at" > "pulse_review_obligations"."claimed_at" AND "pulse_review_obligations"."disposition" IS NULL AND "pulse_review_obligations"."dispositioned_by" IS NULL AND "pulse_review_obligations"."dispositioned_at" IS NULL) OR ("pulse_review_obligations"."state" IN ('dispositioned','legacy_quarantined') AND btrim("pulse_review_obligations"."disposition") <> '' AND btrim("pulse_review_obligations"."dispositioned_by") <> '' AND "pulse_review_obligations"."dispositioned_at" IS NOT NULL)))
);
--> statement-breakpoint
CREATE TABLE "pulse_review_sla_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"schema_version" text NOT NULL,
	"event_key" text NOT NULL,
	"obligation_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"actor" jsonb NOT NULL,
	"reason_code" text NOT NULL,
	"note" text NOT NULL,
	"effective_at" timestamp NOT NULL,
	"expires_at" timestamp,
	"metadata" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "pulse_review_sla_event_contract_check" CHECK ("pulse_review_sla_events"."schema_version" = 'pulse-review-sla-event/v1' AND "pulse_review_sla_events"."event_key" ~ '^pulse-review-sla-event/sha256:[a-f0-9]{64}$' AND "pulse_review_sla_events"."kind" IN ('enqueued','claimed','released','escalated','exception_granted','exception_expired','dispositioned','legacy_quarantined') AND jsonb_typeof("pulse_review_sla_events"."actor") = 'object' AND jsonb_typeof("pulse_review_sla_events"."metadata") = 'object' AND btrim("pulse_review_sla_events"."reason_code") <> '' AND btrim("pulse_review_sla_events"."note") <> '' AND (("pulse_review_sla_events"."kind" = 'exception_granted' AND "pulse_review_sla_events"."expires_at" > "pulse_review_sla_events"."effective_at") OR ("pulse_review_sla_events"."kind" <> 'exception_granted' AND "pulse_review_sla_events"."expires_at" IS NULL)))
);
--> statement-breakpoint
ALTER TABLE "pulse_review_obligations" ADD CONSTRAINT "pulse_review_obligations_event_id_pulse_events_v2_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."pulse_events_v2"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pulse_review_obligations" ADD CONSTRAINT "pulse_review_obligations_incident_id_pulse_incidents_id_fk" FOREIGN KEY ("incident_id") REFERENCES "public"."pulse_incidents"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pulse_review_sla_events" ADD CONSTRAINT "pulse_review_sla_events_obligation_id_pulse_review_obligations_id_fk" FOREIGN KEY ("obligation_id") REFERENCES "public"."pulse_review_obligations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_pulse_review_obligation_event_version" ON "pulse_review_obligations" USING btree ("event_id","sla_version");--> statement-breakpoint
CREATE INDEX "idx_pulse_review_obligation_active_due" ON "pulse_review_obligations" USING btree ("state","due_at");--> statement-breakpoint
CREATE INDEX "idx_pulse_review_obligation_priority_due" ON "pulse_review_obligations" USING btree ("priority","due_at");--> statement-breakpoint
CREATE INDEX "idx_pulse_review_obligation_incident" ON "pulse_review_obligations" USING btree ("incident_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_pulse_review_sla_event_key" ON "pulse_review_sla_events" USING btree ("event_key");--> statement-breakpoint
CREATE INDEX "idx_pulse_review_sla_event_obligation" ON "pulse_review_sla_events" USING btree ("obligation_id","effective_at");--> statement-breakpoint
CREATE INDEX "idx_pulse_review_sla_event_kind" ON "pulse_review_sla_events" USING btree ("kind","effective_at");--> statement-breakpoint

-- PUL-033 historical boundary. These rows predate an SLA and cannot be
-- described as on-time, reviewed, approved, or rejected. Preserve their
-- original event creation time as an explicit proxy and quarantine them from
-- the active queue without changing the substantive classifier record.
INSERT INTO pulse_review_obligations (
  schema_version, event_id, incident_id, sla_version, priority,
  trigger_reason, queued_at, queued_at_basis, escalate_at, due_at, state,
  disposition, dispositioned_by, dispositioned_at, created_at, updated_at
)
SELECT
  'pulse-review-obligation/v1', p.id, p.incident_id, 'pulse-review-sla/v1',
  CASE
    WHEN p.severity_tier = 'catastrophic_neg' THEN 'critical'
    WHEN p.severity_tier IN ('severe_neg', 'high_pos') THEN 'urgent'
    ELSE 'standard'
  END,
  'pre_contract_pending_review', p.created_at, 'created_at_proxy',
  CASE
    WHEN p.severity_tier = 'catastrophic_neg' THEN p.created_at
    WHEN p.severity_tier IN ('severe_neg', 'high_pos') THEN p.created_at + interval '24 hours'
    ELSE p.created_at + interval '5 days'
  END,
  CASE
    WHEN p.severity_tier = 'catastrophic_neg' THEN p.created_at + interval '24 hours'
    WHEN p.severity_tier IN ('severe_neg', 'high_pos') THEN p.created_at + interval '72 hours'
    ELSE p.created_at + interval '7 days'
  END,
  'legacy_quarantined', 'pre_contract_unreviewed_backlog',
  'system:migration-0025', now(), now(), now()
FROM pulse_events_v2 p
WHERE p.review_status = 'pending'
  AND p.published = false
  AND p.projection_status = 'current'
ON CONFLICT (event_id, sla_version) DO NOTHING;--> statement-breakpoint

INSERT INTO pulse_review_sla_events (
  schema_version, event_key, obligation_id, kind, actor, reason_code, note,
  effective_at, expires_at, metadata, created_at
)
SELECT
  'pulse-review-sla-event/v1',
  'pulse-review-sla-event/sha256:' || encode(
    digest(o.id::text || E'\nlegacy_quarantined\npre_contract_unreviewed_backlog', 'sha256'),
    'hex'
  ),
  o.id, 'legacy_quarantined',
  '{"type":"system_migration","id":"0025_careful_the_professor"}'::jsonb,
  'pre_contract_unreviewed_backlog',
  'Retained unpublished because the item entered review before pulse-review-sla/v1 and has no recorded human disposition.',
  o.dispositioned_at, NULL,
  jsonb_build_object(
    'queuedAtBasis', o.queued_at_basis,
    'historicalBoundary', 'PUL-033',
    'humanReviewed', false
  ),
  o.created_at
FROM pulse_review_obligations o
WHERE o.state = 'legacy_quarantined'
  AND o.disposition = 'pre_contract_unreviewed_backlog'
ON CONFLICT (event_key) DO NOTHING;--> statement-breakpoint

UPDATE pulse_events_v2 p
SET review_status = 'legacy_quarantined',
    human_reviewed = false,
    reviewer_id = NULL,
    updated_at = now()
FROM pulse_review_obligations o
WHERE o.event_id = p.id
  AND o.state = 'legacy_quarantined'
  AND p.review_status = 'pending'
  AND p.published = false;--> statement-breakpoint

ALTER TABLE pulse_events_v2
ADD CONSTRAINT pulse_events_v2_review_status_check
CHECK (
  review_status IN ('pending','approved','rejected','edited','legacy_quarantined')
  AND (review_status <> 'pending' OR (published = false AND human_reviewed = false))
  AND (review_status <> 'legacy_quarantined' OR (published = false AND human_reviewed = false AND reviewer_id IS NULL))
);--> statement-breakpoint

CREATE OR REPLACE FUNCTION civica_sync_pulse_review_obligation()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  obligation_id uuid;
  queue_time timestamp;
  priority_value text;
  escalate_time timestamp;
  due_time timestamp;
BEGIN
  IF NEW.review_status = 'pending'
     AND NEW.published = false
     AND NEW.projection_status = 'current' THEN
    queue_time := CASE
      WHEN TG_OP = 'INSERT' THEN NEW.created_at
      ELSE NEW.updated_at
    END;
    priority_value := CASE
      WHEN NEW.severity_tier = 'catastrophic_neg' THEN 'critical'
      WHEN NEW.severity_tier IN ('severe_neg', 'high_pos') THEN 'urgent'
      ELSE 'standard'
    END;
    escalate_time := CASE
      WHEN priority_value = 'critical' THEN queue_time
      WHEN priority_value = 'urgent' THEN queue_time + interval '24 hours'
      ELSE queue_time + interval '5 days'
    END;
    due_time := CASE
      WHEN priority_value = 'critical' THEN queue_time + interval '24 hours'
      WHEN priority_value = 'urgent' THEN queue_time + interval '72 hours'
      ELSE queue_time + interval '7 days'
    END;

    INSERT INTO pulse_review_obligations (
      schema_version, event_id, incident_id, sla_version, priority,
      trigger_reason, queued_at, queued_at_basis, escalate_at, due_at, state
    ) VALUES (
      'pulse-review-obligation/v1', NEW.id, NEW.incident_id,
      'pulse-review-sla/v1', priority_value, 'publication_gate', queue_time,
      'recorded', escalate_time, due_time, 'open'
    )
    ON CONFLICT (event_id, sla_version) DO NOTHING
    RETURNING id INTO obligation_id;

    IF obligation_id IS NOT NULL THEN
      INSERT INTO pulse_review_sla_events (
        schema_version, event_key, obligation_id, kind, actor, reason_code,
        note, effective_at, expires_at, metadata
      ) VALUES (
        'pulse-review-sla-event/v1',
        'pulse-review-sla-event/sha256:' || encode(
          digest(obligation_id::text || E'\nenqueued\n' || queue_time::text, 'sha256'),
          'hex'
        ),
        obligation_id, 'enqueued',
        '{"type":"database_trigger","version":"pulse-review-sla/v1"}'::jsonb,
        'publication_gate',
        'Classification entered the human-review queue under pulse-review-sla/v1.',
        queue_time, NULL,
        jsonb_build_object('priority', priority_value, 'dueAt', due_time)
      ) ON CONFLICT (event_key) DO NOTHING;
    END IF;
  END IF;

  IF TG_OP = 'UPDATE'
     AND OLD.review_status = 'pending'
     AND NEW.review_status <> 'pending' THEN
    UPDATE pulse_review_obligations
    SET state = 'dispositioned',
        claimed_by = NULL,
        claimed_at = NULL,
        claim_expires_at = NULL,
        disposition = NEW.review_status,
        dispositioned_by = COALESCE(NULLIF(NEW.reviewer_id, ''), 'system:event-transition'),
        dispositioned_at = NEW.updated_at,
        updated_at = NEW.updated_at
    WHERE event_id = NEW.id
      AND sla_version = 'pulse-review-sla/v1'
      AND state IN ('open','claimed')
    RETURNING id INTO obligation_id;

    IF obligation_id IS NOT NULL THEN
      INSERT INTO pulse_review_sla_events (
        schema_version, event_key, obligation_id, kind, actor, reason_code,
        note, effective_at, expires_at, metadata
      ) VALUES (
        'pulse-review-sla-event/v1',
        'pulse-review-sla-event/sha256:' || encode(
          digest(obligation_id::text || E'\ndispositioned\n' || NEW.review_status || E'\n' || NEW.updated_at::text, 'sha256'),
          'hex'
        ),
        obligation_id, 'dispositioned',
        jsonb_build_object(
          'type', CASE WHEN NEW.human_reviewed THEN 'human_reviewer' ELSE 'system_transition' END,
          'reviewerId', NEW.reviewer_id
        ),
        NEW.review_status,
        'The event left the active review queue.',
        NEW.updated_at, NULL,
        jsonb_build_object('humanReviewed', NEW.human_reviewed, 'published', NEW.published)
      ) ON CONFLICT (event_key) DO NOTHING;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;--> statement-breakpoint

CREATE TRIGGER pulse_review_obligation_sync
AFTER INSERT OR UPDATE OF review_status, published, projection_status ON pulse_events_v2
FOR EACH ROW EXECUTE FUNCTION civica_sync_pulse_review_obligation();--> statement-breakpoint

CREATE TRIGGER dat_016_retain_mutation
BEFORE UPDATE OR DELETE ON pulse_review_obligations
FOR EACH ROW EXECUTE FUNCTION civica_capture_research_evidence_history();--> statement-breakpoint

CREATE OR REPLACE FUNCTION civica_reject_pulse_review_sla_event_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% is append-only', TG_TABLE_NAME;
END;
$$;--> statement-breakpoint

CREATE TRIGGER pulse_review_sla_events_append_only
BEFORE UPDATE OR DELETE ON pulse_review_sla_events
FOR EACH ROW EXECUTE FUNCTION civica_reject_pulse_review_sla_event_mutation();

-- civica-affected-relations: pulse_events_v2,pulse_incidents,pulse_review_obligations,pulse_review_sla_events,research_evidence_history
