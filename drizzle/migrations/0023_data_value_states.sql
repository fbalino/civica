ALTER TABLE "country_facts"
  ADD COLUMN "value_status" text DEFAULT 'observed' NOT NULL,
  ADD COLUMN "value_status_reason" text;

ALTER TABLE "indicator_history"
  ALTER COLUMN "value" DROP NOT NULL,
  ADD COLUMN "value_status" text DEFAULT 'observed' NOT NULL,
  ADD COLUMN "value_status_reason" text;

ALTER TABLE "country_metrics"
  ALTER COLUMN "value" DROP NOT NULL,
  ADD COLUMN "value_status" text DEFAULT 'observed' NOT NULL,
  ADD COLUMN "value_status_reason" text;

ALTER TABLE "country_facts"
  ADD CONSTRAINT "country_facts_value_status_allowed"
  CHECK ("value_status" IN ('observed', 'missing', 'unknown', 'not_applicable', 'not_observed', 'disputed', 'withheld')),
  ADD CONSTRAINT "country_facts_value_status_shape"
  CHECK (
    ("value_status" IN ('observed', 'disputed') AND ("fact_value" IS NOT NULL OR "fact_value_numeric" IS NOT NULL OR "value_json" IS NOT NULL))
    OR
    ("value_status" IN ('missing', 'unknown', 'not_applicable', 'not_observed', 'withheld') AND "fact_value" IS NULL AND "fact_value_numeric" IS NULL AND "value_json" IS NULL)
  ),
  ADD CONSTRAINT "country_facts_value_status_reason"
  CHECK (("value_status" = 'observed' AND "value_status_reason" IS NULL) OR ("value_status" <> 'observed' AND length(btrim("value_status_reason")) > 0));

ALTER TABLE "indicator_history"
  ADD CONSTRAINT "indicator_history_value_status_allowed"
  CHECK ("value_status" IN ('observed', 'missing', 'unknown', 'not_applicable', 'not_observed', 'disputed', 'withheld')),
  ADD CONSTRAINT "indicator_history_value_status_shape"
  CHECK (("value_status" IN ('observed', 'disputed') AND "value" IS NOT NULL) OR ("value_status" IN ('missing', 'unknown', 'not_applicable', 'not_observed', 'withheld') AND "value" IS NULL)),
  ADD CONSTRAINT "indicator_history_value_status_reason"
  CHECK (("value_status" = 'observed' AND "value_status_reason" IS NULL) OR ("value_status" <> 'observed' AND length(btrim("value_status_reason")) > 0));

ALTER TABLE "country_metrics"
  ADD CONSTRAINT "country_metrics_value_status_allowed"
  CHECK ("value_status" IN ('observed', 'missing', 'unknown', 'not_applicable', 'not_observed', 'disputed', 'withheld')),
  ADD CONSTRAINT "country_metrics_value_status_shape"
  CHECK (("value_status" IN ('observed', 'disputed') AND "value" IS NOT NULL) OR ("value_status" IN ('missing', 'unknown', 'not_applicable', 'not_observed', 'withheld') AND "value" IS NULL)),
  ADD CONSTRAINT "country_metrics_value_status_reason"
  CHECK (("value_status" = 'observed' AND "value_status_reason" IS NULL) OR ("value_status" <> 'observed' AND length(btrim("value_status_reason")) > 0));
