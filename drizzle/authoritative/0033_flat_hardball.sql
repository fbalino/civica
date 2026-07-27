-- civica-affected-relations: admin_mutation_audit_log,admin_session_revocations
-- PLT-009 adds durable hashed logout revocation and a common bounded owner-admin mutation ledger. No historical session or mutation evidence is backfilled.
CREATE TABLE "admin_mutation_audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"event" text NOT NULL,
	"route" text NOT NULL,
	"method" text NOT NULL,
	"actor_id" text NOT NULL,
	"actor_source" text NOT NULL,
	"session_key" text NOT NULL,
	"action" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" text NOT NULL,
	"result" text NOT NULL,
	"http_status" integer,
	"reason_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admin_mutation_audit_event_result_check" CHECK (("admin_mutation_audit_log"."event" = 'attempt' AND "admin_mutation_audit_log"."result" = 'attempted' AND "admin_mutation_audit_log"."http_status" IS NULL) OR ("admin_mutation_audit_log"."event" = 'outcome' AND "admin_mutation_audit_log"."result" IN ('succeeded','rejected','failed') AND "admin_mutation_audit_log"."http_status" BETWEEN 100 AND 599)),
	CONSTRAINT "admin_mutation_audit_method_check" CHECK ("admin_mutation_audit_log"."method" IN ('GET','POST','PUT','PATCH','DELETE')),
	CONSTRAINT "admin_mutation_audit_actor_check" CHECK (length("admin_mutation_audit_log"."actor_id") BETWEEN 1 AND 80 AND "admin_mutation_audit_log"."actor_id" ~ '^[a-zA-Z0-9 _.\-]+$' AND "admin_mutation_audit_log"."actor_source" IN ('admin_session','password_login','google_login')),
	CONSTRAINT "admin_mutation_audit_session_key_check" CHECK ("admin_mutation_audit_log"."session_key" ~ '^[a-f0-9]{64}$'),
	CONSTRAINT "admin_mutation_audit_descriptor_check" CHECK (length("admin_mutation_audit_log"."route") BETWEEN 1 AND 160 AND left("admin_mutation_audit_log"."route", 1) = '/' AND length("admin_mutation_audit_log"."action") BETWEEN 1 AND 80 AND "admin_mutation_audit_log"."action" ~ '^[a-z][a-z0-9_.-]*$' AND length("admin_mutation_audit_log"."target_type") BETWEEN 1 AND 80 AND "admin_mutation_audit_log"."target_type" ~ '^[a-z][a-z0-9_.-]*$' AND length("admin_mutation_audit_log"."target_id") BETWEEN 1 AND 160),
	CONSTRAINT "admin_mutation_audit_reason_check" CHECK ("admin_mutation_audit_log"."reason_code" IS NULL OR (length("admin_mutation_audit_log"."reason_code") BETWEEN 1 AND 80 AND "admin_mutation_audit_log"."reason_code" ~ '^[a-z][a-z0-9_.-]*$'))
);
--> statement-breakpoint
CREATE TABLE "admin_session_revocations" (
	"session_key" text PRIMARY KEY NOT NULL,
	"reviewer_id" text NOT NULL,
	"issued_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admin_session_revocations_key_check" CHECK ("admin_session_revocations"."session_key" ~ '^[a-f0-9]{64}$'),
	CONSTRAINT "admin_session_revocations_reviewer_check" CHECK (length("admin_session_revocations"."reviewer_id") BETWEEN 1 AND 80 AND "admin_session_revocations"."reviewer_id" ~ '^[a-zA-Z0-9 _.\-]+$'),
	CONSTRAINT "admin_session_revocations_lifetime_check" CHECK ("admin_session_revocations"."expires_at" = "admin_session_revocations"."issued_at" + interval '7 days'),
	CONSTRAINT "admin_session_revocations_time_order_check" CHECK ("admin_session_revocations"."revoked_at" >= "admin_session_revocations"."issued_at" - interval '60 seconds' AND "admin_session_revocations"."revoked_at" < "admin_session_revocations"."expires_at")
);
--> statement-breakpoint
CREATE UNIQUE INDEX "idx_admin_mutation_audit_request_event" ON "admin_mutation_audit_log" USING btree ("request_id","event");--> statement-breakpoint
CREATE INDEX "idx_admin_mutation_audit_actor_date" ON "admin_mutation_audit_log" USING btree ("actor_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_admin_mutation_audit_target_date" ON "admin_mutation_audit_log" USING btree ("target_type","target_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_admin_mutation_audit_session_date" ON "admin_mutation_audit_log" USING btree ("session_key","created_at");--> statement-breakpoint
CREATE INDEX "idx_admin_session_revocations_expires_at" ON "admin_session_revocations" USING btree ("expires_at");--> statement-breakpoint

CREATE OR REPLACE FUNCTION civica_reject_admin_security_evidence_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  RAISE EXCEPTION '% is append-only', TG_TABLE_NAME;
END;
$function$;--> statement-breakpoint

CREATE TRIGGER admin_mutation_audit_log_append_only
BEFORE UPDATE OR DELETE ON admin_mutation_audit_log
FOR EACH ROW EXECUTE FUNCTION civica_reject_admin_security_evidence_mutation();--> statement-breakpoint

CREATE TRIGGER admin_session_revocations_append_only
BEFORE UPDATE OR DELETE ON admin_session_revocations
FOR EACH ROW EXECUTE FUNCTION civica_reject_admin_security_evidence_mutation();--> statement-breakpoint

CREATE TRIGGER admin_mutation_audit_log_no_truncate
BEFORE TRUNCATE ON admin_mutation_audit_log
FOR EACH STATEMENT EXECUTE FUNCTION civica_reject_admin_security_evidence_mutation();--> statement-breakpoint

CREATE TRIGGER admin_session_revocations_no_truncate
BEFORE TRUNCATE ON admin_session_revocations
FOR EACH STATEMENT EXECUTE FUNCTION civica_reject_admin_security_evidence_mutation();
