CREATE OR REPLACE FUNCTION public.ci_research_panel_rows_immutable()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.ci_research_panel_releases
    WHERE id = COALESCE(OLD.release_id, NEW.release_id) AND status = 'complete'
  ) THEN
    RAISE EXCEPTION 'completed Civica Index research panel rows are immutable';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER ci_research_panel_rows_immutable
BEFORE INSERT OR UPDATE OR DELETE ON public.ci_research_panel_rows
FOR EACH ROW EXECUTE FUNCTION public.ci_research_panel_rows_immutable();

CREATE OR REPLACE FUNCTION public.ci_research_panel_release_immutable()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status = 'complete' THEN
    RAISE EXCEPTION 'completed Civica Index research panel releases are immutable';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER ci_research_panel_release_immutable
BEFORE UPDATE OR DELETE ON public.ci_research_panel_releases
FOR EACH ROW EXECUTE FUNCTION public.ci_research_panel_release_immutable();
