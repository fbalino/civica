/**
 * DAT-037 one-time repair of stored CIA World Leaders cabinet terms.
 *
 * The corrected importer (`cia-cabinets-sync.ts`) sets every current flag,
 * list position, and term statement from the live CIA pages. This repair only
 * removes the invariant defects the former importer left behind, so it needs
 * no inference about which July roster listed whom:
 *
 *   R1  terms held by CIA's "Vacant" placeholder imported as a person;
 *   R2  duplicate `(office, person)` rows, collapsed to the shared survivor;
 *   R3  CIA or Wikidata statements attached to the wrong term, re-homed to the
 *       term they describe or deleted when that term already has its own;
 *   R4  unsourced legacy cabinet rows the imported roster supersedes;
 *   R5  page "Last Updated" dates stored as term start dates.
 *
 * Planning is pure and deterministic. Apply runs one transaction whose first
 * statements lock the affected tables and assert that every planned row is
 * still in its planned before-state (or already in its after-state, which
 * makes an interrupted apply safely resumable) and that no other cabinet row
 * changed since the plan. Any drift raises and rolls the whole repair back.
 */
import { createHash } from "node:crypto";

import { sql, type SQL } from "drizzle-orm";

import {
  CABINET_MEMBER_PREDICATE,
  CABINET_ROSTER_PREDICATE,
  CIA_ROSTER_SOURCE_ID,
  VACANT_PERSON_NAME_RE,
  ciaRosterPageUrlForJurisdiction,
  compareCabinetTermSurvivor,
  isCiaOwnedOffice,
  isCiaRosterOfficeType,
  isHeadOfficeType,
  timestampEpoch,
} from "@/lib/factbook/cabinet-roster";

export const CABINET_REPAIR_PLAN_SCHEMA = "civica-cabinet-term-repair-plan/v1";
export const CABINET_REPAIR_METHOD = "cabinet-term-integrity-repair/v1";

type Row = Record<string, unknown>;

/** One consistent read snapshot, and one atomic write transaction. */
export interface CabinetRepairExecutor {
  read(statements: SQL[]): Promise<Row[][]>;
  write(statements: SQL[]): Promise<Row[][]>;
}

export class CabinetRepairPlanError extends Error {
  constructor(message: string) {
    super(`Cabinet repair plan refused: ${message}`);
    this.name = "CabinetRepairPlanError";
  }
}

// ─── Row digests (identical in SQL and TypeScript) ───────────────────────────

const NULL_MARK = "∅";

const TERM_DIGEST_SQL = sql`md5(concat_ws('|', t.id::text, t.office_id::text,
  t.person_id::text, coalesce(t.party_name, ${NULL_MARK}),
  coalesce(t.party_color, ${NULL_MARK}), coalesce(t.start_date::text, ${NULL_MARK}),
  coalesce(t.end_date::text, ${NULL_MARK}), coalesce(t.is_current::text, ${NULL_MARK})))`;

const STATEMENT_DIGEST_SQL = sql`md5(concat_ws('|', s.id::text, s.subject_table,
  s.subject_id::text, s.predicate, s.source_id, coalesce(s.object_value, ${NULL_MARK}),
  coalesce(s.object_entity_id::text, ${NULL_MARK}), coalesce(s.source_url, ${NULL_MARK}),
  coalesce(s.source_license, ${NULL_MARK}), s.retrieved_at::text,
  coalesce(s.source_hash, ${NULL_MARK}), coalesce(s.valid_from::text, ${NULL_MARK}),
  coalesce(s.valid_to::text, ${NULL_MARK})))`;

const OFFICE_DIGEST_SQL = sql`md5(concat_ws('|', o.id::text, o.body_id::text, o.name,
  o.office_type, coalesce(o.is_elected::text, ${NULL_MARK}),
  coalesce(o.wikidata_qid, ${NULL_MARK}), coalesce(o.reports_to_office_id::text, ${NULL_MARK}),
  coalesce(o.display_order::text, ${NULL_MARK})))`;

const PERSON_DIGEST_SQL = sql`md5(concat_ws('|', p.id::text, p.name,
  coalesce(p.date_of_birth::text, ${NULL_MARK}), coalesce(p.wikidata_qid, ${NULL_MARK}),
  coalesce(p.photo_url, ${NULL_MARK}), coalesce(p.photo_license, ${NULL_MARK}),
  coalesce(p.photo_credit, ${NULL_MARK}), coalesce(p.parline_person_code, ${NULL_MARK})))`;

const BODY_DIGEST_SQL = sql`md5(concat_ws('|', b.id::text, b.jurisdiction_id::text,
  b.name, b.body_type, coalesce(b.chamber_type, ${NULL_MARK}),
  coalesce(b.total_seats::text, ${NULL_MARK}), coalesce(b.branch, ${NULL_MARK}),
  coalesce(b.wikidata_qid, ${NULL_MARK}), coalesce(b.ipu_parline_id, ${NULL_MARK}),
  coalesce(b.hierarchy_level::text, ${NULL_MARK}), coalesce(b.parent_body_id::text, ${NULL_MARK}),
  coalesce(b.electoral_system_family, ${NULL_MARK}),
  coalesce(b.electoral_subsystem, ${NULL_MARK})))`;

function md5(text: string): string {
  return createHash("md5").update(text, "utf8").digest("hex");
}

function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

interface TermDigestFields {
  id: string;
  officeId: string;
  personId: string;
  partyName: string | null;
  partyColor: string | null;
  startDate: string | null;
  endDate: string | null;
  isCurrent: boolean | null;
}

export function termDigest(term: TermDigestFields): string {
  return md5(
    [
      term.id,
      term.officeId,
      term.personId,
      term.partyName ?? NULL_MARK,
      term.partyColor ?? NULL_MARK,
      term.startDate ?? NULL_MARK,
      term.endDate ?? NULL_MARK,
      term.isCurrent === null ? NULL_MARK : String(term.isCurrent),
    ].join("|"),
  );
}

interface StatementDigestFields {
  id: string;
  subjectTable: string;
  subjectId: string;
  predicate: string;
  sourceId: string;
  objectValue: string | null;
  objectEntityId: string | null;
  sourceUrl: string | null;
  sourceLicense: string | null;
  retrievedAt: string;
  sourceHash: string | null;
  validFrom: string | null;
  validTo: string | null;
}

export function statementDigest(statement: StatementDigestFields): string {
  return md5(
    [
      statement.id,
      statement.subjectTable,
      statement.subjectId,
      statement.predicate,
      statement.sourceId,
      statement.objectValue ?? NULL_MARK,
      statement.objectEntityId ?? NULL_MARK,
      statement.sourceUrl ?? NULL_MARK,
      statement.sourceLicense ?? NULL_MARK,
      statement.retrievedAt,
      statement.sourceHash ?? NULL_MARK,
      statement.validFrom ?? NULL_MARK,
      statement.validTo ?? NULL_MARK,
    ].join("|"),
  );
}

/** SHA-256 over `id:digest` lines in id order; matches `fingerprintSql`. */
export function fingerprint(rows: ReadonlyArray<{ id: string; digest: string }>): string {
  return sha256(
    [...rows]
      .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
      .map((row) => `${row.id}:${row.digest}`)
      .join("\n"),
  );
}

function jsonIds(ids: readonly string[]): string {
  return JSON.stringify([...ids]);
}

// ─── State ───────────────────────────────────────────────────────────────────

export interface RepairTerm extends TermDigestFields {
  digest: string;
  jurisdictionId: string;
  personName: string;
  personQid: string | null;
}

export interface RepairStatement extends StatementDigestFields {
  digest: string;
}

export interface RepairOffice {
  id: string;
  bodyId: string;
  jurisdictionId: string;
  name: string;
  officeType: string;
  displayOrder: number | null;
  digest: string;
}

export interface CabinetRepairState {
  jurisdictionSlugs: Map<string, string>;
  offices: RepairOffice[];
  terms: RepairTerm[];
  /** Statements whose subject is an executive-body term. */
  statements: RepairStatement[];
  /** Roster statements (body-level), part of the non-target fingerprint. */
  rosterStatements: RepairStatement[];
  persons: Array<{ id: string; digest: string }>;
  bodies: Array<{ id: string; digest: string }>;
  ciaSourceLastSyncAt: string | null;
}

const EXECUTIVE_TERMS = sql`
  SELECT t.id FROM terms t
  JOIN offices o ON o.id = t.office_id
  JOIN government_bodies b ON b.id = o.body_id AND b.branch = 'executive'`;

function stateQueries(): SQL[] {
  return [
    sql`SELECT id::text AS id, slug FROM jurisdictions`,
    sql`SELECT o.id::text AS id, o.body_id::text AS body_id,
               b.jurisdiction_id::text AS jurisdiction_id, o.name, o.office_type,
               o.display_order, ${OFFICE_DIGEST_SQL} AS digest
        FROM offices o
        JOIN government_bodies b ON b.id = o.body_id AND b.branch = 'executive'`,
    sql`SELECT t.id::text AS id, t.office_id::text AS office_id,
               t.person_id::text AS person_id, t.party_name, t.party_color,
               t.start_date::text AS start_date, t.end_date::text AS end_date,
               t.is_current, b.jurisdiction_id::text AS jurisdiction_id,
               p.name AS person_name, p.wikidata_qid AS person_qid,
               ${TERM_DIGEST_SQL} AS digest
        FROM terms t
        JOIN offices o ON o.id = t.office_id
        JOIN government_bodies b ON b.id = o.body_id AND b.branch = 'executive'
        JOIN persons p ON p.id = t.person_id`,
    sql`SELECT s.id::text AS id, s.subject_table, s.subject_id::text AS subject_id,
               s.predicate, s.source_id, s.object_value,
               s.object_entity_id::text AS object_entity_id, s.source_url,
               s.source_license, s.retrieved_at::text AS retrieved_at, s.source_hash,
               s.valid_from::text AS valid_from, s.valid_to::text AS valid_to,
               ${STATEMENT_DIGEST_SQL} AS digest
        FROM statements s
        WHERE s.subject_table = 'terms' AND s.subject_id IN (${EXECUTIVE_TERMS})`,
    sql`SELECT s.id::text AS id, s.subject_table, s.subject_id::text AS subject_id,
               s.predicate, s.source_id, s.object_value,
               s.object_entity_id::text AS object_entity_id, s.source_url,
               s.source_license, s.retrieved_at::text AS retrieved_at, s.source_hash,
               s.valid_from::text AS valid_from, s.valid_to::text AS valid_to,
               ${STATEMENT_DIGEST_SQL} AS digest
        FROM statements s
        WHERE s.subject_table = 'government_bodies'
          AND s.predicate = ${CABINET_ROSTER_PREDICATE}
          AND s.source_id = ${CIA_ROSTER_SOURCE_ID}`,
    sql`SELECT p.id::text AS id, ${PERSON_DIGEST_SQL} AS digest
        FROM persons p
        WHERE p.id IN (SELECT t.person_id FROM terms t
                       JOIN offices o ON o.id = t.office_id
                       JOIN government_bodies b ON b.id = o.body_id
                        AND b.branch = 'executive')`,
    sql`SELECT b.id::text AS id, ${BODY_DIGEST_SQL} AS digest
        FROM government_bodies b WHERE b.branch = 'executive'`,
    sql`SELECT last_sync_at::text AS last_sync_at FROM sources
        WHERE id = ${CIA_ROSTER_SOURCE_ID}`,
  ];
}

function text(value: unknown): string | null {
  return value === null || value === undefined ? null : String(value);
}

function toStatement(row: Row): RepairStatement {
  return {
    id: String(row.id),
    subjectTable: String(row.subject_table),
    subjectId: String(row.subject_id),
    predicate: String(row.predicate),
    sourceId: String(row.source_id),
    objectValue: text(row.object_value),
    objectEntityId: text(row.object_entity_id),
    sourceUrl: text(row.source_url),
    sourceLicense: text(row.source_license),
    retrievedAt: String(row.retrieved_at),
    sourceHash: text(row.source_hash),
    validFrom: text(row.valid_from),
    validTo: text(row.valid_to),
    digest: String(row.digest),
  };
}

export async function loadCabinetRepairState(
  executor: CabinetRepairExecutor,
): Promise<CabinetRepairState> {
  const [
    jurisdictionRows,
    officeRows,
    termRows,
    statementRows,
    rosterRows,
    personRows,
    bodyRows,
    sourceRows,
  ] = await executor.read(stateQueries());
  return {
    jurisdictionSlugs: new Map(
      jurisdictionRows.map((row) => [String(row.id), String(row.slug)]),
    ),
    offices: officeRows.map((row) => ({
      id: String(row.id),
      bodyId: String(row.body_id),
      jurisdictionId: String(row.jurisdiction_id),
      name: String(row.name),
      officeType: String(row.office_type),
      displayOrder:
        row.display_order === null || row.display_order === undefined
          ? null
          : Number(row.display_order),
      digest: String(row.digest),
    })),
    terms: termRows.map((row) => ({
      id: String(row.id),
      officeId: String(row.office_id),
      personId: String(row.person_id),
      partyName: text(row.party_name),
      partyColor: text(row.party_color),
      startDate: text(row.start_date),
      endDate: text(row.end_date),
      isCurrent:
        row.is_current === null || row.is_current === undefined
          ? null
          : row.is_current === true || row.is_current === "t",
      jurisdictionId: String(row.jurisdiction_id),
      personName: String(row.person_name),
      personQid: text(row.person_qid),
      digest: String(row.digest),
    })),
    statements: statementRows.map(toStatement),
    rosterStatements: rosterRows.map(toStatement),
    persons: personRows.map((row) => ({ id: String(row.id), digest: String(row.digest) })),
    bodies: bodyRows.map((row) => ({ id: String(row.id), digest: String(row.digest) })),
    ciaSourceLastSyncAt: text(sourceRows[0]?.last_sync_at),
  };
}

// ─── Plan ────────────────────────────────────────────────────────────────────

export interface PlannedRowChange {
  id: string;
  before: string;
  /** Digest after the change, or `absent` for a deletion. */
  after: string;
}

export interface PlannedRehome extends PlannedRowChange {
  fromSubjectId: string;
  toSubjectId: string;
}

export interface CabinetRepairPlan {
  schemaVersion: typeof CABINET_REPAIR_PLAN_SCHEMA;
  methodologyVersion: typeof CABINET_REPAIR_METHOD;
  categories: {
    r1PlaceholderTerms: number;
    r1PlaceholderStatements: number;
    r2DuplicatePairs: number;
    r2LoserTerms: number;
    r2LoserStatements: number;
    r2SurvivorReinstated: number;
    r3CiaOnHeadDeleted: number;
    r3CiaOnHeadRehomed: number;
    r3CiaMisplacedDeleted: number;
    r3CiaMisplacedRehomed: number;
    r3WikidataDeleted: number;
    r3WikidataRehomed: number;
    r4LegacyRetired: number;
    r5DatesCleared: number;
  };
  /** Evidence, not targets: the undated/unlisted state the plan leaves. */
  observations: {
    ciaOwnedOffices: number;
    ciaOwnedTerms: number;
    survivingCiaOwnedTerms: number;
    currentCiaOwnedTermsWithoutProvenance: number;
    retiredCiaOwnedTermsWithoutProvenance: number;
    jurisdictionsWithCiaTerms: number;
    jurisdictionsWithRosterStatement: number;
    jurisdictionsWithoutRosterStatement: string[];
    legacyCurrentTermsKept: number;
  };
  targets: {
    termDeletes: PlannedRowChange[];
    termUpdates: Array<PlannedRowChange & { isCurrent: boolean; clearDates: boolean }>;
    statementDeletes: PlannedRowChange[];
    statementRehomes: PlannedRehome[];
  };
  nonTarget: {
    terms: string;
    statements: string;
    offices: string;
    persons: string;
    bodies: string;
    personIds: string[];
  };
  snapshot: {
    ciaSourceLastSyncAt: string | null;
  };
  expectedHistoryRows: number;
  planSha256: string;
}

function sortById<T extends { id: string }>(rows: T[]): T[] {
  return rows.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/**
 * Pure, deterministic plan. Throws `CabinetRepairPlanError` when a defect
 * cannot be repaired by rule (the repair then needs a human decision).
 */
export function planCabinetTermRepair(state: CabinetRepairState): CabinetRepairPlan {
  const officeById = new Map(state.offices.map((office) => [office.id, office]));
  const termById = new Map(state.terms.map((term) => [term.id, term]));
  const statementsByTerm = new Map<string, RepairStatement[]>();
  for (const statement of state.statements) {
    const list = statementsByTerm.get(statement.subjectId) ?? [];
    list.push(statement);
    statementsByTerm.set(statement.subjectId, list);
  }
  const ciaStatementOf = (termId: string) =>
    (statementsByTerm.get(termId) ?? []).find(
      (statement) =>
        statement.sourceId === CIA_ROSTER_SOURCE_ID &&
        statement.predicate === CABINET_MEMBER_PREDICATE,
    ) ?? null;

  const provenanceOffices = new Set(
    state.terms
      .filter((term) => ciaStatementOf(term.id) !== null)
      .map((term) => term.officeId),
  );
  const ownedOffices = new Set(
    state.offices
      .filter((office) =>
        isCiaOwnedOffice({
          officeType: office.officeType,
          displayOrder: office.displayOrder,
          hasCiaProvenance: provenanceOffices.has(office.id),
        }),
      )
      .map((office) => office.id),
  );
  const pageForJurisdiction = (jurisdictionId: string) => {
    const slug = state.jurisdictionSlugs.get(jurisdictionId);
    return slug ? ciaRosterPageUrlForJurisdiction(slug) : null;
  };
  const jurisdictionForPage = new Map<string, string>();
  for (const [id, slug] of state.jurisdictionSlugs) {
    jurisdictionForPage.set(ciaRosterPageUrlForJurisdiction(slug), id);
  }

  const termDeletes = new Map<string, PlannedRowChange>();
  const statementDeletes = new Map<string, PlannedRowChange>();
  const statementRehomes = new Map<string, PlannedRehome>();
  const deleteStatementsOf = (termId: string, allowNonCia: boolean) => {
    for (const statement of statementsByTerm.get(termId) ?? []) {
      if (!allowNonCia && statement.sourceId !== CIA_ROSTER_SOURCE_ID) {
        throw new CabinetRepairPlanError(
          `term ${termId} scheduled for deletion carries a non-CIA statement`,
        );
      }
      statementDeletes.set(statement.id, {
        id: statement.id,
        before: statement.digest,
        after: "absent",
      });
    }
  };

  const ownedTerms = state.terms.filter((term) => ownedOffices.has(term.officeId));

  // R1 — placeholder "Vacant" pseudo-person terms.
  let r1Statements = 0;
  const r1Terms = ownedTerms.filter(
    (term) => term.personQid === null && VACANT_PERSON_NAME_RE.test(term.personName.trim()),
  );
  for (const term of r1Terms) {
    r1Statements += (statementsByTerm.get(term.id) ?? []).length;
    deleteStatementsOf(term.id, false);
    termDeletes.set(term.id, { id: term.id, before: term.digest, after: "absent" });
  }

  // R2 — duplicate (office, person) pairs collapse to the shared survivor.
  const pairs = new Map<string, RepairTerm[]>();
  for (const term of ownedTerms) {
    if (termDeletes.has(term.id)) continue;
    const key = `${term.officeId}|${term.personId}`;
    const list = pairs.get(key) ?? [];
    list.push(term);
    pairs.set(key, list);
  }
  const survivors = new Map<string, RepairTerm>();
  const survivorCurrent = new Map<string, boolean>();
  let duplicatePairs = 0;
  let loserTerms = 0;
  let loserStatements = 0;
  let reinstated = 0;
  for (const rows of pairs.values()) {
    const ranked = [...rows].sort((a, b) =>
      compareCabinetTermSurvivor(
        {
          id: a.id,
          isCurrent: a.isCurrent,
          startDate: a.startDate,
          hasCiaStatement: ciaStatementOf(a.id) !== null,
          ciaStatementRetrievedAt: ciaStatementOf(a.id)?.retrievedAt ?? null,
        },
        {
          id: b.id,
          isCurrent: b.isCurrent,
          startDate: b.startDate,
          hasCiaStatement: ciaStatementOf(b.id) !== null,
          ciaStatementRetrievedAt: ciaStatementOf(b.id)?.retrievedAt ?? null,
        },
      ),
    );
    const survivor = ranked[0];
    survivors.set(survivor.id, survivor);
    const anyCurrent = rows.some((row) => row.isCurrent === true);
    survivorCurrent.set(survivor.id, anyCurrent || survivor.isCurrent === true);
    if (ranked.length > 1) {
      duplicatePairs++;
      if (anyCurrent && survivor.isCurrent !== true) reinstated++;
      for (const loser of ranked.slice(1)) {
        loserTerms++;
        loserStatements += (statementsByTerm.get(loser.id) ?? []).length;
        deleteStatementsOf(loser.id, false);
        termDeletes.set(loser.id, { id: loser.id, before: loser.digest, after: "absent" });
      }
    }
  }

  // R3 — misplaced statements. A target is the surviving CIA-owned term of the
  // same person on the office the statement names, in the page's country.
  const survivorsByPersonJurisdiction = new Map<string, RepairTerm[]>();
  for (const survivor of survivors.values()) {
    const key = `${survivor.personId}|${survivor.jurisdictionId}`;
    const list = survivorsByPersonJurisdiction.get(key) ?? [];
    list.push(survivor);
    survivorsByPersonJurisdiction.set(key, list);
  }
  const claimed = new Set<string>();
  const hasCiaAfterPlan = (termId: string) => {
    if (claimed.has(termId)) return true;
    const own = ciaStatementOf(termId);
    return own !== null && !statementDeletes.has(own.id) && !statementRehomes.has(own.id);
  };
  // A statement is misplaced when it sits on a head term, or on a surviving
  // CIA-owned term whose office title or country page it does not name.
  const misplaced = new Set<string>();
  for (const statement of state.statements) {
    if (
      statementDeletes.has(statement.id) ||
      statement.sourceId !== CIA_ROSTER_SOURCE_ID ||
      statement.predicate !== CABINET_MEMBER_PREDICATE
    ) {
      continue;
    }
    const term = termById.get(statement.subjectId);
    const office = term ? officeById.get(term.officeId) : undefined;
    if (!term || !office) continue;
    if (
      isHeadOfficeType(office.officeType) ||
      (survivors.has(term.id) &&
        (statement.objectValue !== office.name ||
          statement.sourceUrl !== pageForJurisdiction(term.jurisdictionId)))
    ) {
      misplaced.add(statement.id);
    }
  }
  const resolveTarget = (statement: RepairStatement, personId: string) => {
    const jurisdictionId = statement.sourceUrl
      ? jurisdictionForPage.get(statement.sourceUrl)
      : undefined;
    if (!jurisdictionId) return null;
    const candidates = (
      survivorsByPersonJurisdiction.get(`${personId}|${jurisdictionId}`) ?? []
    ).filter(
      (term) =>
        term.id !== statement.subjectId &&
        officeById.get(term.officeId)?.name === statement.objectValue,
    );
    return candidates.length === 1 ? candidates[0] : candidates.length === 0 ? null : "ambiguous";
  };
  let ciaOnHeadDeleted = 0;
  let ciaOnHeadRehomed = 0;
  let misplacedDeleted = 0;
  let misplacedRehomed = 0;
  const rehomeOrDelete = (
    statement: RepairStatement,
    personId: string,
  ): "deleted" | "rehomed" => {
    const target = resolveTarget(statement, personId);
    if (target === null || target === "ambiguous") {
      throw new CabinetRepairPlanError(
        `statement ${statement.id} names no single surviving term to re-home to`,
      );
    }
    const targetOwn = ciaStatementOf(target.id);
    if (targetOwn && misplaced.has(targetOwn.id)) {
      throw new CabinetRepairPlanError(
        `statement ${statement.id} targets a term whose own statement is also misplaced`,
      );
    }
    if (hasCiaAfterPlan(target.id)) {
      statementDeletes.set(statement.id, {
        id: statement.id,
        before: statement.digest,
        after: "absent",
      });
      return "deleted";
    }
    claimed.add(target.id);
    statementRehomes.set(statement.id, {
      id: statement.id,
      before: statement.digest,
      after: statementDigest({ ...statement, subjectId: target.id }),
      fromSubjectId: statement.subjectId,
      toSubjectId: target.id,
    });
    return "rehomed";
  };

  const orderedStatements = sortById([...state.statements]);
  for (const statement of orderedStatements) {
    if (statementDeletes.has(statement.id)) continue;
    if (
      statement.sourceId !== CIA_ROSTER_SOURCE_ID ||
      statement.predicate !== CABINET_MEMBER_PREDICATE
    ) {
      continue;
    }
    const term = termById.get(statement.subjectId);
    const office = term ? officeById.get(term.officeId) : undefined;
    if (!term || !office) continue;
    if (isHeadOfficeType(office.officeType)) {
      if (rehomeOrDelete(statement, term.personId) === "deleted") ciaOnHeadDeleted++;
      else ciaOnHeadRehomed++;
      continue;
    }
    if (!survivors.has(term.id)) continue;
    const ownPage = pageForJurisdiction(term.jurisdictionId);
    if (statement.objectValue === office.name && statement.sourceUrl === ownPage) continue;
    if (rehomeOrDelete(statement, term.personId) === "deleted") misplacedDeleted++;
    else misplacedRehomed++;
  }

  // Wikidata statements on CIA-owned survivors belong on the person's head term.
  let wikidataDeleted = 0;
  let wikidataRehomed = 0;
  const headTermsOf = (personId: string, jurisdictionId: string, predicate: string) =>
    state.terms.filter(
      (term) =>
        term.personId === personId &&
        term.jurisdictionId === jurisdictionId &&
        officeById.get(term.officeId)?.officeType === predicate,
    );
  for (const statement of orderedStatements) {
    if (statement.sourceId !== "wikidata") continue;
    const term = termById.get(statement.subjectId);
    if (!term || !survivors.has(term.id)) continue;
    if (!isHeadOfficeType(statement.predicate)) {
      throw new CabinetRepairPlanError(
        `Wikidata statement ${statement.id} on a CIA-owned term has an unexpected predicate`,
      );
    }
    const heads = headTermsOf(term.personId, term.jurisdictionId, statement.predicate);
    const carrying = heads.filter((head) =>
      (statementsByTerm.get(head.id) ?? []).some(
        (other) =>
          other.sourceId === "wikidata" &&
          other.predicate === statement.predicate &&
          !statementRehomes.has(other.id),
      ) ||
      [...statementRehomes.values()].some(
        (rehome) => rehome.toSubjectId === head.id && rehome.id !== statement.id,
      ),
    );
    if (carrying.length > 0) {
      statementDeletes.set(statement.id, {
        id: statement.id,
        before: statement.digest,
        after: "absent",
      });
      wikidataDeleted++;
      continue;
    }
    if (heads.length !== 1) {
      throw new CabinetRepairPlanError(
        `Wikidata statement ${statement.id} has no single head term to re-home to`,
      );
    }
    statementRehomes.set(statement.id, {
      id: statement.id,
      before: statement.digest,
      after: statementDigest({ ...statement, subjectId: heads[0].id }),
      fromSubjectId: statement.subjectId,
      toSubjectId: heads[0].id,
    });
    wikidataRehomed++;
  }

  // R4 — unsourced legacy rows superseded by an imported roster.
  const rosterBodies = new Set(state.rosterStatements.map((row) => row.subjectId));
  const termUpdates = new Map<
    string,
    PlannedRowChange & { isCurrent: boolean; clearDates: boolean }
  >();
  let legacyRetired = 0;
  let legacyKept = 0;
  for (const term of state.terms) {
    const office = officeById.get(term.officeId);
    if (!office || !isCiaRosterOfficeType(office.officeType)) continue;
    if (ownedOffices.has(office.id) || term.isCurrent === false) continue;
    if ((statementsByTerm.get(term.id) ?? []).length > 0) continue;
    if (!rosterBodies.has(office.bodyId)) {
      legacyKept++;
      continue;
    }
    termUpdates.set(term.id, {
      id: term.id,
      before: term.digest,
      after: termDigest({ ...term, isCurrent: false }),
      isCurrent: false,
      clearDates: false,
    });
    legacyRetired++;
  }

  // R5 (+ R2 current-flag transfer) — surviving CIA-owned terms end undated.
  let datesCleared = 0;
  for (const survivor of survivors.values()) {
    const isCurrent = survivorCurrent.get(survivor.id) ?? survivor.isCurrent === true;
    const clearDates = survivor.startDate !== null || survivor.endDate !== null;
    if (!clearDates && isCurrent === (survivor.isCurrent === true)) continue;
    if (clearDates) datesCleared++;
    termUpdates.set(survivor.id, {
      id: survivor.id,
      before: survivor.digest,
      after: termDigest({ ...survivor, isCurrent, startDate: null, endDate: null }),
      isCurrent,
      clearDates: true,
    });
  }

  // ── Non-target fingerprints (drift and collateral-change detection) ──────
  const targetTerms = new Set([...termDeletes.keys(), ...termUpdates.keys()]);
  const targetStatements = new Set([...statementDeletes.keys(), ...statementRehomes.keys()]);
  const nonTarget = {
    terms: fingerprint(state.terms.filter((term) => !targetTerms.has(term.id))),
    statements: fingerprint(
      [...state.statements, ...state.rosterStatements].filter(
        (statement) => !targetStatements.has(statement.id),
      ),
    ),
    offices: fingerprint(state.offices),
    persons: fingerprint(state.persons),
    bodies: fingerprint(state.bodies),
    personIds: state.persons.map((person) => person.id).sort(),
  };

  // ── Observations ──────────────────────────────────────────────────────────
  const survivingOwned = [...survivors.values()];
  const withProvenanceAfter = (termId: string) =>
    hasCiaAfterPlan(termId) ||
    [...statementRehomes.values()].some((rehome) => rehome.toSubjectId === termId);
  const jurisdictionsWithCia = new Set(ownedTerms.map((term) => term.jurisdictionId));
  const jurisdictionsWithRoster = new Set(
    state.offices
      .filter((office) => rosterBodies.has(office.bodyId))
      .map((office) => office.jurisdictionId),
  );
  const withoutRoster = [...jurisdictionsWithCia]
    .filter((id) => !jurisdictionsWithRoster.has(id))
    .map((id) => state.jurisdictionSlugs.get(id) ?? id)
    .sort();

  const targets = {
    termDeletes: sortById([...termDeletes.values()]),
    termUpdates: sortById([...termUpdates.values()]),
    statementDeletes: sortById([...statementDeletes.values()]),
    statementRehomes: sortById([...statementRehomes.values()]),
  };
  const categories = {
    r1PlaceholderTerms: r1Terms.length,
    r1PlaceholderStatements: r1Statements,
    r2DuplicatePairs: duplicatePairs,
    r2LoserTerms: loserTerms,
    r2LoserStatements: loserStatements,
    r2SurvivorReinstated: reinstated,
    r3CiaOnHeadDeleted: ciaOnHeadDeleted,
    r3CiaOnHeadRehomed: ciaOnHeadRehomed,
    r3CiaMisplacedDeleted: misplacedDeleted,
    r3CiaMisplacedRehomed: misplacedRehomed,
    r3WikidataDeleted: wikidataDeleted,
    r3WikidataRehomed: wikidataRehomed,
    r4LegacyRetired: legacyRetired,
    r5DatesCleared: datesCleared,
  };
  const body: Omit<CabinetRepairPlan, "planSha256"> = {
    schemaVersion: CABINET_REPAIR_PLAN_SCHEMA,
    methodologyVersion: CABINET_REPAIR_METHOD,
    categories,
    observations: {
      ciaOwnedOffices: ownedOffices.size,
      ciaOwnedTerms: ownedTerms.length,
      survivingCiaOwnedTerms: survivingOwned.length,
      currentCiaOwnedTermsWithoutProvenance: survivingOwned.filter(
        (term) => survivorCurrent.get(term.id) === true && !withProvenanceAfter(term.id),
      ).length,
      retiredCiaOwnedTermsWithoutProvenance: survivingOwned.filter(
        (term) => survivorCurrent.get(term.id) !== true && !withProvenanceAfter(term.id),
      ).length,
      jurisdictionsWithCiaTerms: jurisdictionsWithCia.size,
      jurisdictionsWithRosterStatement: [...jurisdictionsWithCia].filter((id) =>
        jurisdictionsWithRoster.has(id),
      ).length,
      jurisdictionsWithoutRosterStatement: withoutRoster,
      legacyCurrentTermsKept: legacyKept,
    },
    targets,
    nonTarget,
    snapshot: { ciaSourceLastSyncAt: state.ciaSourceLastSyncAt },
    expectedHistoryRows:
      targets.termDeletes.length +
      targets.termUpdates.length +
      targets.statementDeletes.length +
      targets.statementRehomes.length,
  };
  return { ...body, planSha256: sha256(JSON.stringify(body)) };
}

export function verifyPlanDigest(plan: CabinetRepairPlan): boolean {
  const { planSha256, ...body } = plan;
  return sha256(JSON.stringify(body)) === planSha256;
}

export function planWriteCount(plan: CabinetRepairPlan): number {
  return plan.expectedHistoryRows;
}

// ─── Apply ───────────────────────────────────────────────────────────────────

function assertion(marker: string, countSql: SQL): SQL {
  return sql`SELECT CASE WHEN x.problems = 0 THEN 1
      ELSE (${`civica_assertion_failed:${marker}:`} || x.problems::text)::integer
    END AS verified
    FROM (${countSql}) x`;
}

function fingerprintSql(rowsSql: SQL): SQL {
  return sql`SELECT encode(sha256(convert_to(coalesce(
      string_agg(f.id || ':' || f.digest, E'\\n' ORDER BY f.id COLLATE "C"), ''), 'UTF8')), 'hex') AS fingerprint
    FROM (${rowsSql}) f`;
}

function nonTargetRows(plan: CabinetRepairPlan) {
  const termIds = jsonIds([
    ...plan.targets.termDeletes.map((row) => row.id),
    ...plan.targets.termUpdates.map((row) => row.id),
  ]);
  const statementIds = jsonIds([
    ...plan.targets.statementDeletes.map((row) => row.id),
    ...plan.targets.statementRehomes.map((row) => row.id),
  ]);
  return {
    terms: sql`SELECT t.id::text AS id, ${TERM_DIGEST_SQL} AS digest
      FROM terms t
      JOIN offices o ON o.id = t.office_id
      JOIN government_bodies b ON b.id = o.body_id AND b.branch = 'executive'
      WHERE t.id::text NOT IN (SELECT jsonb_array_elements_text(${termIds}::jsonb))`,
    statements: sql`SELECT s.id::text AS id, ${STATEMENT_DIGEST_SQL} AS digest
      FROM statements s
      WHERE ((s.subject_table = 'terms' AND s.subject_id IN (${EXECUTIVE_TERMS}))
          OR (s.subject_table = 'government_bodies'
              AND s.predicate = ${CABINET_ROSTER_PREDICATE}
              AND s.source_id = ${CIA_ROSTER_SOURCE_ID}))
        AND s.id::text NOT IN (SELECT jsonb_array_elements_text(${statementIds}::jsonb))`,
    offices: sql`SELECT o.id::text AS id, ${OFFICE_DIGEST_SQL} AS digest
      FROM offices o
      JOIN government_bodies b ON b.id = o.body_id AND b.branch = 'executive'`,
    persons: sql`SELECT p.id::text AS id, ${PERSON_DIGEST_SQL} AS digest
      FROM persons p
      WHERE p.id::text IN (SELECT jsonb_array_elements_text(${jsonIds(plan.nonTarget.personIds)}::jsonb))`,
    bodies: sql`SELECT b.id::text AS id, ${BODY_DIGEST_SQL} AS digest
      FROM government_bodies b WHERE b.branch = 'executive'`,
  };
}

function nonTargetAssertion(plan: CabinetRepairPlan, stage: "before" | "after"): SQL {
  const rows = nonTargetRows(plan);
  const expected = plan.nonTarget;
  return assertion(
    `repair_non_target_drift_${stage}`,
    sql`SELECT (
        ((${fingerprintSql(rows.terms)}) <> ${expected.terms})::int +
        ((${fingerprintSql(rows.statements)}) <> ${expected.statements})::int +
        ((${fingerprintSql(rows.offices)}) <> ${expected.offices})::int +
        ((${fingerprintSql(rows.persons)}) <> ${expected.persons})::int +
        ((${fingerprintSql(rows.bodies)}) <> ${expected.bodies})::int
      ) AS problems`,
  );
}

/** Every planned target is in its before-state or already in its after-state. */
function targetStateAssertion(
  plan: CabinetRepairPlan,
  accept: "before_or_after" | "after_only",
): SQL {
  const terms = [...plan.targets.termDeletes, ...plan.targets.termUpdates].map(
    ({ id, before, after }) => ({ id, before, after }),
  );
  const statements = [
    ...plan.targets.statementDeletes,
    ...plan.targets.statementRehomes,
  ].map(({ id, before, after }) => ({ id, before, after }));
  const acceptBefore = accept === "before_or_after";
  return assertion(
    accept === "after_only" ? "repair_postcondition" : "repair_drift",
    sql`SELECT (
        (SELECT count(*)::int FROM jsonb_to_recordset(${JSON.stringify(terms)}::jsonb)
            AS e(id uuid, before text, after text)
          LEFT JOIN terms t ON t.id = e.id
          WHERE NOT (
            (t.id IS NULL AND e.after = 'absent')
            OR (t.id IS NOT NULL AND (${TERM_DIGEST_SQL} = e.after
                OR (${acceptBefore} AND ${TERM_DIGEST_SQL} = e.before)))
          ))
        +
        (SELECT count(*)::int FROM jsonb_to_recordset(${JSON.stringify(statements)}::jsonb)
            AS e(id uuid, before text, after text)
          LEFT JOIN statements s ON s.id = e.id
          WHERE NOT (
            (s.id IS NULL AND e.after = 'absent')
            OR (s.id IS NOT NULL AND (${STATEMENT_DIGEST_SQL} = e.after
                OR (${acceptBefore} AND ${STATEMENT_DIGEST_SQL} = e.before)))
          ))
      ) AS problems`,
  );
}

/**
 * The ordered statements of the one repair transaction. Every mutation is
 * guarded so a row already in its after-state is left untouched.
 */
export function buildCabinetRepairTransaction(plan: CabinetRepairPlan): SQL[] {
  const termDeleteIds = jsonIds(plan.targets.termDeletes.map((row) => row.id));
  const statementDeleteIds = jsonIds(plan.targets.statementDeletes.map((row) => row.id));
  const rehomes = JSON.stringify(
    plan.targets.statementRehomes.map(({ id, fromSubjectId, toSubjectId }) => ({
      id,
      fromSubjectId,
      toSubjectId,
    })),
  );
  const updates = JSON.stringify(
    plan.targets.termUpdates.map(({ id, isCurrent, clearDates }) => ({
      id,
      isCurrent,
      clearDates,
    })),
  );
  return [
    sql`LOCK TABLE terms, statements, offices IN SHARE ROW EXCLUSIVE MODE`,
    // Matches `research_evidence_history.recorded_at DEFAULT now()` exactly.
    sql`SELECT now()::timestamp::text AS transaction_started_at`,
    targetStateAssertion(plan, "before_or_after"),
    nonTargetAssertion(plan, "before"),
    sql`DELETE FROM statements
        WHERE subject_table = 'terms'
          AND id IN (SELECT jsonb_array_elements_text(${statementDeleteIds}::jsonb)::uuid)
        RETURNING id`,
    sql`UPDATE statements s SET subject_id = x."toSubjectId"
        FROM jsonb_to_recordset(${rehomes}::jsonb)
          AS x(id uuid, "fromSubjectId" uuid, "toSubjectId" uuid)
        WHERE s.id = x.id AND s.subject_table = 'terms' AND s.subject_id = x."fromSubjectId"
        RETURNING s.id`,
    assertion(
      "repair_term_still_referenced",
      sql`SELECT count(*)::int AS problems FROM statements
          WHERE subject_table = 'terms'
            AND subject_id IN (SELECT jsonb_array_elements_text(${termDeleteIds}::jsonb)::uuid)`,
    ),
    sql`DELETE FROM terms
        WHERE id IN (SELECT jsonb_array_elements_text(${termDeleteIds}::jsonb)::uuid)
        RETURNING id`,
    sql`UPDATE terms t
        SET is_current = x."isCurrent",
            start_date = CASE WHEN x."clearDates" THEN NULL ELSE t.start_date END,
            end_date = CASE WHEN x."clearDates" THEN NULL ELSE t.end_date END
        FROM jsonb_to_recordset(${updates}::jsonb)
          AS x(id uuid, "isCurrent" boolean, "clearDates" boolean)
        WHERE t.id = x.id
          AND (t.is_current IS DISTINCT FROM x."isCurrent"
               OR (x."clearDates" AND (t.start_date IS NOT NULL OR t.end_date IS NOT NULL)))
        RETURNING t.id`,
    targetStateAssertion(plan, "after_only"),
    nonTargetAssertion(plan, "after"),
  ];
}

export interface CabinetRepairApplyResult {
  transactionStartedAt: string;
  statementsDeleted: number;
  statementsRehomed: number;
  termsDeleted: number;
  termsUpdated: number;
  rowsChanged: number;
}

export async function applyCabinetTermRepair(
  executor: CabinetRepairExecutor,
  plan: CabinetRepairPlan,
): Promise<CabinetRepairApplyResult> {
  if (!verifyPlanDigest(plan)) {
    throw new CabinetRepairPlanError("plan digest does not match its contents");
  }
  const results = await executor.write(buildCabinetRepairTransaction(plan));
  const count = (index: number) => results[index]?.length ?? 0;
  const result = {
    transactionStartedAt: String(results[1]?.[0]?.transaction_started_at ?? ""),
    statementsDeleted: count(4),
    statementsRehomed: count(5),
    termsDeleted: count(7),
    termsUpdated: count(8),
    rowsChanged: 0,
  };
  result.rowsChanged =
    result.statementsDeleted +
    result.statementsRehomed +
    result.termsDeleted +
    result.termsUpdated;
  return result;
}

// ─── Verify (read-only postflight) ───────────────────────────────────────────

export interface CabinetRepairVerification {
  checks: Record<string, { pass: boolean; observed: number | string | null }>;
  replan: CabinetRepairPlan["categories"];
  pass: boolean;
}

function checkCount(observed: number) {
  return { pass: observed === 0, observed };
}

/**
 * P1–P8 invariants plus, when a plan and apply report are supplied, the
 * freshness (P10) and history-accounting (P11) checks. Reads only.
 */
export async function verifyCabinetTermRepair(
  executor: CabinetRepairExecutor,
  options: {
    plan?: CabinetRepairPlan;
    transactionStartedAt?: string;
  } = {},
): Promise<CabinetRepairVerification> {
  const state = await loadCabinetRepairState(executor);
  let replan: CabinetRepairPlan;
  try {
    replan = planCabinetTermRepair(state);
  } catch (error) {
    throw new CabinetRepairPlanError(
      `postflight re-plan failed: ${(error as Error).message}`,
    );
  }
  const officeById = new Map(state.offices.map((office) => [office.id, office]));
  const statementsByTerm = new Map<string, RepairStatement[]>();
  for (const statement of state.statements) {
    const list = statementsByTerm.get(statement.subjectId) ?? [];
    list.push(statement);
    statementsByTerm.set(statement.subjectId, list);
  }
  const provenanceOffices = new Set(
    state.terms
      .filter((term) =>
        (statementsByTerm.get(term.id) ?? []).some(
          (statement) => statement.sourceId === CIA_ROSTER_SOURCE_ID,
        ),
      )
      .map((term) => term.officeId),
  );
  const owned = (officeId: string) => {
    const office = officeById.get(officeId);
    return (
      !!office &&
      isCiaOwnedOffice({
        officeType: office.officeType,
        displayOrder: office.displayOrder,
        hasCiaProvenance: provenanceOffices.has(office.id),
      })
    );
  };
  const ownedTerms = state.terms.filter((term) => owned(term.officeId));
  const pairs = new Map<string, number>();
  for (const term of ownedTerms) {
    const key = `${term.officeId}|${term.personId}`;
    pairs.set(key, (pairs.get(key) ?? 0) + 1);
  }
  const current = ownedTerms.filter((term) => term.isCurrent === true);
  const badProvenance = current.filter((term) => {
    const cia = (statementsByTerm.get(term.id) ?? []).filter(
      (statement) =>
        statement.sourceId === CIA_ROSTER_SOURCE_ID &&
        statement.predicate === CABINET_MEMBER_PREDICATE,
    );
    const slug = state.jurisdictionSlugs.get(term.jurisdictionId);
    const page = slug ? ciaRosterPageUrlForJurisdiction(slug) : null;
    return (
      cia.length !== 1 ||
      cia[0].objectValue !== officeById.get(term.officeId)?.name ||
      cia[0].sourceUrl !== page
    );
  });
  const ciaOnHead = state.statements.filter((statement) => {
    const term = state.terms.find((candidate) => candidate.id === statement.subjectId);
    return (
      statement.sourceId === CIA_ROSTER_SOURCE_ID &&
      !!term &&
      isHeadOfficeType(officeById.get(term.officeId)?.officeType)
    );
  });
  const wikidataOnOwned = state.statements.filter((statement) => {
    const term = state.terms.find((candidate) => candidate.id === statement.subjectId);
    return statement.sourceId === "wikidata" && !!term && owned(term.officeId);
  });
  const placeholders = ownedTerms.filter(
    (term) => term.personQid === null && VACANT_PERSON_NAME_RE.test(term.personName.trim()),
  );
  const rosterBodies = new Set(state.rosterStatements.map((row) => row.subjectId));
  const bodiesWithCurrent = new Set(
    current.map((term) => officeById.get(term.officeId)?.bodyId).filter(Boolean) as string[],
  );
  const rosterInvalid = state.rosterStatements.filter(
    (row) => !/^\d{4}-\d{2}-\d{2}$/.test(row.objectValue ?? ""),
  );
  const unlistedWithCurrent = current.filter(
    (term) => officeById.get(term.officeId)?.displayOrder === null,
  );
  const positions = new Map<string, number>();
  for (const office of state.offices) {
    if (!owned(office.id) || office.displayOrder === null) continue;
    const key = `${office.bodyId}|${office.displayOrder}`;
    positions.set(key, (positions.get(key) ?? 0) + 1);
  }
  const replanWrites = Object.values(replan.categories).reduce((sum, value) => sum + value, 0);

  const checks: CabinetRepairVerification["checks"] = {
    P1_ciaOwnedTermsWithDates: checkCount(
      ownedTerms.filter((term) => term.startDate !== null || term.endDate !== null).length,
    ),
    P2_duplicatePairs: checkCount([...pairs.values()].filter((n) => n > 1).length),
    P3_currentTermsWithoutExactProvenance: checkCount(badProvenance.length),
    P3_retiredTermsWithoutProvenance_disclosed: {
      pass: true,
      observed: ownedTerms.filter(
        (term) =>
          term.isCurrent !== true &&
          !(statementsByTerm.get(term.id) ?? []).some(
            (statement) => statement.sourceId === CIA_ROSTER_SOURCE_ID,
          ),
      ).length,
    },
    P4_ciaStatementsOnHeadTerms: checkCount(ciaOnHead.length),
    P4_wikidataStatementsOnCiaTerms: checkCount(wikidataOnOwned.length),
    P5_placeholderTerms: checkCount(placeholders.length),
    P6_bodiesWithCurrentTermsWithoutRoster: checkCount(
      [...bodiesWithCurrent].filter((id) => !rosterBodies.has(id)).length,
    ),
    P6_rosterStatementsWithoutIsoDate: checkCount(rosterInvalid.length),
    P7_unlistedOfficesWithCurrentHolders: checkCount(unlistedWithCurrent.length),
    P7_sharedListPositions: checkCount([...positions.values()].filter((n) => n > 1).length),
    P8_replanWrites: checkCount(replanWrites),
  };
  if (options.plan) {
    checks.P10_ciaSourceFreshnessUnchanged = {
      pass:
        timestampEpoch(state.ciaSourceLastSyncAt) ===
        timestampEpoch(options.plan.snapshot.ciaSourceLastSyncAt),
      observed: state.ciaSourceLastSyncAt,
    };
  }
  if (options.plan && options.transactionStartedAt) {
    const [historyRows] = await executor.read([
      sql`SELECT count(*)::int AS n FROM research_evidence_history
          WHERE recorded_at = ${options.transactionStartedAt}::timestamp
            AND entity_table IN ('terms', 'statements')`,
    ]);
    const observed = Number(historyRows[0]?.n ?? -1);
    checks.P11_historyRowsForTransaction = {
      pass: observed === options.plan.expectedHistoryRows,
      observed,
    };
  }
  return {
    checks,
    replan: replan.categories,
    pass: Object.values(checks).every((check) => check.pass),
  };
}
