CREATE TABLE "civica_conditions_scores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"jurisdiction_id" uuid NOT NULL,
	"dimension" text NOT NULL,
	"quarter" text NOT NULL,
	"normalized_score" real NOT NULL,
	"raw_value" real,
	"source_id" text NOT NULL,
	"dataset_year" integer NOT NULL,
	"methodology_version" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "civica_conditions_scores" ADD CONSTRAINT "civica_conditions_scores_jurisdiction_id_jurisdictions_id_fk" FOREIGN KEY ("jurisdiction_id") REFERENCES "public"."jurisdictions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "civica_conditions_scores" ADD CONSTRAINT "civica_conditions_scores_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_conditions_unique" ON "civica_conditions_scores" USING btree ("jurisdiction_id","dimension","quarter","methodology_version");--> statement-breakpoint
CREATE INDEX "idx_conditions_quarter" ON "civica_conditions_scores" USING btree ("quarter");--> statement-breakpoint
CREATE INDEX "idx_conditions_jurisdiction" ON "civica_conditions_scores" USING btree ("jurisdiction_id");