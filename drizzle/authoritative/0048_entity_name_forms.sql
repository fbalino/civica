-- EXP-029: versioned, source-backed entity name forms.
CREATE TABLE "entity_name_forms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contract_version" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"value" text NOT NULL,
	"language_tag" text NOT NULL,
	"script_code" text,
	"name_role" text NOT NULL,
	"source_id" text NOT NULL,
	"source_url" text NOT NULL,
	"retrieved_at" timestamp NOT NULL,
	"upstream_vintage" text NOT NULL,
	"translation_status" text NOT NULL,
	"transliteration_status" text NOT NULL,
	"is_current" boolean DEFAULT true NOT NULL,
	"superseded_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "entity_name_forms_contract_check" CHECK ("entity_name_forms"."contract_version" = 'civica-entity-name-form/v1'),
	CONSTRAINT "entity_name_forms_entity_type_check" CHECK ("entity_name_forms"."entity_type" IN ('jurisdiction','person','office','political_party')),
	CONSTRAINT "entity_name_forms_role_check" CHECK ("entity_name_forms"."name_role" IN ('english_display','source','native','official','transliterated')),
	CONSTRAINT "entity_name_forms_language_check" CHECK ("entity_name_forms"."language_tag" ~ '^[A-Za-z]{2,8}(-[A-Za-z0-9]{1,8})*$'),
	CONSTRAINT "entity_name_forms_script_check" CHECK ("entity_name_forms"."script_code" IS NULL OR "entity_name_forms"."script_code" ~ '^[A-Z][a-z]{3}$'),
	CONSTRAINT "entity_name_forms_translation_check" CHECK ("entity_name_forms"."translation_status" IN ('not_translated','publisher_supplied_translation','civica_translation','unknown')),
	CONSTRAINT "entity_name_forms_transliteration_check" CHECK ("entity_name_forms"."transliteration_status" IN ('not_transliterated','publisher_supplied_transliteration','civica_transliteration','unknown')),
	CONSTRAINT "entity_name_forms_https_source_check" CHECK ("entity_name_forms"."source_url" ~ '^https://'),
	CONSTRAINT "entity_name_forms_lifecycle_check" CHECK (("entity_name_forms"."is_current" = true AND "entity_name_forms"."superseded_at" IS NULL) OR ("entity_name_forms"."is_current" = false AND "entity_name_forms"."superseded_at" IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "entity_name_forms" ADD CONSTRAINT "entity_name_forms_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "entity_name_forms_current_identity_idx" ON "entity_name_forms" USING btree ("entity_type","entity_id","name_role","language_tag","source_id") WHERE "entity_name_forms"."is_current" = true;--> statement-breakpoint
CREATE INDEX "entity_name_forms_entity_idx" ON "entity_name_forms" USING btree ("entity_type","entity_id","is_current");
--> statement-breakpoint
CREATE TRIGGER entity_name_forms_research_evidence_history
BEFORE UPDATE OR DELETE ON entity_name_forms
FOR EACH ROW
EXECUTE FUNCTION civica_capture_research_evidence_history();
