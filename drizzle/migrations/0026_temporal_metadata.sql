-- civica-affected-relations: country_fact_vintages,country_facts,government_taxonomies,sources
ALTER TABLE "country_fact_vintages"
  ADD COLUMN IF NOT EXISTS "observation_reference_year" integer,
  ADD COLUMN IF NOT EXISTS "upstream_dataset_release" text,
  ADD COLUMN IF NOT EXISTS "source_retrieved_at" timestamp,
  ADD COLUMN IF NOT EXISTS "civica_publication_version" text;
--> statement-breakpoint
ALTER TABLE "government_taxonomies"
  ADD COLUMN IF NOT EXISTS "regime_source_dataset_version" text,
  ADD COLUMN IF NOT EXISTS "regime_retrieved_at" timestamp,
  ADD COLUMN IF NOT EXISTS "civica_publication_version" text;
--> statement-breakpoint

-- DAT-023 normally rejects every mutation. This one reviewed migration adds
-- previously absent temporal metadata without changing the cited value,
-- source, hash, method, cutoff, or label, then reinstalls the guard.
DROP TRIGGER IF EXISTS dat_023_immutable_vintage ON "country_fact_vintages";
--> statement-breakpoint
UPDATE country_fact_vintages v
SET
  observation_reference_year = COALESCE(
    EXTRACT(YEAR FROM v.as_of)::integer,
    CASE WHEN cf.retrieved_at <= v.cut_at_timestamp
      THEN COALESCE(cf.data_vintage_year, cf.fact_year) END
  ),
  upstream_dataset_release = CASE WHEN cf.retrieved_at <= v.cut_at_timestamp
    THEN cf.upstream_vintage_label END,
  source_retrieved_at = CASE WHEN cf.retrieved_at <= v.cut_at_timestamp
    THEN cf.retrieved_at END,
  civica_publication_version = v.vintage_label
FROM country_facts cf
WHERE cf.id = v.canonical_fact_id;
--> statement-breakpoint
CREATE TRIGGER dat_023_immutable_vintage BEFORE UPDATE OR DELETE ON "country_fact_vintages"
  FOR EACH ROW EXECUTE FUNCTION civica_reject_frozen_vintage_mutation();
--> statement-breakpoint

UPDATE government_taxonomies
SET
  regime_year = 2022,
  regime_source_dataset_version = 'Bjørnskov-Rode regime data v6.1',
  regime_retrieved_at = (SELECT last_sync_at FROM sources WHERE id = 'bjornskov_rode'),
  civica_publication_version = taxonomy_version
WHERE regime_dataset_version = 'QoG Standard Jan26' AND regime_type_cgv IS NOT NULL;
--> statement-breakpoint

ALTER TABLE "country_fact_vintages"
  DROP CONSTRAINT IF EXISTS "country_fact_vintages_publication_matches_label";
--> statement-breakpoint
ALTER TABLE "country_fact_vintages"
  ADD CONSTRAINT "country_fact_vintages_publication_matches_label"
  CHECK (civica_publication_version = vintage_label);
--> statement-breakpoint
ALTER TABLE "government_taxonomies"
  DROP CONSTRAINT IF EXISTS "government_taxonomies_regime_temporal_complete";
--> statement-breakpoint
ALTER TABLE "government_taxonomies"
  ADD CONSTRAINT "government_taxonomies_regime_temporal_complete" CHECK (
    regime_type_cgv IS NULL OR (
      regime_year IS NOT NULL AND
      regime_dataset_version IS NOT NULL AND
      regime_source_dataset_version IS NOT NULL AND
      regime_retrieved_at IS NOT NULL AND
      civica_publication_version IS NOT NULL
    )
  );
