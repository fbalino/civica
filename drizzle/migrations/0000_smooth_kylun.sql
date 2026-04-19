CREATE TABLE "constitutions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"jurisdiction_id" uuid NOT NULL,
	"constitute_project_id" text,
	"year" integer,
	"year_updated" integer,
	"full_text_html" text,
	"last_fetched" timestamp
);
--> statement-breakpoint
CREATE TABLE "country_factbook_sections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"jurisdiction_id" uuid NOT NULL,
	"section_name" text NOT NULL,
	"section_data" jsonb NOT NULL,
	"display_order" integer,
	"import_phase" integer DEFAULT 1,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "country_facts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"jurisdiction_id" uuid NOT NULL,
	"category" text NOT NULL,
	"fact_key" text NOT NULL,
	"fact_value" text,
	"fact_value_numeric" real,
	"fact_unit" text,
	"fact_year" integer,
	"source_note" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "elections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"jurisdiction_id" uuid NOT NULL,
	"election_date" date,
	"election_type" text,
	"body_id" uuid,
	"turnout_percent" real,
	"wikidata_qid" text
);
--> statement-breakpoint
CREATE TABLE "government_bodies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"jurisdiction_id" uuid NOT NULL,
	"name" text NOT NULL,
	"body_type" text NOT NULL,
	"chamber_type" text,
	"total_seats" integer,
	"branch" text,
	"wikidata_qid" text,
	"ipu_parline_id" text,
	"hierarchy_level" integer
);
--> statement-breakpoint
CREATE TABLE "jurisdictions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"iso2" text,
	"iso3" text,
	"wikidata_qid" text,
	"continent" text,
	"government_type" text,
	"government_type_detail" text,
	"capital" text,
	"population" integer,
	"gdp_billions" real,
	"area_sq_km" integer,
	"languages" text,
	"currency" text,
	"democracy_index" real,
	"flag_url" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "jurisdictions_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "legislature_parties" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"body_id" uuid NOT NULL,
	"party_name" text NOT NULL,
	"party_color" text,
	"seat_count" integer NOT NULL,
	"is_ruling_coalition" boolean DEFAULT false,
	"wikidata_qid" text
);
--> statement-breakpoint
CREATE TABLE "offices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"body_id" uuid NOT NULL,
	"name" text NOT NULL,
	"office_type" text NOT NULL,
	"is_elected" boolean,
	"wikidata_qid" text
);
--> statement-breakpoint
CREATE TABLE "persons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"date_of_birth" date,
	"wikidata_qid" text,
	"photo_url" text,
	"parline_person_code" text
);
--> statement-breakpoint
CREATE TABLE "sources" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"base_url" text,
	"license" text NOT NULL,
	"is_commercial_use_allowed" boolean NOT NULL,
	"last_sync_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "statements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subject_table" text NOT NULL,
	"subject_id" uuid NOT NULL,
	"predicate" text NOT NULL,
	"object_value" text,
	"object_entity_id" uuid,
	"source_id" text NOT NULL,
	"source_url" text,
	"source_license" text,
	"retrieved_at" timestamp NOT NULL,
	"source_hash" text,
	"valid_from" date,
	"valid_to" date,
	"confidence" real DEFAULT 1,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "terms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"office_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"party_name" text,
	"party_color" text,
	"start_date" date,
	"end_date" date,
	"is_current" boolean DEFAULT true
);
--> statement-breakpoint
ALTER TABLE "constitutions" ADD CONSTRAINT "constitutions_jurisdiction_id_jurisdictions_id_fk" FOREIGN KEY ("jurisdiction_id") REFERENCES "public"."jurisdictions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "country_factbook_sections" ADD CONSTRAINT "country_factbook_sections_jurisdiction_id_jurisdictions_id_fk" FOREIGN KEY ("jurisdiction_id") REFERENCES "public"."jurisdictions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "country_facts" ADD CONSTRAINT "country_facts_jurisdiction_id_jurisdictions_id_fk" FOREIGN KEY ("jurisdiction_id") REFERENCES "public"."jurisdictions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "elections" ADD CONSTRAINT "elections_jurisdiction_id_jurisdictions_id_fk" FOREIGN KEY ("jurisdiction_id") REFERENCES "public"."jurisdictions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "elections" ADD CONSTRAINT "elections_body_id_government_bodies_id_fk" FOREIGN KEY ("body_id") REFERENCES "public"."government_bodies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "government_bodies" ADD CONSTRAINT "government_bodies_jurisdiction_id_jurisdictions_id_fk" FOREIGN KEY ("jurisdiction_id") REFERENCES "public"."jurisdictions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legislature_parties" ADD CONSTRAINT "legislature_parties_body_id_government_bodies_id_fk" FOREIGN KEY ("body_id") REFERENCES "public"."government_bodies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offices" ADD CONSTRAINT "offices_body_id_government_bodies_id_fk" FOREIGN KEY ("body_id") REFERENCES "public"."government_bodies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "terms" ADD CONSTRAINT "terms_office_id_offices_id_fk" FOREIGN KEY ("office_id") REFERENCES "public"."offices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "terms" ADD CONSTRAINT "terms_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_factbook_sections_unique" ON "country_factbook_sections" USING btree ("jurisdiction_id","section_name");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_country_facts_unique" ON "country_facts" USING btree ("jurisdiction_id","fact_key");--> statement-breakpoint
CREATE INDEX "idx_country_facts_key" ON "country_facts" USING btree ("fact_key");--> statement-breakpoint
CREATE INDEX "idx_country_facts_category" ON "country_facts" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_country_facts_numeric" ON "country_facts" USING btree ("fact_key","fact_value_numeric");