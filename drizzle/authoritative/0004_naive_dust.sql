ALTER TABLE "ci_ingestion_runs" ADD CONSTRAINT "ci_ingestion_runs_status_closed" CHECK ("ci_ingestion_runs"."status" IN ('staging', 'failed', 'completed'));--> statement-breakpoint
ALTER TABLE "ci_ingestion_runs" ADD CONSTRAINT "ci_ingestion_runs_terminal_shape" CHECK (
      ("ci_ingestion_runs"."status" = 'staging' AND "ci_ingestion_runs"."completed_at" IS NULL)
      OR ("ci_ingestion_runs"."status" = 'failed' AND "ci_ingestion_runs"."completed_at" IS NOT NULL AND "ci_ingestion_runs"."error_message" IS NOT NULL)
      OR ("ci_ingestion_runs"."status" = 'completed' AND "ci_ingestion_runs"."completed_at" IS NOT NULL AND "ci_ingestion_runs"."staged_checksum" IS NOT NULL AND "ci_ingestion_runs"."error_message" IS NULL)
    );