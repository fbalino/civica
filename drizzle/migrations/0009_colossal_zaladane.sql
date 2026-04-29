CREATE TABLE "pulse_review_audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"reviewer_id" text NOT NULL,
	"action" text NOT NULL,
	"before" jsonb NOT NULL,
	"after" jsonb NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pulse_review_audit_log" ADD CONSTRAINT "pulse_review_audit_log_event_id_pulse_events_v2_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."pulse_events_v2"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_pulse_review_audit_event" ON "pulse_review_audit_log" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "idx_pulse_review_audit_reviewer" ON "pulse_review_audit_log" USING btree ("reviewer_id","created_at");