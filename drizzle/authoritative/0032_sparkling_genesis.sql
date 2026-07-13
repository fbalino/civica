-- civica-affected-relations: organization_memberships,organizations,sources,jurisdictions,research_evidence_history
-- ATL-012 adds fail-closed relationship status and exact provenance storage. Existing rows default to unverified_legacy and remain retained, and the checked release is activated separately by the atomic sync writer.
ALTER TABLE "organization_memberships" ADD COLUMN "join_date_precision" text DEFAULT 'unknown' NOT NULL;--> statement-breakpoint
ALTER TABLE "organization_memberships" ADD COLUMN "end_date" date;--> statement-breakpoint
ALTER TABLE "organization_memberships" ADD COLUMN "end_date_precision" text DEFAULT 'unknown' NOT NULL;--> statement-breakpoint
ALTER TABLE "organization_memberships" ADD COLUMN "status" text DEFAULT 'unverified_legacy' NOT NULL;--> statement-breakpoint
ALTER TABLE "organization_memberships" ADD COLUMN "status_note" text;--> statement-breakpoint
ALTER TABLE "organization_memberships" ADD COLUMN "disputed" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "organization_memberships" ADD COLUMN "source_id" text;--> statement-breakpoint
ALTER TABLE "organization_memberships" ADD COLUMN "source_url" text;--> statement-breakpoint
ALTER TABLE "organization_memberships" ADD COLUMN "source_license" text;--> statement-breakpoint
ALTER TABLE "organization_memberships" ADD COLUMN "source_retrieved_at" timestamp;--> statement-breakpoint
ALTER TABLE "organization_memberships" ADD COLUMN "upstream_vintage" text;--> statement-breakpoint
ALTER TABLE "organization_memberships" ADD COLUMN "updated_at" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "source_id" text;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "source_url" text;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "source_license" text;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "source_retrieved_at" timestamp;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "upstream_vintage" text;--> statement-breakpoint
ALTER TABLE "organization_memberships" ADD CONSTRAINT "organization_memberships_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_org_memberships_public" ON "organization_memberships" USING btree ("status","jurisdiction_id");--> statement-breakpoint
ALTER TABLE "organization_memberships" ADD CONSTRAINT "organization_memberships_status_check" CHECK ("organization_memberships"."status" in ('current', 'former', 'withdrawn', 'suspended', 'unverified_legacy'));--> statement-breakpoint
ALTER TABLE "organization_memberships" ADD CONSTRAINT "organization_memberships_join_precision_check" CHECK ("organization_memberships"."join_date_precision" in ('day', 'year', 'unknown'));--> statement-breakpoint
ALTER TABLE "organization_memberships" ADD CONSTRAINT "organization_memberships_end_precision_check" CHECK ("organization_memberships"."end_date_precision" in ('day', 'year', 'unknown'));--> statement-breakpoint
ALTER TABLE "organization_memberships" ADD CONSTRAINT "organization_memberships_interval_check" CHECK ("organization_memberships"."end_date" is null or "organization_memberships"."join_date" is null or "organization_memberships"."end_date" >= "organization_memberships"."join_date");--> statement-breakpoint
ALTER TABLE "organization_memberships" ADD CONSTRAINT "organization_memberships_terminal_date_check" CHECK ("organization_memberships"."status" not in ('former', 'withdrawn') or "organization_memberships"."end_date" is not null);--> statement-breakpoint
ALTER TABLE "organization_memberships" ADD CONSTRAINT "organization_memberships_source_bundle_check" CHECK ("organization_memberships"."status" = 'unverified_legacy' or ("organization_memberships"."source_id" is not null and "organization_memberships"."source_url" is not null and "organization_memberships"."source_license" is not null and "organization_memberships"."source_retrieved_at" is not null and "organization_memberships"."upstream_vintage" is not null));--> statement-breakpoint
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_source_bundle_check" CHECK (("organizations"."source_id" is null and "organizations"."source_url" is null and "organizations"."source_license" is null and "organizations"."source_retrieved_at" is null and "organizations"."upstream_vintage" is null) or ("organizations"."source_id" is not null and "organizations"."source_url" is not null and "organizations"."source_license" is not null and "organizations"."source_retrieved_at" is not null and "organizations"."upstream_vintage" is not null));
