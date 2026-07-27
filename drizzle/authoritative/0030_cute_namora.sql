-- civica-affected-relations: constitution_passages
CREATE TABLE "constitution_passages" (
	"passage_id" text PRIMARY KEY NOT NULL,
	"schema_version" text NOT NULL,
	"search_index_version" text NOT NULL,
	"constitution_id" uuid NOT NULL,
	"jurisdiction_id" uuid NOT NULL,
	"source_document_id" text NOT NULL,
	"source_section_id" text NOT NULL,
	"section_order" integer NOT NULL,
	"anchor_id" text NOT NULL,
	"heading_label" text,
	"topic_keys" jsonb NOT NULL,
	"plain_text" text NOT NULL,
	"content_sha256" text NOT NULL,
	"language_code" text NOT NULL,
	"language_basis" text NOT NULL,
	"translation_status" text NOT NULL,
	"original_language_code" text,
	"translator" text,
	"source_id" text NOT NULL,
	"source_url" text NOT NULL,
	"retrieval_url" text NOT NULL,
	"retrieved_at" timestamp NOT NULL,
	"is_current" boolean DEFAULT true NOT NULL,
	"superseded_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"search_vector" "tsvector" GENERATED ALWAYS AS (setweight(to_tsvector('english'::regconfig, coalesce("heading_label", '')), 'A') || setweight(to_tsvector('english'::regconfig, coalesce("plain_text", '')), 'B')) STORED NOT NULL,
	CONSTRAINT "constitution_passages_contract_check" CHECK ("constitution_passages"."schema_version" = 'constitution-passage/v1' AND "constitution_passages"."search_index_version" = 'constitution-search-index/english-v1' AND "constitution_passages"."passage_id" ~ '^constitution-passage/sha256:[a-f0-9]{64}$' AND btrim("constitution_passages"."source_document_id") <> '' AND btrim("constitution_passages"."source_section_id") <> '' AND "constitution_passages"."section_order" >= 0 AND "constitution_passages"."anchor_id" ~ '^sec-[A-Za-z0-9-]+$' AND jsonb_typeof("constitution_passages"."topic_keys") = 'array' AND btrim("constitution_passages"."plain_text") <> '' AND "constitution_passages"."content_sha256" ~ '^[a-f0-9]{64}$' AND "constitution_passages"."language_code" = 'en' AND "constitution_passages"."language_basis" = 'constitute-service-lang-parameter' AND "constitution_passages"."translation_status" = 'publisher-supplied-language-version-translation-status-unknown' AND "constitution_passages"."original_language_code" IS NULL AND "constitution_passages"."translator" IS NULL AND "constitution_passages"."source_id" = 'constitute_project' AND "constitution_passages"."source_url" ~ '^https://www[.]constituteproject[.]org/constitution/' AND "constitution_passages"."retrieval_url" ~ '^https://www[.]constituteproject[.]org/service/html[?]' AND (("constitution_passages"."is_current" = true AND "constitution_passages"."superseded_at" IS NULL) OR ("constitution_passages"."is_current" = false AND "constitution_passages"."superseded_at" IS NOT NULL)))
);
--> statement-breakpoint
ALTER TABLE "constitution_passages" ADD CONSTRAINT "constitution_passages_constitution_id_constitutions_id_fk" FOREIGN KEY ("constitution_id") REFERENCES "public"."constitutions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "constitution_passages" ADD CONSTRAINT "constitution_passages_jurisdiction_id_jurisdictions_id_fk" FOREIGN KEY ("jurisdiction_id") REFERENCES "public"."jurisdictions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "constitution_passages" ADD CONSTRAINT "constitution_passages_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_constitution_passages_current_section" ON "constitution_passages" USING btree ("constitution_id","source_section_id") WHERE "constitution_passages"."is_current" = true;--> statement-breakpoint
CREATE INDEX "idx_constitution_passages_search" ON "constitution_passages" USING gin ("search_vector") WHERE "constitution_passages"."is_current" = true;--> statement-breakpoint
CREATE INDEX "idx_constitution_passages_topics" ON "constitution_passages" USING gin ("topic_keys") WHERE "constitution_passages"."is_current" = true;--> statement-breakpoint
CREATE INDEX "idx_constitution_passages_jurisdiction" ON "constitution_passages" USING btree ("jurisdiction_id","is_current");--> statement-breakpoint
CREATE INDEX "idx_constitution_passages_document_order" ON "constitution_passages" USING btree ("constitution_id","is_current","section_order");
--> statement-breakpoint
CREATE OR REPLACE FUNCTION civica_capture_constitution_passage_history()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  before_row jsonb := to_jsonb(OLD);
  after_row jsonb := CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(NEW) ELSE NULL END;
  evidence_id text := COALESCE(after_row->>'passage_id', before_row->>'passage_id');
BEGIN
  IF evidence_id IS NULL OR evidence_id !~ '^constitution-passage/sha256:[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'constitution passage history requires canonical passage_id';
  END IF;
  INSERT INTO research_evidence_history (
    entity_table, entity_id, operation, before, after, reason, actor_id
  ) VALUES (
    TG_TABLE_NAME, evidence_id, lower(TG_OP), before_row, after_row,
    lower(TG_OP) || '_retained_by_atl_009', current_user
  );
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER constitution_passages_dat_016_retain_mutation
BEFORE UPDATE OR DELETE ON "constitution_passages"
FOR EACH ROW EXECUTE FUNCTION civica_capture_constitution_passage_history();
