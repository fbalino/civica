CREATE TABLE "ci_ingestion_runs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"dataset_year" integer NOT NULL,
	"quarter" text NOT NULL,
	"methodology_version" text NOT NULL,
	"release_label" text NOT NULL,
	"status" text DEFAULT 'staging' NOT NULL,
	"required_adapters" jsonb NOT NULL,
	"adapter_results" jsonb NOT NULL,
	"staged_checksum" text,
	"previous_visible_release" jsonb,
	"error_message" text,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE INDEX "idx_ci_ingestion_runs_status_started" ON "ci_ingestion_runs" USING btree ("status","started_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_ci_ingestion_runs_release_label" ON "ci_ingestion_runs" USING btree ("release_label");
--> statement-breakpoint
CREATE TRIGGER dat_016_retain_mutation
  BEFORE DELETE OR UPDATE ON ci_ingestion_runs
  FOR EACH ROW EXECUTE FUNCTION civica_capture_research_evidence_history();
