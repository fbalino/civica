CREATE OR REPLACE FUNCTION civica_validate_pulse_decision_supersession()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  parent_kind text;
  parent_cluster_id uuid;
  parent_event_id uuid;
BEGIN
  IF NEW.supersedes_decision_key IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT kind, cluster_id, event_id
  INTO parent_kind, parent_cluster_id, parent_event_id
  FROM pulse_event_decisions
  WHERE decision_key = NEW.supersedes_decision_key;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'superseded Pulse decision does not exist';
  END IF;
  IF NEW.kind IS DISTINCT FROM parent_kind
     OR NEW.cluster_id IS DISTINCT FROM parent_cluster_id
     OR NEW.event_id IS DISTINCT FROM parent_event_id THEN
    RAISE EXCEPTION 'Pulse decision supersession must stay on the same axis, cluster, and event';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER pulse_event_decisions_validate_supersession
BEFORE INSERT ON "pulse_event_decisions"
FOR EACH ROW EXECUTE FUNCTION civica_validate_pulse_decision_supersession();
