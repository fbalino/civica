-- civica-affected-relations: pulse_classification_delivery_bindings
-- Pulse classify retries retain the exact run adopted by each cron delivery.
CREATE TABLE "pulse_classification_delivery_bindings" (
	"execution_key" text PRIMARY KEY NOT NULL,
	"classification_run_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pulse_classification_delivery_execution_check" CHECK ("pulse_classification_delivery_bindings"."execution_key" ~ '^[a-f0-9]{64}$')
);
--> statement-breakpoint
ALTER TABLE "pulse_classification_delivery_bindings" ADD CONSTRAINT "pulse_classification_delivery_execution_fk" FOREIGN KEY ("execution_key") REFERENCES "public"."cron_job_executions"("execution_key") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pulse_classification_delivery_bindings" ADD CONSTRAINT "pulse_classification_delivery_run_fk" FOREIGN KEY ("classification_run_id") REFERENCES "public"."pulse_pipeline_runs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_pulse_classification_delivery_run" ON "pulse_classification_delivery_bindings" USING btree ("classification_run_id");--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.civica_guard_pulse_classify_binding_insert_v1()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $function$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.cron_job_executions AS execution_row
    WHERE execution_row.execution_key = NEW.execution_key
      AND execution_row.job_id = 'pulse.v2.classify'
  ) OR NOT EXISTS (
    SELECT 1
    FROM public.pulse_pipeline_runs AS run_row
    WHERE run_row.id = NEW.classification_run_id
      AND run_row.stage = 'classify'
  ) THEN
    RAISE EXCEPTION 'invalid Pulse classification delivery binding';
  END IF;
  RETURN NEW;
END;
$function$;--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.civica_reject_pulse_classify_binding_mutation_v1()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $function$
BEGIN
  RAISE EXCEPTION 'Pulse classification delivery bindings are immutable';
END;
$function$;--> statement-breakpoint

CREATE TRIGGER pulse_classification_delivery_insert_guard
BEFORE INSERT ON public.pulse_classification_delivery_bindings
FOR EACH ROW EXECUTE FUNCTION public.civica_guard_pulse_classify_binding_insert_v1();--> statement-breakpoint

CREATE TRIGGER pulse_classification_delivery_no_mutation
BEFORE UPDATE OR DELETE ON public.pulse_classification_delivery_bindings
FOR EACH ROW EXECUTE FUNCTION public.civica_reject_pulse_classify_binding_mutation_v1();--> statement-breakpoint

CREATE TRIGGER pulse_classification_delivery_no_truncate
BEFORE TRUNCATE ON public.pulse_classification_delivery_bindings
FOR EACH STATEMENT EXECUTE FUNCTION public.civica_reject_pulse_classify_binding_mutation_v1();
