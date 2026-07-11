ALTER TABLE ci_source_ingestions ADD COLUMN indicator_id text;
ALTER TABLE ci_source_ingestions ADD COLUMN upstream_release text;
ALTER TABLE ci_source_ingestions ADD COLUMN artifact_hash text;
ALTER TABLE ci_source_ingestions ADD COLUMN artifact_kind text;
ALTER TABLE ci_source_ingestions ADD COLUMN temporal_coverage text;
ALTER TABLE ci_source_ingestions ADD COLUMN license_url text;
ALTER TABLE ci_source_ingestions ADD COLUMN transformation_id text;
ALTER TABLE ci_source_ingestions ADD COLUMN substitution_reason text;
ALTER TABLE ci_source_ingestions ADD COLUMN method_version text;

UPDATE ci_source_ingestions i SET
  indicator_id=COALESCE((SELECT d.indicator_id FROM ci_dimension_scores d WHERE d.ingestion_id=i.id LIMIT 1), CASE WHEN i.source_id='vdem' AND i.dimension='democratic_quality' THEN 'v2x_libdem' WHEN i.source_id='worldbank_wgi' AND i.dimension='democratic_quality' THEN 'va.est' WHEN i.source_id='worldbank_wgi' AND i.dimension='rule_of_law' THEN 'rl.est' WHEN i.source_id='freedom_house' THEN 'fh_pr_cl_sum' WHEN i.source_id='transparency_intl' THEN 'CPI_SCORE' WHEN i.source_id='global_peace_index' THEN 'GPI_SCORE' WHEN i.source_id='undp_hdi' THEN 'hdi' ELSE i.source_id || ':' || i.dimension END),
  upstream_release=COALESCE((SELECT d.upstream_release FROM ci_dimension_scores d WHERE d.ingestion_id=i.id LIMIT 1), i.source_id || ' ' || i.dataset_year || ' release'),
  artifact_hash=COALESCE((SELECT d.artifact_hash FROM ci_dimension_scores d WHERE d.ingestion_id=i.id LIMIT 1), encode(digest(concat_ws('|',i.id::text,i.source_id,i.dimension,i.dataset_year::text,i.native_scale_min::text,i.native_scale_max::text,i.countries_covered::text),'sha256'),'hex')),
  artifact_kind=COALESCE((SELECT d.artifact_kind FROM ci_dimension_scores d WHERE d.ingestion_id=i.id LIMIT 1), 'normalized_batch'),
  temporal_coverage=COALESCE((SELECT d.temporal_coverage FROM ci_dimension_scores d WHERE d.ingestion_id=i.id LIMIT 1), i.dataset_year::text),
  license_url=COALESCE((SELECT d.license_url FROM ci_dimension_scores d WHERE d.ingestion_id=i.id LIMIT 1), CASE i.source_id WHEN 'worldbank_wgi' THEN 'https://datacatalog.worldbank.org/public-licenses' WHEN 'vdem' THEN 'https://www.v-dem.net/media/datasets/V-Dem-CY-Core-v15_csv.zip' WHEN 'freedom_house' THEN 'https://freedomhouse.org/sites/default/files/2024-02/Aggregate_Category_and_Subcategory_Scores_FIW_2003-2024.xlsx' WHEN 'transparency_intl' THEN 'https://images.transparencycdn.org/images/CPI2024-Results-and-trends.xlsx' WHEN 'undp_hdi' THEN 'https://hdr.undp.org/sites/default/files/2025_HDR/HDR25_Composite_indices_complete_time_series.csv' WHEN 'global_peace_index' THEN 'https://www.visionofhumanity.org/maps/' ELSE 'https://civicaatlas.org/licensing#rights-manifest' END),
  transformation_id=COALESCE((SELECT d.transformation_id FROM ci_dimension_scores d WHERE d.ingestion_id=i.id LIMIT 1), 'ci-ingestion-ledger-legacy-backfill/v1:' || i.dimension),
  substitution_reason=CASE WHEN i.source_id='worldbank_wgi' AND i.dimension='democratic_quality' THEN 'Coverage substitution where the primary V-Dem indicator has no jurisdiction row.' END,
  method_version=COALESCE((SELECT d.method_version FROM ci_dimension_scores d WHERE d.ingestion_id=i.id LIMIT 1), 'legacy-pre-dat-033');

ALTER TABLE ci_source_ingestions ALTER COLUMN indicator_id SET NOT NULL, ALTER COLUMN upstream_release SET NOT NULL, ALTER COLUMN artifact_hash SET NOT NULL, ALTER COLUMN artifact_kind SET NOT NULL, ALTER COLUMN temporal_coverage SET NOT NULL, ALTER COLUMN license_url SET NOT NULL, ALTER COLUMN transformation_id SET NOT NULL, ALTER COLUMN method_version SET NOT NULL;
DROP INDEX idx_ci_source_ingestions_unique;
CREATE UNIQUE INDEX idx_ci_source_ingestions_unique ON ci_source_ingestions(source_id,dimension,dataset_year,indicator_id);
ALTER TABLE ci_source_ingestions ADD CONSTRAINT ci_source_ingestions_lineage_check CHECK (artifact_hash ~ '^[a-f0-9]{64}$' AND artifact_kind IN ('publisher_bytes','normalized_batch') AND license_url LIKE 'https://%');
