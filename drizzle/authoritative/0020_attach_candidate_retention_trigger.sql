CREATE TRIGGER dat_016_retain_mutation
BEFORE UPDATE OR DELETE ON pulse_candidate_outcomes
FOR EACH ROW EXECUTE FUNCTION civica_capture_research_evidence_history();
