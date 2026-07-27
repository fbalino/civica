ALTER TABLE "correction_log" ADD COLUMN "entity_type" text;--> statement-breakpoint
ALTER TABLE "correction_log" ADD COLUMN "entity_id" text;--> statement-breakpoint
ALTER TABLE "correction_log" ADD COLUMN "field_path" text;--> statement-breakpoint
ALTER TABLE "correction_log" ADD COLUMN "affected_release_id" text;--> statement-breakpoint
ALTER TABLE "correction_log" ADD COLUMN "reported_source_id" text;--> statement-breakpoint
ALTER TABLE "correction_log" ADD COLUMN "reported_source_url" text;--> statement-breakpoint
ALTER TABLE "correction_log" ADD COLUMN "published_value" text;--> statement-breakpoint
ALTER TABLE "correction_log" ADD COLUMN "proposed_value" text;--> statement-breakpoint
ALTER TABLE "correction_log" ADD COLUMN "evidence_url" text;--> statement-breakpoint
ALTER TABLE "correction_log" ADD COLUMN "notice_version" text;--> statement-breakpoint
ALTER TABLE "correction_log" ADD COLUMN "notice_accepted_at" timestamp;--> statement-breakpoint
ALTER TABLE "correction_log" ADD COLUMN "acknowledgment_code" text;--> statement-breakpoint
ALTER TABLE "correction_log" ADD COLUMN "acknowledged_at" timestamp;--> statement-breakpoint
ALTER TABLE "correction_log" ADD COLUMN "triaged_at" timestamp;--> statement-breakpoint
ALTER TABLE "correction_log" ADD COLUMN "reviewer_id" text;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_correction_log_acknowledgment_code" ON "correction_log" USING btree ("acknowledgment_code") WHERE "correction_log"."acknowledgment_code" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_correction_log_status_submitted" ON "correction_log" USING btree ("status","submitted_at");--> statement-breakpoint
CREATE INDEX "idx_correction_log_entity" ON "correction_log" USING btree ("entity_type","entity_id");--> statement-breakpoint
ALTER TABLE "correction_log" ADD CONSTRAINT "correction_log_status_closed" CHECK ("correction_log"."status" IN ('open','in_review','resolved_corrected','resolved_no_change','rejected'));--> statement-breakpoint
ALTER TABLE "correction_log" ADD CONSTRAINT "correction_log_resolution_shape" CHECK ((("correction_log"."status" IN ('open','in_review')) AND "correction_log"."resolved_at" IS NULL) OR (("correction_log"."status" IN ('resolved_corrected','resolved_no_change','rejected')) AND "correction_log"."resolved_at" IS NOT NULL AND length(trim("correction_log"."disposition")) >= 10));--> statement-breakpoint
ALTER TABLE "correction_log" ADD CONSTRAINT "correction_log_atlas_report_shape" CHECK ("correction_log"."category" <> 'atlas_data_error' OR ("correction_log"."entity_type" IN ('fact','institution','office','person','election','constitution-passage','organization','indicator') AND length(trim("correction_log"."entity_id")) > 0 AND length(trim("correction_log"."field_path")) > 0 AND length(trim("correction_log"."affected_release_id")) > 0 AND length(trim("correction_log"."reported_source_id")) > 0 AND "correction_log"."reported_source_url" LIKE 'https://%' AND length(trim("correction_log"."published_value")) > 0 AND "correction_log"."notice_version" = 'civica-data-error-report-notice/2026-07-23' AND "correction_log"."notice_accepted_at" IS NOT NULL AND "correction_log"."acknowledgment_code" ~ '^CA-[A-F0-9]{12}$' AND "correction_log"."acknowledged_at" IS NOT NULL));--> statement-breakpoint
ALTER TABLE "correction_log" ADD CONSTRAINT "correction_log_url_shape" CHECK (("correction_log"."reported_source_url" IS NULL OR "correction_log"."reported_source_url" LIKE 'https://%') AND ("correction_log"."evidence_url" IS NULL OR "correction_log"."evidence_url" LIKE 'https://%'));

-- civica-affected-relations: correction_log,atlas_entity_change_history,research_evidence_history
