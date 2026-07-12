CREATE TABLE "pulse_event_absorptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"schema_version" text NOT NULL,
	"absorption_key" text NOT NULL,
	"event_id" uuid NOT NULL,
	"jurisdiction_id" uuid NOT NULL,
	"dimension" text NOT NULL,
	"outcome" text NOT NULL,
	"previous_ci_release_id" text NOT NULL,
	"current_ci_release_id" text NOT NULL,
	"previous_score" real NOT NULL,
	"current_score" real NOT NULL,
	"score_delta" real NOT NULL,
	"threshold" real NOT NULL,
	"fixed_scale_id" text NOT NULL,
	"link_standing" text NOT NULL,
	"link_actor_type" text NOT NULL,
	"link_method_version" text NOT NULL,
	"method_version" text NOT NULL,
	"as_of" date NOT NULL,
	"rationale" text NOT NULL,
	"evidence_refs" text[] NOT NULL,
	"reasons" text[] NOT NULL,
	"supersedes_absorption_key" text,
	"decided_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "pulse_event_absorptions_absorption_key_unique" UNIQUE("absorption_key"),
	CONSTRAINT "pulse_event_absorptions_contract_check" CHECK ("pulse_event_absorptions"."schema_version" = 'pulse-event-absorption/v1' AND "pulse_event_absorptions"."absorption_key" ~ '^pulse-absorption/sha256:[a-f0-9]{64}$' AND "pulse_event_absorptions"."dimension" IN ('democratic_quality','rule_of_law','freedom_rights','corruption_control') AND "pulse_event_absorptions"."outcome" IN ('absorbed','not_absorbed') AND "pulse_event_absorptions"."previous_ci_release_id" <> "pulse_event_absorptions"."current_ci_release_id" AND "pulse_event_absorptions"."previous_score" <> 'NaN'::real AND "pulse_event_absorptions"."current_score" <> 'NaN'::real AND "pulse_event_absorptions"."score_delta" <> 'NaN'::real AND "pulse_event_absorptions"."threshold" > 0 AND btrim("pulse_event_absorptions"."fixed_scale_id") <> '' AND "pulse_event_absorptions"."link_standing" IN ('confirmed','candidate') AND "pulse_event_absorptions"."link_actor_type" IN ('human_reviewer','source_native_exact_link','model_candidate') AND btrim("pulse_event_absorptions"."link_method_version") <> '' AND btrim("pulse_event_absorptions"."method_version") <> '' AND btrim("pulse_event_absorptions"."rationale") <> '' AND cardinality("pulse_event_absorptions"."evidence_refs") >= 2 AND (("pulse_event_absorptions"."outcome" = 'absorbed' AND "pulse_event_absorptions"."link_standing" = 'confirmed' AND "pulse_event_absorptions"."link_actor_type" IN ('human_reviewer','source_native_exact_link') AND cardinality("pulse_event_absorptions"."reasons") = 0) OR ("pulse_event_absorptions"."outcome" = 'not_absorbed' AND cardinality("pulse_event_absorptions"."reasons") > 0)))
);
--> statement-breakpoint
ALTER TABLE "pulse_event_absorptions" ADD CONSTRAINT "pulse_event_absorptions_event_id_pulse_events_v2_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."pulse_events_v2"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pulse_event_absorptions" ADD CONSTRAINT "pulse_event_absorptions_jurisdiction_id_jurisdictions_id_fk" FOREIGN KEY ("jurisdiction_id") REFERENCES "public"."jurisdictions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pulse_event_absorptions" ADD CONSTRAINT "pulse_event_absorptions_supersedes_key_fk" FOREIGN KEY ("supersedes_absorption_key") REFERENCES "public"."pulse_event_absorptions"("absorption_key") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_pulse_event_absorptions_event_as_of" ON "pulse_event_absorptions" USING btree ("event_id","as_of","decided_at");--> statement-breakpoint
CREATE INDEX "idx_pulse_event_absorptions_release" ON "pulse_event_absorptions" USING btree ("current_ci_release_id","dimension");
--> statement-breakpoint
CREATE OR REPLACE FUNCTION civica_reject_pulse_event_absorptions_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'pulse_event_absorptions is append-only';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER pulse_event_absorptions_append_only
BEFORE UPDATE OR DELETE ON "pulse_event_absorptions"
FOR EACH ROW
EXECUTE FUNCTION civica_reject_pulse_event_absorptions_mutation();

-- civica-affected-relations: pulse_event_absorptions,pulse_events_v2,ci_dimension_scores,research_evidence_history
