DROP TRIGGER dat_032_immutable_candidates ON country_fact_vintage_candidates;
--> statement-breakpoint
DROP TRIGGER dat_032_immutable_candidate_releases ON country_fact_vintage_releases;
--> statement-breakpoint
ALTER TABLE country_fact_vintage_releases DROP CONSTRAINT fact_vintage_release_completeness_closed;
--> statement-breakpoint
ALTER TABLE country_fact_vintage_releases ADD CONSTRAINT fact_vintage_release_completeness_closed CHECK (
  (completeness_status IN ('staging','complete_candidates') AND candidate_count IS NOT NULL AND candidate_count > 0 AND candidate_set_checksum ~ '^[0-9a-f]{64}$')
  OR (completeness_status = 'canonical_only_legacy' AND candidate_count IS NULL AND candidate_set_checksum IS NULL)
);
--> statement-breakpoint
CREATE OR REPLACE FUNCTION civica_guard_candidate_snapshot_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE release_status text;
BEGIN
  SELECT completeness_status INTO release_status FROM country_fact_vintage_releases
    WHERE vintage_label=COALESCE(OLD.vintage_label, NEW.vintage_label);
  IF release_status <> 'staging' THEN
    RAISE EXCEPTION 'frozen candidate vintage % is immutable', COALESCE(OLD.vintage_label, NEW.vintage_label);
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER dat_032_immutable_candidates BEFORE UPDATE OR DELETE ON country_fact_vintage_candidates
  FOR EACH ROW EXECUTE FUNCTION civica_guard_candidate_snapshot_mutation();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION civica_guard_candidate_release_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE actual_candidates integer; actual_winners integer; linked_winners integer;
BEGIN
  IF TG_OP <> 'UPDATE' OR OLD.completeness_status <> 'staging' OR NEW.completeness_status <> 'complete_candidates'
     OR (to_jsonb(OLD) - 'completeness_status') IS DISTINCT FROM (to_jsonb(NEW) - 'completeness_status') THEN
    RAISE EXCEPTION 'candidate release % is immutable except staging finalization', OLD.vintage_label;
  END IF;
  SELECT count(*)::int, count(*) FILTER (WHERE is_canonical_at_cut)::int INTO actual_candidates, actual_winners
    FROM country_fact_vintage_candidates WHERE vintage_label=NEW.vintage_label;
  SELECT count(*)::int INTO linked_winners FROM country_fact_vintages v
    JOIN country_fact_vintage_candidates c ON c.id=v.canonical_candidate_id AND c.vintage_label=v.vintage_label AND c.is_canonical_at_cut
    WHERE v.vintage_label=NEW.vintage_label;
  IF actual_candidates <> NEW.candidate_count OR actual_winners <> NEW.winner_count OR linked_winners <> NEW.winner_count THEN
    RAISE EXCEPTION 'candidate release % is incomplete: candidates %/%, winners %/%, linked %/%', NEW.vintage_label,
      actual_candidates, NEW.candidate_count, actual_winners, NEW.winner_count, linked_winners, NEW.winner_count;
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER dat_032_immutable_candidate_releases BEFORE UPDATE OR DELETE ON country_fact_vintage_releases
  FOR EACH ROW EXECUTE FUNCTION civica_guard_candidate_release_mutation();
