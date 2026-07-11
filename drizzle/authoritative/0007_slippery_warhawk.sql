-- DAT-033: first-class source/indicator lineage without discarding legacy observations.
ALTER TABLE "ci_dimension_scores" ADD COLUMN "indicator_id" text;
ALTER TABLE "ci_dimension_scores" ADD COLUMN "upstream_release" text;
ALTER TABLE "ci_dimension_scores" ADD COLUMN "artifact_hash" text;
ALTER TABLE "ci_dimension_scores" ADD COLUMN "artifact_kind" text;
ALTER TABLE "ci_dimension_scores" ADD COLUMN "temporal_coverage" text;
ALTER TABLE "ci_dimension_scores" ADD COLUMN "license_url" text;
ALTER TABLE "ci_dimension_scores" ADD COLUMN "transformation_id" text;
ALTER TABLE "ci_dimension_scores" ADD COLUMN "substitution_reason" text;
ALTER TABLE "ci_dimension_scores" ADD COLUMN "method_version" text;

ALTER TABLE "civica_conditions_scores" ADD COLUMN "indicator_id" text;
ALTER TABLE "civica_conditions_scores" ADD COLUMN "upstream_release" text;
ALTER TABLE "civica_conditions_scores" ADD COLUMN "artifact_hash" text;
ALTER TABLE "civica_conditions_scores" ADD COLUMN "artifact_kind" text;
ALTER TABLE "civica_conditions_scores" ADD COLUMN "temporal_coverage" text;
ALTER TABLE "civica_conditions_scores" ADD COLUMN "license_url" text;
ALTER TABLE "civica_conditions_scores" ADD COLUMN "transformation_id" text;
ALTER TABLE "civica_conditions_scores" ADD COLUMN "substitution_reason" text;
ALTER TABLE "civica_conditions_scores" ADD COLUMN "method_version" text;

ALTER TABLE "indicator_history" ADD COLUMN "upstream_release" text;
ALTER TABLE "indicator_history" ADD COLUMN "artifact_hash" text;
ALTER TABLE "indicator_history" ADD COLUMN "artifact_kind" text;
ALTER TABLE "indicator_history" ADD COLUMN "temporal_coverage" text;
ALTER TABLE "indicator_history" ADD COLUMN "license_url" text;
ALTER TABLE "indicator_history" ADD COLUMN "transformation_id" text;
ALTER TABLE "indicator_history" ADD COLUMN "substitution_reason" text;
ALTER TABLE "indicator_history" ADD COLUMN "method_version" text;

WITH batches AS (
  SELECT source_id, dimension, quarter, methodology_version,
    encode(digest(string_agg(concat_ws('|', jurisdiction_id::text, raw_value::text, normalized_score::text), E'\n' ORDER BY jurisdiction_id), 'sha256'), 'hex') AS normalized_hash
  FROM ci_dimension_scores GROUP BY source_id, dimension, quarter, methodology_version
)
UPDATE ci_dimension_scores d SET
  indicator_id = CASE
    WHEN d.source_id='vdem' AND d.dimension='democratic_quality' THEN 'v2x_libdem'
    WHEN d.source_id='worldbank_wgi' AND d.dimension='democratic_quality' THEN 'va.est'
    WHEN d.source_id='worldbank_wgi' AND d.dimension='rule_of_law' THEN 'rl.est'
    WHEN d.source_id='freedom_house' AND d.dimension='freedom_rights' THEN 'fh_pr_cl_sum'
    WHEN d.source_id='transparency_intl' AND d.dimension='corruption_control' THEN 'CPI_SCORE'
    WHEN d.source_id='global_peace_index' AND d.dimension='stability_security' THEN 'GPI_SCORE'
    WHEN d.source_id='undp_hdi' AND d.dimension='human_development' THEN 'hdi'
    ELSE d.source_id || ':' || d.dimension END,
  upstream_release = d.source_id || ' release represented by ' || d.quarter,
  artifact_hash = CASE
    WHEN d.quarter='2024-Q4' AND d.source_id='vdem' THEN 'bd6430d6b78785c7422acee7d75bef1b852f2ce1baa5f673ae40ffca64ffe51b'
    WHEN d.quarter='2024-Q4' AND d.source_id='worldbank_wgi' THEN '25a2f9eabb90b0092973392c0b31571aa58b691cc5786292e504b52f693e1eb8'
    WHEN d.quarter='2024-Q4' AND d.source_id='freedom_house' THEN 'd6ac861af6e7dcea7e870e39ddbcd2925730a653c1466f8992a7d0005f53be88'
    WHEN d.quarter='2024-Q4' AND d.source_id='transparency_intl' THEN '34d1c16eb3c5b04cad2cf116c852dfc4ab8144b1c66cb37c74011848639f5736'
    ELSE b.normalized_hash END,
  artifact_kind = CASE WHEN d.quarter='2024-Q4' AND d.source_id IN ('vdem','worldbank_wgi','freedom_house','transparency_intl') THEN 'publisher_bytes' ELSE 'normalized_batch' END,
  temporal_coverage = split_part(d.quarter, '-', 1),
  license_url = CASE d.source_id
    WHEN 'vdem' THEN 'https://www.v-dem.net/media/datasets/V-Dem-CY-Core-v15_csv.zip'
    WHEN 'worldbank_wgi' THEN 'https://datacatalog.worldbank.org/public-licenses'
    WHEN 'freedom_house' THEN 'https://freedomhouse.org/sites/default/files/2024-02/Aggregate_Category_and_Subcategory_Scores_FIW_2003-2024.xlsx'
    WHEN 'transparency_intl' THEN 'https://images.transparencycdn.org/images/CPI2024-Results-and-trends.xlsx'
    WHEN 'undp_hdi' THEN 'https://hdr.undp.org/sites/default/files/2025_HDR/HDR25_Composite_indices_complete_time_series.csv'
    WHEN 'global_peace_index' THEN 'https://www.visionofhumanity.org/maps/'
    ELSE 'https://civicaatlas.org/licensing#rights-manifest' END,
  transformation_id = 'ci-ingest-legacy-backfill/v1:' || d.dimension,
  substitution_reason = CASE WHEN d.source_id='worldbank_wgi' AND d.dimension='democratic_quality' THEN 'Coverage substitution where the primary V-Dem indicator has no jurisdiction row.' END,
  method_version = d.methodology_version
FROM batches b WHERE b.source_id=d.source_id AND b.dimension=d.dimension AND b.quarter=d.quarter AND b.methodology_version=d.methodology_version;

WITH batches AS (
  SELECT source_id, dimension, quarter, methodology_version,
    encode(digest(string_agg(concat_ws('|', jurisdiction_id::text, raw_value::text, normalized_score::text), E'\n' ORDER BY jurisdiction_id), 'sha256'), 'hex') AS normalized_hash
  FROM civica_conditions_scores GROUP BY source_id, dimension, quarter, methodology_version
)
UPDATE civica_conditions_scores d SET
  indicator_id = CASE WHEN d.source_id='undp_hdi' THEN 'hdi' WHEN d.source_id='global_peace_index' THEN 'GPI_SCORE' WHEN d.source_id='worldbank_economic' THEN 'FP.CPI.TOTL.ZG+SL.UEM.TOTL.ZS+NY.GDP.MKTP.KD.ZG' ELSE d.source_id || ':' || d.dimension END,
  upstream_release = d.source_id || ' release represented by ' || d.quarter,
  artifact_hash = b.normalized_hash, artifact_kind = 'normalized_batch', temporal_coverage = d.dataset_year::text,
  license_url = CASE d.source_id WHEN 'worldbank_economic' THEN 'https://datacatalog.worldbank.org/public-licenses' WHEN 'undp_hdi' THEN 'https://hdr.undp.org/sites/default/files/2025_HDR/HDR25_Composite_indices_complete_time_series.csv' WHEN 'global_peace_index' THEN 'https://www.visionofhumanity.org/maps/' ELSE 'https://civicaatlas.org/licensing#rights-manifest' END,
  transformation_id = 'conditions-legacy-backfill/v1:' || d.dimension, substitution_reason = NULL, method_version = d.methodology_version
FROM batches b WHERE b.source_id=d.source_id AND b.dimension=d.dimension AND b.quarter=d.quarter AND b.methodology_version=d.methodology_version;

WITH batches AS (
  SELECT source_id, indicator,
    encode(digest(string_agg(concat_ws('|', jurisdiction_id::text, year::text, value::text), E'\n' ORDER BY jurisdiction_id, year), 'sha256'), 'hex') AS normalized_hash,
    min(year)::text || '/' || max(year)::text AS coverage
  FROM indicator_history GROUP BY source_id, indicator
)
UPDATE indicator_history h SET upstream_release = h.source_id || ' historical series retained before DAT-033',
  artifact_hash=b.normalized_hash, artifact_kind='normalized_batch', temporal_coverage=b.coverage,
  license_url=CASE h.source_id WHEN 'vdem' THEN 'https://www.v-dem.net/media/datasets/V-Dem-CY-Core-v15_csv.zip' WHEN 'worldbank_wgi' THEN 'https://datacatalog.worldbank.org/public-licenses' WHEN 'freedom_house' THEN 'https://freedomhouse.org/sites/default/files/2024-02/Aggregate_Category_and_Subcategory_Scores_FIW_2003-2024.xlsx' WHEN 'transparency_intl' THEN 'https://images.transparencycdn.org/images/CPI2024-Results-and-trends.xlsx' WHEN 'undp_hdi' THEN 'https://hdr.undp.org/sites/default/files/2025_HDR/HDR25_Composite_indices_complete_time_series.csv' ELSE 'https://civicaatlas.org/licensing#rights-manifest' END,
  transformation_id='source-native-history-legacy-backfill/v1', substitution_reason=NULL, method_version='indicator-history/v1'
FROM batches b WHERE b.source_id=h.source_id AND b.indicator=h.indicator;

ALTER TABLE ci_dimension_scores ALTER COLUMN indicator_id SET NOT NULL, ALTER COLUMN upstream_release SET NOT NULL, ALTER COLUMN artifact_hash SET NOT NULL, ALTER COLUMN artifact_kind SET NOT NULL, ALTER COLUMN temporal_coverage SET NOT NULL, ALTER COLUMN license_url SET NOT NULL, ALTER COLUMN transformation_id SET NOT NULL, ALTER COLUMN method_version SET NOT NULL;
ALTER TABLE civica_conditions_scores ALTER COLUMN indicator_id SET NOT NULL, ALTER COLUMN upstream_release SET NOT NULL, ALTER COLUMN artifact_hash SET NOT NULL, ALTER COLUMN artifact_kind SET NOT NULL, ALTER COLUMN temporal_coverage SET NOT NULL, ALTER COLUMN license_url SET NOT NULL, ALTER COLUMN transformation_id SET NOT NULL, ALTER COLUMN method_version SET NOT NULL;
ALTER TABLE indicator_history ALTER COLUMN upstream_release SET NOT NULL, ALTER COLUMN artifact_hash SET NOT NULL, ALTER COLUMN artifact_kind SET NOT NULL, ALTER COLUMN temporal_coverage SET NOT NULL, ALTER COLUMN license_url SET NOT NULL, ALTER COLUMN transformation_id SET NOT NULL, ALTER COLUMN method_version SET NOT NULL;

DROP INDEX "idx_ci_dimension_scores_unique";
DROP INDEX "idx_conditions_unique";
DROP INDEX "idx_indicator_history_unique";
CREATE UNIQUE INDEX "idx_ci_dimension_scores_unique" ON "ci_dimension_scores" ("jurisdiction_id","dimension","quarter","methodology_version","source_id","indicator_id");
CREATE UNIQUE INDEX "idx_conditions_unique" ON "civica_conditions_scores" ("jurisdiction_id","dimension","quarter","methodology_version","source_id","indicator_id");
CREATE UNIQUE INDEX "idx_indicator_history_unique" ON "indicator_history" ("jurisdiction_id","indicator","year","source_id");
