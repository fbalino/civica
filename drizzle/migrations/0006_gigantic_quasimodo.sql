ALTER TABLE "ci_composite_scores" ADD COLUMN "score_lower" real;--> statement-breakpoint
ALTER TABLE "ci_composite_scores" ADD COLUMN "score_upper" real;--> statement-breakpoint
ALTER TABLE "ci_composite_scores" ADD COLUMN "band" text;--> statement-breakpoint
ALTER TABLE "ci_composite_scores" ADD COLUMN "completeness_flag" text;--> statement-breakpoint
ALTER TABLE "ci_composite_scores" ADD COLUMN "vintage_label" text;