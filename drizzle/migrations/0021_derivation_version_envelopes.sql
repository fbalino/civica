-- DAT-010: retain method/algorithm/prompt/taxonomy/source-basket identity on derived rows.
-- Existing rows are marked honestly as legacy_unversioned; no historical version is inferred.

ALTER TABLE "country_fact_vintages" ADD COLUMN "derivation_version_key" text;
ALTER TABLE "country_fact_vintages" ADD COLUMN "derivation_versions" jsonb;
UPDATE "country_fact_vintages"
SET "derivation_version_key" = 'derivation/legacy-unversioned/country_fact_vintages',
    "derivation_versions" = '{"schemaVersion":"derivation-version-envelope/v1","methodology":{"state":"legacy_unversioned","reason":"Existing country_fact_vintages row predates DAT-010 row-level derivation versioning."},"algorithm":{"state":"legacy_unversioned","reason":"Existing country_fact_vintages row predates DAT-010 row-level derivation versioning."},"prompt":{"state":"legacy_unversioned","reason":"Existing country_fact_vintages row predates DAT-010 row-level derivation versioning."},"taxonomy":{"state":"legacy_unversioned","reason":"Existing country_fact_vintages row predates DAT-010 row-level derivation versioning."},"sourceBasket":{"state":"legacy_unversioned","reason":"Existing country_fact_vintages row predates DAT-010 row-level derivation versioning."},"sourceIds":[]}'::jsonb
WHERE "derivation_version_key" IS NULL OR "derivation_versions" IS NULL;
ALTER TABLE "country_fact_vintages" ALTER COLUMN "derivation_version_key" SET NOT NULL;
ALTER TABLE "country_fact_vintages" ALTER COLUMN "derivation_versions" SET NOT NULL;
CREATE INDEX "idx_fact_vintage_derivation_version" ON "country_fact_vintages" ("derivation_version_key");

ALTER TABLE "government_taxonomies" ADD COLUMN "derivation_version_key" text;
ALTER TABLE "government_taxonomies" ADD COLUMN "derivation_versions" jsonb;
UPDATE "government_taxonomies"
SET "derivation_version_key" = 'derivation/legacy-unversioned/government_taxonomies',
    "derivation_versions" = '{"schemaVersion":"derivation-version-envelope/v1","methodology":{"state":"legacy_unversioned","reason":"Existing government_taxonomies row predates DAT-010 row-level derivation versioning."},"algorithm":{"state":"legacy_unversioned","reason":"Existing government_taxonomies row predates DAT-010 row-level derivation versioning."},"prompt":{"state":"legacy_unversioned","reason":"Existing government_taxonomies row predates DAT-010 row-level derivation versioning."},"taxonomy":{"state":"legacy_unversioned","reason":"Existing government_taxonomies row predates DAT-010 row-level derivation versioning."},"sourceBasket":{"state":"legacy_unversioned","reason":"Existing government_taxonomies row predates DAT-010 row-level derivation versioning."},"sourceIds":[]}'::jsonb
WHERE "derivation_version_key" IS NULL OR "derivation_versions" IS NULL;
ALTER TABLE "government_taxonomies" ALTER COLUMN "derivation_version_key" SET NOT NULL;
ALTER TABLE "government_taxonomies" ALTER COLUMN "derivation_versions" SET NOT NULL;
CREATE INDEX "idx_government_taxonomies_derivation_version" ON "government_taxonomies" ("derivation_version_key");

ALTER TABLE "ci_dimension_scores" ADD COLUMN "derivation_version_key" text;
ALTER TABLE "ci_dimension_scores" ADD COLUMN "derivation_versions" jsonb;
UPDATE "ci_dimension_scores"
SET "derivation_version_key" = 'derivation/legacy-unversioned/ci_dimension_scores',
    "derivation_versions" = '{"schemaVersion":"derivation-version-envelope/v1","methodology":{"state":"legacy_unversioned","reason":"Existing ci_dimension_scores row predates DAT-010 row-level derivation versioning."},"algorithm":{"state":"legacy_unversioned","reason":"Existing ci_dimension_scores row predates DAT-010 row-level derivation versioning."},"prompt":{"state":"legacy_unversioned","reason":"Existing ci_dimension_scores row predates DAT-010 row-level derivation versioning."},"taxonomy":{"state":"legacy_unversioned","reason":"Existing ci_dimension_scores row predates DAT-010 row-level derivation versioning."},"sourceBasket":{"state":"legacy_unversioned","reason":"Existing ci_dimension_scores row predates DAT-010 row-level derivation versioning."},"sourceIds":[]}'::jsonb
WHERE "derivation_version_key" IS NULL OR "derivation_versions" IS NULL;
ALTER TABLE "ci_dimension_scores" ALTER COLUMN "derivation_version_key" SET NOT NULL;
ALTER TABLE "ci_dimension_scores" ALTER COLUMN "derivation_versions" SET NOT NULL;
CREATE INDEX "idx_ci_dimension_scores_derivation_version" ON "ci_dimension_scores" ("derivation_version_key");

ALTER TABLE "ci_composite_scores" ADD COLUMN "derivation_version_key" text;
ALTER TABLE "ci_composite_scores" ADD COLUMN "derivation_versions" jsonb;
UPDATE "ci_composite_scores"
SET "derivation_version_key" = 'derivation/legacy-unversioned/ci_composite_scores',
    "derivation_versions" = '{"schemaVersion":"derivation-version-envelope/v1","methodology":{"state":"legacy_unversioned","reason":"Existing ci_composite_scores row predates DAT-010 row-level derivation versioning."},"algorithm":{"state":"legacy_unversioned","reason":"Existing ci_composite_scores row predates DAT-010 row-level derivation versioning."},"prompt":{"state":"legacy_unversioned","reason":"Existing ci_composite_scores row predates DAT-010 row-level derivation versioning."},"taxonomy":{"state":"legacy_unversioned","reason":"Existing ci_composite_scores row predates DAT-010 row-level derivation versioning."},"sourceBasket":{"state":"legacy_unversioned","reason":"Existing ci_composite_scores row predates DAT-010 row-level derivation versioning."},"sourceIds":[]}'::jsonb
WHERE "derivation_version_key" IS NULL OR "derivation_versions" IS NULL;
ALTER TABLE "ci_composite_scores" ALTER COLUMN "derivation_version_key" SET NOT NULL;
ALTER TABLE "ci_composite_scores" ALTER COLUMN "derivation_versions" SET NOT NULL;
CREATE INDEX "idx_ci_composite_derivation_version" ON "ci_composite_scores" ("derivation_version_key");

ALTER TABLE "pulse_events_v2" ADD COLUMN "derivation_version_key" text;
ALTER TABLE "pulse_events_v2" ADD COLUMN "derivation_versions" jsonb;
UPDATE "pulse_events_v2"
SET "derivation_version_key" = 'derivation/legacy-unversioned/pulse_events_v2',
    "derivation_versions" = '{"schemaVersion":"derivation-version-envelope/v1","methodology":{"state":"legacy_unversioned","reason":"Existing pulse_events_v2 row predates DAT-010 row-level derivation versioning."},"algorithm":{"state":"legacy_unversioned","reason":"Existing pulse_events_v2 row predates DAT-010 row-level derivation versioning."},"prompt":{"state":"legacy_unversioned","reason":"Existing pulse_events_v2 row predates DAT-010 row-level derivation versioning."},"taxonomy":{"state":"legacy_unversioned","reason":"Existing pulse_events_v2 row predates DAT-010 row-level derivation versioning."},"sourceBasket":{"state":"legacy_unversioned","reason":"Existing pulse_events_v2 row predates DAT-010 row-level derivation versioning."},"sourceIds":[]}'::jsonb
WHERE "derivation_version_key" IS NULL OR "derivation_versions" IS NULL;
ALTER TABLE "pulse_events_v2" ALTER COLUMN "derivation_version_key" SET NOT NULL;
ALTER TABLE "pulse_events_v2" ALTER COLUMN "derivation_versions" SET NOT NULL;
CREATE INDEX "idx_pulse_v2_derivation_version" ON "pulse_events_v2" ("derivation_version_key");

ALTER TABLE "pulse_dimensional_deltas" ADD COLUMN "derivation_version_key" text;
ALTER TABLE "pulse_dimensional_deltas" ADD COLUMN "derivation_versions" jsonb;
UPDATE "pulse_dimensional_deltas"
SET "derivation_version_key" = 'derivation/legacy-unversioned/pulse_dimensional_deltas',
    "derivation_versions" = '{"schemaVersion":"derivation-version-envelope/v1","methodology":{"state":"legacy_unversioned","reason":"Existing pulse_dimensional_deltas row predates DAT-010 row-level derivation versioning."},"algorithm":{"state":"legacy_unversioned","reason":"Existing pulse_dimensional_deltas row predates DAT-010 row-level derivation versioning."},"prompt":{"state":"legacy_unversioned","reason":"Existing pulse_dimensional_deltas row predates DAT-010 row-level derivation versioning."},"taxonomy":{"state":"legacy_unversioned","reason":"Existing pulse_dimensional_deltas row predates DAT-010 row-level derivation versioning."},"sourceBasket":{"state":"legacy_unversioned","reason":"Existing pulse_dimensional_deltas row predates DAT-010 row-level derivation versioning."},"sourceIds":[]}'::jsonb
WHERE "derivation_version_key" IS NULL OR "derivation_versions" IS NULL;
ALTER TABLE "pulse_dimensional_deltas" ALTER COLUMN "derivation_version_key" SET NOT NULL;
ALTER TABLE "pulse_dimensional_deltas" ALTER COLUMN "derivation_versions" SET NOT NULL;
CREATE INDEX "idx_pulse_dim_derivation_version" ON "pulse_dimensional_deltas" ("derivation_version_key");
