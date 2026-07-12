-- PUL-034 retires the abandoned scalar Pulse v1 output. The migration is
-- deliberately destructive only when both relations are empty. A database
-- containing any row must be investigated and preserved through a reviewed
-- forward migration instead of silently discarding research output.
DO $$
DECLARE
  score_rows bigint;
  changelog_rows bigint;
BEGIN
  IF to_regclass('public.pulse_daily_scores') IS NULL THEN
    RAISE EXCEPTION 'PUL-034 expected public.pulse_daily_scores to exist';
  END IF;
  IF to_regclass('public.pulse_changelog') IS NULL THEN
    RAISE EXCEPTION 'PUL-034 expected public.pulse_changelog to exist';
  END IF;

  SELECT count(*) INTO score_rows FROM pulse_daily_scores;
  SELECT count(*) INTO changelog_rows FROM pulse_changelog;

  IF score_rows <> 0 OR changelog_rows <> 0 THEN
    RAISE EXCEPTION
      'PUL-034 refuses to drop nonempty legacy Pulse outputs (pulse_daily_scores=%, pulse_changelog=%)',
      score_rows,
      changelog_rows;
  END IF;
END;
$$;--> statement-breakpoint
DROP TABLE "pulse_changelog";--> statement-breakpoint
DROP TABLE "pulse_daily_scores";

-- civica-affected-relations: pulse_changelog,pulse_daily_scores
