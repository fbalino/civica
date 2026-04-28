CREATE TABLE "bills" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"jurisdiction_id" uuid NOT NULL,
	"body_id" uuid,
	"source_id" text NOT NULL,
	"external_id" text NOT NULL,
	"title" text NOT NULL,
	"long_title" text,
	"summary" text,
	"stage" integer DEFAULT 0 NOT NULL,
	"raw_status" text,
	"introduced_date" date,
	"last_action_date" date NOT NULL,
	"last_action_text" text,
	"sponsor_name" text,
	"sponsor_party" text,
	"url" text NOT NULL,
	"text_url" text,
	"vote_yes" integer,
	"vote_no" integer,
	"vote_abstain" integer,
	"raw" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bills" ADD CONSTRAINT "bills_jurisdiction_id_jurisdictions_id_fk" FOREIGN KEY ("jurisdiction_id") REFERENCES "public"."jurisdictions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bills" ADD CONSTRAINT "bills_body_id_government_bodies_id_fk" FOREIGN KEY ("body_id") REFERENCES "public"."government_bodies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bills" ADD CONSTRAINT "bills_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bills_jurisdiction_last_action_idx" ON "bills" USING btree ("jurisdiction_id","last_action_date");--> statement-breakpoint
CREATE UNIQUE INDEX "bills_source_external_idx" ON "bills" USING btree ("source_id","external_id");