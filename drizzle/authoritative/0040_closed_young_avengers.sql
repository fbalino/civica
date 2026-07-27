CREATE TABLE "civica_conditions_calculations" (
	"calculation_key" text PRIMARY KEY NOT NULL,
	"jurisdiction_id" uuid NOT NULL,
	"dimension" text NOT NULL,
	"methodology_version" text NOT NULL,
	"alignment_policy" text NOT NULL,
	"alignment_status" text NOT NULL,
	"reference_year" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "conditions_calculation_contract_check" CHECK ("civica_conditions_calculations"."calculation_key" ~ '^conditions-calculation/v1/sha256:[a-f0-9]{64}$' AND "civica_conditions_calculations"."alignment_policy" = 'all-components-same-reference-year/v1' AND "civica_conditions_calculations"."alignment_status" IN ('aligned','mixed_year_refused','missing_component') AND (("civica_conditions_calculations"."alignment_status" = 'aligned' AND "civica_conditions_calculations"."reference_year" BETWEEN 1800 AND 2200) OR ("civica_conditions_calculations"."alignment_status" <> 'aligned' AND "civica_conditions_calculations"."reference_year" IS NULL)))
);
--> statement-breakpoint
CREATE TABLE "civica_conditions_components" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"calculation_key" text NOT NULL,
	"component_id" text NOT NULL,
	"native_value" real,
	"native_unit" text NOT NULL,
	"reference_year" integer,
	"value_status" text NOT NULL,
	"value_status_reason" text,
	"inclusion_decision" text NOT NULL,
	"source_id" text NOT NULL,
	"indicator_id" text NOT NULL,
	"upstream_release" text NOT NULL,
	"artifact_hash" text NOT NULL,
	"artifact_kind" text NOT NULL,
	"temporal_coverage" text NOT NULL,
	"license_url" text NOT NULL,
	"transformation_id" text NOT NULL,
	"substitution_reason" text,
	"method_version" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "conditions_component_lineage_check" CHECK ("civica_conditions_components"."artifact_hash" ~ '^[a-f0-9]{64}$' AND "civica_conditions_components"."artifact_kind" IN ('publisher_bytes','normalized_batch') AND "civica_conditions_components"."license_url" LIKE 'https://%'),
	CONSTRAINT "conditions_component_value_state_check" CHECK ("civica_conditions_components"."value_status" IN ('observed','missing','unknown','not_applicable','not_observed','disputed','withheld') AND ((("civica_conditions_components"."value_status" IN ('observed','disputed')) AND "civica_conditions_components"."native_value" IS NOT NULL AND "civica_conditions_components"."reference_year" BETWEEN 1800 AND 2200) OR (("civica_conditions_components"."value_status" NOT IN ('observed','disputed')) AND "civica_conditions_components"."native_value" IS NULL AND "civica_conditions_components"."reference_year" IS NULL)) AND (("civica_conditions_components"."value_status" = 'observed' AND "civica_conditions_components"."value_status_reason" IS NULL) OR ("civica_conditions_components"."value_status" <> 'observed' AND length(trim("civica_conditions_components"."value_status_reason")) > 0))),
	CONSTRAINT "conditions_component_inclusion_check" CHECK ("civica_conditions_components"."inclusion_decision" IN ('included','excluded_missing','refused_mixed_year'))
);
--> statement-breakpoint
ALTER TABLE "civica_conditions_scores" ADD COLUMN "calculation_key" text;--> statement-breakpoint
ALTER TABLE "civica_conditions_calculations" ADD CONSTRAINT "civica_conditions_calculations_jurisdiction_id_jurisdictions_id_fk" FOREIGN KEY ("jurisdiction_id") REFERENCES "public"."jurisdictions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "civica_conditions_components" ADD CONSTRAINT "civica_conditions_components_calculation_key_civica_conditions_calculations_calculation_key_fk" FOREIGN KEY ("calculation_key") REFERENCES "public"."civica_conditions_calculations"("calculation_key") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "civica_conditions_components" ADD CONSTRAINT "civica_conditions_components_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_conditions_calculation_jurisdiction" ON "civica_conditions_calculations" USING btree ("jurisdiction_id","dimension","methodology_version");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_conditions_component_unique" ON "civica_conditions_components" USING btree ("calculation_key","component_id");--> statement-breakpoint
CREATE INDEX "idx_conditions_component_source" ON "civica_conditions_components" USING btree ("source_id","indicator_id");--> statement-breakpoint
ALTER TABLE "civica_conditions_scores" ADD CONSTRAINT "civica_conditions_scores_calculation_key_civica_conditions_calculations_calculation_key_fk" FOREIGN KEY ("calculation_key") REFERENCES "public"."civica_conditions_calculations"("calculation_key") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_conditions_calculation" ON "civica_conditions_scores" USING btree ("calculation_key");--> statement-breakpoint
CREATE TRIGGER dat_016_retain_mutation
BEFORE UPDATE OR DELETE ON "civica_conditions_calculations"
FOR EACH ROW EXECUTE FUNCTION civica_capture_research_evidence_history();--> statement-breakpoint
CREATE TRIGGER dat_016_retain_mutation
BEFORE UPDATE OR DELETE ON "civica_conditions_components"
FOR EACH ROW EXECUTE FUNCTION civica_capture_research_evidence_history();

-- civica-affected-relations: civica_conditions_calculations,civica_conditions_components,civica_conditions_scores,research_evidence_history
