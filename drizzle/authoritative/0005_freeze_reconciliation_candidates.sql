CREATE TABLE "country_fact_vintage_candidates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vintage_label" text NOT NULL,
	"cut_at_timestamp" timestamp NOT NULL,
	"jurisdiction_id" uuid NOT NULL,
	"fact_key" text NOT NULL,
	"source_id" text NOT NULL,
	"source_row_id" uuid NOT NULL,
	"source_hash" text,
	"source_snapshot_id" uuid,
	"input_evidence_kind" text NOT NULL,
	"input_evidence_hash" text NOT NULL,
	"adapter_version_hash" text NOT NULL,
	"candidate_content_hash" text NOT NULL,
	"candidate_status" text NOT NULL,
	"candidate_payload" jsonb NOT NULL,
	"is_canonical_at_cut" boolean DEFAULT false NOT NULL,
	"decision_reason" text,
	"decision_trace" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "country_fact_vintage_releases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vintage_label" text NOT NULL,
	"cut_at_timestamp" timestamp NOT NULL,
	"methodology_version" text NOT NULL,
	"resolver_version_hash" text NOT NULL,
	"completeness_status" text NOT NULL,
	"candidate_count" integer,
	"winner_count" integer NOT NULL,
	"candidate_set_checksum" text,
	"winner_set_checksum" text NOT NULL,
	"input_manifest" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "country_fact_vintage_releases_vintage_label_unique" UNIQUE("vintage_label")
);
--> statement-breakpoint
ALTER TABLE "country_fact_vintages" ADD COLUMN "canonical_candidate_id" uuid;--> statement-breakpoint
ALTER TABLE "country_fact_vintage_candidates" ADD CONSTRAINT "country_fact_vintage_candidates_vintage_label_country_fact_vintage_releases_vintage_label_fk" FOREIGN KEY ("vintage_label") REFERENCES "public"."country_fact_vintage_releases"("vintage_label") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "country_fact_vintage_candidates" ADD CONSTRAINT "country_fact_vintage_candidates_jurisdiction_id_jurisdictions_id_fk" FOREIGN KEY ("jurisdiction_id") REFERENCES "public"."jurisdictions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "country_fact_vintage_candidates" ADD CONSTRAINT "country_fact_vintage_candidates_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_fact_vintage_candidate_identity" ON "country_fact_vintage_candidates" USING btree ("vintage_label","jurisdiction_id","fact_key","source_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_fact_vintage_candidate_id_label" ON "country_fact_vintage_candidates" USING btree ("id","vintage_label");--> statement-breakpoint
CREATE INDEX "idx_fact_vintage_candidate_pair" ON "country_fact_vintage_candidates" USING btree ("vintage_label","jurisdiction_id","fact_key");--> statement-breakpoint
CREATE INDEX "idx_fact_vintage_candidate_source" ON "country_fact_vintage_candidates" USING btree ("vintage_label","source_id");--> statement-breakpoint
CREATE INDEX "idx_fact_vintage_release_status" ON "country_fact_vintage_releases" USING btree ("completeness_status");
--> statement-breakpoint
ALTER TABLE "country_fact_vintage_releases" ADD CONSTRAINT "fact_vintage_release_completeness_closed" CHECK (
  (completeness_status = 'complete_candidates' AND candidate_count IS NOT NULL AND candidate_count > 0 AND candidate_set_checksum ~ '^[0-9a-f]{64}$')
  OR (completeness_status = 'canonical_only_legacy' AND candidate_count IS NULL AND candidate_set_checksum IS NULL)
);
--> statement-breakpoint
ALTER TABLE "country_fact_vintage_releases" ADD CONSTRAINT "fact_vintage_release_hashes_valid" CHECK (
  winner_count > 0 AND winner_set_checksum ~ '^[0-9a-f]{64}$'
  AND (resolver_version_hash = 'legacy-unrecorded' OR resolver_version_hash ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
ALTER TABLE "country_fact_vintage_candidates" ADD CONSTRAINT "fact_vintage_candidate_evidence_closed" CHECK (
  input_evidence_kind IN ('source_payload_hash','normalized_observation_hash')
  AND input_evidence_hash ~ '^[0-9a-f]{64}$'
  AND adapter_version_hash ~ '^[0-9a-f]{64}$'
  AND candidate_content_hash ~ '^[0-9a-f]{64}$'
);
--> statement-breakpoint
ALTER TABLE "country_fact_vintage_candidates" ADD CONSTRAINT "fact_vintage_candidate_status_closed" CHECK (candidate_status IN ('active','rejected','superseded','demoted'));
--> statement-breakpoint
ALTER TABLE "country_fact_vintages" ADD CONSTRAINT "country_fact_vintages_candidate_same_release_fk"
  FOREIGN KEY (canonical_candidate_id, vintage_label)
  REFERENCES country_fact_vintage_candidates(id, vintage_label)
  DEFERRABLE INITIALLY DEFERRED;
--> statement-breakpoint
CREATE TRIGGER dat_032_immutable_candidates BEFORE UPDATE OR DELETE ON country_fact_vintage_candidates
  FOR EACH ROW EXECUTE FUNCTION civica_reject_frozen_vintage_mutation();
--> statement-breakpoint
CREATE TRIGGER dat_032_immutable_candidate_releases BEFORE UPDATE OR DELETE ON country_fact_vintage_releases
  FOR EACH ROW EXECUTE FUNCTION civica_reject_frozen_vintage_mutation();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION civica_validate_complete_candidate_winner() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE release_status text; candidate_winner boolean;
BEGIN
  SELECT completeness_status INTO release_status FROM country_fact_vintage_releases WHERE vintage_label=NEW.vintage_label;
  IF release_status = 'complete_candidates' THEN
    IF NEW.canonical_candidate_id IS NULL THEN RAISE EXCEPTION 'complete candidate release requires canonical_candidate_id'; END IF;
    SELECT is_canonical_at_cut INTO candidate_winner FROM country_fact_vintage_candidates
      WHERE id=NEW.canonical_candidate_id AND vintage_label=NEW.vintage_label;
    IF candidate_winner IS DISTINCT FROM true THEN RAISE EXCEPTION 'canonical candidate pointer is not the frozen winner'; END IF;
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER dat_032_validate_complete_candidate_winner BEFORE INSERT ON country_fact_vintages
  FOR EACH ROW EXECUTE FUNCTION civica_validate_complete_candidate_winner();
--> statement-breakpoint
INSERT INTO country_fact_vintage_releases (
  vintage_label, cut_at_timestamp, methodology_version, resolver_version_hash,
  completeness_status, candidate_count, winner_count, candidate_set_checksum,
  winner_set_checksum, input_manifest
)
SELECT vintage_label, min(cut_at_timestamp), min(methodology_version), 'legacy-unrecorded',
  'canonical_only_legacy', NULL, count(*)::int, NULL,
  encode(digest(string_agg(content_hash, '' ORDER BY jurisdiction_id, fact_key), 'sha256'), 'hex'),
  jsonb_build_object(
    'schemaVersion','reconciliation-candidate-input-manifest/v1',
    'status','historical-inputs-not-retained',
    'reason','This cut predates complete candidate retention; current mutable rows cannot reconstruct its resolver input set.'
  )
FROM country_fact_vintages
GROUP BY vintage_label;
