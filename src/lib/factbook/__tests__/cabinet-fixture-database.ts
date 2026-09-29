/**
 * DAT-037 test fixture: an in-process PostgreSQL (PGlite) with the production
 * shape of the government-structure relations the CIA roster importer and the
 * one-time repair touch — primary keys, foreign keys, the statement identity
 * index, the DAT-028 subject trigger, the Atlas change-history checks, and the
 * DAT-016 retention triggers. Unlike the former fake client, every WHERE
 * clause, conflict target, and trigger is evaluated by PostgreSQL.
 */
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";

import * as schema from "@/lib/db/schema";

export const FIXTURE_DDL = `
  CREATE TABLE jurisdictions (
    id uuid PRIMARY KEY,
    slug text NOT NULL UNIQUE,
    name text NOT NULL,
    wikidata_qid text
  );
  CREATE TABLE sources (
    id text PRIMARY KEY,
    name text NOT NULL,
    base_url text,
    license text NOT NULL,
    is_commercial_use_allowed boolean NOT NULL,
    last_sync_at timestamp
  );
  CREATE TABLE government_bodies (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    jurisdiction_id uuid NOT NULL REFERENCES jurisdictions(id),
    name text NOT NULL,
    body_type text NOT NULL,
    chamber_type text,
    total_seats integer,
    branch text,
    wikidata_qid text,
    ipu_parline_id text,
    hierarchy_level integer,
    parent_body_id uuid,
    electoral_system_family text,
    electoral_subsystem text
  );
  CREATE TABLE offices (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    body_id uuid NOT NULL REFERENCES government_bodies(id),
    name text NOT NULL,
    office_type text NOT NULL,
    is_elected boolean,
    wikidata_qid text,
    reports_to_office_id uuid,
    display_order integer
  );
  CREATE TABLE persons (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    date_of_birth date,
    wikidata_qid text,
    photo_url text,
    parline_person_code text,
    photo_license text,
    photo_credit text
  );
  CREATE TABLE terms (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    office_id uuid NOT NULL REFERENCES offices(id),
    person_id uuid NOT NULL REFERENCES persons(id),
    party_name text,
    party_color text,
    start_date date,
    end_date date,
    is_current boolean DEFAULT true
  );
  CREATE TABLE statements (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    subject_table text NOT NULL,
    subject_id uuid NOT NULL,
    predicate text NOT NULL,
    object_value text,
    object_entity_id uuid,
    source_id text NOT NULL,
    source_url text,
    source_license text,
    retrieved_at timestamp NOT NULL,
    source_hash text,
    valid_from date,
    valid_to date,
    confidence real DEFAULT 1,
    created_at timestamp DEFAULT now(),
    CONSTRAINT statements_subject_table_closed CHECK (subject_table IN
      ('constitutions', 'elections', 'government_bodies', 'jurisdictions', 'terms'))
  );
  CREATE UNIQUE INDEX idx_statements_subject_predicate_source
    ON statements (subject_table, subject_id, predicate, source_id);
  CREATE TABLE correction_log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    submitted_at timestamp DEFAULT now() NOT NULL,
    country_id uuid,
    category text NOT NULL,
    dimension text,
    submitter_name text,
    submitter_email text,
    submitter_affiliation text,
    description text NOT NULL,
    status text DEFAULT 'open' NOT NULL,
    disposition text,
    resolved_at timestamp,
    is_public boolean DEFAULT true NOT NULL,
    internal_notes text
  );
  CREATE TABLE atlas_entity_change_history (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type text NOT NULL,
    entity_id text NOT NULL,
    entity_table text NOT NULL,
    operation text NOT NULL,
    change_kind text NOT NULL,
    changes jsonb NOT NULL,
    reason text NOT NULL,
    methodology_version text NOT NULL,
    release_id text NOT NULL,
    correction_log_id uuid REFERENCES correction_log(id) ON DELETE RESTRICT,
    correction_status text,
    recorded_at timestamp DEFAULT now() NOT NULL,
    CONSTRAINT atlas_entity_change_history_identity_check CHECK (
      btrim(entity_id) <> ''
      AND (entity_type, entity_table) IN (
        ('fact','country_facts'), ('institution','government_bodies'),
        ('office','offices'), ('person','persons'), ('election','elections'),
        ('constitution-passage','constitution_passages'),
        ('organization','organizations'), ('indicator','country_metrics')
      )
    ),
    CONSTRAINT atlas_entity_change_history_event_check CHECK (
      operation IN ('insert','update','delete')
      AND change_kind IN ('routine_refresh','substantive_revision','correction','retraction','methodology_change')
      AND jsonb_typeof(changes) = 'array'
      AND btrim(reason) <> ''
      AND btrim(methodology_version) <> ''
      AND release_id ~ '^[A-Za-z0-9._-]{1,96}$'
    ),
    CONSTRAINT atlas_entity_change_history_correction_check CHECK (
      (correction_log_id IS NULL AND correction_status IS NULL)
      OR (correction_log_id IS NOT NULL AND correction_status IN
        ('open','in_review','resolved_corrected','resolved_no_change','rejected'))
    )
  );
  CREATE TABLE research_evidence_history (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_table text NOT NULL,
    entity_id text NOT NULL,
    operation text NOT NULL,
    before jsonb NOT NULL,
    after jsonb,
    reason text NOT NULL,
    actor_id text NOT NULL,
    recorded_at timestamp DEFAULT now() NOT NULL
  );

  CREATE FUNCTION civica_capture_research_evidence_history() RETURNS trigger
  LANGUAGE plpgsql AS $$
  DECLARE
    before_row jsonb := to_jsonb(OLD);
    after_row jsonb := CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(NEW) ELSE NULL END;
  BEGIN
    INSERT INTO research_evidence_history (
      entity_table, entity_id, operation, before, after, reason, actor_id
    ) VALUES (
      TG_TABLE_NAME, COALESCE(after_row->>'id', before_row->>'id'),
      lower(TG_OP), before_row, after_row,
      lower(TG_OP) || '_retained_by_dat_016', current_user
    );
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END;
  $$;
  CREATE FUNCTION civica_reject_research_evidence_history_mutation() RETURNS trigger
  LANGUAGE plpgsql AS $$
  BEGIN
    RAISE EXCEPTION 'research_evidence_history is append-only';
  END;
  $$;
  CREATE TRIGGER research_evidence_history_append_only
    BEFORE DELETE OR UPDATE ON research_evidence_history
    FOR EACH ROW EXECUTE FUNCTION civica_reject_research_evidence_history_mutation();
  CREATE TRIGGER dat_016_retain_mutation BEFORE DELETE OR UPDATE ON government_bodies
    FOR EACH ROW EXECUTE FUNCTION civica_capture_research_evidence_history();
  CREATE TRIGGER dat_016_retain_mutation BEFORE DELETE OR UPDATE ON offices
    FOR EACH ROW EXECUTE FUNCTION civica_capture_research_evidence_history();
  CREATE TRIGGER dat_016_retain_mutation BEFORE DELETE OR UPDATE ON persons
    FOR EACH ROW EXECUTE FUNCTION civica_capture_research_evidence_history();
  CREATE TRIGGER dat_016_retain_mutation BEFORE DELETE OR UPDATE ON terms
    FOR EACH ROW EXECUTE FUNCTION civica_capture_research_evidence_history();
  CREATE TRIGGER dat_016_retain_mutation BEFORE DELETE OR UPDATE ON statements
    FOR EACH ROW EXECUTE FUNCTION civica_capture_research_evidence_history();
  CREATE TRIGGER dat_016_retain_mutation BEFORE DELETE OR UPDATE ON correction_log
    FOR EACH ROW EXECUTE FUNCTION civica_capture_research_evidence_history();

  CREATE FUNCTION civica_validate_statement_subject() RETURNS trigger
  LANGUAGE plpgsql AS $$
  DECLARE
    subject_exists boolean;
  BEGIN
    CASE NEW.subject_table
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
  CREATE TRIGGER dat_028_validate_statement_subject
    BEFORE INSERT OR UPDATE OF subject_table, subject_id ON statements
    FOR EACH ROW EXECUTE FUNCTION civica_validate_statement_subject();

  INSERT INTO sources (id, name, base_url, license, is_commercial_use_allowed, last_sync_at)
  VALUES ('cia_world_leaders', 'CIA World Leaders',
          'https://www.cia.gov/resources/world-leaders/', 'public_domain', true,
          '2026-07-01 00:00:00'),
         ('wikidata', 'Wikidata', 'https://www.wikidata.org/', 'CC0-1.0', true,
          '2026-07-01 00:00:00');
`;

type BatchQuery = {
  toSQL?: () => { sql: string; params: unknown[] };
  getQuery?: () => { sql: string; params: unknown[] };
};

const FIXTURE_TABLES = [
  "research_evidence_history",
  "atlas_entity_change_history",
  "correction_log",
  "statements",
  "terms",
  "persons",
  "offices",
  "government_bodies",
  "sources",
  "jurisdictions",
];

const SOURCE_SEED = FIXTURE_DDL.slice(FIXTURE_DDL.indexOf("INSERT INTO sources"));

export interface CabinetFixture {
  pglite: PGlite;
  /** Empty every table and restore the seeded sources (fast per-test reset;
   *  one PGlite instance per file avoids repeated WebAssembly allocation). */
  reset(): Promise<void>;
  // The importer and repair are typed for the Neon HTTP client; the PGlite
  // client provides the same select/execute surface plus the batch shim.
  db: never;
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]>;
  count(table: string, where?: string, params?: unknown[]): Promise<number>;
  close(): Promise<void>;
}

/** A Neon-compatible `batch`: every query commits in one transaction or none. */
export async function createCabinetFixture(): Promise<CabinetFixture> {
  const pglite = new PGlite();
  await pglite.exec(FIXTURE_DDL);
  const base = drizzle(pglite, { schema });
  const batch = async (queries: readonly unknown[]) =>
    pglite.transaction(async (transaction) => {
      const results: unknown[] = [];
      for (const query of queries as readonly BatchQuery[]) {
        const compiled = query.getQuery?.() ?? query.toSQL?.();
        if (!compiled) throw new Error("Unsupported batch query");
        results.push(await transaction.query(compiled.sql, compiled.params));
      }
      return results;
    });
  const db = Object.assign(base, { batch }) as never;
  const query = async <T,>(text: string, params: unknown[] = []) =>
    (await pglite.query<T>(text, params)).rows;
  return {
    pglite,
    reset: async () => {
      await pglite.exec(
        `TRUNCATE ${FIXTURE_TABLES.join(", ")} RESTART IDENTITY CASCADE;
         ALTER TABLE statements DROP CONSTRAINT IF EXISTS fixture_block;
         ${SOURCE_SEED}`,
      );
    },
    db,
    query,
    count: async (table, where = "true", params = []) =>
      Number(
        (
          await query<{ n: number }>(
            `SELECT count(*)::int AS n FROM ${table} WHERE ${where}`,
            params,
          )
        )[0]?.n ?? 0,
      ),
    close: () => pglite.close(),
  };
}
