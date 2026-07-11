-- civica-affected-relations: country_fact_vintages,ci_composite_scores
CREATE EXTENSION IF NOT EXISTS pgcrypto;
--> statement-breakpoint
ALTER TABLE "country_fact_vintages"
  ADD COLUMN IF NOT EXISTS "supersedes_vintage_label" text;
--> statement-breakpoint
ALTER TABLE "ci_composite_scores"
  ADD COLUMN IF NOT EXISTS "supersedes_vintage_label" text,
  ADD COLUMN IF NOT EXISTS "content_hash" text;
--> statement-breakpoint

-- Repair the sole pre-G2 Atlas cut before making it immutable. Its label
-- published v0.2-beta while its rows incorrectly retained the live input's
-- v0.1-beta methodology value.
UPDATE "country_fact_vintages"
SET
  "methodology_version" = 'v0.2-beta',
  "content_hash" = encode(digest(
    "source_id" || '|' || COALESCE("value_text", '') || '|' ||
    COALESCE("value_numeric"::text, '') || '|' || COALESCE("as_of"::text, '') ||
    '|v0.2-beta', 'sha256'), 'hex')
WHERE "vintage_label" = 'Civica Atlas Reconciled v0.2-beta — vintage 2026-Q1'
  AND "methodology_version" = 'v0.1-beta';
--> statement-breakpoint

UPDATE "ci_composite_scores"
SET "content_hash" = encode(digest(
  "score"::text || '|' || COALESCE("score_lower"::text, '') || '|' ||
  COALESCE("score_upper"::text, '') || '|' || COALESCE("completeness_flag", '') || '|' ||
  COALESCE("rank"::text, '') || '|' || COALESCE("total_ranked"::text, '') || '|' ||
  "is_partial"::text || '|' || "dimensions_available"::text || '|' ||
  COALESCE(array_to_string((SELECT array_agg(x ORDER BY x) FROM unnest("missing_dimensions") x), ','), '') || '|' ||
  "methodology_version" || '|' || "derivation_version_key", 'sha256'), 'hex')
WHERE "vintage_label" IS NOT NULL AND "content_hash" IS NULL;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION civica_reject_frozen_vintage_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_TABLE_NAME = 'country_fact_vintages' OR OLD.vintage_label IS NOT NULL THEN
    RAISE EXCEPTION 'frozen vintage % is immutable; publish a new superseding version', OLD.vintage_label;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION civica_validate_frozen_vintage_insert()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  parsed text[];
  published_period text;
  prior_label text;
BEGIN
  IF TG_TABLE_NAME = 'country_fact_vintages' THEN
    parsed := regexp_match(NEW.vintage_label, '^Civica Atlas Reconciled (v[^[:space:]]+) — vintage ([0-9]{4}-Q[1-4])$');
    IF parsed IS NULL OR NEW.methodology_version <> parsed[1] THEN
      RAISE EXCEPTION 'Atlas vintage label and methodology_version disagree';
    END IF;
    published_period := parsed[2];
    SELECT vintage_label INTO prior_label FROM country_fact_vintages
      WHERE vintage_label <> NEW.vintage_label
        AND vintage_label LIKE '%vintage ' || published_period LIMIT 1;
    IF prior_label IS NOT NULL AND NEW.supersedes_vintage_label IS NULL THEN
      RAISE EXCEPTION 'corrected Atlas vintage must name supersedes_vintage_label';
    END IF;
  ELSE
    IF NEW.vintage_label IS NULL THEN RETURN NEW; END IF;
    parsed := regexp_match(NEW.vintage_label, '^Civica Index ([0-9]{4}) Q([1-4]) \(([^)]+)\)$');
    IF parsed IS NULL OR NEW.quarter <> parsed[1] || '-Q' || parsed[2]
       OR lower(NEW.methodology_version) <> lower(parsed[3]) THEN
      RAISE EXCEPTION 'Civica Index vintage label, quarter, and methodology_version disagree';
    END IF;
    SELECT vintage_label INTO prior_label FROM ci_composite_scores
      WHERE quarter = NEW.quarter AND vintage_label IS NOT NULL
        AND vintage_label <> NEW.vintage_label LIMIT 1;
    IF prior_label IS NOT NULL AND NEW.supersedes_vintage_label IS NULL THEN
      RAISE EXCEPTION 'corrected Civica Index vintage must name supersedes_vintage_label';
    END IF;
  END IF;

  IF NEW.supersedes_vintage_label IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM (
      SELECT vintage_label FROM country_fact_vintages WHERE TG_TABLE_NAME = 'country_fact_vintages'
      UNION ALL
      SELECT vintage_label FROM ci_composite_scores WHERE TG_TABLE_NAME = 'ci_composite_scores'
    ) prior WHERE prior.vintage_label = NEW.supersedes_vintage_label
  ) THEN
    RAISE EXCEPTION 'supersedes_vintage_label does not identify an existing frozen vintage';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint

DROP TRIGGER IF EXISTS dat_023_immutable_vintage ON "country_fact_vintages";
--> statement-breakpoint
CREATE TRIGGER dat_023_immutable_vintage BEFORE UPDATE OR DELETE ON "country_fact_vintages"
  FOR EACH ROW EXECUTE FUNCTION civica_reject_frozen_vintage_mutation();
--> statement-breakpoint
DROP TRIGGER IF EXISTS dat_023_immutable_vintage ON "ci_composite_scores";
--> statement-breakpoint
CREATE TRIGGER dat_023_immutable_vintage BEFORE UPDATE OR DELETE ON "ci_composite_scores"
  FOR EACH ROW WHEN (OLD.vintage_label IS NOT NULL)
  EXECUTE FUNCTION civica_reject_frozen_vintage_mutation();
--> statement-breakpoint
DROP TRIGGER IF EXISTS dat_023_validate_vintage ON "country_fact_vintages";
--> statement-breakpoint
CREATE TRIGGER dat_023_validate_vintage BEFORE INSERT ON "country_fact_vintages"
  FOR EACH ROW EXECUTE FUNCTION civica_validate_frozen_vintage_insert();
--> statement-breakpoint
DROP TRIGGER IF EXISTS dat_023_validate_vintage ON "ci_composite_scores";
--> statement-breakpoint
CREATE TRIGGER dat_023_validate_vintage BEFORE INSERT ON "ci_composite_scores"
  FOR EACH ROW WHEN (NEW.vintage_label IS NOT NULL)
  EXECUTE FUNCTION civica_validate_frozen_vintage_insert();
