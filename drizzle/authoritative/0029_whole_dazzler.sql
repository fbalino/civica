CREATE TABLE "pulse_event_information_environment_pins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"schema_version" text NOT NULL,
	"context_schema_version" text NOT NULL,
	"pin_key" text NOT NULL,
	"event_id" uuid NOT NULL,
	"jurisdiction_id" uuid NOT NULL,
	"classification_run_id" uuid NOT NULL,
	"release_id" text,
	"value_status" text NOT NULL,
	"score" real,
	"tier" text,
	"source_id" text,
	"source_url" text,
	"upstream_release" text,
	"observation_year" integer,
	"retrieved_at" timestamp,
	"content_sha256" text,
	"rights_status" text NOT NULL,
	"use_status" text NOT NULL,
	"missing_reason" text,
	"method_version" text NOT NULL,
	"classified_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "pulse_event_information_environment_pins_pin_key_unique" UNIQUE("pin_key"),
	CONSTRAINT "pulse_event_information_environment_pins_event_id_unique" UNIQUE("event_id"),
	CONSTRAINT "pulse_event_information_environment_pins_contract_check" CHECK ("pulse_event_information_environment_pins"."schema_version" = 'pulse-information-environment-pin/v1' AND "pulse_event_information_environment_pins"."context_schema_version" = 'pulse-information-environment-context/v1' AND "pulse_event_information_environment_pins"."pin_key" ~ '^pulse-information-environment-pin/sha256:[a-f0-9]{64}$' AND "pulse_event_information_environment_pins"."method_version" = 'pulse-information-environment/classification-pin-v1' AND "pulse_event_information_environment_pins"."value_status" IN ('observed','missing') AND "pulse_event_information_environment_pins"."rights_status" IN ('verified','pending','not_registered') AND "pulse_event_information_environment_pins"."use_status" IN ('active_unvalidated_heuristic','disabled_pending_rights_and_validation','not_available') AND (("pulse_event_information_environment_pins"."value_status" = 'observed' AND "pulse_event_information_environment_pins"."release_id" IS NOT NULL AND "pulse_event_information_environment_pins"."score" BETWEEN 0 AND 100 AND "pulse_event_information_environment_pins"."score" <> 'NaN'::real AND "pulse_event_information_environment_pins"."tier" IN ('free','partial','restricted') AND btrim("pulse_event_information_environment_pins"."source_id") <> '' AND "pulse_event_information_environment_pins"."source_url" ~ '^https://' AND btrim("pulse_event_information_environment_pins"."upstream_release") <> '' AND "pulse_event_information_environment_pins"."observation_year" >= 1900 AND "pulse_event_information_environment_pins"."retrieved_at" IS NOT NULL AND "pulse_event_information_environment_pins"."content_sha256" ~ '^[a-f0-9]{64}$' AND "pulse_event_information_environment_pins"."missing_reason" IS NULL) OR ("pulse_event_information_environment_pins"."value_status" = 'missing' AND "pulse_event_information_environment_pins"."score" IS NULL AND "pulse_event_information_environment_pins"."tier" IS NULL AND btrim("pulse_event_information_environment_pins"."missing_reason") <> '')))
);
--> statement-breakpoint
CREATE TABLE "pulse_information_environment_releases" (
	"release_id" text PRIMARY KEY NOT NULL,
	"schema_version" text NOT NULL,
	"source_id" text NOT NULL,
	"source_url" text NOT NULL,
	"methodology_url" text NOT NULL,
	"terms_url" text NOT NULL,
	"upstream_release" text NOT NULL,
	"observation_year" integer NOT NULL,
	"retrieved_at" timestamp NOT NULL,
	"content_sha256" text NOT NULL,
	"publisher_rows" integer NOT NULL,
	"matched_jurisdictions" integer NOT NULL,
	"supported_jurisdictions" integer NOT NULL,
	"redistribution_posture" text NOT NULL,
	"rights_status" text NOT NULL,
	"use_status" text NOT NULL,
	"adopted_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "pulse_information_environment_releases_contract_check" CHECK ("pulse_information_environment_releases"."schema_version" = 'pulse-information-environment-release/v1' AND btrim("pulse_information_environment_releases"."release_id") <> '' AND btrim("pulse_information_environment_releases"."source_id") <> '' AND "pulse_information_environment_releases"."source_url" ~ '^https://' AND "pulse_information_environment_releases"."methodology_url" ~ '^https://' AND "pulse_information_environment_releases"."terms_url" ~ '^https://' AND btrim("pulse_information_environment_releases"."upstream_release") <> '' AND "pulse_information_environment_releases"."observation_year" >= 1900 AND "pulse_information_environment_releases"."content_sha256" ~ '^[a-f0-9]{64}$' AND "pulse_information_environment_releases"."publisher_rows" > 0 AND "pulse_information_environment_releases"."matched_jurisdictions" >= 0 AND "pulse_information_environment_releases"."supported_jurisdictions" > 0 AND "pulse_information_environment_releases"."matched_jurisdictions" <= "pulse_information_environment_releases"."supported_jurisdictions" AND "pulse_information_environment_releases"."matched_jurisdictions" <= "pulse_information_environment_releases"."publisher_rows" AND "pulse_information_environment_releases"."rights_status" IN ('verified','pending') AND "pulse_information_environment_releases"."use_status" IN ('active_unvalidated_heuristic','disabled_pending_rights_and_validation'))
);
--> statement-breakpoint
CREATE TABLE "pulse_information_environment_values" (
	"release_id" text NOT NULL,
	"jurisdiction_id" uuid NOT NULL,
	"iso3" text,
	"value_status" text NOT NULL,
	"score" real,
	"tier" text,
	"missing_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "pulse_information_environment_values_pk" PRIMARY KEY("release_id","jurisdiction_id"),
	CONSTRAINT "pulse_information_environment_values_contract_check" CHECK ("pulse_information_environment_values"."value_status" IN ('observed','missing') AND (("pulse_information_environment_values"."value_status" = 'observed' AND "pulse_information_environment_values"."score" BETWEEN 0 AND 100 AND "pulse_information_environment_values"."score" <> 'NaN'::real AND "pulse_information_environment_values"."tier" IN ('free','partial','restricted') AND "pulse_information_environment_values"."missing_reason" IS NULL) OR ("pulse_information_environment_values"."value_status" = 'missing' AND "pulse_information_environment_values"."score" IS NULL AND "pulse_information_environment_values"."tier" IS NULL AND btrim("pulse_information_environment_values"."missing_reason") <> '')))
);
--> statement-breakpoint
ALTER TABLE "pulse_event_information_environment_pins" ADD CONSTRAINT "pulse_event_information_environment_pins_event_id_pulse_events_v2_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."pulse_events_v2"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pulse_event_information_environment_pins" ADD CONSTRAINT "pulse_event_information_environment_pins_jurisdiction_id_jurisdictions_id_fk" FOREIGN KEY ("jurisdiction_id") REFERENCES "public"."jurisdictions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pulse_event_information_environment_pins" ADD CONSTRAINT "pulse_event_information_environment_pins_classification_run_id_pulse_pipeline_runs_id_fk" FOREIGN KEY ("classification_run_id") REFERENCES "public"."pulse_pipeline_runs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pulse_event_information_environment_pins" ADD CONSTRAINT "pulse_event_information_environment_pins_release_id_pulse_information_environment_releases_release_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."pulse_information_environment_releases"("release_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pulse_information_environment_values" ADD CONSTRAINT "pulse_information_environment_values_release_id_pulse_information_environment_releases_release_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."pulse_information_environment_releases"("release_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pulse_information_environment_values" ADD CONSTRAINT "pulse_information_environment_values_jurisdiction_id_jurisdictions_id_fk" FOREIGN KEY ("jurisdiction_id") REFERENCES "public"."jurisdictions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_pulse_information_pins_jurisdiction_time" ON "pulse_event_information_environment_pins" USING btree ("jurisdiction_id","classified_at");--> statement-breakpoint
CREATE INDEX "idx_pulse_information_pins_release" ON "pulse_event_information_environment_pins" USING btree ("release_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_pulse_information_release_hash" ON "pulse_information_environment_releases" USING btree ("content_sha256");--> statement-breakpoint
CREATE INDEX "idx_pulse_information_values_jurisdiction" ON "pulse_information_environment_values" USING btree ("jurisdiction_id");
--> statement-breakpoint
CREATE OR REPLACE FUNCTION civica_reject_pulse_information_environment_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION '% is append-only', TG_TABLE_NAME;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER pulse_information_environment_releases_append_only
BEFORE UPDATE OR DELETE ON "pulse_information_environment_releases"
FOR EACH ROW EXECUTE FUNCTION civica_reject_pulse_information_environment_mutation();
--> statement-breakpoint
CREATE TRIGGER pulse_information_environment_values_append_only
BEFORE UPDATE OR DELETE ON "pulse_information_environment_values"
FOR EACH ROW EXECUTE FUNCTION civica_reject_pulse_information_environment_mutation();
--> statement-breakpoint
CREATE TRIGGER pulse_event_information_environment_pins_append_only
BEFORE UPDATE OR DELETE ON "pulse_event_information_environment_pins"
FOR EACH ROW EXECUTE FUNCTION civica_reject_pulse_information_environment_mutation();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION civica_pin_pulse_event_information_environment()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  release_row pulse_information_environment_releases%ROWTYPE;
  value_row pulse_information_environment_values%ROWTYPE;
  classified_time timestamp := COALESCE(NEW.created_at, now());
  identity text;
BEGIN
  SELECT * INTO release_row
  FROM pulse_information_environment_releases
  WHERE adopted_at <= classified_time
  ORDER BY adopted_at DESC, retrieved_at DESC, release_id DESC
  LIMIT 1;

  IF release_row.release_id IS NOT NULL THEN
    SELECT * INTO value_row
    FROM pulse_information_environment_values
    WHERE release_id = release_row.release_id
      AND jurisdiction_id = NEW.jurisdiction_id;
  END IF;

  identity := concat_ws('|',
    'pulse-information-environment-pin/v1', NEW.id::text,
    NEW.jurisdiction_id::text, NEW.classification_run_id::text,
    classified_time::text, release_row.release_id,
    value_row.value_status, value_row.score::text, value_row.tier,
    release_row.content_sha256
  );

  INSERT INTO pulse_event_information_environment_pins (
    schema_version, context_schema_version, pin_key, event_id,
    jurisdiction_id, classification_run_id, release_id, value_status,
    score, tier, source_id, source_url, upstream_release, observation_year,
    retrieved_at, content_sha256, rights_status, use_status, missing_reason,
    method_version, classified_at
  ) VALUES (
    'pulse-information-environment-pin/v1',
    'pulse-information-environment-context/v1',
    'pulse-information-environment-pin/sha256:' || encode(digest(identity, 'sha256'), 'hex'),
    NEW.id, NEW.jurisdiction_id, NEW.classification_run_id,
    release_row.release_id,
    COALESCE(value_row.value_status, 'missing'),
    value_row.score,
    value_row.tier,
    release_row.source_id,
    release_row.source_url,
    release_row.upstream_release,
    release_row.observation_year,
    release_row.retrieved_at,
    release_row.content_sha256,
    COALESCE(release_row.rights_status, 'not_registered'),
    COALESCE(release_row.use_status, 'not_available'),
    CASE
      WHEN value_row.value_status = 'observed' THEN NULL
      WHEN value_row.missing_reason IS NOT NULL THEN value_row.missing_reason
      WHEN release_row.release_id IS NULL THEN 'No adopted information-environment release existed at classification time.'
      ELSE 'The adopted release has no jurisdiction coverage row; classification failed closed to missing.'
    END,
    'pulse-information-environment/classification-pin-v1',
    classified_time
  );
  RETURN NEW;
END;
$$;
--> statement-breakpoint
INSERT INTO pulse_event_information_environment_pins (
  schema_version, context_schema_version, pin_key, event_id,
  jurisdiction_id, classification_run_id, release_id, value_status,
  score, tier, source_id, source_url, upstream_release, observation_year,
  retrieved_at, content_sha256, rights_status, use_status, missing_reason,
  method_version, classified_at
)
SELECT
  'pulse-information-environment-pin/v1',
  'pulse-information-environment-context/v1',
  'pulse-information-environment-pin/sha256:' || encode(digest(
    concat_ws('|', 'historical-unrecoverable', p.id::text,
      p.jurisdiction_id::text, p.classification_run_id::text, p.created_at::text),
    'sha256'
  ), 'hex'),
  p.id, p.jurisdiction_id, p.classification_run_id,
  NULL, 'missing', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
  'not_registered', 'not_available',
  'No immutable information-environment release was pinned when this historical event was classified; the value is unrecoverable and was not reconstructed.',
  'pulse-information-environment/classification-pin-v1', p.created_at
FROM pulse_events_v2 p
ON CONFLICT (event_id) DO NOTHING;
--> statement-breakpoint
CREATE TRIGGER pulse_events_v2_pin_information_environment
AFTER INSERT ON "pulse_events_v2"
FOR EACH ROW EXECUTE FUNCTION civica_pin_pulse_event_information_environment();

-- civica-affected-relations: pulse_information_environment_releases,pulse_information_environment_values,pulse_event_information_environment_pins,pulse_events_v2,jurisdictions,pulse_pipeline_runs,research_evidence_history
