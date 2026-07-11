-- DAT-028: repair polymorphic statement subjects before enforcing the contract.
-- Term producers historically declared `terms` while storing a person UUID.
UPDATE statements s
SET subject_id = (
  SELECT t.id
  FROM terms t
  WHERE t.person_id = s.subject_id
  ORDER BY t.is_current DESC NULLS LAST,
           (t.end_date IS NULL) DESC,
           t.start_date DESC NULLS LAST,
           t.id
  LIMIT 1
)
WHERE s.subject_table = 'terms'
  AND NOT EXISTS (SELECT 1 FROM terms t WHERE t.id = s.subject_id)
  AND EXISTS (SELECT 1 FROM terms t WHERE t.person_id = s.subject_id);
--> statement-breakpoint

-- Party-composition provenance describes the complete body composition.
UPDATE statements s
SET subject_table = 'government_bodies'
WHERE s.subject_table = 'legislature_parties'
  AND EXISTS (SELECT 1 FROM government_bodies b WHERE b.id = s.subject_id);
--> statement-breakpoint

-- Remove subjects that no longer exist or use an unsupported declared type.
-- DAT-016 retains every deleted row in research_evidence_history.
DELETE FROM statements s
WHERE CASE s.subject_table
  WHEN 'constitutions' THEN NOT EXISTS (SELECT 1 FROM constitutions x WHERE x.id = s.subject_id)
  WHEN 'elections' THEN NOT EXISTS (SELECT 1 FROM elections x WHERE x.id = s.subject_id)
  WHEN 'government_bodies' THEN NOT EXISTS (SELECT 1 FROM government_bodies x WHERE x.id = s.subject_id)
  WHEN 'jurisdictions' THEN NOT EXISTS (SELECT 1 FROM jurisdictions x WHERE x.id = s.subject_id)
  WHEN 'terms' THEN NOT EXISTS (SELECT 1 FROM terms x WHERE x.id = s.subject_id)
  ELSE true
END;
--> statement-breakpoint

-- Keep the newest provenance row from every semantic identity group.
WITH ranked AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY subject_table, subject_id, predicate, source_id
           ORDER BY retrieved_at DESC, created_at DESC NULLS LAST, id DESC
         ) AS position
  FROM statements
)
DELETE FROM statements s
USING ranked r
WHERE s.id = r.id AND r.position > 1;
--> statement-breakpoint

CREATE UNIQUE INDEX "idx_statements_subject_predicate_source"
  ON "statements" USING btree
  ("subject_table", "subject_id", "predicate", "source_id");
--> statement-breakpoint

ALTER TABLE "statements"
  ADD CONSTRAINT "statements_subject_table_closed"
  CHECK ("statements"."subject_table" IN
    ('constitutions', 'elections', 'government_bodies', 'jurisdictions', 'terms'));
--> statement-breakpoint

CREATE OR REPLACE FUNCTION civica_validate_statement_subject()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  subject_exists boolean;
BEGIN
  CASE NEW.subject_table
    WHEN 'constitutions' THEN SELECT EXISTS(SELECT 1 FROM constitutions x WHERE x.id = NEW.subject_id) INTO subject_exists;
    WHEN 'elections' THEN SELECT EXISTS(SELECT 1 FROM elections x WHERE x.id = NEW.subject_id) INTO subject_exists;
    WHEN 'government_bodies' THEN SELECT EXISTS(SELECT 1 FROM government_bodies x WHERE x.id = NEW.subject_id) INTO subject_exists;
    WHEN 'jurisdictions' THEN SELECT EXISTS(SELECT 1 FROM jurisdictions x WHERE x.id = NEW.subject_id) INTO subject_exists;
    WHEN 'terms' THEN SELECT EXISTS(SELECT 1 FROM terms x WHERE x.id = NEW.subject_id) INTO subject_exists;
    ELSE RAISE EXCEPTION 'Unsupported statement subject table: %', NEW.subject_table;
  END CASE;
  IF NOT subject_exists THEN
    RAISE EXCEPTION 'Statement subject does not exist: %.%', NEW.subject_table, NEW.subject_id;
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint

DROP TRIGGER IF EXISTS dat_028_validate_statement_subject ON statements;
--> statement-breakpoint
CREATE TRIGGER dat_028_validate_statement_subject
  BEFORE INSERT OR UPDATE OF subject_table, subject_id ON statements
  FOR EACH ROW EXECUTE FUNCTION civica_validate_statement_subject();
