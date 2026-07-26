ALTER TABLE "civica_conditions_components" ALTER COLUMN "native_value" SET DATA TYPE double precision;--> statement-breakpoint
ALTER TABLE "civica_conditions_normalization_parameters"
  ALTER COLUMN "mean" SET DATA TYPE double precision,
  ALTER COLUMN "standard_deviation" SET DATA TYPE double precision,
  ALTER COLUMN "lower_bound" SET DATA TYPE double precision,
  ALTER COLUMN "upper_bound" SET DATA TYPE double precision;--> statement-breakpoint
ALTER TABLE "civica_conditions_scores"
  ALTER COLUMN "normalized_score" SET DATA TYPE double precision,
  ALTER COLUMN "raw_value" SET DATA TYPE double precision;

-- civica-affected-relations: civica_conditions_components,civica_conditions_normalization_parameters,civica_conditions_scores
