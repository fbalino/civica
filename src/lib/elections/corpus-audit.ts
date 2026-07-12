/**
 * Pure, deterministic election-corpus qualification contract.
 *
 * The audit intentionally does not repair records. It normalizes only the two
 * election families the Atlas supports and makes every other uncertainty
 * visible as an issue or a quarantined row.
 */

export const ELECTION_CORPUS_AUDIT_VERSION =
  "election-corpus-audit/v1" as const;

export type ElectionFamily = "legislative" | "presidential";
export type ElectionDateBasis =
  "source_confirmed" | "derived_term_projection" | "unknown";
export type ElectionTemporalClass =
  "historical" | "source_dated_upcoming" | "projection_due" | "unknown";
export type ElectionRowDisposition =
  "qualified_event" | "qualified_contest" | "projection_only" | "quarantined";

export type ElectionAuditIssueCode =
  | "MISSING_EVENT_PROVENANCE"
  | "MISSING_DATE_CONFIDENCE"
  | "UNSUPPORTED_ELECTION_TYPE"
  | "SUBNATIONAL_MARKER"
  | "NAME_DATE_YEAR_MISMATCH"
  | "JANUARY_FIRST_YEAR_PRECISION_SUSPECTED"
  | "IMPRECISE_SOURCE_DATE"
  | "CANCELLED_POSTPONED_OR_ANNULLED"
  | "NON_NATIONAL_EXECUTIVE_SELECTION"
  | "OUT_OF_SCOPE_JURISDICTION"
  | "MISSING_JURISDICTION_IDENTITY_EVIDENCE"
  | "JURISDICTION_IDENTITY_MISMATCH"
  | "MISSING_EVENT_STATUS_ASSESSMENT"
  | "UNRESOLVED_IDENTITY_LABEL"
  | "UNSOURCED_TURNOUT"
  | "UNSOURCED_RESULTS"
  | "LICENSE_MISMATCH"
  | "EVENT_DISPLAY_RIGHTS_BLOCKED"
  | "UNKNOWN_SOURCE"
  | "STALE_UPCOMING_EVIDENCE"
  | "EXACT_DUPLICATE"
  | "CONTEST_KEY_COLLISION";

export interface ElectionAuditSource {
  id: string;
  license: string | null;
  retrievedAt: string | null;
}

export interface ElectionAuditRights {
  sourceId: string;
  expectedLicense: string;
  reviewStatus: "verified" | "pending";
  publicDisplay: boolean;
  mayUseTurnout: boolean;
  mayUseResults: boolean;
}

export interface ElectionAuditStatement {
  sourceId: string;
  statementId: string;
  sourceLicense: string | null;
  retrievedAt: string | null;
}

export interface ElectionStatementProvenance {
  event?: ElectionAuditStatement | null;
  turnout?: ElectionAuditStatement | null;
  results?: ElectionAuditStatement | null;
}

export interface ElectionJurisdictionIdentityEvidence {
  basis:
    "wikidata_p17" | "ipu_election_code" | "ipu_chamber_code" | "unavailable";
  sourceId: string | null;
  sourceRecordId: string | null;
  expectedJurisdictionId: string | null;
  observedJurisdictionIds: string[];
  status: "matched" | "missing" | "mismatch";
}

export interface ElectionCorpusRow {
  id: string;
  jurisdictionId: string;
  jurisdictionSlug: string;
  jurisdictionStatus: string;
  includeInElectionScope: boolean;
  electionType: string | null;
  electionName: string | null;
  electionDate: string | null;
  dateConfidence: string | null;
  datePrecision?: "day" | "month" | "year" | "unknown" | null;
  dateRole?:
    "election_day" | "point_in_time" | "derived_due_date" | "unknown" | null;
  sourceEventStatus?:
    | "held"
    | "source_dated"
    | "tentative"
    | "postponed"
    | "cancelled"
    | "annulled"
    | "unknown"
    | null;
  bodyId?: string | null;
  chamber?: string | null;
  isSubnational?: boolean;
  isNationalExecutiveSelection?: boolean | null;
  turnoutPercent?: number | null;
  results?: readonly unknown[] | null;
  provenance?: ElectionStatementProvenance | null;
  jurisdictionIdentity?: ElectionJurisdictionIdentityEvidence | null;
}

export interface ElectionCorpusAuditInput {
  rows: readonly ElectionCorpusRow[];
  sources: readonly ElectionAuditSource[];
  rights: readonly ElectionAuditRights[];
  /** ISO date, fixed by the caller so output never depends on wall-clock time. */
  asOf: string;
  /** Maximum age of evidence for a source-confirmed future election. */
  upcomingFreshnessDays: number;
}

export interface ElectionFieldEligibility {
  turnout: boolean;
  results: boolean;
}

export interface ElectionFieldEvidence {
  sourceId: string;
  license: string | null;
  retrievedAt: string | null;
  rightsReview: "verified" | "pending" | "unknown";
}

export interface AuditedElectionRow {
  inputIndex: number;
  rowId: string;
  electionDate: string | null;
  normalizedType: ElectionFamily | null;
  dateBasis: ElectionDateBasis;
  datePrecision: "day" | "month" | "year" | "unknown";
  dateRole: "election_day" | "point_in_time" | "derived_due_date" | "unknown";
  sourceEventStatus:
    | "held"
    | "source_dated"
    | "tentative"
    | "postponed"
    | "cancelled"
    | "annulled"
    | "unknown";
  temporalClass: ElectionTemporalClass;
  disposition: ElectionRowDisposition;
  conceptualEventKey: string | null;
  chamberContestKey: string | null;
  primaryRowId: string | null;
  relatedContestRowIds: string[];
  jurisdiction: {
    id: string;
    slug: string;
    status: string;
    inScope: boolean;
  };
  jurisdictionIdentity: ElectionJurisdictionIdentityEvidence | null;
  evidence: {
    sourceId: string | null;
    license: string | null;
    retrievedAt: string | null;
    ageDays: number | null;
    freshness: "current" | "stale" | "unknown";
    rightsReview: "verified" | "pending" | "unknown";
    publicDisplay: boolean;
  };
  fieldEligibility: ElectionFieldEligibility;
  fieldEvidence: {
    turnout: ElectionFieldEvidence | null;
    results: ElectionFieldEvidence | null;
  };
  issueCodes: ElectionAuditIssueCode[];
}

export interface ElectionCorpusAuditResult {
  version: typeof ELECTION_CORPUS_AUDIT_VERSION;
  asOf: string;
  inputRowCount: number;
  accountedRowCount: number;
  rows: AuditedElectionRow[];
  groups: Array<{
    conceptualEventKey: string;
    primaryRowId: string;
    relatedContestRowIds: string[];
  }>;
  issueCounts: Partial<Record<ElectionAuditIssueCode, number>>;
  dispositionCounts: Record<ElectionRowDisposition, number>;
}

const FATAL_ISSUES = new Set<ElectionAuditIssueCode>([
  "MISSING_EVENT_PROVENANCE",
  "MISSING_DATE_CONFIDENCE",
  "UNSUPPORTED_ELECTION_TYPE",
  "SUBNATIONAL_MARKER",
  "NAME_DATE_YEAR_MISMATCH",
  "JANUARY_FIRST_YEAR_PRECISION_SUSPECTED",
  "IMPRECISE_SOURCE_DATE",
  "CANCELLED_POSTPONED_OR_ANNULLED",
  "NON_NATIONAL_EXECUTIVE_SELECTION",
  "OUT_OF_SCOPE_JURISDICTION",
  "MISSING_JURISDICTION_IDENTITY_EVIDENCE",
  "JURISDICTION_IDENTITY_MISMATCH",
  "MISSING_EVENT_STATUS_ASSESSMENT",
  "UNRESOLVED_IDENTITY_LABEL",
  "LICENSE_MISMATCH",
  "EVENT_DISPLAY_RIGHTS_BLOCKED",
  "UNKNOWN_SOURCE",
  "STALE_UPCOMING_EVIDENCE",
  "EXACT_DUPLICATE",
  "CONTEST_KEY_COLLISION",
]);

function isoDay(value: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const milliseconds = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isFinite(milliseconds)
    ? Math.floor(milliseconds / 86_400_000)
    : null;
}

function normalizedFamily(value: string | null): ElectionFamily | null {
  const normalized = value?.trim().toLowerCase();
  return normalized === "legislative" || normalized === "presidential"
    ? normalized
    : null;
}

function normalizedPart(value: string | null | undefined): string {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function addIssue(
  row: AuditedElectionRow,
  issue: ElectionAuditIssueCode,
): void {
  if (!row.issueCodes.includes(issue)) row.issueCodes.push(issue);
}

function eventYearFromName(name: string | null): number | null {
  const years = name?.match(/(?:^|\D)((?:19|20)\d{2})(?!\d)/g) ?? [];
  if (years.length !== 1) return null;
  const match = years[0].match(/(?:19|20)\d{2}/);
  return match ? Number(match[0]) : null;
}

function dispositionRank(row: AuditedElectionRow): string {
  const confirmed = row.dateBasis === "source_confirmed" ? "0" : "1";
  const contest = row.chamberContestKey?.split("|").at(-1) ?? "";
  return `${confirmed}|${contest}|${row.rowId}`;
}

/** Audit every supplied row exactly once, retaining the caller's input order. */
export function auditElectionCorpus(
  input: ElectionCorpusAuditInput,
): ElectionCorpusAuditResult {
  const asOfDay = isoDay(input.asOf);
  if (asOfDay === null) throw new Error("asOf must be an ISO calendar date");
  if (
    !Number.isInteger(input.upcomingFreshnessDays) ||
    input.upcomingFreshnessDays < 0
  ) {
    throw new Error("upcomingFreshnessDays must be a non-negative integer");
  }

  const sourceById = new Map(
    input.sources.map((source) => [source.id, source]),
  );
  const rightsById = new Map(
    input.rights.map((rights) => [rights.sourceId, rights]),
  );

  const rows: AuditedElectionRow[] = input.rows.map((sourceRow, inputIndex) => {
    const family = normalizedFamily(sourceRow.electionType);
    const dateDay = sourceRow.electionDate
      ? isoDay(sourceRow.electionDate)
      : null;
    const confidence = sourceRow.dateConfidence?.trim().toLowerCase() ?? "";
    const dateBasis: ElectionDateBasis =
      confidence === "confirmed" || confidence === "source_confirmed"
        ? "source_confirmed"
        : confidence === "estimated" || confidence === "derived_term_projection"
          ? "derived_term_projection"
          : "unknown";
    const eventStatement = sourceRow.provenance?.event ?? null;
    const eventSourceId = eventStatement?.sourceId ?? null;
    const source = eventSourceId ? sourceById.get(eventSourceId) : undefined;
    const rights = eventSourceId ? rightsById.get(eventSourceId) : undefined;
    const retrievedAt =
      eventStatement?.retrievedAt ?? source?.retrievedAt ?? null;
    const retrievedDay = retrievedAt ? isoDay(retrievedAt.slice(0, 10)) : null;
    const ageDays =
      retrievedDay === null ? null : Math.max(0, asOfDay - retrievedDay);
    const temporalClass: ElectionTemporalClass =
      dateDay === null
        ? "unknown"
        : dateDay <= asOfDay
          ? "historical"
          : dateBasis === "source_confirmed"
            ? "source_dated_upcoming"
            : dateBasis === "derived_term_projection"
              ? "projection_due"
              : "unknown";
    const datePrecision = sourceRow.datePrecision ?? "unknown";
    const dateRole =
      sourceRow.dateRole ??
      (dateBasis === "derived_term_projection"
        ? "derived_due_date"
        : dateBasis === "source_confirmed"
          ? "point_in_time"
          : "unknown");
    const sourceEventStatus = sourceRow.sourceEventStatus ?? "unknown";
    const eventKey =
      family && sourceRow.electionDate
        ? `${sourceRow.jurisdictionId}|${family}|${sourceRow.electionDate}`
        : null;
    const chamberIdentity =
      normalizedPart(sourceRow.bodyId) || normalizedPart(sourceRow.chamber);
    const contestKey = eventKey
      ? `${eventKey}|${family === "legislative" ? chamberIdentity || "unspecified-chamber" : "office"}`
      : null;

    const audited: AuditedElectionRow = {
      inputIndex,
      rowId: sourceRow.id,
      electionDate: sourceRow.electionDate,
      normalizedType: family,
      dateBasis,
      datePrecision,
      dateRole,
      sourceEventStatus,
      temporalClass,
      disposition: "quarantined",
      conceptualEventKey: eventKey,
      chamberContestKey: contestKey,
      primaryRowId: null,
      relatedContestRowIds: [],
      jurisdiction: {
        id: sourceRow.jurisdictionId,
        slug: sourceRow.jurisdictionSlug,
        status: sourceRow.jurisdictionStatus,
        inScope: sourceRow.includeInElectionScope,
      },
      jurisdictionIdentity: sourceRow.jurisdictionIdentity ?? null,
      evidence: {
        sourceId: eventSourceId,
        license: source?.license ?? null,
        retrievedAt,
        ageDays,
        freshness:
          ageDays === null
            ? "unknown"
            : ageDays <= input.upcomingFreshnessDays
              ? "current"
              : "stale",
        rightsReview: rights?.reviewStatus ?? "unknown",
        publicDisplay: Boolean(rights?.publicDisplay),
      },
      fieldEligibility: { turnout: false, results: false },
      fieldEvidence: { turnout: null, results: null },
      issueCodes: [],
    };

    if (!family) addIssue(audited, "UNSUPPORTED_ELECTION_TYPE");
    if (dateBasis === "unknown") addIssue(audited, "MISSING_DATE_CONFIDENCE");
    if (!sourceRow.provenance?.event?.statementId)
      addIssue(audited, "MISSING_EVENT_PROVENANCE");
    if (eventSourceId && !source) addIssue(audited, "UNKNOWN_SOURCE");
    if (
      source &&
      (!rights ||
        rights.expectedLicense !== source.license ||
        eventStatement?.sourceLicense !== source.license)
    ) {
      addIssue(audited, "LICENSE_MISMATCH");
    }
    if (rights && !rights.publicDisplay) {
      addIssue(audited, "EVENT_DISPLAY_RIGHTS_BLOCKED");
    }
    if (!sourceRow.includeInElectionScope)
      addIssue(audited, "OUT_OF_SCOPE_JURISDICTION");
    if (
      !sourceRow.jurisdictionIdentity ||
      sourceRow.jurisdictionIdentity.status === "missing"
    ) {
      addIssue(audited, "MISSING_JURISDICTION_IDENTITY_EVIDENCE");
    } else if (sourceRow.jurisdictionIdentity.status === "mismatch") {
      addIssue(audited, "JURISDICTION_IDENTITY_MISMATCH");
    }
    if (dateBasis === "source_confirmed" && sourceEventStatus === "unknown") {
      addIssue(audited, "MISSING_EVENT_STATUS_ASSESSMENT");
    }

    const lowerName = sourceRow.electionName?.toLowerCase() ?? "";
    if (
      sourceRow.isSubnational ||
      /\b(state|provincial|regional|municipal|local)\b/.test(lowerName)
    ) {
      addIssue(audited, "SUBNATIONAL_MARKER");
    }
    if (/\b(cancelled|canceled|postponed|annulled)\b/.test(lowerName)) {
      addIssue(audited, "CANCELLED_POSTPONED_OR_ANNULLED");
    }
    if (
      sourceEventStatus === "cancelled" ||
      sourceEventStatus === "postponed" ||
      sourceEventStatus === "annulled"
    ) {
      addIssue(audited, "CANCELLED_POSTPONED_OR_ANNULLED");
    }
    if (
      family === "presidential" &&
      sourceRow.isNationalExecutiveSelection === false
    ) {
      addIssue(audited, "NON_NATIONAL_EXECUTIVE_SELECTION");
    }
    if (/^q\d+$/i.test(sourceRow.electionName?.trim() ?? "")) {
      addIssue(audited, "UNRESOLVED_IDENTITY_LABEL");
    }
    const nameYear = eventYearFromName(sourceRow.electionName);
    if (
      nameYear &&
      sourceRow.electionDate &&
      nameYear !== Number(sourceRow.electionDate.slice(0, 4))
    ) {
      addIssue(audited, "NAME_DATE_YEAR_MISMATCH");
    }
    if (dateBasis === "source_confirmed" && datePrecision !== "day") {
      addIssue(audited, "IMPRECISE_SOURCE_DATE");
    } else if (
      sourceRow.electionDate?.endsWith("-01-01") &&
      datePrecision === "unknown" &&
      (dateBasis !== "source_confirmed" || /\b(?:19|20)\d{2}\b/.test(lowerName))
    ) {
      addIssue(audited, "JANUARY_FIRST_YEAR_PRECISION_SUSPECTED");
    }
    if (
      temporalClass === "source_dated_upcoming" &&
      (ageDays === null || ageDays > input.upcomingFreshnessDays)
    ) {
      addIssue(audited, "STALE_UPCOMING_EVIDENCE");
    }

    const turnoutPresent =
      sourceRow.turnoutPercent !== null &&
      sourceRow.turnoutPercent !== undefined;
    const resultsPresent = Boolean(sourceRow.results?.length);
    const turnoutStatement = sourceRow.provenance?.turnout;
    const resultsStatement = sourceRow.provenance?.results;
    if (turnoutPresent && !turnoutStatement?.statementId)
      addIssue(audited, "UNSOURCED_TURNOUT");
    if (resultsPresent && !resultsStatement?.statementId)
      addIssue(audited, "UNSOURCED_RESULTS");
    const fieldEligible = (
      statement: ElectionAuditStatement | null | undefined,
      kind: "turnout" | "results",
    ) => {
      if (!statement?.statementId) return false;
      const fieldSource = sourceById.get(statement.sourceId);
      const fieldRights = rightsById.get(statement.sourceId);
      if (!fieldSource || !fieldRights || !fieldRights.publicDisplay)
        return false;
      if (
        fieldSource.license !== fieldRights.expectedLicense ||
        statement.sourceLicense !== fieldSource.license
      ) {
        return false;
      }
      return kind === "turnout"
        ? fieldRights.mayUseTurnout
        : fieldRights.mayUseResults;
    };
    audited.fieldEligibility.turnout =
      turnoutPresent && fieldEligible(turnoutStatement, "turnout");
    audited.fieldEligibility.results =
      resultsPresent && fieldEligible(resultsStatement, "results");
    const fieldEvidence = (
      statement: ElectionAuditStatement | null | undefined,
    ): ElectionFieldEvidence | null => {
      if (!statement?.statementId) return null;
      const fieldSource = sourceById.get(statement.sourceId);
      const fieldRights = rightsById.get(statement.sourceId);
      return {
        sourceId: statement.sourceId,
        license: fieldSource?.license ?? null,
        retrievedAt: statement.retrievedAt,
        rightsReview: fieldRights?.reviewStatus ?? "unknown",
      };
    };
    audited.fieldEvidence.turnout = fieldEvidence(turnoutStatement);
    audited.fieldEvidence.results = fieldEvidence(resultsStatement);

    return audited;
  });

  const eventGroups = new Map<string, AuditedElectionRow[]>();
  const contestGroups = new Map<string, AuditedElectionRow[]>();
  for (const row of rows) {
    if (row.conceptualEventKey) {
      const group = eventGroups.get(row.conceptualEventKey) ?? [];
      group.push(row);
      eventGroups.set(row.conceptualEventKey, group);
    }
    if (row.chamberContestKey) {
      const group = contestGroups.get(row.chamberContestKey) ?? [];
      group.push(row);
      contestGroups.set(row.chamberContestKey, group);
    }
  }

  for (const contestRows of contestGroups.values()) {
    if (contestRows.length < 2) continue;
    const sorted = [...contestRows].sort((a, b) =>
      dispositionRank(a).localeCompare(dispositionRank(b)),
    );
    const firstInput = input.rows[sorted[0].inputIndex];
    const signature = (row: ElectionCorpusRow) =>
      JSON.stringify([
        row.electionName,
        row.turnoutPercent,
        row.results ?? null,
        row.provenance ?? null,
      ]);
    const baseline = signature(firstInput);
    for (const duplicate of sorted.slice(1)) {
      addIssue(
        duplicate,
        signature(input.rows[duplicate.inputIndex]) === baseline
          ? "EXACT_DUPLICATE"
          : "CONTEST_KEY_COLLISION",
      );
    }
  }

  // A general/unscoped legislative row colliding with body-specific contests
  // is not another chamber. Preserve it in the audit, but keep it out of the
  // public event selection until its identity is reconciled.
  for (const eventRows of eventGroups.values()) {
    const hasSpecificContest = eventRows.some(
      (row) =>
        row.normalizedType === "legislative" &&
        !row.chamberContestKey?.endsWith("|unspecified-chamber"),
    );
    if (!hasSpecificContest) continue;
    for (const row of eventRows) {
      if (row.chamberContestKey?.endsWith("|unspecified-chamber")) {
        addIssue(row, "CONTEST_KEY_COLLISION");
      }
    }
  }

  const groups = [...eventGroups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([conceptualEventKey, eventRows]) => {
      const eligible = eventRows.filter(
        (row) => !row.issueCodes.some((issue) => FATAL_ISSUES.has(issue)),
      );
      const ranked = [...eligible].sort((a, b) =>
        dispositionRank(a).localeCompare(dispositionRank(b)),
      );
      const primary =
        ranked[0] ??
        [...eventRows].sort((a, b) => a.rowId.localeCompare(b.rowId))[0];
      const related = ranked
        .slice(1)
        .map((row) => row.rowId)
        .sort();
      for (const row of eventRows) {
        row.primaryRowId = primary.rowId;
        row.relatedContestRowIds = related;
        if (row.issueCodes.some((issue) => FATAL_ISSUES.has(issue))) {
          row.disposition = "quarantined";
        } else if (row.temporalClass === "projection_due") {
          row.disposition = "projection_only";
        } else if (row.rowId === primary.rowId) {
          row.disposition = "qualified_event";
        } else {
          row.disposition = "qualified_contest";
        }
      }
      return {
        conceptualEventKey,
        primaryRowId: primary.rowId,
        relatedContestRowIds: related,
      };
    });

  // Rows without a usable conceptual key are still explicitly accounted for.
  for (const row of rows) {
    if (!row.conceptualEventKey) row.disposition = "quarantined";
    row.issueCodes.sort();
  }

  const issueCounts: Partial<Record<ElectionAuditIssueCode, number>> = {};
  const dispositionCounts: Record<ElectionRowDisposition, number> = {
    qualified_event: 0,
    qualified_contest: 0,
    projection_only: 0,
    quarantined: 0,
  };
  for (const row of rows) {
    dispositionCounts[row.disposition] += 1;
    for (const issue of row.issueCodes)
      issueCounts[issue] = (issueCounts[issue] ?? 0) + 1;
  }

  if (rows.length !== input.rows.length)
    throw new Error("Election audit failed row accounting");
  return {
    version: ELECTION_CORPUS_AUDIT_VERSION,
    asOf: input.asOf,
    inputRowCount: input.rows.length,
    accountedRowCount: rows.length,
    rows,
    groups,
    issueCounts,
    dispositionCounts,
  };
}
