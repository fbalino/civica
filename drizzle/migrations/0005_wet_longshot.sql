CREATE TABLE "advisory_board_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"affiliation" text NOT NULL,
	"expertise" text NOT NULL,
	"bio_md" text,
	"photo_url" text,
	"display_order" integer DEFAULT 100 NOT NULL,
	"joined_at" date DEFAULT now() NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "correction_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"submitted_at" timestamp DEFAULT now() NOT NULL,
	"country_id" uuid,
	"category" text NOT NULL,
	"dimension" text,
	"submitter_name" text,
	"submitter_email" text,
	"submitter_affiliation" text,
	"description" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"disposition" text,
	"resolved_at" timestamp,
	"is_public" boolean DEFAULT true NOT NULL,
	"internal_notes" text
);
--> statement-breakpoint
ALTER TABLE "correction_log" ADD CONSTRAINT "correction_log_country_id_jurisdictions_id_fk" FOREIGN KEY ("country_id") REFERENCES "public"."jurisdictions"("id") ON DELETE no action ON UPDATE no action;