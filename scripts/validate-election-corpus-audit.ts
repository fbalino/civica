import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

import artifact from "../src/lib/elections/corpus-audit.generated.json";
import jurisdictionIdentity from "../src/lib/elections/jurisdiction-identity.generated.json";
import { stableStringify } from "../src/lib/data/frozen-vintage";
import {
  ELECTION_CORPUS_AUDIT_VERSION,
  type ElectionAuditIssueCode,
  type ElectionRowDisposition,
} from "../src/lib/elections/corpus-audit";

const EXPECTED_ROWS = 915;
const errors: string[] = [];
const report = artifact as typeof artifact & {
  dispositionCounts: Record<ElectionRowDisposition, number>;
  issueCounts: Partial<Record<ElectionAuditIssueCode, number>>;
};

const publicDisposition = (disposition: string) =>
  disposition === "qualified_event" || disposition === "qualified_contest";
const sha256 = (value: unknown) =>
  createHash("sha256").update(stableStringify(value)).digest("hex");

if (report.schemaVersion !== ELECTION_CORPUS_AUDIT_VERSION)
  errors.push("schema version drift");
if (report.baseline.expectedRows !== EXPECTED_ROWS)
  errors.push("expected baseline row count drift");
if (
  report.baseline.observedRows !== EXPECTED_ROWS ||
  report.raw.rows !== EXPECTED_ROWS ||
  report.rows.length !== EXPECTED_ROWS
)
  errors.push("not every baseline row is represented");
if (!/^[a-f0-9]{64}$/.test(report.baseline.fingerprintSha256))
  errors.push("baseline fingerprint is invalid");
if (!/^\d{4}-\d{2}-\d{2}$/.test(report.asOf))
  errors.push("as-of date is invalid");
if (!Number.isFinite(new Date(report.generatedAt).getTime()))
  errors.push("generatedAt is invalid");

const ids = new Set(report.rows.map((row) => row.rowId));
if (ids.size !== EXPECTED_ROWS) errors.push("row ids are not unique");
const rowContentFingerprints = report.rowContentFingerprints as Record<
  string,
  string
>;
const fingerprintIds = Object.keys(rowContentFingerprints);
if (
  fingerprintIds.length !== EXPECTED_ROWS ||
  fingerprintIds.some(
    (id) => !ids.has(id) || !/^[a-f0-9]{64}$/.test(rowContentFingerprints[id]),
  )
) {
  errors.push("row-content fingerprints do not cover the baseline exactly");
}
if (
  report.baseline.jurisdictionIdentityRowsSha256 !==
  sha256(jurisdictionIdentity.rows)
) {
  errors.push("jurisdiction-identity artifact hash does not match the audit");
}
const rowById = new Map(report.rows.map((row) => [row.rowId, row]));
const dispositions: Record<ElectionRowDisposition, number> = {
  qualified_event: 0,
  qualified_contest: 0,
  projection_only: 0,
  quarantined: 0,
};
const issues: Partial<Record<ElectionAuditIssueCode, number>> = {};
for (const row of report.rows) {
  const disposition = row.disposition as ElectionRowDisposition;
  dispositions[disposition] += 1;
  if (!row.conceptualEventKey && row.disposition !== "quarantined")
    errors.push(`${row.rowId} lacks a conceptual event key but is public`);
  if (
    row.disposition === "projection_only" &&
    row.temporalClass !== "projection_due"
  )
    errors.push(
      `${row.rowId} is a projection without projection temporal state`,
    );
  if (
    (row.disposition === "qualified_event" ||
      row.disposition === "qualified_contest") &&
    (!row.evidence.sourceId ||
      !row.evidence.license ||
      !row.evidence.retrievedAt)
  )
    errors.push(`${row.rowId} is qualified without complete event evidence`);
  if (
    publicDisposition(row.disposition) &&
    row.jurisdictionIdentity?.status !== "matched"
  )
    errors.push(
      `${row.rowId} is qualified without matching publisher identity`,
    );
  if (publicDisposition(row.disposition) && row.sourceEventStatus === "unknown")
    errors.push(`${row.rowId} is qualified without an event-status assessment`);
  for (const issue of row.issueCodes as ElectionAuditIssueCode[])
    issues[issue] = (issues[issue] ?? 0) + 1;
}
if (JSON.stringify(dispositions) !== JSON.stringify(report.dispositionCounts))
  errors.push("disposition counts do not reproduce");
if (JSON.stringify(issues) !== JSON.stringify(report.issueCounts))
  errors.push("issue counts do not reproduce");
if (
  Object.values(dispositions).reduce((sum, count) => sum + count, 0) !==
  EXPECTED_ROWS
)
  errors.push("dispositions do not account for every row");

const groupKeys = new Set<string>();
const groupedRowIds = new Set<string>();
for (const group of report.groups) {
  if (groupKeys.has(group.conceptualEventKey))
    errors.push(`duplicate conceptual group ${group.conceptualEventKey}`);
  groupKeys.add(group.conceptualEventKey);

  const primary = rowById.get(group.primaryRowId);
  if (!primary) {
    errors.push(
      `${group.conceptualEventKey} references missing primary ${group.primaryRowId}`,
    );
    continue;
  }
  if (primary.conceptualEventKey !== group.conceptualEventKey)
    errors.push(`${group.conceptualEventKey} primary belongs to another group`);
  if (primary.primaryRowId !== group.primaryRowId)
    errors.push(
      `${group.conceptualEventKey} primary row does not identify itself`,
    );

  const relatedIds = new Set(group.relatedContestRowIds);
  if (relatedIds.size !== group.relatedContestRowIds.length)
    errors.push(`${group.conceptualEventKey} repeats a related row`);
  if (relatedIds.has(group.primaryRowId))
    errors.push(`${group.conceptualEventKey} lists its primary as related`);

  const expectedRelated = report.rows
    .filter(
      (row) =>
        row.conceptualEventKey === group.conceptualEventKey &&
        row.rowId !== group.primaryRowId &&
        row.disposition !== "quarantined",
    )
    .map((row) => row.rowId)
    .sort();
  if (
    JSON.stringify([...relatedIds].sort()) !== JSON.stringify(expectedRelated)
  )
    errors.push(`${group.conceptualEventKey} related rows do not reproduce`);

  for (const row of report.rows.filter(
    (candidate) => candidate.conceptualEventKey === group.conceptualEventKey,
  )) {
    if (groupedRowIds.has(row.rowId))
      errors.push(`${row.rowId} appears in more than one conceptual group`);
    groupedRowIds.add(row.rowId);
    if (row.primaryRowId !== group.primaryRowId)
      errors.push(`${row.rowId} disagrees with its group primary`);
    if (
      JSON.stringify([...row.relatedContestRowIds].sort()) !==
      JSON.stringify([...relatedIds].sort())
    )
      errors.push(`${row.rowId} disagrees with its group relations`);
  }

  for (const relatedId of relatedIds) {
    const related = rowById.get(relatedId);
    if (!related)
      errors.push(
        `${group.conceptualEventKey} references missing row ${relatedId}`,
      );
    else if (related.conceptualEventKey !== group.conceptualEventKey)
      errors.push(`${relatedId} is related across conceptual groups`);
  }
}
for (const row of report.rows) {
  if (row.conceptualEventKey && !groupedRowIds.has(row.rowId))
    errors.push(`${row.rowId} is missing from its conceptual group`);
}

const publicRows = report.rows.filter((row) =>
  publicDisposition(row.disposition),
);
const qualifiedGroups = report.groups.filter(
  (group) => rowById.get(group.primaryRowId)?.disposition === "qualified_event",
);
const setSize = (values: string[]) => new Set(values).size;
const recomputedQualified = {
  conceptualEvents: qualifiedGroups.length,
  contestRows: publicRows.length,
  jurisdictions: setSize(publicRows.map((row) => row.jurisdiction.id)),
  sovereignJurisdictions: setSize(
    publicRows
      .filter((row) => row.jurisdiction.status === "sovereign_state")
      .map((row) => row.jurisdiction.id),
  ),
  limitedRecognitionJurisdictions: setSize(
    publicRows
      .filter(
        (row) => row.jurisdiction.status === "disputed_or_limited_recognition",
      )
      .map((row) => row.jurisdiction.id),
  ),
  legislativeJurisdictions: setSize(
    publicRows
      .filter((row) => row.normalizedType === "legislative")
      .map((row) => row.jurisdiction.id),
  ),
  presidentialJurisdictions: setSize(
    publicRows
      .filter((row) => row.normalizedType === "presidential")
      .map((row) => row.jurisdiction.id),
  ),
  historicalEvents: qualifiedGroups.filter(
    (group) => rowById.get(group.primaryRowId)?.temporalClass === "historical",
  ).length,
  sourceDatedUpcomingEvents: qualifiedGroups.filter(
    (group) =>
      rowById.get(group.primaryRowId)?.temporalClass ===
      "source_dated_upcoming",
  ).length,
  projectionGroups: report.groups.filter(
    (group) =>
      rowById.get(group.primaryRowId)?.disposition === "projection_only",
  ).length,
  quarantinedRows: dispositions.quarantined,
  turnoutEligibleRows: report.rows.filter((row) => row.fieldEligibility.turnout)
    .length,
  resultEligibleRows: report.rows.filter((row) => row.fieldEligibility.results)
    .length,
};
for (const [key, value] of Object.entries(recomputedQualified)) {
  if (report.qualified[key as keyof typeof recomputedQualified] !== value)
    errors.push(`qualified.${key} does not reproduce`);
}

const recomputedRaw = {
  rows: report.rows.length,
  jurisdictions: setSize(report.rows.map((row) => row.jurisdiction.id)),
  sovereignRows: report.rows.filter(
    (row) => row.jurisdiction.status === "sovereign_state",
  ).length,
  sovereignJurisdictions: setSize(
    report.rows
      .filter((row) => row.jurisdiction.status === "sovereign_state")
      .map((row) => row.jurisdiction.id),
  ),
  historicalRows: report.rows.filter(
    (row) => row.temporalClass === "historical",
  ).length,
  futureRows: report.rows.filter((row) => row.temporalClass !== "historical")
    .length,
  projectionRows: report.rows.filter(
    (row) => row.dateBasis === "derived_term_projection",
  ).length,
};
for (const [key, value] of Object.entries(recomputedRaw)) {
  if (report.raw[key as keyof typeof recomputedRaw] !== value)
    errors.push(`raw.${key} does not reproduce`);
}

const requiredIssues: ElectionAuditIssueCode[] = [
  "MISSING_EVENT_PROVENANCE",
  "MISSING_DATE_CONFIDENCE",
  "UNSUPPORTED_ELECTION_TYPE",
  "SUBNATIONAL_MARKER",
  "NAME_DATE_YEAR_MISMATCH",
  "IMPRECISE_SOURCE_DATE",
  "CANCELLED_POSTPONED_OR_ANNULLED",
  "NON_NATIONAL_EXECUTIVE_SELECTION",
  "MISSING_JURISDICTION_IDENTITY_EVIDENCE",
  "UNRESOLVED_IDENTITY_LABEL",
  "UNSOURCED_TURNOUT",
  "UNSOURCED_RESULTS",
  "CONTEST_KEY_COLLISION",
];
for (const issue of requiredIssues)
  if (!report.issueCounts[issue])
    errors.push(`missing live issue class ${issue}`);

if (
  report.raw.sovereignRows !== 909 ||
  report.raw.sovereignJurisdictions !== 193
)
  errors.push("sovereign baseline no longer matches the audited release");
if (report.raw.projectionRows !== 233)
  errors.push("projection baseline no longer matches the audited release");
if (report.raw.statementsWithSourceHash !== 0)
  errors.push("source-hash posture changed; review and version the limitation");
if (report.qualified.jurisdictions !== 195)
  errors.push("qualified jurisdiction coverage drifted");

const rights = new Map(report.sourceRights.map((row) => [row.sourceId, row]));
if (rights.get("wikidata")?.reviewStatus !== "verified")
  errors.push("Wikidata rights are no longer verified");
for (const sourceId of ["ipu_parline", "international_idea"])
  if (
    rights.get(sourceId)?.reviewStatus !== "pending" ||
    rights.get(sourceId)?.publicExport !== "non-commercial-only"
  )
    errors.push(`${sourceId} pending non-commercial rights posture drifted`);

const electionsPage = readFileSync("src/app/elections/page.tsx", "utf8");
const electionsClient = readFileSync(
  "src/app/elections/ElectionsClient.tsx",
  "utf8",
);
if (
  /worldwide election calendar|tracked worldwide/i.test(
    `${electionsPage}\n${electionsClient}`,
  )
)
  errors.push("unsupported worldwide election claim remains public");
const guardedSurfaces = [
  ["src/lib/db/queries.ts", "isAuditedPublicElection"],
  ["src/components/compare/CompareElections.tsx", "temporalClass"],
  ["src/lib/db/queries-legislature.ts", "isAuditedPublicElection"],
  ["src/lib/factbook/legislature.ts", "isAuditedPublicElection"],
  ["src/lib/atlas/load-atlas-data.ts", "isAuditedPublicElection"],
  ["src/lib/atlas/surface-data-matrix.ts", "ELECTION_CORPUS_AUDIT"],
] as const;
for (const [path, marker] of guardedSurfaces)
  if (!readFileSync(path, "utf8").includes(marker))
    errors.push(`${path} does not consume the election qualification contract`);
const systemsPage = readFileSync("src/app/elections/systems/page.tsx", "utf8");
if (/world's legislatures|Every democracy/i.test(systemsPage))
  errors.push("electoral-systems page retains a universal scope claim");

console.log("=== ATL-007 election corpus audit ===\n");
if (errors.length) {
  for (const error of errors) console.error(`ERROR: ${error}`);
  process.exit(1);
}
console.log(`Baseline rows: ${report.raw.rows}/${EXPECTED_ROWS}`);
console.log(
  `Qualified conceptual events: ${report.qualified.conceptualEvents}`,
);
console.log(`Qualified jurisdictions: ${report.qualified.jurisdictions}`);
console.log(`Projection groups: ${report.qualified.projectionGroups}`);
console.log(`Quarantined rows: ${report.qualified.quarantinedRows}`);
console.log(
  "\nPASS — every baseline row has a deterministic identity, date, temporal, provenance, rights, duplication, field-eligibility, and publication disposition.",
);
