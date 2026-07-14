-- civica-affected-relations: cron_job_attempts,cron_job_executions,cron_job_leases
-- PLT-010 serializes each cron job across instances, retains every attempt,
-- and deduplicates scheduled slots and durable manual Idempotency-Keys.
CREATE TABLE "cron_job_attempts" (
	"attempt_id" uuid PRIMARY KEY NOT NULL,
	"execution_key" text NOT NULL,
	"job_id" text NOT NULL,
	"ordinal" integer NOT NULL,
	"fence" integer NOT NULL,
	"status" text NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone,
	"response_status" integer,
	"result_code" text,
	CONSTRAINT "cron_job_attempt_identity_check" CHECK ("cron_job_attempts"."execution_key" ~ '^[a-f0-9]{64}$' AND length("cron_job_attempts"."job_id") BETWEEN 1 AND 80 AND "cron_job_attempts"."job_id" ~ '^[a-z][a-z0-9.-]*$' AND "cron_job_attempts"."ordinal" >= 1 AND "cron_job_attempts"."fence" >= 1),
	CONSTRAINT "cron_job_attempt_lifecycle_check" CHECK (("cron_job_attempts"."status" = 'running' AND "cron_job_attempts"."completed_at" IS NULL AND "cron_job_attempts"."response_status" IS NULL AND "cron_job_attempts"."result_code" IS NULL) OR ("cron_job_attempts"."status" = 'succeeded' AND "cron_job_attempts"."completed_at" IS NOT NULL AND "cron_job_attempts"."response_status" IS NOT NULL AND "cron_job_attempts"."result_code" IS NOT NULL AND "cron_job_attempts"."completed_at" >= "cron_job_attempts"."started_at" AND "cron_job_attempts"."response_status" BETWEEN 200 AND 299 AND "cron_job_attempts"."result_code" ~ '^[a-z][a-z0-9_.-]*$') OR ("cron_job_attempts"."status" IN ('failed','expired') AND "cron_job_attempts"."completed_at" IS NOT NULL AND "cron_job_attempts"."response_status" IS NOT NULL AND "cron_job_attempts"."result_code" IS NOT NULL AND "cron_job_attempts"."completed_at" >= "cron_job_attempts"."started_at" AND "cron_job_attempts"."response_status" BETWEEN 100 AND 599 AND NOT ("cron_job_attempts"."response_status" BETWEEN 200 AND 299) AND "cron_job_attempts"."result_code" ~ '^[a-z][a-z0-9_.-]*$'))
);
--> statement-breakpoint
CREATE TABLE "cron_job_executions" (
	"execution_key" text PRIMARY KEY NOT NULL,
	"job_id" text NOT NULL,
	"route" text NOT NULL,
	"trigger_kind" text NOT NULL,
	"schedule_slot" timestamp with time zone,
	"request_mode" text NOT NULL,
	"scope_key" text,
	"request_sha256" text NOT NULL,
	"status" text NOT NULL,
	"attempt_count" integer NOT NULL,
	"max_attempts" integer NOT NULL,
	"last_attempt_id" uuid NOT NULL,
	"last_fence" integer NOT NULL,
	"first_started_at" timestamp with time zone NOT NULL,
	"last_started_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone,
	"response_status" integer,
	"result_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cron_job_execution_identity_check" CHECK ("cron_job_executions"."execution_key" ~ '^[a-f0-9]{64}$' AND length("cron_job_executions"."job_id") BETWEEN 1 AND 80 AND "cron_job_executions"."job_id" ~ '^[a-z][a-z0-9.-]*$' AND length("cron_job_executions"."route") BETWEEN 1 AND 160 AND "cron_job_executions"."route" ~ '^/api/cron/[a-z0-9_./-]+$' AND ("cron_job_executions"."scope_key" IS NULL OR "cron_job_executions"."scope_key" ~ '^[a-f0-9]{64}$') AND "cron_job_executions"."request_sha256" ~ '^[a-f0-9]{64}$'),
	CONSTRAINT "cron_job_execution_mode_status_check" CHECK ("cron_job_executions"."request_mode" IN ('apply','dry_run') AND "cron_job_executions"."status" IN ('running','succeeded','failed') AND "cron_job_executions"."attempt_count" >= 1 AND "cron_job_executions"."max_attempts" >= 1 AND "cron_job_executions"."attempt_count" <= "cron_job_executions"."max_attempts" AND "cron_job_executions"."last_fence" >= 1),
	CONSTRAINT "cron_job_execution_trigger_check" CHECK (("cron_job_executions"."trigger_kind" = 'scheduled' AND "cron_job_executions"."schedule_slot" IS NOT NULL AND "cron_job_executions"."scope_key" IS NULL AND "cron_job_executions"."request_mode" = 'apply') OR ("cron_job_executions"."trigger_kind" = 'manual' AND "cron_job_executions"."schedule_slot" IS NULL AND "cron_job_executions"."scope_key" IS NOT NULL)),
	CONSTRAINT "cron_job_execution_time_order_check" CHECK ("cron_job_executions"."last_started_at" >= "cron_job_executions"."first_started_at" AND "cron_job_executions"."updated_at" >= "cron_job_executions"."created_at"),
	CONSTRAINT "cron_job_execution_lifecycle_check" CHECK (("cron_job_executions"."status" = 'running' AND "cron_job_executions"."completed_at" IS NULL AND "cron_job_executions"."response_status" IS NULL AND "cron_job_executions"."result_code" IS NULL) OR ("cron_job_executions"."status" = 'succeeded' AND "cron_job_executions"."completed_at" IS NOT NULL AND "cron_job_executions"."response_status" IS NOT NULL AND "cron_job_executions"."result_code" IS NOT NULL AND "cron_job_executions"."completed_at" >= "cron_job_executions"."last_started_at" AND "cron_job_executions"."response_status" BETWEEN 200 AND 299 AND "cron_job_executions"."result_code" ~ '^[a-z][a-z0-9_.-]*$') OR ("cron_job_executions"."status" = 'failed' AND "cron_job_executions"."completed_at" IS NOT NULL AND "cron_job_executions"."response_status" IS NOT NULL AND "cron_job_executions"."result_code" IS NOT NULL AND "cron_job_executions"."completed_at" >= "cron_job_executions"."last_started_at" AND "cron_job_executions"."response_status" BETWEEN 100 AND 599 AND NOT ("cron_job_executions"."response_status" BETWEEN 200 AND 299) AND "cron_job_executions"."result_code" ~ '^[a-z][a-z0-9_.-]*$'))
);
--> statement-breakpoint
CREATE TABLE "cron_job_leases" (
	"job_id" text PRIMARY KEY NOT NULL,
	"lease_token" uuid,
	"lease_fence" integer DEFAULT 0 NOT NULL,
	"lease_expires_at" timestamp with time zone,
	"execution_key" text,
	"attempt_id" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cron_job_lease_identity_check" CHECK (length("cron_job_leases"."job_id") BETWEEN 1 AND 80 AND "cron_job_leases"."job_id" ~ '^[a-z][a-z0-9.-]*$' AND "cron_job_leases"."lease_fence" >= 0 AND ("cron_job_leases"."execution_key" IS NULL OR "cron_job_leases"."execution_key" ~ '^[a-f0-9]{64}$')),
	CONSTRAINT "cron_job_lease_active_fields_check" CHECK (("cron_job_leases"."lease_token" IS NULL AND "cron_job_leases"."lease_expires_at" IS NULL AND "cron_job_leases"."execution_key" IS NULL AND "cron_job_leases"."attempt_id" IS NULL) OR ("cron_job_leases"."lease_token" IS NOT NULL AND "cron_job_leases"."lease_expires_at" IS NOT NULL AND "cron_job_leases"."execution_key" IS NOT NULL AND "cron_job_leases"."attempt_id" IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "cron_job_attempts" ADD CONSTRAINT "cron_job_attempts_execution_key_cron_job_executions_execution_key_fk" FOREIGN KEY ("execution_key") REFERENCES "public"."cron_job_executions"("execution_key") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_cron_job_attempt_fence" ON "cron_job_attempts" USING btree ("job_id","fence");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_cron_job_attempt_ordinal" ON "cron_job_attempts" USING btree ("execution_key","ordinal");--> statement-breakpoint
CREATE INDEX "idx_cron_job_attempt_execution" ON "cron_job_attempts" USING btree ("execution_key","started_at");--> statement-breakpoint
CREATE INDEX "idx_cron_job_attempt_status" ON "cron_job_attempts" USING btree ("status","started_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_cron_job_execution_scheduled" ON "cron_job_executions" USING btree ("job_id","schedule_slot") WHERE "cron_job_executions"."trigger_kind" = 'scheduled';--> statement-breakpoint
CREATE UNIQUE INDEX "idx_cron_job_execution_manual" ON "cron_job_executions" USING btree ("job_id","scope_key") WHERE "cron_job_executions"."trigger_kind" = 'manual';--> statement-breakpoint
CREATE INDEX "idx_cron_job_execution_status" ON "cron_job_executions" USING btree ("status","updated_at");--> statement-breakpoint
CREATE INDEX "idx_cron_job_execution_job_time" ON "cron_job_executions" USING btree ("job_id","schedule_slot");--> statement-breakpoint
CREATE INDEX "idx_cron_job_lease_expiry" ON "cron_job_leases" USING btree ("lease_expires_at");--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.civica_guard_cron_job_attempt_update_v1()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $function$
BEGIN
  IF OLD.status <> 'running'
     OR NEW.attempt_id IS DISTINCT FROM OLD.attempt_id
     OR NEW.execution_key IS DISTINCT FROM OLD.execution_key
     OR NEW.job_id IS DISTINCT FROM OLD.job_id
     OR NEW.ordinal IS DISTINCT FROM OLD.ordinal
     OR NEW.fence IS DISTINCT FROM OLD.fence
     OR NEW.started_at IS DISTINCT FROM OLD.started_at
     OR NEW.status NOT IN ('succeeded', 'failed', 'expired')
     OR NEW.completed_at IS NULL
     OR NEW.response_status IS NULL
     OR NEW.result_code IS NULL THEN
    RAISE EXCEPTION 'cron attempt identity or terminal evidence cannot be rewritten';
  END IF;
  RETURN NEW;
END;
$function$;--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.civica_guard_cron_job_execution_update_v1()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $function$
BEGIN
  IF OLD.status = 'succeeded'
     OR NEW.execution_key IS DISTINCT FROM OLD.execution_key
     OR NEW.job_id IS DISTINCT FROM OLD.job_id
     OR NEW.route IS DISTINCT FROM OLD.route
     OR NEW.trigger_kind IS DISTINCT FROM OLD.trigger_kind
     OR NEW.schedule_slot IS DISTINCT FROM OLD.schedule_slot
     OR NEW.request_mode IS DISTINCT FROM OLD.request_mode
     OR NEW.scope_key IS DISTINCT FROM OLD.scope_key
     OR NEW.request_sha256 IS DISTINCT FROM OLD.request_sha256
     OR NEW.max_attempts IS DISTINCT FROM OLD.max_attempts
     OR NEW.first_started_at IS DISTINCT FROM OLD.first_started_at
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
     OR NEW.updated_at < OLD.updated_at THEN
    RAISE EXCEPTION 'cron execution identity or completed delivery cannot be rewritten';
  END IF;

  IF NEW.attempt_count = OLD.attempt_count THEN
    IF OLD.status <> 'running'
       OR NEW.status NOT IN ('succeeded', 'failed')
       OR NEW.completed_at IS NULL
       OR NEW.response_status IS NULL
       OR NEW.result_code IS NULL
       OR NEW.last_attempt_id IS DISTINCT FROM OLD.last_attempt_id
       OR NEW.last_fence IS DISTINCT FROM OLD.last_fence
       OR NEW.last_started_at IS DISTINCT FROM OLD.last_started_at THEN
      RAISE EXCEPTION 'invalid cron execution finalization';
    END IF;
  ELSIF NEW.attempt_count = OLD.attempt_count + 1 THEN
    IF OLD.status <> 'failed'
       OR NEW.status <> 'running'
       OR NEW.last_attempt_id IS NOT DISTINCT FROM OLD.last_attempt_id
       OR NEW.last_fence <= OLD.last_fence
       OR NEW.last_started_at < OLD.last_started_at THEN
      RAISE EXCEPTION 'invalid cron execution retry transition';
    END IF;
  ELSE
    RAISE EXCEPTION 'cron execution attempt count must advance exactly once';
  END IF;
  RETURN NEW;
END;
$function$;--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.civica_guard_cron_job_lease_update_v1()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_old_active boolean := OLD.lease_token IS NOT NULL;
  v_new_active boolean := NEW.lease_token IS NOT NULL;
BEGIN
  IF NEW.job_id IS DISTINCT FROM OLD.job_id OR NEW.updated_at < OLD.updated_at THEN
    RAISE EXCEPTION 'cron job lease identity cannot be rewritten';
  END IF;

  IF NEW.lease_fence = OLD.lease_fence THEN
    IF NOT v_old_active OR v_new_active THEN
      RAISE EXCEPTION 'a cron job lease may retain its fence only when released';
    END IF;
  ELSIF NEW.lease_fence = OLD.lease_fence + 1 THEN
    IF v_old_active OR NOT v_new_active THEN
      RAISE EXCEPTION 'a cron job lease fence may advance only on acquisition';
    END IF;
  ELSE
    RAISE EXCEPTION 'cron job lease fence must advance monotonically by one';
  END IF;
  RETURN NEW;
END;
$function$;--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.civica_reject_cron_job_evidence_removal_v1()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $function$
BEGIN
  RAISE EXCEPTION '% cannot be deleted or truncated', TG_TABLE_NAME;
END;
$function$;--> statement-breakpoint

CREATE TRIGGER cron_job_attempt_update_guard
BEFORE UPDATE ON public.cron_job_attempts
FOR EACH ROW EXECUTE FUNCTION public.civica_guard_cron_job_attempt_update_v1();--> statement-breakpoint

CREATE TRIGGER cron_job_execution_update_guard
BEFORE UPDATE ON public.cron_job_executions
FOR EACH ROW EXECUTE FUNCTION public.civica_guard_cron_job_execution_update_v1();--> statement-breakpoint

CREATE TRIGGER cron_job_lease_update_guard
BEFORE UPDATE ON public.cron_job_leases
FOR EACH ROW EXECUTE FUNCTION public.civica_guard_cron_job_lease_update_v1();--> statement-breakpoint

CREATE TRIGGER cron_job_attempt_no_delete
BEFORE DELETE ON public.cron_job_attempts
FOR EACH ROW EXECUTE FUNCTION public.civica_reject_cron_job_evidence_removal_v1();--> statement-breakpoint

CREATE TRIGGER cron_job_execution_no_delete
BEFORE DELETE ON public.cron_job_executions
FOR EACH ROW EXECUTE FUNCTION public.civica_reject_cron_job_evidence_removal_v1();--> statement-breakpoint

CREATE TRIGGER cron_job_lease_no_delete
BEFORE DELETE ON public.cron_job_leases
FOR EACH ROW EXECUTE FUNCTION public.civica_reject_cron_job_evidence_removal_v1();--> statement-breakpoint

CREATE TRIGGER cron_job_attempt_no_truncate
BEFORE TRUNCATE ON public.cron_job_attempts
FOR EACH STATEMENT EXECUTE FUNCTION public.civica_reject_cron_job_evidence_removal_v1();--> statement-breakpoint

CREATE TRIGGER cron_job_execution_no_truncate
BEFORE TRUNCATE ON public.cron_job_executions
FOR EACH STATEMENT EXECUTE FUNCTION public.civica_reject_cron_job_evidence_removal_v1();--> statement-breakpoint

CREATE TRIGGER cron_job_lease_no_truncate
BEFORE TRUNCATE ON public.cron_job_leases
FOR EACH STATEMENT EXECUTE FUNCTION public.civica_reject_cron_job_evidence_removal_v1();--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.civica_acquire_cron_job_v1(
  p_execution_key text,
  p_job_id text,
  p_route text,
  p_trigger_kind text,
  p_schedule_slot timestamptz,
  p_request_mode text,
  p_scope_key text,
  p_request_sha256 text,
  p_lease_seconds integer,
  p_max_attempts integer,
  p_candidate_lease_token uuid,
  p_candidate_attempt_id uuid
)
RETURNS TABLE (
  claim_state text,
  lease_token uuid,
  lease_expires_at timestamptz,
  attempt_count integer,
  attempt_id uuid,
  lease_fence integer,
  completed_at timestamptz,
  response_status integer
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_lease public.cron_job_leases%ROWTYPE;
  v_execution public.cron_job_executions%ROWTYPE;
  v_now timestamptz;
  v_expires_at timestamptz;
  v_attempt_count integer;
  v_fence integer;
  v_affected integer;
BEGIN
  IF p_execution_key IS NULL
     OR p_job_id IS NULL
     OR p_route IS NULL
     OR p_trigger_kind IS NULL
     OR p_request_mode IS NULL
     OR p_request_sha256 IS NULL
     OR p_lease_seconds IS NULL
     OR p_max_attempts IS NULL
     OR p_execution_key !~ '^[a-f0-9]{64}$'
     OR p_request_sha256 !~ '^[a-f0-9]{64}$'
     OR p_job_id !~ '^[a-z][a-z0-9.-]*$'
     OR length(p_job_id) NOT BETWEEN 1 AND 80
     OR p_route !~ '^/api/cron/[a-z0-9_./-]+$'
     OR length(p_route) NOT BETWEEN 1 AND 160
     OR p_request_mode NOT IN ('apply', 'dry_run')
     OR p_lease_seconds NOT BETWEEN 1 AND 86400
     OR p_max_attempts NOT BETWEEN 1 AND 20
     OR p_candidate_lease_token IS NULL
     OR p_candidate_attempt_id IS NULL THEN
    RAISE EXCEPTION 'invalid cron acquisition input';
  END IF;

  IF p_trigger_kind = 'scheduled' THEN
    IF p_schedule_slot IS NULL
       OR NOT isfinite(p_schedule_slot)
       OR p_scope_key IS NOT NULL
       OR p_request_mode <> 'apply' THEN
      RAISE EXCEPTION 'invalid scheduled cron trigger identity';
    END IF;
  ELSIF p_trigger_kind = 'manual' THEN
    IF p_schedule_slot IS NOT NULL
       OR p_scope_key IS NULL
       OR p_scope_key !~ '^[a-f0-9]{64}$' THEN
      RAISE EXCEPTION 'invalid manual cron trigger identity';
    END IF;
  ELSE
    RAISE EXCEPTION 'invalid cron trigger identity';
  END IF;

  INSERT INTO public.cron_job_leases (job_id, lease_fence, updated_at)
  VALUES (p_job_id, 0, clock_timestamp())
  ON CONFLICT (job_id) DO NOTHING;

  SELECT lease_row.*
  INTO STRICT v_lease
  FROM public.cron_job_leases AS lease_row
  WHERE lease_row.job_id = p_job_id
  FOR UPDATE;

  -- Take the database clock only after lock acquisition so lock wait time
  -- cannot make lease decisions against a stale transaction timestamp.
  v_now := clock_timestamp();

  IF v_lease.lease_token IS NOT NULL
     AND v_lease.lease_expires_at > v_now THEN
    SELECT execution_row.*
    INTO STRICT v_execution
    FROM public.cron_job_executions AS execution_row
    WHERE execution_row.execution_key = v_lease.execution_key;
    v_attempt_count := v_execution.attempt_count;

    IF v_lease.execution_key = p_execution_key
       AND (
         v_execution.job_id IS DISTINCT FROM p_job_id
         OR v_execution.route IS DISTINCT FROM p_route
         OR v_execution.trigger_kind IS DISTINCT FROM p_trigger_kind
         OR v_execution.schedule_slot IS DISTINCT FROM p_schedule_slot
         OR v_execution.request_mode IS DISTINCT FROM p_request_mode
         OR v_execution.scope_key IS DISTINCT FROM p_scope_key
         OR v_execution.request_sha256 IS DISTINCT FROM p_request_sha256
         OR v_execution.max_attempts IS DISTINCT FROM p_max_attempts
       ) THEN
      RETURN QUERY SELECT
        'conflict'::text,
        NULL::uuid,
        NULL::timestamptz,
        v_attempt_count,
        NULL::uuid,
        NULL::integer,
        v_execution.completed_at,
        v_execution.response_status;
      RETURN;
    END IF;

    RETURN QUERY SELECT
      CASE
        WHEN v_lease.execution_key = p_execution_key THEN 'running'::text
        ELSE 'busy'::text
      END,
      v_lease.lease_token,
      v_lease.lease_expires_at,
      v_attempt_count,
      v_lease.attempt_id,
      v_lease.lease_fence,
      NULL::timestamptz,
      NULL::integer;
    RETURN;
  END IF;

  IF v_lease.lease_token IS NOT NULL THEN
    UPDATE public.cron_job_attempts AS attempt_row
    SET status = 'expired',
        completed_at = v_now,
        response_status = 504,
        result_code = 'lease_expired'
    WHERE attempt_row.attempt_id = v_lease.attempt_id
      AND attempt_row.execution_key = v_lease.execution_key
      AND attempt_row.job_id = p_job_id
      AND attempt_row.fence = v_lease.lease_fence
      AND attempt_row.status = 'running';
    GET DIAGNOSTICS v_affected = ROW_COUNT;
    IF v_affected <> 1 THEN
      RAISE EXCEPTION 'expired cron lease has no matching running attempt';
    END IF;

    UPDATE public.cron_job_executions AS execution_row
    SET status = 'failed',
        completed_at = v_now,
        response_status = 504,
        result_code = 'lease_expired',
        updated_at = v_now
    WHERE execution_row.execution_key = v_lease.execution_key
      AND execution_row.job_id = p_job_id
      AND execution_row.last_attempt_id = v_lease.attempt_id
      AND execution_row.last_fence = v_lease.lease_fence
      AND execution_row.status = 'running';
    GET DIAGNOSTICS v_affected = ROW_COUNT;
    IF v_affected <> 1 THEN
      RAISE EXCEPTION 'expired cron lease has no matching running execution';
    END IF;

    UPDATE public.cron_job_leases AS lease_row
    SET lease_token = NULL,
        lease_expires_at = NULL,
        execution_key = NULL,
        attempt_id = NULL,
        updated_at = v_now
    WHERE lease_row.job_id = p_job_id;

    v_lease.lease_token := NULL;
    v_lease.lease_expires_at := NULL;
    v_lease.execution_key := NULL;
    v_lease.attempt_id := NULL;
    v_lease.updated_at := v_now;
  END IF;

  SELECT execution_row.*
  INTO v_execution
  FROM public.cron_job_executions AS execution_row
  WHERE execution_row.execution_key = p_execution_key
     OR (
       p_trigger_kind = 'scheduled'
       AND execution_row.job_id = p_job_id
       AND execution_row.trigger_kind = 'scheduled'
       AND execution_row.schedule_slot = p_schedule_slot
     )
     OR (
       p_trigger_kind = 'manual'
       AND execution_row.job_id = p_job_id
       AND execution_row.trigger_kind = 'manual'
       AND execution_row.scope_key = p_scope_key
     )
  ORDER BY (execution_row.execution_key = p_execution_key) DESC
  LIMIT 1
  FOR UPDATE;

  IF FOUND THEN
    IF v_execution.execution_key IS DISTINCT FROM p_execution_key
       OR v_execution.job_id IS DISTINCT FROM p_job_id
       OR v_execution.route IS DISTINCT FROM p_route
       OR v_execution.trigger_kind IS DISTINCT FROM p_trigger_kind
       OR v_execution.schedule_slot IS DISTINCT FROM p_schedule_slot
       OR v_execution.request_mode IS DISTINCT FROM p_request_mode
       OR v_execution.scope_key IS DISTINCT FROM p_scope_key
       OR v_execution.request_sha256 IS DISTINCT FROM p_request_sha256
       OR v_execution.max_attempts IS DISTINCT FROM p_max_attempts THEN
      RETURN QUERY SELECT
        'conflict'::text,
        NULL::uuid,
        NULL::timestamptz,
        v_execution.attempt_count,
        NULL::uuid,
        NULL::integer,
        v_execution.completed_at,
        v_execution.response_status;
      RETURN;
    END IF;

    IF v_execution.status = 'succeeded' THEN
      RETURN QUERY SELECT
        'succeeded'::text,
        NULL::uuid,
        NULL::timestamptz,
        v_execution.attempt_count,
        NULL::uuid,
        NULL::integer,
        v_execution.completed_at,
        v_execution.response_status;
      RETURN;
    END IF;

    IF v_execution.status = 'running' THEN
      RAISE EXCEPTION 'running cron execution has no matching active job lease';
    END IF;

    IF v_execution.attempt_count >= v_execution.max_attempts THEN
      RETURN QUERY SELECT
        'exhausted'::text,
        NULL::uuid,
        NULL::timestamptz,
        v_execution.attempt_count,
        NULL::uuid,
        NULL::integer,
        v_execution.completed_at,
        v_execution.response_status;
      RETURN;
    END IF;
  END IF;

  IF v_lease.lease_fence = 2147483647 THEN
    RAISE EXCEPTION 'cron job lease fence exhausted';
  END IF;
  v_fence := v_lease.lease_fence + 1;
  v_expires_at := v_now + make_interval(secs => p_lease_seconds);

  IF FOUND THEN
    v_attempt_count := v_execution.attempt_count + 1;
    UPDATE public.cron_job_executions AS execution_row
    SET status = 'running',
        attempt_count = v_attempt_count,
        last_attempt_id = p_candidate_attempt_id,
        last_fence = v_fence,
        last_started_at = v_now,
        completed_at = NULL,
        response_status = NULL,
        result_code = NULL,
        updated_at = v_now
    WHERE execution_row.execution_key = p_execution_key;
  ELSE
    v_attempt_count := 1;
    INSERT INTO public.cron_job_executions (
      execution_key,
      job_id,
      route,
      trigger_kind,
      schedule_slot,
      request_mode,
      scope_key,
      request_sha256,
      status,
      attempt_count,
      max_attempts,
      last_attempt_id,
      last_fence,
      first_started_at,
      last_started_at,
      completed_at,
      response_status,
      result_code,
      created_at,
      updated_at
    ) VALUES (
      p_execution_key,
      p_job_id,
      p_route,
      p_trigger_kind,
      p_schedule_slot,
      p_request_mode,
      p_scope_key,
      p_request_sha256,
      'running',
      1,
      p_max_attempts,
      p_candidate_attempt_id,
      v_fence,
      v_now,
      v_now,
      NULL,
      NULL,
      NULL,
      v_now,
      v_now
    );
  END IF;

  INSERT INTO public.cron_job_attempts (
    attempt_id,
    execution_key,
    job_id,
    ordinal,
    fence,
    status,
    started_at,
    completed_at,
    response_status,
    result_code
  ) VALUES (
    p_candidate_attempt_id,
    p_execution_key,
    p_job_id,
    v_attempt_count,
    v_fence,
    'running',
    v_now,
    NULL,
    NULL,
    NULL
  );

  UPDATE public.cron_job_leases AS lease_row
  SET lease_token = p_candidate_lease_token,
      lease_fence = v_fence,
      lease_expires_at = v_expires_at,
      execution_key = p_execution_key,
      attempt_id = p_candidate_attempt_id,
      updated_at = v_now
  WHERE lease_row.job_id = p_job_id;

  RETURN QUERY SELECT
    'acquired'::text,
    p_candidate_lease_token,
    v_expires_at,
    v_attempt_count,
    p_candidate_attempt_id,
    v_fence,
    NULL::timestamptz,
    NULL::integer;
END;
$function$;--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.civica_finish_cron_job_v1(
  p_job_id text,
  p_execution_key text,
  p_attempt_id uuid,
  p_lease_token uuid,
  p_lease_fence integer,
  p_status text,
  p_response_status integer,
  p_result_code text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_lease public.cron_job_leases%ROWTYPE;
  v_execution public.cron_job_executions%ROWTYPE;
  v_attempt public.cron_job_attempts%ROWTYPE;
  v_now timestamptz;
BEGIN
  IF p_job_id IS NULL
     OR p_execution_key IS NULL
     OR p_attempt_id IS NULL
     OR p_lease_token IS NULL
     OR p_lease_fence IS NULL
     OR p_status IS NULL
     OR p_response_status IS NULL
     OR p_result_code IS NULL
     OR p_job_id !~ '^[a-z][a-z0-9.-]*$'
     OR length(p_job_id) NOT BETWEEN 1 AND 80
     OR p_execution_key !~ '^[a-f0-9]{64}$'
     OR p_lease_fence < 1
     OR p_status NOT IN ('succeeded', 'failed')
     OR p_response_status NOT BETWEEN 100 AND 599
     OR (p_status = 'succeeded' AND p_response_status NOT BETWEEN 200 AND 299)
     OR (p_status = 'failed' AND p_response_status BETWEEN 200 AND 299)
     OR p_result_code !~ '^[a-z][a-z0-9_.-]*$'
     OR length(p_result_code) > 80 THEN
    RAISE EXCEPTION 'invalid cron finalization input';
  END IF;

  SELECT lease_row.*
  INTO v_lease
  FROM public.cron_job_leases AS lease_row
  WHERE lease_row.job_id = p_job_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  v_now := clock_timestamp();
  IF v_lease.lease_token IS DISTINCT FROM p_lease_token
     OR v_lease.execution_key IS DISTINCT FROM p_execution_key
     OR v_lease.attempt_id IS DISTINCT FROM p_attempt_id
     OR v_lease.lease_fence IS DISTINCT FROM p_lease_fence THEN
    RETURN false;
  END IF;

  SELECT execution_row.*
  INTO v_execution
  FROM public.cron_job_executions AS execution_row
  WHERE execution_row.execution_key = p_execution_key
    AND execution_row.job_id = p_job_id
    AND execution_row.last_attempt_id = p_attempt_id
    AND execution_row.last_fence = p_lease_fence
    AND execution_row.status = 'running'
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  SELECT attempt_row.*
  INTO v_attempt
  FROM public.cron_job_attempts AS attempt_row
  WHERE attempt_row.attempt_id = p_attempt_id
    AND attempt_row.execution_key = p_execution_key
    AND attempt_row.job_id = p_job_id
    AND attempt_row.fence = p_lease_fence
    AND attempt_row.status = 'running'
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF v_now < v_attempt.started_at THEN
    v_now := v_attempt.started_at;
  END IF;

  UPDATE public.cron_job_attempts AS attempt_row
  SET status = p_status,
      completed_at = v_now,
      response_status = p_response_status,
      result_code = p_result_code
  WHERE attempt_row.attempt_id = p_attempt_id;

  UPDATE public.cron_job_executions AS execution_row
  SET status = p_status,
      completed_at = v_now,
      response_status = p_response_status,
      result_code = p_result_code,
      updated_at = v_now
  WHERE execution_row.execution_key = p_execution_key;

  UPDATE public.cron_job_leases AS lease_row
  SET lease_token = NULL,
      lease_expires_at = NULL,
      execution_key = NULL,
      attempt_id = NULL,
      updated_at = v_now
  WHERE lease_row.job_id = p_job_id;

  RETURN true;
END;
$function$;
