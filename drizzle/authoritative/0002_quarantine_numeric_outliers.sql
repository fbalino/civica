-- DAT-029: remove catastrophic numeric parses from the active resolver set
-- without deleting their source evidence. The CIA parser now applies the same
-- fact-key envelope prospectively and persists rejected candidates.
UPDATE country_facts
SET status = 'rejected',
    status_reason = 'plausibility_envelope:military_expenditure_pct_gdp:'
      || fact_value_numeric::text || ':[0,100]',
    updated_at = NOW()
WHERE status = 'active'
  AND fact_key = 'military_expenditure_pct_gdp'
  AND fact_value_numeric IS NOT NULL
  AND (fact_value_numeric < 0 OR fact_value_numeric > 100);
