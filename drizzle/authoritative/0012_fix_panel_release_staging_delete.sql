CREATE OR REPLACE FUNCTION public.ci_research_panel_release_immutable()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status = 'complete' THEN
    RAISE EXCEPTION 'completed Civica Index research panel releases are immutable';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;
