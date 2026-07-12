import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";

import {
  auditElectionCorpus,
  ELECTION_CORPUS_AUDIT_VERSION,
  type ElectionAuditStatement,
  type ElectionCorpusRow,
} from "../src/lib/elections/corpus-audit";
import { sourceRights } from "../src/lib/rights/manifest";
import jurisdictionIdentityArtifact from "../src/lib/elections/jurisdiction-identity.generated.json";
import {
  electionCorpusIntegrityFingerprint,
  electionIntegrityFingerprint,
  type ElectionIntegrityContent,
  type ElectionIntegrityResult,
} from "../src/lib/elections/corpus-audit-integrity";

config({ path: ".env.local", quiet: true });

const OUTPUT = resolve(
  process.cwd(),
  "src/lib/elections/corpus-audit.generated.json",
);
const EXPECTED_BASELINE_ROWS = 915;
const FRESHNESS_DAYS = 180;
const CHECK = process.argv.includes("--check");

type ElectionDbRow = {
  id: string;
  jurisdiction_id: string;
  jurisdiction_slug: string;
  jurisdiction_status: string;
  election_date: string;
  election_type: string;
  election_name: string;
  body_id: string | null;
  chamber_name: string | null;
  electoral_system: string | null;
  turnout_percent: number | null;
  registered_voters: number | null;
  total_valid_votes: number | null;
  wikidata_qid: string | null;
  date_confidence: string | null;
  result_count: number;
};

type ResultDbRow = ElectionIntegrityResult & { election_id: string };

type StatementDbRow = {
  id: string;
  subject_id: string;
  predicate: string;
  source_id: string;
  source_license: string | null;
  source_url: string | null;
  retrieved_at: string;
  object_value: string | null;
  source_hash: string | null;
};

type SourceDbRow = {
  id: string;
  license: string;
  last_sync_at: string | null;
};

const isoDate = (value: string) => new Date(value).toISOString().slice(0, 10);
const isoInstant = (value: string | Date | null) => {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  const normalized = /[zZ]|[+-]\d\d(?::?\d\d)?$/.test(value)
    ? value
    : `${value.replace(" ", "T")}Z`;
  return new Date(normalized).toISOString();
};

function parsedObject(value: string | null): Record<string, unknown> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object"
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function precisionFor(
  event: StatementDbRow | undefined,
  confidence: string | null,
): "day" | "month" | "year" | "unknown" {
  if (confidence === "estimated") return "year";
  if (!event) return "unknown";
  if (event.predicate === "ipu_last_election") return "day";
  if (event.predicate !== "wikidata_election_date") return "unknown";
  const precision = Number(parsedObject(event.object_value).date_precision);
  return precision === 11
    ? "day"
    : precision === 10
      ? "month"
      : precision === 9
        ? "year"
        : "unknown";
}

function statementEvidence(
  row: StatementDbRow | undefined,
): ElectionAuditStatement | null {
  return row
    ? {
        sourceId: row.source_id,
        statementId: row.id,
        sourceLicense: row.source_license,
        retrievedAt: isoInstant(row.retrieved_at),
      }
    : null;
}

function isSubnational(name: string) {
  return /\b(?:state election|provincial|regional|municipal|local|catalonia|catalan|kurdistan|french polynesian)\b/i.test(
    name,
  );
}

function isNationalExecutiveSelection(name: string) {
  return !/\b(?:vice[- ]presidential|investiture)\b/i.test(name);
}

function sourceStatus(
  row: ElectionDbRow,
  event: StatementDbRow | undefined,
  asOf: string,
):
  | "held"
  | "source_dated"
  | "tentative"
  | "postponed"
  | "cancelled"
  | "annulled"
  | "unknown" {
  const name = row.election_name.toLowerCase();
  if (/\b(?:cancelled|canceled)\b/.test(name)) return "cancelled";
  if (/\bpostponed\b/.test(name)) return "postponed";
  if (/\bannulled\b/.test(name)) return "annulled";
  if (row.date_confidence === "estimated") return "unknown";
  if (!event) return "unknown";
  if (event.predicate === "ipu_last_election") return "held";
  return row.election_date <= asOf ? "source_dated" : "tentative";
}

function jurisdictionIdentityFor(
  row: (typeof jurisdictionIdentityArtifact.rows)[number] | undefined,
): NonNullable<ElectionCorpusRow["jurisdictionIdentity"]> | null {
  if (!row) return null;
  return {
    basis: row.basis as NonNullable<
      ElectionCorpusRow["jurisdictionIdentity"]
    >["basis"],
    sourceId: row.sourceId,
    sourceRecordId: row.sourceRecordId,
    expectedJurisdictionId: row.expectedJurisdictionId,
    observedJurisdictionIds: row.observedJurisdictionIds,
    status: row.status as NonNullable<
      ElectionCorpusRow["jurisdictionIdentity"]
    >["status"],
  };
}

async function collect(generatedAt: string, asOf: string) {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  const sql = neon(process.env.DATABASE_URL);
  const [rawElections, rawResults, rawStatements, rawSources] = await Promise.all([
    sql`SELECT e.id, e.jurisdiction_id, j.slug AS jurisdiction_slug,
               j.type AS jurisdiction_status, e.election_date::text,
               e.election_type, e.election_name, e.body_id,
               b.name AS chamber_name, e.electoral_system,
               e.turnout_percent, e.registered_voters, e.total_valid_votes,
               e.wikidata_qid, e.date_confidence, COUNT(er.id)::int AS result_count
        FROM elections e
        JOIN jurisdictions j ON j.id=e.jurisdiction_id
        LEFT JOIN government_bodies b ON b.id=e.body_id
        LEFT JOIN election_results er ON er.election_id=e.id
        GROUP BY e.id,j.slug,j.type,b.name
        ORDER BY e.id`,
    sql`SELECT id,election_id,party_name AS "partyName",
               party_color AS "partyColor",
               party_wikidata_qid AS "partyWikidataQid",
               candidate_name AS "candidateName",votes_count AS "votesCount",
               votes_percent AS "votesPercent",seats_won AS "seatsWon",
               is_winner AS "isWinner"
        FROM election_results
        ORDER BY election_id,id`,
    sql`SELECT id,subject_id,predicate,source_id,source_license,source_url,
               retrieved_at::text,object_value,source_hash
        FROM statements
        WHERE subject_table='elections'
        ORDER BY subject_id,predicate,source_id,id`,
    sql`SELECT id,license,last_sync_at::text
        FROM sources
        WHERE id IN (
          SELECT DISTINCT source_id FROM statements WHERE subject_table='elections'
        )
        ORDER BY id`,
  ]);
  const elections = rawElections as ElectionDbRow[];
  const results = rawResults as ResultDbRow[];
  const statements = rawStatements as StatementDbRow[];
  const sources = rawSources as SourceDbRow[];
  const statementsByElection = new Map<string, StatementDbRow[]>();
  const jurisdictionIdentityByElection = new Map(
    jurisdictionIdentityArtifact.rows.map((row) => [row.rowId, row]),
  );
  const resultsByElection = new Map<string, ElectionIntegrityResult[]>();
  for (const statement of statements) {
    const rows = statementsByElection.get(statement.subject_id) ?? [];
    rows.push(statement);
    statementsByElection.set(statement.subject_id, rows);
  }
  for (const result of results) {
    const rows = resultsByElection.get(result.election_id) ?? [];
    const content: ElectionIntegrityResult = {
      id: result.id,
      partyName: result.partyName,
      partyColor: result.partyColor,
      partyWikidataQid: result.partyWikidataQid,
      candidateName: result.candidateName,
      votesCount: result.votesCount,
      votesPercent: result.votesPercent,
      seatsWon: result.seatsWon,
      isWinner: result.isWinner,
    };
    rows.push(content);
    resultsByElection.set(result.election_id, rows);
  }

  const rows: ElectionCorpusRow[] = elections.map((row) => {
    const rowStatements = statementsByElection.get(row.id) ?? [];
    const event =
      rowStatements.find((statement) =>
        row.date_confidence === "estimated"
          ? statement.predicate === "civica_estimated_next_election"
          : statement.predicate === "ipu_last_election",
      ) ??
      rowStatements.find(
        (statement) => statement.predicate === "wikidata_election_date",
      );
    const turnout = rowStatements.find(
      (statement) => statement.predicate === "idea_voter_turnout",
    );
    const results = rowStatements.find(
      (statement) => statement.predicate === "ipu_last_election",
    );
    const electionDate = isoDate(row.election_date);
    const precision = precisionFor(event, row.date_confidence);
    return {
      id: row.id,
      jurisdictionId: row.jurisdiction_id,
      jurisdictionSlug: row.jurisdiction_slug,
      jurisdictionStatus: row.jurisdiction_status,
      includeInElectionScope:
        row.jurisdiction_status === "sovereign_state" ||
        row.jurisdiction_status === "disputed_or_limited_recognition",
      electionType: row.election_type,
      electionName: row.election_name,
      electionDate,
      dateConfidence: row.date_confidence,
      datePrecision: precision,
      dateRole:
        row.date_confidence === "estimated"
          ? "derived_due_date"
          : event?.predicate === "ipu_last_election"
            ? "election_day"
            : event?.predicate === "wikidata_election_date"
              ? "point_in_time"
              : "unknown",
      sourceEventStatus: sourceStatus(row, event, asOf),
      bodyId: row.body_id,
      chamber: row.chamber_name,
      isSubnational: isSubnational(row.election_name),
      isNationalExecutiveSelection: isNationalExecutiveSelection(
        row.election_name,
      ),
      turnoutPercent: row.turnout_percent,
      results: row.result_count > 0 ? [{}] : [],
      provenance: {
        event: statementEvidence(event),
        turnout: statementEvidence(turnout),
        results: statementEvidence(results),
      },
      jurisdictionIdentity: jurisdictionIdentityFor(
        jurisdictionIdentityByElection.get(row.id),
      ),
    };
  });

  const sourceInput = sources.map((source) => ({
    id: source.id,
    license: source.license,
    retrievedAt: isoInstant(source.last_sync_at),
  }));
  const rightsInput = sources.map((source) => {
    const rights = sourceRights(source.id);
    return {
      sourceId: source.id,
      expectedLicense: source.license,
      reviewStatus: rights?.reviewStatus ?? ("pending" as const),
      publicDisplay:
        rights?.publicExport === "allowed" ||
        rights?.publicExport === "non-commercial-only",
      mayUseTurnout: source.id === "international_idea",
      mayUseResults: source.id === "ipu_parline",
    };
  });
  const audit = auditElectionCorpus({
    rows,
    sources: sourceInput,
    rights: rightsInput,
    asOf,
    upcomingFreshnessDays: FRESHNESS_DAYS,
  });

  const auditById = new Map(audit.rows.map((row) => [row.rowId, row]));
  const publicRows = audit.rows.filter(
    (row) => row.disposition === "qualified_event" || row.disposition === "qualified_contest",
  );
  const qualifiedEventGroups = audit.groups.filter((group) => {
    const primary = auditById.get(group.primaryRowId);
    return primary?.disposition === "qualified_event";
  });
  const qualifiedJurisdictions = new Set(
    publicRows.map((row) => row.jurisdiction.id),
  );
  const jurisdictionIdsForType = (type: "legislative" | "presidential") =>
    new Set(
      publicRows
        .filter((row) => row.normalizedType === type)
        .map((row) => row.jurisdiction.id),
    ).size;
  const sourceDatedUpcomingEvents = qualifiedEventGroups.filter((group) =>
    auditById.get(group.primaryRowId)?.temporalClass === "source_dated_upcoming",
  ).length;
  const historicalEvents = qualifiedEventGroups.filter((group) =>
    auditById.get(group.primaryRowId)?.temporalClass === "historical",
  ).length;
  const projectionGroups = audit.groups.filter((group) =>
    auditById.get(group.primaryRowId)?.disposition === "projection_only",
  ).length;

  const rowContentFingerprints = Object.fromEntries(
    elections.map((row) => {
      const content: ElectionIntegrityContent = {
        id: row.id,
        jurisdictionId: row.jurisdiction_id,
        jurisdictionStatus: row.jurisdiction_status,
        electionDate: isoDate(row.election_date),
        electionType: row.election_type,
        electionName: row.election_name,
        electoralSystem: row.electoral_system,
        bodyId: row.body_id,
        turnoutPercent: row.turnout_percent,
        registeredVoters: row.registered_voters,
        totalValidVotes: row.total_valid_votes,
        wikidataQid: row.wikidata_qid,
        dateConfidence: row.date_confidence,
        jurisdictionIdentity:
          jurisdictionIdentityByElection.get(row.id) ?? null,
        results: resultsByElection.get(row.id) ?? [],
        statements: (statementsByElection.get(row.id) ?? []).map(
          (statement) => ({
            id: statement.id,
            predicate: statement.predicate,
            sourceId: statement.source_id,
            sourceLicense: statement.source_license,
            sourceUrl: statement.source_url,
            retrievedAt: isoInstant(statement.retrieved_at)!,
            objectValue: statement.object_value,
            sourceHash: statement.source_hash,
          }),
        ),
      };
      return [row.id, electionIntegrityFingerprint(content)];
    }),
  );
  const integritySources = sources.map((row) => ({
    id: row.id,
    license: row.license,
    lastSyncAt: isoInstant(row.last_sync_at),
  }));
  return {
    schemaVersion: ELECTION_CORPUS_AUDIT_VERSION,
    generatedAt,
    asOf,
    baseline: {
      expectedRows: EXPECTED_BASELINE_ROWS,
      observedRows: elections.length,
      fingerprintSha256: electionCorpusIntegrityFingerprint({
        rowFingerprints: rowContentFingerprints,
        sources: integritySources,
      }),
      rule: "Every baseline election row, its complete public content, election statements, result rows, and election-referenced registered source records are bound to this fingerprint.",
      jurisdictionIdentityRowsSha256: jurisdictionIdentityArtifact.rowsSha256,
    },
    rowContentFingerprints,
    scope: {
      jurisdictionTaxonomy: "jurisdiction-status/v1",
      includedStatusClasses: [
        "sovereign_state",
        "disputed_or_limited_recognition",
      ],
      rule: "Coverage counts sovereign states separately. Kosovo and Taiwan remain neutral limited-recognition reference entries and never enter sovereign-state totals.",
    },
    sourceRights: sources
      .filter((source) =>
        ["ipu_parline", "wikidata", "international_idea"].includes(source.id),
      )
      .map((source) => {
        const rights = sourceRights(source.id);
        return {
          sourceId: source.id,
          statementLicense: source.license,
          reviewStatus: rights?.reviewStatus ?? "pending",
          publicExport: rights?.publicExport ?? "pending-review",
          lastSyncAt: isoInstant(source.last_sync_at),
        };
      }),
    raw: {
      rows: elections.length,
      jurisdictions: new Set(elections.map((row) => row.jurisdiction_id)).size,
      sovereignRows: elections.filter(
        (row) => row.jurisdiction_status === "sovereign_state",
      ).length,
      sovereignJurisdictions: new Set(
        elections
          .filter((row) => row.jurisdiction_status === "sovereign_state")
          .map((row) => row.jurisdiction_id),
      ).size,
      historicalRows: rows.filter((row) => row.electionDate! <= asOf).length,
      futureRows: rows.filter((row) => row.electionDate! > asOf).length,
      projectionRows: rows.filter((row) => row.dateConfidence === "estimated")
        .length,
      turnoutRows: elections.filter((row) => row.turnout_percent != null).length,
      resultRows: elections.reduce((sum, row) => sum + row.result_count, 0),
      statements: statements.length,
      statementsWithSourceHash: statements.filter((row) => row.source_hash).length,
    },
    qualified: {
      conceptualEvents: qualifiedEventGroups.length,
      contestRows: publicRows.length,
      jurisdictions: qualifiedJurisdictions.size,
      sovereignJurisdictions: new Set(
        publicRows
          .filter((row) => row.jurisdiction.status === "sovereign_state")
          .map((row) => row.jurisdiction.id),
      ).size,
      limitedRecognitionJurisdictions: new Set(
        publicRows
          .filter(
            (row) =>
              row.jurisdiction.status ===
              "disputed_or_limited_recognition",
          )
          .map((row) => row.jurisdiction.id),
      ).size,
      legislativeJurisdictions: jurisdictionIdsForType("legislative"),
      presidentialJurisdictions: jurisdictionIdsForType("presidential"),
      historicalEvents,
      sourceDatedUpcomingEvents,
      projectionGroups,
      quarantinedRows: audit.dispositionCounts.quarantined,
      turnoutEligibleRows: audit.rows.filter((row) => row.fieldEligibility.turnout)
        .length,
      resultEligibleRows: audit.rows.filter((row) => row.fieldEligibility.results)
        .length,
    },
    dispositionCounts: audit.dispositionCounts,
    issueCounts: audit.issueCounts,
    groups: audit.groups,
    rows: audit.rows,
  };
}

async function main() {
  const previous = CHECK
    ? (JSON.parse(readFileSync(OUTPUT, "utf8")) as {
        generatedAt: string;
        asOf: string;
      })
    : null;
  const generatedAt = previous?.generatedAt ?? new Date().toISOString();
  const asOf = previous?.asOf ?? generatedAt.slice(0, 10);
  const artifact = await collect(generatedAt, asOf);
  if (artifact.baseline.observedRows !== EXPECTED_BASELINE_ROWS) {
    throw new Error(
      `Expected ${EXPECTED_BASELINE_ROWS} baseline rows; observed ${artifact.baseline.observedRows}. Review and version the audit before accepting new membership.`,
    );
  }
  const serialized = `${JSON.stringify(artifact, null, 2)}\n`;
  if (CHECK) {
    if (serialized !== readFileSync(OUTPUT, "utf8")) {
      throw new Error("Checked election corpus audit differs from the live database");
    }
    console.log(
      `PASS — ${artifact.baseline.observedRows} election rows match ${artifact.baseline.fingerprintSha256}.`,
    );
    return;
  }
  writeFileSync(OUTPUT, serialized);
  console.log(
    `Wrote ${artifact.schemaVersion}: ${artifact.baseline.observedRows} rows; ${artifact.qualified.conceptualEvents} qualified events; ${artifact.qualified.projectionGroups} projection groups; ${artifact.qualified.quarantinedRows} quarantined rows.`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
