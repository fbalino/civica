CREATE TABLE "ci_index_release_pointers" (
	"product" text PRIMARY KEY NOT NULL,
	"release_id" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "ci_index_release_pointers_product_closed" CHECK ("ci_index_release_pointers"."product" = 'civica_index')
);
--> statement-breakpoint
CREATE TABLE "ci_index_releases" (
	"id" text PRIMARY KEY NOT NULL,
	"status" text DEFAULT 'staging' NOT NULL,
	"quarter" text NOT NULL,
	"methodology_version" text NOT NULL,
	"methodology_content_sha256" text NOT NULL,
	"vintage_label" text NOT NULL,
	"supersession_kind" text NOT NULL,
	"supersedes_release_id" text,
	"supersedes_vintage_label" text,
	"input_manifest_sha256" text NOT NULL,
	"dimension_row_set_sha256" text NOT NULL,
	"composite_row_set_sha256" text NOT NULL,
	"dimension_row_count" integer NOT NULL,
	"composite_row_count" integer NOT NULL,
	"input_transformation_version" text NOT NULL,
	"composite_algorithm_version" text NOT NULL,
	"display_transform_version" text NOT NULL,
	"uncertainty_policy" jsonb NOT NULL,
	"dimension_rules" jsonb NOT NULL,
	"source_artifacts" jsonb NOT NULL,
	"published_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "ci_index_releases_vintage_label_unique" UNIQUE("vintage_label"),
	CONSTRAINT "ci_index_releases_status_closed" CHECK ("ci_index_releases"."status" IN ('staging','published')),
	CONSTRAINT "ci_index_releases_hashes_valid" CHECK ("ci_index_releases"."methodology_content_sha256" ~ '^[a-f0-9]{64}$' AND "ci_index_releases"."input_manifest_sha256" ~ '^[a-f0-9]{64}$' AND "ci_index_releases"."dimension_row_set_sha256" ~ '^[a-f0-9]{64}$' AND "ci_index_releases"."composite_row_set_sha256" ~ '^[a-f0-9]{64}$'),
	CONSTRAINT "ci_index_releases_identity_shape" CHECK ("ci_index_releases"."id" ~ '^ci-[a-z0-9-]+-[0-9]{4}-Q[1-4]$' AND "ci_index_releases"."quarter" ~ '^[0-9]{4}-Q[1-4]$' AND btrim("ci_index_releases"."methodology_version") <> '' AND btrim("ci_index_releases"."vintage_label") <> '' AND btrim("ci_index_releases"."input_transformation_version") <> '' AND btrim("ci_index_releases"."composite_algorithm_version") <> '' AND btrim("ci_index_releases"."display_transform_version") <> ''),
	CONSTRAINT "ci_index_releases_supersession_shape" CHECK ((("ci_index_releases"."supersession_kind" = 'none' AND "ci_index_releases"."supersedes_release_id" IS NULL AND "ci_index_releases"."supersedes_vintage_label" IS NULL) OR ("ci_index_releases"."supersession_kind" = 'legacy_unregistered_vintage' AND "ci_index_releases"."supersedes_release_id" IS NULL AND "ci_index_releases"."supersedes_vintage_label" IS NOT NULL) OR ("ci_index_releases"."supersession_kind" = 'registered_release' AND "ci_index_releases"."supersedes_release_id" IS NOT NULL AND "ci_index_releases"."supersedes_vintage_label" IS NOT NULL)) AND "ci_index_releases"."supersedes_release_id" IS DISTINCT FROM "ci_index_releases"."id"),
	CONSTRAINT "ci_index_releases_uncertainty_shape" CHECK (jsonb_typeof("ci_index_releases"."uncertainty_policy") = 'object' AND "ci_index_releases"."uncertainty_policy"->>'schemaVersion' = 'ci-index-uncertainty/v1' AND "ci_index_releases"."uncertainty_policy"->>'pointEstimate' IN ('seeded_simulation_median','deterministic_weighted_composite') AND "ci_index_releases"."uncertainty_policy"->>'displayedRange' IN ('sensitivity_summary_5th_95th_percentile','not_published') AND "ci_index_releases"."uncertainty_policy"->>'bounds' IN ('required','absent') AND ("ci_index_releases"."uncertainty_policy"->>'simulations')::integer >= 0 AND "ci_index_releases"."uncertainty_policy"->>'covarianceModel' IN ('independence_assumed','not_available') AND btrim("ci_index_releases"."uncertainty_policy"->>'interpretation') <> '' AND (("ci_index_releases"."uncertainty_policy"->>'bounds' = 'required') = ("ci_index_releases"."uncertainty_policy"->>'displayedRange' <> 'not_published')) AND ((("ci_index_releases"."uncertainty_policy"->>'simulations')::integer > 0) = ("ci_index_releases"."uncertainty_policy"->>'pointEstimate' = 'seeded_simulation_median'))),
	CONSTRAINT "ci_index_releases_dimension_rules_shape" CHECK (jsonb_typeof("ci_index_releases"."dimension_rules") = 'array' AND jsonb_array_length("ci_index_releases"."dimension_rules") = 5),
	CONSTRAINT "ci_index_releases_source_artifacts_shape" CHECK (jsonb_typeof("ci_index_releases"."source_artifacts") = 'object' AND "ci_index_releases"."source_artifacts" <> '{}'::jsonb),
	CONSTRAINT "ci_index_releases_counts_positive" CHECK ("ci_index_releases"."dimension_row_count" > 0 AND "ci_index_releases"."composite_row_count" > 0),
	CONSTRAINT "ci_index_releases_publication_shape" CHECK (("ci_index_releases"."status" = 'staging' AND "ci_index_releases"."published_at" IS NULL) OR ("ci_index_releases"."status" = 'published' AND "ci_index_releases"."published_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "pulse_score_publication_pointers" (
	"product" text PRIMARY KEY NOT NULL,
	"computation_run_id" uuid NOT NULL,
	"version_key" text NOT NULL,
	"score_as_of" date NOT NULL,
	"published_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "pulse_score_publication_pointers_computation_run_id_unique" UNIQUE("computation_run_id"),
	CONSTRAINT "pulse_score_publication_product_closed" CHECK ("pulse_score_publication_pointers"."product" = 'pulse_dimensions'),
	CONSTRAINT "pulse_score_publication_version_shape" CHECK ("pulse_score_publication_pointers"."version_key" ~ '^pulse-stage/sha256:[a-f0-9]{64}$')
);
--> statement-breakpoint
ALTER TABLE "ci_composite_scores" ADD COLUMN "release_id" text;--> statement-breakpoint
ALTER TABLE "ci_dimension_scores" ADD COLUMN "release_id" text;--> statement-breakpoint
ALTER TABLE "ci_index_release_pointers" ADD CONSTRAINT "ci_index_release_pointers_release_id_ci_index_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."ci_index_releases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ci_index_releases" ADD CONSTRAINT "ci_index_releases_methodology_version_ci_methodology_versions_id_fk" FOREIGN KEY ("methodology_version") REFERENCES "public"."ci_methodology_versions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ci_index_releases" ADD CONSTRAINT "ci_index_releases_supersedes_release_id_ci_index_releases_id_fk" FOREIGN KEY ("supersedes_release_id") REFERENCES "public"."ci_index_releases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pulse_score_publication_pointers" ADD CONSTRAINT "pulse_score_publication_pointers_computation_run_id_pulse_pipeline_runs_id_fk" FOREIGN KEY ("computation_run_id") REFERENCES "public"."pulse_pipeline_runs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_ci_index_releases_status" ON "ci_index_releases" USING btree ("status","published_at");--> statement-breakpoint
ALTER TABLE "ci_composite_scores" ADD CONSTRAINT "ci_composite_scores_release_id_ci_index_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."ci_index_releases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ci_dimension_scores" ADD CONSTRAINT "ci_dimension_scores_release_id_ci_index_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."ci_index_releases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_ci_composite_release" ON "ci_composite_scores" USING btree ("release_id","jurisdiction_id");--> statement-breakpoint
CREATE INDEX "idx_ci_dimension_scores_release" ON "ci_dimension_scores" USING btree ("release_id","jurisdiction_id");--> statement-breakpoint
DROP INDEX "idx_ci_dimension_scores_unique";--> statement-breakpoint
ALTER TABLE "ci_dimension_scores" ADD CONSTRAINT "idx_ci_dimension_scores_unique" UNIQUE NULLS NOT DISTINCT ("jurisdiction_id","dimension","quarter","methodology_version","source_id","indicator_id","release_id");--> statement-breakpoint
DROP INDEX "idx_ci_composite_unique";--> statement-breakpoint
ALTER TABLE "ci_composite_scores" ADD CONSTRAINT "idx_ci_composite_unique" UNIQUE NULLS NOT DISTINCT ("jurisdiction_id","quarter","methodology_version","release_id");
--> statement-breakpoint

-- PLT-014: register the three named Index releases as staging headers and bind
-- existing rows. On an empty schema the INSERT ... SELECT statements are
-- harmless; publication remains an explicit, separately verified operation.
INSERT INTO ci_index_releases (
  id,status,quarter,methodology_version,methodology_content_sha256,vintage_label,
  supersession_kind,supersedes_release_id,supersedes_vintage_label,
  input_manifest_sha256,dimension_row_set_sha256,composite_row_set_sha256,
  dimension_row_count,composite_row_count,input_transformation_version,
  composite_algorithm_version,display_transform_version,uncertainty_policy,
  dimension_rules,source_artifacts
)
SELECT
  release.id,'staging','2024-Q4',release.methodology_version,
  release.methodology_content_sha256,release.vintage_label,
  release.supersession_kind,release.supersedes_release_id,release.supersedes_vintage_label,
  'dc74a651c96ec770cd8128cb22c61d663f0b8192f9441ce55ff44f24966602cc',
  release.dimension_sha256,release.composite_sha256,745,190,
  'ci-ingest-normalization/minmax-v1',release.composite_algorithm,
  'ci-display/fixed-native-bounds-v1',release.uncertainty_policy,
  '[{"dimension":"democratic_quality","sourceId":"vdem","indicatorId":"v2x_libdem","priority":1,"artifactSha256":"bd6430d6b78785c7422acee7d75bef1b852f2ce1baa5f673ae40ffca64ffe51b","upstreamRelease":"vdem 2024 release","artifactKind":"publisher_bytes","temporalCoverage":"2024","licenseUrl":"https://www.v-dem.net/media/datasets/V-Dem-CY-Core-v15_csv.zip","substitutionReason":null},{"dimension":"democratic_quality","sourceId":"worldbank_wgi","indicatorId":"va.est","priority":2,"artifactSha256":"25a2f9eabb90b0092973392c0b31571aa58b691cc5786292e504b52f693e1eb8","upstreamRelease":"worldbank_wgi 2024 release","artifactKind":"publisher_bytes","temporalCoverage":"2024","licenseUrl":"https://datacatalog.worldbank.org/public-licenses","substitutionReason":"Coverage substitution where the primary V-Dem indicator has no jurisdiction row."},{"dimension":"rule_of_law","sourceId":"worldbank_wgi","indicatorId":"rl.est","priority":1,"artifactSha256":"25a2f9eabb90b0092973392c0b31571aa58b691cc5786292e504b52f693e1eb8","upstreamRelease":"worldbank_wgi 2024 release","artifactKind":"publisher_bytes","temporalCoverage":"2024","licenseUrl":"https://datacatalog.worldbank.org/public-licenses","substitutionReason":null},{"dimension":"freedom_rights","sourceId":"freedom_house","indicatorId":"fh_pr_cl_sum","priority":1,"artifactSha256":"d6ac861af6e7dcea7e870e39ddbcd2925730a653c1466f8992a7d0005f53be88","upstreamRelease":"freedom_house 2024 release","artifactKind":"publisher_bytes","temporalCoverage":"2024","licenseUrl":"https://freedomhouse.org/sites/default/files/2024-02/Aggregate_Category_and_Subcategory_Scores_FIW_2003-2024.xlsx","substitutionReason":null},{"dimension":"corruption_control","sourceId":"transparency_intl","indicatorId":"CPI_SCORE","priority":1,"artifactSha256":"34d1c16eb3c5b04cad2cf116c852dfc4ab8144b1c66cb37c74011848639f5736","upstreamRelease":"transparency_intl 2024 release","artifactKind":"publisher_bytes","temporalCoverage":"2024","licenseUrl":"https://images.transparencycdn.org/images/CPI2024-Results-and-trends.xlsx","substitutionReason":null}]'::jsonb,
  '{"vdem:v2x_libdem":"bd6430d6b78785c7422acee7d75bef1b852f2ce1baa5f673ae40ffca64ffe51b","worldbank_wgi:va.est":"25a2f9eabb90b0092973392c0b31571aa58b691cc5786292e504b52f693e1eb8","worldbank_wgi:rl.est":"25a2f9eabb90b0092973392c0b31571aa58b691cc5786292e504b52f693e1eb8","freedom_house:fh_pr_cl_sum":"d6ac861af6e7dcea7e870e39ddbcd2925730a653c1466f8992a7d0005f53be88","transparency_intl:CPI_SCORE":"34d1c16eb3c5b04cad2cf116c852dfc4ab8144b1c66cb37c74011848639f5736"}'::jsonb
FROM (VALUES
  ('ci-beta-r3-2024-Q4','beta-r3','bda3f38947afc44b1a1d54ffe22ad4540068abeb4c29ca907b50a174e5536e85','Civica Index 2024 Q4 (Beta-R3)','legacy_unregistered_vintage',NULL::text,'Civica Index 2024 Q4 (Beta-R2)','d16100ada72a2037a5c311b098eb8bb283ef0d01f1a346efdf74126b1fb65327','dfc3b2d53587fa3901a368b32580f648ee54d68ecbaaae7163515972083b2fa3','ci-composite/fixed-bounds-monte-carlo-v2','{"schemaVersion":"ci-index-uncertainty/v1","pointEstimate":"seeded_simulation_median","displayedRange":"sensitivity_summary_5th_95th_percentile","bounds":"required","simulations":10000,"covarianceModel":"independence_assumed","interpretation":"Sensitivity summary under declared perturbation and independence assumptions; not a calibrated confidence interval."}'::jsonb),
  ('ci-beta-r4-2024-Q4','beta-r4','55344e56d2db234b0e7ccbd809ea43297ded26ad42520e5211cc8bbb2cb69bcc','Civica Index 2024 Q4 (Beta-R4)','registered_release','ci-beta-r3-2024-Q4','Civica Index 2024 Q4 (Beta-R3)','65ffdc77324b12f60467837549b849fde9f01a9df9ae1105acbe0a0aaf63d991','24b282f57a4c04bd152abbce2967f5474847f6f4c1e3cc03ca926d9783d0a605','ci-composite/fixed-bounds-weighted-v3','{"schemaVersion":"ci-index-uncertainty/v1","pointEstimate":"deterministic_weighted_composite","displayedRange":"not_published","bounds":"absent","simulations":0,"covarianceModel":"not_available","interpretation":"No range is published because source-specific uncertainty and dependence were not retained and validated for this release."}'::jsonb),
  ('ci-beta-r5-2024-Q4','beta-r5','39eebd5d0c3f46e900e7bc4e09cac778ac10ad2cef1c4b9b79261a2654a58b8a','Civica Index 2024 Q4 (Beta-R5)','registered_release','ci-beta-r4-2024-Q4','Civica Index 2024 Q4 (Beta-R4)','6dd1ebe3b7b5e29d190bdc52595e06d5776068b5cbbfa7adbb0b04239f72923d','109f70af2629f9af6b5af29d89f94280f302a1fa0d1d1461e136e47238c31e35','ci-composite/fixed-bounds-weighted-v4','{"schemaVersion":"ci-index-uncertainty/v1","pointEstimate":"deterministic_weighted_composite","displayedRange":"not_published","bounds":"absent","simulations":0,"covarianceModel":"not_available","interpretation":"No range is published because source-specific uncertainty and dependence were not retained and validated for this release."}'::jsonb)
) AS release(id,methodology_version,methodology_content_sha256,vintage_label,supersession_kind,supersedes_release_id,supersedes_vintage_label,dimension_sha256,composite_sha256,composite_algorithm,uncertainty_policy)
JOIN ci_methodology_versions methodology ON methodology.id=release.methodology_version
ON CONFLICT (id) DO NOTHING;
--> statement-breakpoint
UPDATE ci_dimension_scores score
SET release_id=release.id
FROM ci_index_releases release
WHERE score.release_id IS NULL
  AND score.methodology_version=release.methodology_version
  AND score.quarter=release.quarter;
--> statement-breakpoint

-- The pre-0036 frozen-vintage trigger rejects every UPDATE, including this
-- one-time release-registry linkage. Disable only that trigger while changing
-- only release_id. ALTER TABLE holds an ACCESS EXCLUSIVE lock until this
-- migration transaction commits, so no concurrent write can enter the gap;
-- an error rolls the disable and the backfill back together.
ALTER TABLE ci_composite_scores DISABLE TRIGGER dat_023_immutable_vintage;
--> statement-breakpoint
UPDATE ci_composite_scores score
SET release_id=release.id
FROM ci_index_releases release
WHERE score.release_id IS NULL
  AND score.methodology_version=release.methodology_version
  AND score.quarter=release.quarter
  AND score.vintage_label=release.vintage_label;
--> statement-breakpoint
ALTER TABLE ci_composite_scores ENABLE TRIGGER dat_023_immutable_vintage;
--> statement-breakpoint

-- These helpers reproduce the exact JavaScript recipes used by
-- stableStringify({ id, weights }) and ciVersionEnvelope(). Publication does
-- not trust a well-shaped hash/key supplied by a writer; it recomputes both.
CREATE OR REPLACE FUNCTION civica_ci_methodology_content_sha256(target_methodology_id text)
RETURNS text LANGUAGE sql STABLE STRICT AS $$
  SELECT encode(digest(
    '{"id":' || to_json(methodology.id)::text || ',"weights":{' ||
    COALESCE((
      SELECT string_agg(to_json(weight.key)::text || ':' || weight.value::text, ',' ORDER BY weight.key)
      FROM jsonb_each(methodology.weights) AS weight(key,value)
    ),'') || '}}',
    'sha256'
  ),'hex')
  FROM ci_methodology_versions methodology
  WHERE methodology.id=target_methodology_id
$$;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION civica_ci_source_basket_version(source_ids jsonb)
RETURNS text LANGUAGE plpgsql IMMUTABLE STRICT AS $$
DECLARE source_lines text;
BEGIN
  IF jsonb_typeof(source_ids)<>'array' OR jsonb_array_length(source_ids)=0 THEN
    RETURN NULL;
  END IF;
  SELECT string_agg(source_id,E'\n' ORDER BY source_id) INTO source_lines
  FROM jsonb_array_elements_text(source_ids) AS source(source_id);
  RETURN 'source-basket/sha256:' || substr(encode(digest(source_lines,'sha256'),'hex'),1,16);
END $$;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION civica_ci_expected_derivation_envelope(
  methodology_version text,
  algorithm_version text,
  source_ids jsonb
)
RETURNS jsonb LANGUAGE sql IMMUTABLE STRICT AS $$
  SELECT jsonb_build_object(
    'schemaVersion','derivation-version-envelope/v1',
    'methodology',jsonb_build_object('state','versioned','id',methodology_version),
    'algorithm',jsonb_build_object('state','versioned','id',algorithm_version),
    'prompt',jsonb_build_object('state','not_applicable','reason','The Civica Index calculation does not use a model prompt.'),
    'taxonomy',jsonb_build_object('state','not_applicable','reason','The Civica Index calculation does not apply a categorical taxonomy.'),
    'sourceBasket',jsonb_build_object('state','versioned','id',civica_ci_source_basket_version(source_ids)),
    'sourceIds',source_ids
  )
$$;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION civica_ci_expected_derivation_version_key(
  methodology_version text,
  algorithm_version text,
  source_ids jsonb
)
RETURNS text LANGUAGE plpgsql IMMUTABLE STRICT AS $$
DECLARE source_ids_json text; source_basket text; payload text;
BEGIN
  IF jsonb_typeof(source_ids)<>'array' OR jsonb_array_length(source_ids)=0 THEN
    RETURN NULL;
  END IF;
  SELECT '[' || string_agg(to_json(source_id)::text,',' ORDER BY ordinal) || ']'
    INTO source_ids_json
  FROM jsonb_array_elements_text(source_ids) WITH ORDINALITY AS source(source_id,ordinal);
  source_basket := civica_ci_source_basket_version(source_ids);
  payload :=
    '{"schemaVersion":"derivation-version-envelope/v1"' ||
    ',"methodology":{"state":"versioned","id":' || to_json(methodology_version)::text || '}' ||
    ',"algorithm":{"state":"versioned","id":' || to_json(algorithm_version)::text || '}' ||
    ',"prompt":{"state":"not_applicable","reason":"The Civica Index calculation does not use a model prompt."}' ||
    ',"taxonomy":{"state":"not_applicable","reason":"The Civica Index calculation does not apply a categorical taxonomy."}' ||
    ',"sourceBasket":{"state":"versioned","id":' || to_json(source_basket)::text || '}' ||
    ',"sourceIds":' || source_ids_json || '}';
  RETURN 'derivation/sha256:' || substr(encode(digest(payload,'sha256'),'hex'),1,16);
END $$;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION civica_validate_ci_release_score_row()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  release_row ci_index_releases%ROWTYPE;
  expected_artifact text;
  expected_dimension_rule jsonb;
  expected_source_ids jsonb;
  expected_derivation_versions jsonb;
  expected_derivation_version_key text;
BEGIN
  IF NEW.release_id IS NULL THEN
    IF TG_TABLE_NAME='ci_composite_scores' AND NEW.vintage_label IS NOT NULL THEN
      RAISE EXCEPTION 'named Index score requires release_id';
    END IF;
    RETURN NEW;
  END IF;
  SELECT * INTO release_row FROM ci_index_releases WHERE id=NEW.release_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'unknown Index release %', NEW.release_id; END IF;
  IF release_row.status='published' THEN
    RAISE EXCEPTION 'published Index release % is immutable', NEW.release_id;
  END IF;
  IF NEW.quarter IS DISTINCT FROM release_row.quarter
     OR NEW.methodology_version IS DISTINCT FROM release_row.methodology_version THEN
    RAISE EXCEPTION 'Index score coordinates disagree with release %', NEW.release_id;
  END IF;
  IF TG_TABLE_NAME='ci_dimension_scores' THEN
    SELECT rule INTO expected_dimension_rule
    FROM jsonb_array_elements(release_row.dimension_rules) rule
    WHERE rule->>'dimension'=NEW.dimension
      AND rule->>'sourceId'=NEW.source_id
      AND rule->>'indicatorId'=NEW.indicator_id;
    IF NOT FOUND
       OR expected_dimension_rule->>'artifactSha256' IS DISTINCT FROM NEW.artifact_hash
       OR expected_dimension_rule->>'upstreamRelease' IS DISTINCT FROM NEW.upstream_release
       OR expected_dimension_rule->>'artifactKind' IS DISTINCT FROM NEW.artifact_kind
       OR expected_dimension_rule->>'temporalCoverage' IS DISTINCT FROM NEW.temporal_coverage
       OR expected_dimension_rule->>'licenseUrl' IS DISTINCT FROM NEW.license_url
       OR expected_dimension_rule->>'substitutionReason' IS DISTINCT FROM NEW.substitution_reason THEN
      RAISE EXCEPTION 'Index dimension lineage is outside release %', NEW.release_id;
    END IF;
    expected_artifact := release_row.source_artifacts->>(NEW.source_id || ':' || NEW.indicator_id);
    IF expected_artifact IS NULL OR expected_artifact IS DISTINCT FROM NEW.artifact_hash THEN
      RAISE EXCEPTION 'Index dimension source artifact is outside release %', NEW.release_id;
    END IF;
    expected_source_ids := to_jsonb(ARRAY[NEW.source_id]::text[]);
    expected_derivation_versions := civica_ci_expected_derivation_envelope(
      release_row.methodology_version,release_row.input_transformation_version,expected_source_ids
    );
    expected_derivation_version_key := civica_ci_expected_derivation_version_key(
      release_row.methodology_version,release_row.input_transformation_version,expected_source_ids
    );
    IF NEW.transformation_id IS DISTINCT FROM release_row.input_transformation_version || ':' || NEW.dimension
       OR NEW.method_version IS DISTINCT FROM release_row.methodology_version
       OR NEW.derivation_versions IS DISTINCT FROM expected_derivation_versions
       OR NEW.derivation_version_key IS DISTINCT FROM expected_derivation_version_key THEN
      RAISE EXCEPTION 'Index dimension derivation disagrees with release %', NEW.release_id;
    END IF;
  ELSE
    IF NEW.vintage_label IS DISTINCT FROM release_row.vintage_label
       OR NEW.supersedes_vintage_label IS DISTINCT FROM release_row.supersedes_vintage_label
       OR NEW.content_hash !~ '^[a-f0-9]{64}$'
       OR (release_row.uncertainty_policy->>'bounds'='required' AND (NEW.score_lower IS NULL OR NEW.score_upper IS NULL))
       OR (release_row.uncertainty_policy->>'bounds'='absent' AND (NEW.score_lower IS NOT NULL OR NEW.score_upper IS NOT NULL))
       OR (NEW.score_lower IS NOT NULL AND NEW.score_upper IS NOT NULL AND (NEW.score_lower>NEW.score OR NEW.score_upper<NEW.score OR NEW.score_lower>NEW.score_upper)) THEN
      RAISE EXCEPTION 'Index composite identity disagrees with release %', NEW.release_id;
    END IF;
    SELECT COALESCE(jsonb_agg(source.source_id ORDER BY source.source_id),'[]'::jsonb)
      INTO expected_source_ids
    FROM (
      SELECT DISTINCT score.source_id
      FROM ci_dimension_scores score
      WHERE score.release_id=NEW.release_id AND score.jurisdiction_id=NEW.jurisdiction_id
    ) source;
    expected_derivation_versions := civica_ci_expected_derivation_envelope(
      release_row.methodology_version,release_row.composite_algorithm_version,expected_source_ids
    );
    expected_derivation_version_key := civica_ci_expected_derivation_version_key(
      release_row.methodology_version,release_row.composite_algorithm_version,expected_source_ids
    );
    IF jsonb_array_length(expected_source_ids)=0
       OR NEW.derivation_versions IS DISTINCT FROM expected_derivation_versions
       OR NEW.derivation_version_key IS DISTINCT FROM expected_derivation_version_key THEN
      RAISE EXCEPTION 'Index composite derivation disagrees with release %', NEW.release_id;
    END IF;
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER plt_014_validate_ci_dimension_release
BEFORE INSERT OR UPDATE ON ci_dimension_scores
FOR EACH ROW EXECUTE FUNCTION civica_validate_ci_release_score_row();
--> statement-breakpoint
CREATE TRIGGER plt_014_validate_ci_composite_release
BEFORE INSERT OR UPDATE ON ci_composite_scores
FOR EACH ROW EXECUTE FUNCTION civica_validate_ci_release_score_row();
--> statement-breakpoint

CREATE OR REPLACE FUNCTION civica_guard_published_ci_score_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE release_status text; affected_release_id text;
BEGIN
  affected_release_id := CASE WHEN TG_OP='DELETE' THEN OLD.release_id ELSE COALESCE(OLD.release_id,NEW.release_id) END;
  SELECT status INTO release_status FROM ci_index_releases
    WHERE id=affected_release_id;
  IF release_status='published' THEN
    RAISE EXCEPTION 'published Index release % is immutable', affected_release_id;
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;

--> statement-breakpoint
CREATE TRIGGER plt_014_guard_ci_dimension_release
BEFORE UPDATE OR DELETE ON ci_dimension_scores
FOR EACH ROW EXECUTE FUNCTION civica_guard_published_ci_score_mutation();
--> statement-breakpoint
CREATE TRIGGER plt_014_guard_ci_composite_release
BEFORE UPDATE OR DELETE ON ci_composite_scores
FOR EACH ROW EXECUTE FUNCTION civica_guard_published_ci_score_mutation();
--> statement-breakpoint

CREATE OR REPLACE FUNCTION civica_guard_ci_release_header_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='INSERT' THEN
    IF NEW.status<>'staging' OR NEW.published_at IS NOT NULL THEN
      RAISE EXCEPTION 'Index release header % must be inserted as staging', NEW.id;
    END IF;
    RETURN NEW;
  END IF;
  IF OLD.status='published' THEN
    RAISE EXCEPTION 'published Index release header % is immutable', OLD.id;
  END IF;
  IF TG_OP='DELETE' THEN
    RAISE EXCEPTION 'Index release header % cannot be deleted', OLD.id;
  END IF;
  IF (to_jsonb(OLD) - 'status' - 'published_at')
     IS DISTINCT FROM (to_jsonb(NEW) - 'status' - 'published_at') THEN
    RAISE EXCEPTION 'staged Index release header % identity is immutable', OLD.id;
  END IF;
  IF NEW.status='published' AND current_setting('civica.ci_release_publication',true) IS DISTINCT FROM NEW.id THEN
    RAISE EXCEPTION 'Index release % must be finalized through civica_publish_ci_release()', NEW.id;
  END IF;
  RETURN NEW;
END $$;

-- civica-affected-relations: ci_composite_scores,ci_dimension_scores,ci_index_release_pointers,ci_index_releases,ci_methodology_versions,country_fact_vintage_candidates,country_fact_vintage_releases,country_fact_vintages,pulse_dimensional_delta_history,pulse_pipeline_runs,pulse_score_publication_pointers
--> statement-breakpoint
CREATE TRIGGER plt_014_guard_ci_release_header
BEFORE INSERT OR UPDATE OR DELETE ON ci_index_releases
FOR EACH ROW EXECUTE FUNCTION civica_guard_ci_release_header_mutation();
--> statement-breakpoint

CREATE OR REPLACE FUNCTION civica_guard_published_ci_methodology()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM ci_index_releases WHERE methodology_version=OLD.id AND status='published') THEN
    RAISE EXCEPTION 'methodology % belongs to a published Index release and is immutable', OLD.id;
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER plt_014_guard_ci_methodology
BEFORE UPDATE OR DELETE ON ci_methodology_versions
FOR EACH ROW EXECUTE FUNCTION civica_guard_published_ci_methodology();
--> statement-breakpoint

CREATE OR REPLACE FUNCTION civica_ci_dimension_storage_sha256(target_release_id text)
RETURNS text LANGUAGE sql STABLE AS $$
  SELECT encode(digest(COALESCE(string_agg(jsonb_build_array(
    score.jurisdiction_id,score.dimension,score.quarter,score.normalized_score,
    score.raw_value,score.source_id,score.indicator_id,score.upstream_release,
    score.artifact_hash,score.artifact_kind,score.temporal_coverage,
    score.license_url,score.transformation_id,score.substitution_reason,
    score.method_version,score.methodology_version,score.release_id,
    score.derivation_version_key,score.derivation_versions
  )::text,E'\n' ORDER BY score.jurisdiction_id,score.dimension,score.source_id,score.indicator_id),''),'sha256'),'hex')
  FROM ci_dimension_scores score WHERE score.release_id=target_release_id
$$;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION civica_ci_composite_storage_sha256(target_release_id text)
RETURNS text LANGUAGE sql STABLE AS $$
  SELECT encode(digest(COALESCE(string_agg(jsonb_build_array(
    score.jurisdiction_id,score.quarter,score.score,score.score_lower,
    score.score_upper,score.band,score.completeness_flag,score.vintage_label,
    score.supersedes_vintage_label,score.content_hash,score.rank,
    score.total_ranked,score.is_partial,score.dimensions_available,
    score.missing_dimensions,score.methodology_version,score.release_id,
    score.derivation_version_key,score.derivation_versions
  )::text,E'\n' ORDER BY score.jurisdiction_id),''),'sha256'),'hex')
  FROM ci_composite_scores score WHERE score.release_id=target_release_id
$$;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION civica_validate_ci_release_pointer()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE release_status text;
BEGIN
  SELECT status INTO release_status FROM ci_index_releases WHERE id=NEW.release_id;
  IF release_status IS DISTINCT FROM 'published' THEN
    RAISE EXCEPTION 'Index pointer requires a published release';
  END IF;
  IF current_setting('civica.ci_release_publication',true) IS DISTINCT FROM NEW.release_id THEN
    RAISE EXCEPTION 'Index pointer must flip through civica_publish_ci_release()';
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER plt_014_validate_ci_release_pointer
BEFORE INSERT OR UPDATE ON ci_index_release_pointers
FOR EACH ROW EXECUTE FUNCTION civica_validate_ci_release_pointer();
--> statement-breakpoint

CREATE OR REPLACE FUNCTION civica_guard_ci_release_pointer_delete()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Index publication pointer cannot be deleted; publish a verified successor release';
END $$;
--> statement-breakpoint
CREATE TRIGGER plt_014_guard_ci_release_pointer_delete
BEFORE DELETE ON ci_index_release_pointers
FOR EACH ROW EXECUTE FUNCTION civica_guard_ci_release_pointer_delete();
--> statement-breakpoint

CREATE OR REPLACE FUNCTION civica_publish_ci_release(
  target_release_id text,
  verified_input_manifest_sha256 text,
  verified_dimension_row_set_sha256 text,
  verified_composite_row_set_sha256 text,
  observed_dimension_storage_sha256 text,
  observed_composite_storage_sha256 text
)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  release_row ci_index_releases%ROWTYPE;
  predecessor_row ci_index_releases%ROWTYPE;
  current_pointer_release_id text;
  dimension_count integer;
  composite_count integer;
  actual_dimension_storage_sha256 text;
  actual_composite_storage_sha256 text;
  actual_methodology_content_sha256 text;
  actual_source_artifacts jsonb;
BEGIN
  SELECT * INTO release_row FROM ci_index_releases WHERE id=target_release_id FOR UPDATE;
  IF NOT FOUND OR release_row.status<>'staging' THEN
    RAISE EXCEPTION 'Index release % is not staging', target_release_id;
  END IF;
  IF verified_input_manifest_sha256 IS DISTINCT FROM release_row.input_manifest_sha256
     OR verified_dimension_row_set_sha256 IS DISTINCT FROM release_row.dimension_row_set_sha256
     OR verified_composite_row_set_sha256 IS DISTINCT FROM release_row.composite_row_set_sha256 THEN
    RAISE EXCEPTION 'Index release % semantic verification disagrees with its staged header',target_release_id;
  END IF;
  -- Publication is rare. Whole-table SHARE locks prevent an insert/update/delete
  -- race between the caller's semantic hash check and this atomic pointer flip.
  LOCK TABLE ci_dimension_scores IN SHARE MODE;
  LOCK TABLE ci_composite_scores IN SHARE MODE;
  SELECT civica_ci_methodology_content_sha256(release_row.methodology_version)
    INTO actual_methodology_content_sha256
  FROM ci_methodology_versions
  WHERE id=release_row.methodology_version
  FOR SHARE;
  IF actual_methodology_content_sha256 IS DISTINCT FROM release_row.methodology_content_sha256 THEN
    RAISE EXCEPTION 'Index release % methodology content disagrees with its staged header',target_release_id;
  END IF;
  SELECT COALESCE(jsonb_object_agg(artifact.identity,artifact.artifact_hash ORDER BY artifact.identity),'{}'::jsonb)
    INTO actual_source_artifacts
  FROM (
    SELECT score.source_id || ':' || score.indicator_id AS identity,min(score.artifact_hash) AS artifact_hash
    FROM ci_dimension_scores score
    WHERE score.release_id=target_release_id
    GROUP BY score.source_id,score.indicator_id
    HAVING count(DISTINCT score.artifact_hash)=1
  ) artifact;
  IF actual_source_artifacts IS DISTINCT FROM release_row.source_artifacts THEN
    RAISE EXCEPTION 'Index release % source artifact basket is incomplete or contains unselected identities',target_release_id;
  END IF;
  SELECT count(*)::int,civica_ci_dimension_storage_sha256(target_release_id)
    INTO dimension_count,actual_dimension_storage_sha256
    FROM ci_dimension_scores WHERE release_id=target_release_id;
  SELECT count(*)::int,civica_ci_composite_storage_sha256(target_release_id)
    INTO composite_count,actual_composite_storage_sha256
    FROM ci_composite_scores WHERE release_id=target_release_id;
  IF dimension_count<>release_row.dimension_row_count OR composite_count<>release_row.composite_row_count THEN
    RAISE EXCEPTION 'Index release % is incomplete: dimensions %/%, composites %/%',target_release_id,dimension_count,release_row.dimension_row_count,composite_count,release_row.composite_row_count;
  END IF;
  IF EXISTS (
    SELECT 1
    FROM ci_dimension_scores score
    WHERE score.release_id=target_release_id
    GROUP BY score.jurisdiction_id,score.dimension
    HAVING count(*)<>1
  ) OR EXISTS (
    SELECT 1 FROM ci_dimension_scores score
    WHERE score.release_id=target_release_id AND (
      score.quarter IS DISTINCT FROM release_row.quarter
      OR score.methodology_version IS DISTINCT FROM release_row.methodology_version
      OR release_row.source_artifacts->>(score.source_id || ':' || score.indicator_id) IS DISTINCT FROM score.artifact_hash
      OR NOT EXISTS (
        SELECT 1
        FROM jsonb_array_elements(release_row.dimension_rules) rule
        WHERE rule->>'dimension'=score.dimension
          AND rule->>'sourceId'=score.source_id
          AND rule->>'indicatorId'=score.indicator_id
          AND rule->>'artifactSha256'=score.artifact_hash
          AND rule->>'upstreamRelease'=score.upstream_release
          AND rule->>'artifactKind'=score.artifact_kind
          AND rule->>'temporalCoverage'=score.temporal_coverage
          AND rule->>'licenseUrl'=score.license_url
          AND rule->>'substitutionReason' IS NOT DISTINCT FROM score.substitution_reason
      )
      OR score.transformation_id IS DISTINCT FROM release_row.input_transformation_version || ':' || score.dimension
      OR score.method_version IS DISTINCT FROM release_row.methodology_version
      OR score.derivation_versions IS DISTINCT FROM civica_ci_expected_derivation_envelope(
        release_row.methodology_version,
        release_row.input_transformation_version,
        to_jsonb(ARRAY[score.source_id]::text[])
      )
      OR score.derivation_version_key IS DISTINCT FROM civica_ci_expected_derivation_version_key(
        release_row.methodology_version,
        release_row.input_transformation_version,
        to_jsonb(ARRAY[score.source_id]::text[])
      )
    )
  ) OR EXISTS (
    SELECT 1 FROM ci_composite_scores score
    WHERE score.release_id=target_release_id AND (
      score.quarter IS DISTINCT FROM release_row.quarter
      OR score.methodology_version IS DISTINCT FROM release_row.methodology_version
      OR score.vintage_label IS DISTINCT FROM release_row.vintage_label
      OR score.supersedes_vintage_label IS DISTINCT FROM release_row.supersedes_vintage_label
      OR score.content_hash !~ '^[a-f0-9]{64}$'
      OR (release_row.uncertainty_policy->>'bounds'='required' AND (score.score_lower IS NULL OR score.score_upper IS NULL))
      OR (release_row.uncertainty_policy->>'bounds'='absent' AND (score.score_lower IS NOT NULL OR score.score_upper IS NOT NULL))
      OR (score.score_lower IS NOT NULL AND score.score_upper IS NOT NULL AND (score.score_lower>score.score OR score.score_upper<score.score OR score.score_lower>score.score_upper))
      OR score.derivation_versions IS DISTINCT FROM civica_ci_expected_derivation_envelope(
        release_row.methodology_version,
        release_row.composite_algorithm_version,
        (
          SELECT COALESCE(jsonb_agg(source.source_id ORDER BY source.source_id),'[]'::jsonb)
          FROM (
            SELECT DISTINCT dimension.source_id
            FROM ci_dimension_scores dimension
            WHERE dimension.release_id=target_release_id
              AND dimension.jurisdiction_id=score.jurisdiction_id
          ) source
        )
      )
      OR score.derivation_version_key IS DISTINCT FROM civica_ci_expected_derivation_version_key(
        release_row.methodology_version,
        release_row.composite_algorithm_version,
        (
          SELECT COALESCE(jsonb_agg(source.source_id ORDER BY source.source_id),'[]'::jsonb)
          FROM (
            SELECT DISTINCT dimension.source_id
            FROM ci_dimension_scores dimension
            WHERE dimension.release_id=target_release_id
              AND dimension.jurisdiction_id=score.jurisdiction_id
          ) source
        )
      )
    )
  ) THEN
    RAISE EXCEPTION 'Index release % contains incompatible rows',target_release_id;
  END IF;
  IF observed_dimension_storage_sha256 IS DISTINCT FROM actual_dimension_storage_sha256
     OR observed_composite_storage_sha256 IS DISTINCT FROM actual_composite_storage_sha256 THEN
    RAISE EXCEPTION 'Index release % changed after semantic verification',target_release_id;
  END IF;
  SELECT release_id INTO current_pointer_release_id
  FROM ci_index_release_pointers
  WHERE product='civica_index'
  FOR UPDATE;
  IF release_row.supersession_kind IN ('none','legacy_unregistered_vintage') THEN
    IF current_pointer_release_id IS NOT NULL THEN
      RAISE EXCEPTION 'initial Index release % cannot replace public pointer % without supersession',target_release_id,current_pointer_release_id;
    END IF;
  ELSIF release_row.supersession_kind='registered_release' THEN
    SELECT * INTO predecessor_row
    FROM ci_index_releases
    WHERE id=release_row.supersedes_release_id
    FOR SHARE;
    IF NOT FOUND
       OR predecessor_row.status<>'published'
       OR predecessor_row.vintage_label IS DISTINCT FROM release_row.supersedes_vintage_label THEN
      RAISE EXCEPTION 'Index release % predecessor is missing, unpublished, or mismatched',target_release_id;
    END IF;
    IF current_pointer_release_id IS DISTINCT FROM release_row.supersedes_release_id THEN
      RAISE EXCEPTION 'Index release % can only replace its declared predecessor %',target_release_id,release_row.supersedes_release_id;
    END IF;
  ELSE
    RAISE EXCEPTION 'Index release % has unsupported supersession kind %',target_release_id,release_row.supersession_kind;
  END IF;
  PERFORM set_config('civica.ci_release_publication',target_release_id,true);
  UPDATE ci_index_releases SET status='published',published_at=NOW() WHERE id=target_release_id;
  INSERT INTO ci_index_release_pointers(product,release_id,updated_at)
  VALUES ('civica_index',target_release_id,NOW())
  ON CONFLICT (product) DO UPDATE SET release_id=EXCLUDED.release_id,updated_at=EXCLUDED.updated_at;
END $$;
--> statement-breakpoint

-- Deliberately no automatic publication here. Counts and row-level metadata
-- are necessary but insufficient: scripts/publish-ci-release.ts must reproduce
-- the checked semantic row-set hashes before calling the atomic function.

CREATE OR REPLACE FUNCTION civica_validate_pulse_score_publication()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  run_row pulse_pipeline_runs%ROWTYPE;
  history_count integer;
  jurisdiction_count integer;
  score_dates integer;
  retained_score_as_of date;
BEGIN
  -- Keep the exact retained panel stable until the pointer transaction commits.
  -- A later history INSERT waits, observes the new pointer, and is rejected by
  -- plt_014_guard_published_pulse_history.
  LOCK TABLE pulse_dimensional_delta_history IN SHARE MODE;
  SELECT * INTO run_row FROM pulse_pipeline_runs
  WHERE id=NEW.computation_run_id
  FOR SHARE;
  IF NOT FOUND
     OR run_row.stage<>'score'
     OR run_row.status<>'completed'
     OR run_row.completed_at IS NULL
     OR jsonb_typeof(run_row.failures)<>'array'
     OR jsonb_array_length(run_row.failures)<>0 THEN
    RAISE EXCEPTION 'Pulse score publication requires one successful completed score run';
  END IF;
  IF NEW.version_key IS DISTINCT FROM run_row.version_key THEN
    RAISE EXCEPTION 'Pulse score publication version key mismatch';
  END IF;
  IF NEW.published_at<run_row.completed_at THEN
    RAISE EXCEPTION 'Pulse score publication cannot predate score-run completion';
  END IF;
  SELECT count(*)::int,count(DISTINCT jurisdiction_id)::int,
         count(DISTINCT score_as_of)::int,min(score_as_of)
    INTO history_count,jurisdiction_count,score_dates,retained_score_as_of
    FROM pulse_dimensional_delta_history WHERE computation_run_id=NEW.computation_run_id;
  IF history_count=0
     OR jurisdiction_count=0
     OR history_count<>jurisdiction_count*5
     OR score_dates<>1
     OR retained_score_as_of IS DISTINCT FROM NEW.score_as_of
     OR EXISTS (
       SELECT 1
       FROM pulse_dimensional_delta_history history
       WHERE history.computation_run_id=NEW.computation_run_id
       GROUP BY history.jurisdiction_id
       HAVING count(*)<>5 OR count(DISTINCT history.dimension)<>5
     ) THEN
    RAISE EXCEPTION 'Pulse score publication history is incomplete or mixed';
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER plt_014_validate_pulse_score_publication
BEFORE INSERT OR UPDATE ON pulse_score_publication_pointers
FOR EACH ROW EXECUTE FUNCTION civica_validate_pulse_score_publication();
--> statement-breakpoint

CREATE OR REPLACE FUNCTION civica_guard_published_pulse_history()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE old_run_id uuid; new_run_id uuid;
BEGIN
  IF TG_OP<>'INSERT' THEN old_run_id:=OLD.computation_run_id; END IF;
  IF TG_OP<>'DELETE' THEN new_run_id:=NEW.computation_run_id; END IF;
  IF EXISTS (
    SELECT 1 FROM pulse_pipeline_runs run
    WHERE (run.id=old_run_id OR run.id=new_run_id)
      AND run.stage='score'
      AND run.status='completed'
  ) THEN
    RAISE EXCEPTION 'completed Pulse score history is immutable';
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER plt_014_guard_published_pulse_history
BEFORE INSERT OR UPDATE OR DELETE ON pulse_dimensional_delta_history
FOR EACH ROW EXECUTE FUNCTION civica_guard_published_pulse_history();
--> statement-breakpoint

CREATE OR REPLACE FUNCTION civica_guard_published_pulse_run()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pulse_score_publication_pointers pointer
    WHERE pointer.computation_run_id=OLD.id
  ) THEN
    RAISE EXCEPTION 'currently published Pulse score run is immutable';
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER plt_014_guard_published_pulse_run
BEFORE UPDATE OR DELETE ON pulse_pipeline_runs
FOR EACH ROW EXECUTE FUNCTION civica_guard_published_pulse_run();
--> statement-breakpoint

CREATE OR REPLACE FUNCTION civica_guard_pulse_publication_pointer_delete()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Pulse publication pointer cannot be deleted; publish a complete successor run';
END $$;
--> statement-breakpoint
CREATE TRIGGER plt_014_guard_pulse_publication_pointer_delete
BEFORE DELETE ON pulse_score_publication_pointers
FOR EACH ROW EXECUTE FUNCTION civica_guard_pulse_publication_pointer_delete();
--> statement-breakpoint
INSERT INTO pulse_score_publication_pointers(product,computation_run_id,version_key,score_as_of,published_at)
SELECT 'pulse_dimensions',run.id,run.version_key,min(history.score_as_of),COALESCE(run.completed_at,NOW())
FROM pulse_pipeline_runs run
JOIN pulse_dimensional_delta_history history ON history.computation_run_id=run.id
WHERE run.stage='score'
  AND run.status='completed'
  AND run.completed_at IS NOT NULL
  AND jsonb_typeof(run.failures)='array'
  AND jsonb_array_length(run.failures)=0
  AND NOT EXISTS (
    SELECT 1
    FROM pulse_dimensional_delta_history incomplete
    WHERE incomplete.computation_run_id=run.id
    GROUP BY incomplete.jurisdiction_id
    HAVING count(*)<>5 OR count(DISTINCT incomplete.dimension)<>5
  )
GROUP BY run.id,run.version_key,run.completed_at
HAVING count(*)>0
   AND count(DISTINCT history.score_as_of)=1
   AND count(*)=count(DISTINCT history.jurisdiction_id)*5
ORDER BY run.completed_at DESC
LIMIT 1
ON CONFLICT (product) DO NOTHING;
--> statement-breakpoint

-- Complete-candidate Atlas releases already finalize atomically. Strengthen
-- their winner pointer so a frozen row cannot be added after finalization or
-- point at a candidate for another country/fact/source.
CREATE OR REPLACE FUNCTION civica_validate_complete_candidate_winner()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE release_status text; candidate_row country_fact_vintage_candidates%ROWTYPE;
BEGIN
  SELECT completeness_status INTO release_status FROM country_fact_vintage_releases WHERE vintage_label=NEW.vintage_label;
  IF release_status IS NULL THEN RAISE EXCEPTION 'unknown candidate release %',NEW.vintage_label; END IF;
  IF release_status<>'staging' THEN
    RAISE EXCEPTION 'finalized candidate release % cannot accept new rows',NEW.vintage_label;
  END IF;
  IF NEW.canonical_candidate_id IS NULL THEN RAISE EXCEPTION 'complete candidate release requires canonical_candidate_id'; END IF;
  SELECT * INTO candidate_row FROM country_fact_vintage_candidates
    WHERE id=NEW.canonical_candidate_id AND vintage_label=NEW.vintage_label;
  IF NOT FOUND OR candidate_row.is_canonical_at_cut IS DISTINCT FROM true
     OR candidate_row.jurisdiction_id<>NEW.jurisdiction_id
     OR candidate_row.fact_key<>NEW.fact_key OR candidate_row.source_id<>NEW.source_id THEN
    RAISE EXCEPTION 'canonical candidate pointer does not match the frozen winner identity';
  END IF;
  IF candidate_row.candidate_payload->>'id'<>NEW.canonical_fact_id::text
     OR candidate_row.candidate_payload->>'factValue' IS DISTINCT FROM NEW.value_text
     OR NULLIF(candidate_row.candidate_payload->>'factValueNumeric','')::real IS DISTINCT FROM NEW.value_numeric
     OR candidate_row.candidate_payload->>'factUnit' IS DISTINCT FROM NEW.value_unit
     OR candidate_row.candidate_payload->>'methodologyVersion'<>NEW.methodology_version THEN
    RAISE EXCEPTION 'canonical candidate payload disagrees with frozen vintage row';
  END IF;
  RETURN NEW;
END $$;
