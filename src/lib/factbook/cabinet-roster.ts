/**
 * DAT-037 — CIA World Leaders cabinet roster contract (pure, database-free).
 *
 * The CIA World Leaders directory publishes a per-country list of titles and
 * the people currently holding them, plus one page-level "Last Updated" date.
 * It publishes no appointment or departure dates. Civica therefore models a
 * cabinet term as an undated listing: the identity of a term is
 * `(office, person)`, a term is current exactly while the latest successfully
 * imported roster lists that person under that title, and the page date is a
 * body-level sourced statement rather than a start date.
 *
 * The importer (`cia-cabinets-sync.ts`) and the one-time repair
 * (`scripts/repair-cabinet-terms.ts`) share this module so they always choose
 * the same surviving row and apply the same ownership rules (the repair also
 * counts offices the importer released; see `isCiaOwnedOffice`).
 */
import { createHash } from "node:crypto";

export const CIA_ROSTER_SOURCE_ID = "cia_world_leaders";
export const CABINET_MEMBER_PREDICATE = "cabinet_member";
export const CABINET_ROSTER_PREDICATE = "cabinet_roster_last_updated";
export const CIA_ROSTER_LICENSE = "public_domain";
export const CIA_ROSTER_PAGE_BASE =
  "https://www.cia.gov/resources/world-leaders/foreign-governments";

/**
 * Office types populated by the undated CIA roster (and by eight legacy
 * hand-entered US/UK rows that carry no source). No Civica source currently
 * supplies appointment dates for these offices, so readers never present a
 * stored date on them as a tenure start.
 */
export const CIA_ROSTER_OFFICE_TYPES = [
  "cabinet",
  "deputy_head",
  "central_bank",
  "official",
] as const;

export const HEAD_OFFICE_TYPES = [
  "head_of_state",
  "head_of_government",
] as const;

export function isCiaRosterOfficeType(
  officeType: string | null | undefined,
): boolean {
  return (CIA_ROSTER_OFFICE_TYPES as readonly string[]).includes(
    officeType ?? "",
  );
}

export function isHeadOfficeType(officeType: string | null | undefined) {
  return (HEAD_OFFICE_TYPES as readonly string[]).includes(officeType ?? "");
}

export function ciaRosterPageUrl(ciaSlug: string): string {
  return `${CIA_ROSTER_PAGE_BASE}/${ciaSlug}/`;
}

/**
 * Civica jurisdiction slug → CIA World Leaders slug, for the confirmed
 * divergences (verified live 2026-07-01 via HEAD probes). Anything not here
 * uses the Civica slug unchanged.
 */
export const CIA_SLUG_OVERRIDES: Record<string, string> = {
  drc: "congo-democratic-republic-of-the",
  "congo-brazzaville": "congo-republic-of-the",
  "the-bahamas": "bahamas-the",
  "the-gambia": "gambia-the",
  "the-dominican": "dominican-republic",
  "c-te-d-ivoire": "cote-divoire",
  "north-korea": "korea-north",
  "south-korea": "korea-south",
};

/** The CIA World Leaders page URL for a Civica jurisdiction slug. */
export function ciaRosterPageUrlForJurisdiction(jurisdictionSlug: string): string {
  return ciaRosterPageUrl(CIA_SLUG_OVERRIDES[jurisdictionSlug] ?? jurisdictionSlug);
}

/**
 * CIA prints a placeholder instead of a name when a post is unfilled. Treat it
 * as "no holder" so it never becomes a person who holds offices.
 */
const VACANT_HOLDER_RE =
  /^\(?\s*(position\s+)?vacant(\s+position)?\s*\)?$/i;

export function isVacantHolderText(text: string | null | undefined): boolean {
  return VACANT_HOLDER_RE.test((text ?? "").trim());
}

/** Placeholder person names left behind by the pre-DAT-037 parser. */
export const VACANT_PERSON_NAME_RE = /^\(?vacant\)?$/i;

/**
 * A CIA-owned office is a CIA-typed office in the executive body that the
 * roster placed in a list position, that carries CIA provenance on one of its
 * terms, or whose list position the importer released. Head offices (owned by
 * the Wikidata spine) and the legacy hand-entered offices (never listed, no
 * provenance) are never CIA-owned.
 *
 * `releasedFromRoster` comes from the append-only evidence ledger (an office
 * update whose before-state had a list position and whose after-state has
 * none), so a release cannot erase ownership. The one-time repair and its
 * postflight read it; the importer does not need it, because its release
 * retires every holder in the same transaction and it only writes to a
 * released office again when the page lists that title again.
 */
export function isCiaOwnedOffice(office: {
  officeType: string;
  displayOrder: number | null;
  hasCiaProvenance: boolean;
  releasedFromRoster?: boolean;
}): boolean {
  return (
    isCiaRosterOfficeType(office.officeType) &&
    (office.displayOrder !== null ||
      office.hasCiaProvenance ||
      office.releasedFromRoster === true)
  );
}

/**
 * Whether a roster term's stored dates are CIA page dates ("Last Updated"
 * stamps the former importer wrote as start dates) rather than legacy
 * hand-entered dates. They are when the term carries CIA provenance, or when
 * every stored date is one of the country's page stamps: a date that CIA-sourced
 * roster terms of that country carry, or carried before a repair removed it.
 * A hand-entered legacy row on an office the importer later adopted by title
 * is neither, so its own date is kept.
 */
export function isCiaPageDatedTerm(
  term: {
    startDate: string | null;
    endDate: string | null;
    carriesCiaProvenance: boolean;
  },
  countryPageStamps: ReadonlySet<string>,
): boolean {
  if (term.startDate === null && term.endDate === null) return false;
  if (term.carriesCiaProvenance) return true;
  return [term.startDate, term.endDate].every(
    (date) => date === null || countryPageStamps.has(date),
  );
}

/**
 * Reader rule: a CIA-typed office the latest roster no longer lists (its list
 * position was released) and that nobody currently holds is historical. It is
 * hidden from current-structure surfaces instead of rendering as "vacant".
 */
export function isUnlistedRosterOffice(
  office: { officeType: string; displayOrder?: number | null },
  hasCurrentHolder: boolean,
): boolean {
  return (
    isCiaRosterOfficeType(office.officeType) &&
    (office.displayOrder ?? null) === null &&
    !hasCurrentHolder
  );
}

/**
 * Reader guard for stored dates on roster-typed offices. Until the one-time
 * repair runs, the importer's former behavior left each page's "Last Updated"
 * date in `terms.start_date`; after it runs these are null. Either way no
 * public surface may present them as a tenure start.
 */
export function publishedTermStartDate<T extends string | Date | null>(
  officeType: string | null | undefined,
  startDate: T | undefined,
): T | null {
  if (isCiaRosterOfficeType(officeType)) return null;
  return startDate ?? null;
}

/** Parse the CIA "Last Updated: M/D/YYYY" stamp to ISO `YYYY-MM-DD`. */
export function parseRosterStamp(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const match = raw.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;
  const [, month, day, year] = match;
  const iso = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  const date = new Date(`${iso}T00:00:00Z`);
  if (
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== iso
  ) {
    return null;
  }
  return iso;
}

// ─── Survivor ranking ────────────────────────────────────────────────────────

export interface CabinetTermRankInput {
  id: string;
  isCurrent: boolean | null;
  startDate: string | null;
  /** The term's own CIA `cabinet_member` statement, when it has one. */
  ciaStatementRetrievedAt: string | Date | null;
  hasCiaStatement: boolean;
}

/** Database timestamps are zone-less UTC (`timestamp without time zone`). */
export function timestampEpoch(value: string | Date | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) {
    const time = value.getTime();
    return Number.isNaN(time) ? null : time;
  }
  const trimmed = value.trim();
  const zoneless = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(trimmed);
  const time = Date.parse(
    zoneless ? `${trimmed.replace(" ", "T")}Z` : trimmed,
  );
  return Number.isNaN(time) ? null : time;
}

function descNullsLast(a: number | string | null, b: number | string | null) {
  if (a === b) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a < b ? 1 : -1;
}

/**
 * Deterministic order for rows that share one `(office, person)` identity.
 * The first row survives: CIA provenance first, then current, then the most
 * recent CIA retrieval, then the latest stored date, then the lowest id.
 */
export function compareCabinetTermSurvivor(
  a: CabinetTermRankInput,
  b: CabinetTermRankInput,
): number {
  if (a.hasCiaStatement !== b.hasCiaStatement) {
    return a.hasCiaStatement ? -1 : 1;
  }
  const aCurrent = a.isCurrent === true;
  const bCurrent = b.isCurrent === true;
  if (aCurrent !== bCurrent) return aCurrent ? -1 : 1;
  const retrieved = descNullsLast(
    timestampEpoch(a.ciaStatementRetrievedAt),
    timestampEpoch(b.ciaStatementRetrievedAt),
  );
  if (retrieved !== 0) return retrieved;
  const start = descNullsLast(a.startDate, b.startDate);
  if (start !== 0) return start;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export function rankCabinetTerms<T extends CabinetTermRankInput>(
  rows: readonly T[],
): T[] {
  return [...rows].sort(compareCabinetTermSurvivor);
}

// ─── Roster content hash ─────────────────────────────────────────────────────

export interface RosterHashPosition {
  title: string;
  holder: string | null;
}

/**
 * SHA-256 of the normalized eligible roster: every ingested title with its
 * printed holder, in publisher order. Stored as the roster statement's
 * `source_hash` so a content change is recorded even when CIA's date does not
 * advance.
 */
export function rosterContentHash(
  positions: readonly RosterHashPosition[],
): string {
  const normalized = positions.map((position) => [
    position.title.trim(),
    position.holder === null ? null : position.holder.trim(),
  ]);
  return createHash("sha256")
    .update(JSON.stringify({ version: "cia-roster-content/v1", normalized }))
    .digest("hex");
}

// ─── Per-country roster reconciliation ───────────────────────────────────────

export interface RosterHolder {
  personId: string;
  /** True when the importer must create this QID-less person first. */
  isNew: boolean;
  name: string;
}

export interface RosterTitle {
  title: string;
  officeType: string;
  /** First list index of this exact title on the page. */
  firstOrder: number;
  /** Distinct listed people, in publisher order. Empty = listed vacant. */
  holders: RosterHolder[];
}

export interface RosterStateOffice {
  id: string;
  name: string;
  officeType: string;
  displayOrder: number | null;
  isElected: boolean | null;
}

export interface RosterStateTerm {
  id: string;
  officeId: string;
  personId: string;
  isCurrent: boolean | null;
  startDate: string | null;
  cia: {
    statementId: string;
    objectValue: string | null;
    sourceUrl: string | null;
    sourceLicense: string | null;
    retrievedAt: string | Date | null;
  } | null;
}

export interface RosterStatementState {
  id: string;
  objectValue: string | null;
  sourceHash: string | null;
  sourceUrl: string | null;
  sourceLicense: string | null;
}

export interface CountryRosterState {
  offices: RosterStateOffice[];
  /** Terms on every CIA-typed office of the executive body. */
  terms: RosterStateTerm[];
  rosterStatement: RosterStatementState | null;
}

export interface PlannedOfficeWrite {
  kind: "release" | "move" | "insert";
  officeId: string;
  name: string;
  officeType: string;
  displayOrder: number | null;
  isElected: boolean;
}

export interface PlannedStatementWrite {
  kind: "insert" | "update";
  termId: string;
  objectValue: string;
}

export interface PlannedRosterStatementWrite {
  kind: "insert" | "update";
  objectValue: string;
  sourceHash: string;
}

export type RosterGuardFailure =
  | "office_identity_conflict"
  | "roster_contraction_guard"
  | "roster_stamp_regressed";

export interface CountryRosterPlan {
  guard: RosterGuardFailure | null;
  officeWrites: PlannedOfficeWrite[];
  personInserts: RosterHolder[];
  termInserts: Array<{ termId: string; officeId: string; personId: string }>;
  termsReinstated: string[];
  termsRetired: string[];
  statementWrites: PlannedStatementWrite[];
  rosterStatement: PlannedRosterStatementWrite | null;
  /** Listed titles and their resolved office ids, for the batch assertion. */
  listedOffices: Array<{ officeId: string; name: string; displayOrder: number }>;
  releasedOfficeIds: string[];
  rosterStampMissing: boolean;
  mutationCount: number;
}

export interface CountryRosterInput {
  titles: RosterTitle[];
  /** ISO roster date parsed from the page, or null when absent/unparseable. */
  rosterStamp: string | null;
  rosterHash: string;
  sourceUrl: string;
  state: CountryRosterState;
  /** Allocates UUIDs for new offices and terms (injected for determinism). */
  newId: () => string;
}

/** Stored list positions below this share of the new roster size are treated
 * as a probable partial parse rather than a real cabinet contraction. */
const CONTRACTION_MIN_RATIO = 0.4;
const CONTRACTION_MIN_LISTED = 8;

function emptyPlan(guard: RosterGuardFailure): CountryRosterPlan {
  return {
    guard,
    officeWrites: [],
    personInserts: [],
    termInserts: [],
    termsReinstated: [],
    termsRetired: [],
    statementWrites: [],
    rosterStatement: null,
    listedOffices: [],
    releasedOfficeIds: [],
    rosterStampMissing: false,
    mutationCount: 0,
  };
}

/**
 * Pure reconciliation of one country's stored cabinet with its latest CIA
 * roster. Writes nothing; the caller executes the returned plan atomically.
 *
 * - Every listed title resolves to one CIA-typed office (exact title), or a
 *   new office. A title that also names a head or other non-roster office in
 *   the executive body fails closed.
 * - Offices the roster no longer lists release their list position; their
 *   current holders become former holders.
 * - Current holders of each listed title become exactly the listed people.
 *   Existing rows are reused by `(office, person)` identity and never
 *   duplicated; stored start dates are never written.
 */
export function planCountryRoster(input: CountryRosterInput): CountryRosterPlan {
  const { state, titles } = input;
  const provenanceOffices = new Set(
    state.terms.filter((term) => term.cia !== null).map((term) => term.officeId),
  );
  const ciaTyped = state.offices.filter((office) =>
    isCiaRosterOfficeType(office.officeType),
  );
  const owned = ciaTyped.filter((office) =>
    isCiaOwnedOffice({
      officeType: office.officeType,
      displayOrder: office.displayOrder,
      hasCiaProvenance: provenanceOffices.has(office.id),
    }),
  );

  // ── Guards ────────────────────────────────────────────────────────────────
  const titleSet = new Set(titles.map((title) => title.title));
  for (const office of state.offices) {
    if (!isCiaRosterOfficeType(office.officeType) && titleSet.has(office.name)) {
      return emptyPlan("office_identity_conflict");
    }
  }
  const matchedByTitle = new Map<string, RosterStateOffice>();
  for (const office of ciaTyped) {
    if (!titleSet.has(office.name)) continue;
    if (matchedByTitle.has(office.name)) {
      return emptyPlan("office_identity_conflict");
    }
    matchedByTitle.set(office.name, office);
  }

  const storedStamp = state.rosterStatement?.objectValue ?? null;
  if (
    input.rosterStamp !== null &&
    storedStamp !== null &&
    input.rosterStamp < storedStamp
  ) {
    return emptyPlan("roster_stamp_regressed");
  }

  const currentlyListed = owned.filter((office) => office.displayOrder !== null);
  const toRelease = owned.filter(
    (office) => office.displayOrder !== null && !titleSet.has(office.name),
  );
  if (
    (currentlyListed.length >= 3 && titles.length === 0) ||
    (currentlyListed.length >= CONTRACTION_MIN_LISTED &&
      titles.length < currentlyListed.length * CONTRACTION_MIN_RATIO) ||
    (storedStamp !== null &&
      input.rosterStamp !== null &&
      input.rosterStamp === storedStamp &&
      toRelease.length > Math.max(3, currentlyListed.length * 0.5))
  ) {
    return emptyPlan("roster_contraction_guard");
  }

  // ── Office phase ──────────────────────────────────────────────────────────
  const officeWrites: PlannedOfficeWrite[] = [];
  const releasedOfficeIds: string[] = [];
  for (const office of toRelease) {
    officeWrites.push({
      kind: "release",
      officeId: office.id,
      name: office.name,
      officeType: office.officeType,
      displayOrder: null,
      isElected: office.isElected ?? false,
    });
    releasedOfficeIds.push(office.id);
  }
  const listedOffices: CountryRosterPlan["listedOffices"] = [];
  const officeIdByTitle = new Map<string, string>();
  for (const title of titles) {
    const existing = matchedByTitle.get(title.title);
    if (existing) {
      officeIdByTitle.set(title.title, existing.id);
      if (
        existing.displayOrder !== title.firstOrder ||
        existing.officeType !== title.officeType
      ) {
        officeWrites.push({
          kind: "move",
          officeId: existing.id,
          name: existing.name,
          officeType: title.officeType,
          displayOrder: title.firstOrder,
          isElected: existing.isElected ?? false,
        });
      }
    } else {
      const officeId = input.newId();
      officeIdByTitle.set(title.title, officeId);
      officeWrites.push({
        kind: "insert",
        officeId,
        name: title.title,
        officeType: title.officeType,
        displayOrder: title.firstOrder,
        isElected: false,
      });
    }
    listedOffices.push({
      officeId: officeIdByTitle.get(title.title) as string,
      name: title.title,
      displayOrder: title.firstOrder,
    });
  }

  // ── Term + statement phase ────────────────────────────────────────────────
  const termsByOffice = new Map<string, RosterStateTerm[]>();
  for (const term of state.terms) {
    const list = termsByOffice.get(term.officeId) ?? [];
    list.push(term);
    termsByOffice.set(term.officeId, list);
  }
  const rankable = (term: RosterStateTerm): RosterStateTerm & CabinetTermRankInput => ({
    ...term,
    hasCiaStatement: term.cia !== null,
    ciaStatementRetrievedAt: term.cia?.retrievedAt ?? null,
  });

  const personInserts = new Map<string, RosterHolder>();
  const termInserts: CountryRosterPlan["termInserts"] = [];
  const reinstated = new Set<string>();
  const retired = new Set<string>();
  const statementWrites: PlannedStatementWrite[] = [];

  for (const title of titles) {
    const officeId = officeIdByTitle.get(title.title) as string;
    const officeTerms = termsByOffice.get(officeId) ?? [];
    const byPerson = new Map<string, RosterStateTerm[]>();
    for (const term of officeTerms) {
      const list = byPerson.get(term.personId) ?? [];
      list.push(term);
      byPerson.set(term.personId, list);
    }
    const survivors = new Set<string>();
    const listedPeople = new Set<string>();
    for (const holder of title.holders) {
      if (listedPeople.has(holder.personId)) continue;
      listedPeople.add(holder.personId);
      if (holder.isNew) personInserts.set(holder.personId, holder);
      const rows = byPerson.get(holder.personId) ?? [];
      const survivor = rankCabinetTerms(rows.map(rankable))[0];
      let termId: string;
      if (survivor) {
        termId = survivor.id;
        survivors.add(survivor.id);
        if (survivor.isCurrent !== true) reinstated.add(survivor.id);
      } else {
        termId = input.newId();
        termInserts.push({ termId, officeId, personId: holder.personId });
      }
      const current = survivor?.cia ?? null;
      if (!current) {
        statementWrites.push({ kind: "insert", termId, objectValue: title.title });
      } else if (
        current.objectValue !== title.title ||
        current.sourceUrl !== input.sourceUrl ||
        current.sourceLicense !== CIA_ROSTER_LICENSE
      ) {
        statementWrites.push({ kind: "update", termId, objectValue: title.title });
      }
    }
    for (const term of officeTerms) {
      if (term.isCurrent !== false && !survivors.has(term.id)) {
        retired.add(term.id);
      }
    }
  }
  for (const officeId of releasedOfficeIds) {
    for (const term of termsByOffice.get(officeId) ?? []) {
      if (term.isCurrent !== false) retired.add(term.id);
    }
  }
  // Owned offices that were already unlisted keep no current holders.
  for (const office of owned) {
    if (office.displayOrder !== null || titleSet.has(office.name)) continue;
    for (const term of termsByOffice.get(office.id) ?? []) {
      if (term.isCurrent !== false) retired.add(term.id);
    }
  }

  // ── Roster statement ──────────────────────────────────────────────────────
  let rosterStatement: PlannedRosterStatementWrite | null = null;
  const rosterStampMissing = input.rosterStamp === null;
  if (input.rosterStamp !== null) {
    const stored = state.rosterStatement;
    if (!stored) {
      rosterStatement = {
        kind: "insert",
        objectValue: input.rosterStamp,
        sourceHash: input.rosterHash,
      };
    } else if (
      stored.objectValue !== input.rosterStamp ||
      stored.sourceHash !== input.rosterHash ||
      stored.sourceUrl !== input.sourceUrl ||
      stored.sourceLicense !== CIA_ROSTER_LICENSE
    ) {
      rosterStatement = {
        kind: "update",
        objectValue: input.rosterStamp,
        sourceHash: input.rosterHash,
      };
    }
  }

  const termsReinstated = [...reinstated].sort();
  const termsRetired = [...retired].filter((id) => !reinstated.has(id)).sort();
  const mutationCount =
    officeWrites.length +
    personInserts.size +
    termInserts.length +
    termsReinstated.length +
    termsRetired.length +
    statementWrites.length +
    (rosterStatement ? 1 : 0);
  return {
    guard: null,
    officeWrites,
    personInserts: [...personInserts.values()],
    termInserts,
    termsReinstated,
    termsRetired,
    statementWrites,
    rosterStatement,
    listedOffices,
    releasedOfficeIds,
    rosterStampMissing,
    mutationCount,
  };
}
