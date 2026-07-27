CREATE TABLE "civica_conditions_normalization_parameters" (
	"release_id" text NOT NULL,
	"dimension" text NOT NULL,
	"reference_period" text NOT NULL,
	"component_id" text NOT NULL,
	"direction" text NOT NULL,
	"transformation_id" text NOT NULL,
	"mean" real,
	"standard_deviation" real,
	"lower_bound" real,
	"upper_bound" real,
	CONSTRAINT "civica_conditions_normalization_parameters_pk" PRIMARY KEY("release_id","dimension","reference_period","component_id"),
	CONSTRAINT "conditions_normalization_parameter_shape_check" CHECK ("civica_conditions_normalization_parameters"."direction" IN ('higher_is_better','lower_is_better') AND btrim("civica_conditions_normalization_parameters"."transformation_id") <> '' AND ("civica_conditions_normalization_parameters"."standard_deviation" IS NULL OR "civica_conditions_normalization_parameters"."standard_deviation" > 0) AND (("civica_conditions_normalization_parameters"."lower_bound" IS NULL AND "civica_conditions_normalization_parameters"."upper_bound" IS NULL) OR ("civica_conditions_normalization_parameters"."lower_bound" < "civica_conditions_normalization_parameters"."upper_bound")))
);
--> statement-breakpoint
CREATE TABLE "civica_conditions_reference_sets" (
	"release_id" text NOT NULL,
	"dimension" text NOT NULL,
	"reference_period" text NOT NULL,
	"jurisdiction_ids" jsonb NOT NULL,
	"population_sha256" text NOT NULL,
	"candidate_count" integer NOT NULL,
	"aligned_count" integer NOT NULL,
	"mixed_year_refused_count" integer NOT NULL,
	"missing_component_count" integer NOT NULL,
	"included_components" jsonb NOT NULL,
	"missingness_policy" text NOT NULL,
	CONSTRAINT "civica_conditions_reference_sets_pk" PRIMARY KEY("release_id","dimension","reference_period"),
	CONSTRAINT "conditions_reference_set_shape_check" CHECK ("civica_conditions_reference_sets"."reference_period" ~ '^[0-9]{4}-Q[1-4]$' AND jsonb_typeof("civica_conditions_reference_sets"."jurisdiction_ids") = 'array' AND jsonb_array_length("civica_conditions_reference_sets"."jurisdiction_ids") > 0 AND "civica_conditions_reference_sets"."population_sha256" ~ '^[a-f0-9]{64}$' AND "civica_conditions_reference_sets"."candidate_count" >= "civica_conditions_reference_sets"."aligned_count" AND "civica_conditions_reference_sets"."aligned_count" > 0 AND "civica_conditions_reference_sets"."mixed_year_refused_count" >= 0 AND "civica_conditions_reference_sets"."missing_component_count" >= 0 AND jsonb_typeof("civica_conditions_reference_sets"."included_components") = 'array' AND jsonb_array_length("civica_conditions_reference_sets"."included_components") > 0 AND "civica_conditions_reference_sets"."missingness_policy" = 'no-imputation-all-declared-components-observed-same-reference-year/v1')
);
--> statement-breakpoint
CREATE TABLE "civica_conditions_releases" (
	"id" text PRIMARY KEY NOT NULL,
	"methodology_version" text NOT NULL,
	"manifest_sha256" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "conditions_release_identity_check" CHECK ("civica_conditions_releases"."id" ~ '^conditions-[a-z0-9-]+-v[1-9][0-9]*$' AND btrim("civica_conditions_releases"."methodology_version") <> '' AND "civica_conditions_releases"."manifest_sha256" ~ '^[a-f0-9]{64}$')
);
--> statement-breakpoint
DROP INDEX "idx_conditions_unique";--> statement-breakpoint
DROP INDEX "idx_conditions_calculation_jurisdiction";--> statement-breakpoint
ALTER TABLE "civica_conditions_calculations" ADD COLUMN "release_id" text;--> statement-breakpoint
ALTER TABLE "civica_conditions_scores" ADD COLUMN "release_id" text;--> statement-breakpoint
ALTER TABLE "civica_conditions_normalization_parameters" ADD CONSTRAINT "conditions_normalization_reference_set_fk" FOREIGN KEY ("release_id","dimension","reference_period") REFERENCES "public"."civica_conditions_reference_sets"("release_id","dimension","reference_period") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "civica_conditions_reference_sets" ADD CONSTRAINT "civica_conditions_reference_sets_release_id_civica_conditions_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."civica_conditions_releases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "civica_conditions_calculations" ADD CONSTRAINT "civica_conditions_calculations_release_id_civica_conditions_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."civica_conditions_releases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "civica_conditions_scores" ADD CONSTRAINT "civica_conditions_scores_release_id_civica_conditions_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."civica_conditions_releases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_conditions_release_unique" ON "civica_conditions_scores" USING btree ("jurisdiction_id","dimension","quarter","methodology_version","source_id","indicator_id","release_id");--> statement-breakpoint
CREATE INDEX "idx_conditions_release" ON "civica_conditions_scores" USING btree ("release_id","dimension");--> statement-breakpoint
CREATE INDEX "idx_conditions_calculation_jurisdiction" ON "civica_conditions_calculations" USING btree ("jurisdiction_id","dimension","methodology_version","release_id");
--> statement-breakpoint
CREATE TRIGGER dat_016_retain_mutation BEFORE UPDATE OR DELETE ON "civica_conditions_releases" FOR EACH ROW EXECUTE FUNCTION civica_capture_research_evidence_history();--> statement-breakpoint
CREATE TRIGGER dat_016_retain_mutation BEFORE UPDATE OR DELETE ON "civica_conditions_reference_sets" FOR EACH ROW EXECUTE FUNCTION civica_capture_research_evidence_history();--> statement-breakpoint
CREATE TRIGGER dat_016_retain_mutation BEFORE UPDATE OR DELETE ON "civica_conditions_normalization_parameters" FOR EACH ROW EXECUTE FUNCTION civica_capture_research_evidence_history();

-- civica-affected-relations: civica_conditions_releases,civica_conditions_reference_sets,civica_conditions_normalization_parameters,civica_conditions_calculations,civica_conditions_scores,research_evidence_history
