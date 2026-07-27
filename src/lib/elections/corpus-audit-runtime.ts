import artifact from "./corpus-audit.generated.json";
import type {
  AuditedElectionRow,
  ElectionAuditIssueCode,
  ElectionRowDisposition,
} from "./corpus-audit";

export type ElectionCorpusAuditArtifact = {
  schemaVersion: "election-corpus-audit/v1";
  generatedAt: string;
  asOf: string;
  baseline: {
    expectedRows: number;
    observedRows: number;
    fingerprintSha256: string;
    jurisdictionIdentityRowsSha256: string;
    rule: string;
  };
  rowContentFingerprints: Record<string, string>;
  raw: {
    rows: number;
    jurisdictions: number;
    sovereignRows: number;
    sovereignJurisdictions: number;
    historicalRows: number;
    futureRows: number;
    projectionRows: number;
    turnoutRows: number;
    resultRows: number;
    statements: number;
    statementsWithSourceHash: number;
  };
  sourceRights: Array<{
    sourceId: string;
    statementLicense: string;
    reviewStatus: "verified" | "pending";
    publicExport:
      "allowed" | "non-commercial-only" | "blocked" | "pending-review";
    lastSyncAt: string | null;
  }>;
  qualified: {
    conceptualEvents: number;
    contestRows: number;
    jurisdictions: number;
    sovereignJurisdictions: number;
    limitedRecognitionJurisdictions: number;
    legislativeJurisdictions: number;
    presidentialJurisdictions: number;
    historicalEvents: number;
    sourceDatedUpcomingEvents: number;
    projectionGroups: number;
    quarantinedRows: number;
    turnoutEligibleRows: number;
    resultEligibleRows: number;
  };
  dispositionCounts: Record<ElectionRowDisposition, number>;
  issueCounts: Partial<Record<ElectionAuditIssueCode, number>>;
  rows: AuditedElectionRow[];
};

export const ELECTION_CORPUS_AUDIT =
  artifact as unknown as ElectionCorpusAuditArtifact;

const rowById = new Map(
  ELECTION_CORPUS_AUDIT.rows.map((row) => [row.rowId, row]),
);

export function getElectionAuditRow(id: string) {
  return rowById.get(id) ?? null;
}

export function matchesAuditedElectionContent(
  id: string,
  liveFingerprint: string | null | undefined,
) {
  return Boolean(
    liveFingerprint &&
    ELECTION_CORPUS_AUDIT.rowContentFingerprints[id] === liveFingerprint,
  );
}

export function isAuditedPublicElection(
  id: string,
  liveFingerprint: string | null | undefined,
) {
  const row = getElectionAuditRow(id);
  return Boolean(
    row &&
    matchesAuditedElectionContent(id, liveFingerprint) &&
    (row.disposition === "qualified_event" ||
      row.disposition === "qualified_contest"),
  );
}

export function isAuditedProjection(
  id: string,
  liveFingerprint: string | null | undefined,
) {
  return Boolean(
    matchesAuditedElectionContent(id, liveFingerprint) &&
    getElectionAuditRow(id)?.disposition === "projection_only",
  );
}

export function isPrimaryElectionEvent(id: string) {
  const row = getElectionAuditRow(id);
  return Boolean(row && row.primaryRowId === row.rowId);
}

/**
 * Public projections deliberately suppress day-level precision. Multiple
 * chamber-derived rows can therefore describe the same country's next
 * legislative estimate even when their computed dates or years differ. The
 * public calendar shows the earliest such estimate; country records retain
 * every audited row. This key prevents unlabeled chamber duplicates.
 */
export function getElectionPublicFutureKey(id: string) {
  const row = getElectionAuditRow(id);
  if (!row) return null;
  if (row.temporalClass === "projection_due") {
    return [row.jurisdiction.id, row.normalizedType, "projection"].join("|");
  }
  return row.conceptualEventKey;
}

export function getElectionProjectionDisplayGroupCount() {
  return new Set(
    ELECTION_CORPUS_AUDIT.rows
      .filter((row) => row.disposition === "projection_only")
      .map((row) =>
        [row.jurisdiction.id, row.normalizedType, "projection"].join("|"),
      ),
  ).size;
}

export function isEligibleElectionField(
  id: string,
  field: "turnout" | "results",
) {
  return Boolean(getElectionAuditRow(id)?.fieldEligibility[field]);
}
