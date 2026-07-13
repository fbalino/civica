import { and, sql, desc, asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  elections,
  governmentBodies,
  legislatureParties,
  sources,
  statements,
} from "@/lib/db/schema";
import {
  ELECTION_CORPUS_AUDIT,
  getElectionAuditRow,
  isAuditedProjection,
  isAuditedPublicElection,
  isEligibleElectionField,
  isPrimaryElectionEvent,
} from "@/lib/elections/corpus-audit-runtime";
import { loadLiveElectionContentFingerprints } from "@/lib/elections/corpus-audit-live";

/**
 * Section-scoped queries for the deepened Civica Data → Legislature section.
 *
 * These live in a section-local file (NOT the shared `src/lib/db/queries.ts`)
 * and read ONLY columns that actually carry data today:
 *
 *   - `legislature_parties.is_ruling_coalition` — set for a small set of
 *     bodies (≈9). Drives the optional government/opposition balance bar.
 *     Absent for most countries → the bar is skipped, never faked.
 *   - `elections.electoral_system` / `turnout_percent` / `election_date` —
 *     present for ~13 countries with an ingested legislative election. Drive
 *     the key-facts strip. Absent → those cells are simply omitted.
 *
 * No fabricated values: every field is nullable and the UI degrades to a
 * clean empty state when the underlying row is missing.
 */

/** Per-body coalition signal, keyed by the government_bodies UUID. */
export interface ChamberCoalition {
  bodyId: string;
  /** Sum of seats held by parties flagged `is_ruling_coalition = true`. */
  coalitionSeats: number;
  /** Number of distinct parties in the governing coalition. */
  coalitionPartyCount: number;
  /**
   * Lowercased set of party names flagged as governing-coalition members,
   * used by the party browser to tag rows Government / Opposition. We key by
   * normalised name because the chamber data the chart already builds doesn't
   * carry the `is_ruling_coalition` flag through.
   */
  coalitionPartyNames: string[];
}

/** Country-level "how the legislature is elected" facts. */
export interface LegislatureKeyFacts {
  /** e.g. "Mixed-member proportional", "First-past-the-post". */
  electoralSystem: string | null;
  /** Voter turnout of the most recent legislative election, 0–100. */
  turnoutPercent: number | null;
  /** Four-digit year of the most recent past legislative election. */
  lastElectionYear: string | null;
  /** Display name of that election, e.g. "2025 German federal election". */
  lastElectionName: string | null;
  /** Four-digit year of the next scheduled legislative election, if any. */
  nextElectionYear: string | null;
  /** A source date is not necessarily an official schedule; projections are separate. */
  nextElectionBasis: "source_dated" | "term_projection" | null;
  nextElectionStatus: "tentative" | "source_dated" | "held" | "unknown" | null;
  lastElectionResultsStatus: "compiled" | "not_compiled" | null;
}

export interface LegislatureContext {
  keyFacts: LegislatureKeyFacts;
  /** One entry per legislative body that has coalition flags. May be empty. */
  coalitions: ChamberCoalition[];
  /** ISO timestamp of the last IPU Parline sync (drives the SourceDot). */
  partySyncAt: string | null;
  electionEvidence: {
    sourceId: string;
    retrievedAt: string | null;
  } | null;
  turnoutEvidence: {
    sourceId: string;
    retrievedAt: string | null;
  } | null;
  systemEvidence: {
    sourceId: string;
    retrievedAt: string | null;
  } | null;
}

/** Reads the last sync timestamp for the party-seat source (IPU Parline). */
export async function getPartySourceSyncAt(): Promise<string | null> {
  const rows = await db
    .select({ lastSyncAt: sources.lastSyncAt })
    .from(sources)
    .where(eq(sources.id, "ipu_parline"))
    .limit(1);
  const v = rows[0]?.lastSyncAt;
  return v ? new Date(v as unknown as string).toISOString() : null;
}

function yearOf(value: unknown): string | null {
  if (!value) return null;
  const d = new Date(value as string);
  if (Number.isNaN(d.getTime())) return null;
  return String(d.getUTCFullYear());
}

/**
 * Loads the supplementary legislature context for one jurisdiction.
 *
 * Always returns a well-formed object (never throws to the caller — callers
 * should still `.catch(() => null)` defensively). Every field can be null /
 * empty, which the UI renders as an absent cell rather than a placeholder.
 */
export async function getLegislatureContext(
  jurisdictionId: string,
): Promise<LegislatureContext> {
  const empty: LegislatureContext = {
    keyFacts: {
      electoralSystem: null,
      turnoutPercent: null,
      lastElectionYear: null,
      lastElectionName: null,
      nextElectionYear: null,
      nextElectionBasis: null,
      nextElectionStatus: null,
      lastElectionResultsStatus: null,
    },
    coalitions: [],
    partySyncAt: null,
    electionEvidence: null,
    turnoutEvidence: null,
    systemEvidence: null,
  };

  // 1. Coalition flags, scoped to this jurisdiction's legislative bodies.
  const legislativeBodies = await db
    .select({ id: governmentBodies.id })
    .from(governmentBodies)
    .where(
      sql`${governmentBodies.jurisdictionId} = ${jurisdictionId}
        AND ${governmentBodies.branch} = 'legislative'`,
    );

  const bodyIds = legislativeBodies.map((b) => b.id);

  let coalitions: ChamberCoalition[] = [];
  if (bodyIds.length > 0) {
    const flagged = await db
      .select({
        bodyId: legislatureParties.bodyId,
        partyName: legislatureParties.partyName,
        seatCount: legislatureParties.seatCount,
        isRuling: legislatureParties.isRulingCoalition,
      })
      .from(legislatureParties)
      .where(
        sql`${legislatureParties.bodyId} IN ${bodyIds}
          AND ${legislatureParties.isRulingCoalition} = true
          AND ${legislatureParties.isCurrent} = true`,
      );

    const byBody = new Map<string, ChamberCoalition>();
    for (const row of flagged) {
      if (!row.bodyId) continue;
      const entry = byBody.get(row.bodyId) ?? {
        bodyId: row.bodyId,
        coalitionSeats: 0,
        coalitionPartyCount: 0,
        coalitionPartyNames: [],
      };
      entry.coalitionSeats += row.seatCount ?? 0;
      entry.coalitionPartyCount += 1;
      entry.coalitionPartyNames.push(row.partyName.toLowerCase().trim());
      byBody.set(row.bodyId, entry);
    }
    coalitions = [...byBody.values()];
  }

  // 2. Electoral system + turnout from the most recent PAST legislative
  //    election. `election_type` casing varies ("legislative" / "Legislative")
  //    so we match case-insensitively. `body_id` is unpopulated today, so we
  //    scope to the jurisdiction and treat the fact as legislature-level.
  const pastLegislative = await db
    .select({
      id: elections.id,
      electoralSystem: elections.electoralSystem,
      turnoutPercent: elections.turnoutPercent,
      electionDate: elections.electionDate,
      electionName: elections.electionName,
    })
    .from(elections)
    .where(
      sql`${elections.jurisdictionId} = ${jurisdictionId}
        AND ${elections.electionType} ILIKE 'legislativ%'
        AND ${elections.electionDate} <= ${ELECTION_CORPUS_AUDIT.asOf}`,
    )
    .orderBy(desc(elections.electionDate));

  const nextLegislative = await db
    .select({ id: elections.id, electionDate: elections.electionDate })
    .from(elections)
    .where(
      sql`${elections.jurisdictionId} = ${jurisdictionId}
        AND ${elections.electionType} ILIKE 'legislativ%'
        AND ${elections.electionDate} > ${ELECTION_CORPUS_AUDIT.asOf}`,
    )
    .orderBy(asc(elections.electionDate));

  const liveFingerprints = await loadLiveElectionContentFingerprints([
    ...pastLegislative.map((row) => row.id),
    ...nextLegislative.map((row) => row.id),
  ]);

  const past = pastLegislative.find((row) =>
    isAuditedPublicElection(row.id, liveFingerprints.get(row.id)),
  );
  const next = nextLegislative.find(
    (row) =>
      isPrimaryElectionEvent(row.id) &&
      (isAuditedPublicElection(row.id, liveFingerprints.get(row.id)) ||
        isAuditedProjection(row.id, liveFingerprints.get(row.id))),
  );
  const nextAudit = next ? getElectionAuditRow(next.id) : null;
  const pastAudit = past ? getElectionAuditRow(past.id) : null;

  const systemStatements = past
    ? await db
        .select({
          sourceId: statements.sourceId,
          retrievedAt: statements.retrievedAt,
          objectValue: statements.objectValue,
        })
        .from(statements)
        .where(
          and(
            eq(statements.subjectTable, "elections"),
            eq(statements.subjectId, past.id),
            eq(statements.predicate, "ipu_last_election"),
            eq(statements.sourceId, "ipu_parline"),
          ),
        )
        .limit(1)
    : [];
  const systemStatement = systemStatements.find((statement) => {
    try {
      const value = JSON.parse(statement.objectValue ?? "{}") as {
        electoral_system?: unknown;
      };
      return (
        typeof value.electoral_system === "string" &&
        value.electoral_system.trim().length > 0
      );
    } catch {
      return false;
    }
  });

  const partySyncAt = await getPartySourceSyncAt().catch(() => null);

  return {
    keyFacts: {
      electoralSystem: systemStatement ? (past?.electoralSystem ?? null) : null,
      turnoutPercent:
        past?.turnoutPercent != null &&
        isEligibleElectionField(past.id, "turnout")
          ? Number(past.turnoutPercent)
          : null,
      lastElectionYear: yearOf(past?.electionDate),
      lastElectionName: past?.electionName ?? null,
      nextElectionYear: yearOf(next?.electionDate),
      nextElectionBasis:
        nextAudit?.temporalClass === "source_dated_upcoming"
          ? "source_dated"
          : nextAudit?.temporalClass === "projection_due"
            ? "term_projection"
            : null,
      nextElectionStatus:
        nextAudit?.temporalClass === "projection_due"
          ? "unknown"
          : nextAudit?.sourceEventStatus === "tentative"
            ? "tentative"
            : nextAudit?.sourceEventStatus === "source_dated"
              ? "source_dated"
              : nextAudit?.sourceEventStatus === "held"
                ? "held"
                : nextAudit
                  ? "unknown"
                  : null,
      lastElectionResultsStatus: past
        ? isEligibleElectionField(past.id, "results")
          ? "compiled"
          : "not_compiled"
        : null,
    },
    coalitions: coalitions.length > 0 ? coalitions : empty.coalitions,
    partySyncAt,
    electionEvidence: (nextAudit ?? pastAudit)?.evidence.sourceId
      ? {
          sourceId: (nextAudit ?? pastAudit)!.evidence.sourceId!,
          retrievedAt: (nextAudit ?? pastAudit)!.evidence.retrievedAt,
        }
      : null,
    turnoutEvidence: pastAudit?.fieldEvidence.turnout
      ? {
          sourceId: pastAudit.fieldEvidence.turnout.sourceId,
          retrievedAt: pastAudit.fieldEvidence.turnout.retrievedAt,
        }
      : null,
    systemEvidence: systemStatement
      ? {
          sourceId: systemStatement.sourceId,
          retrievedAt: systemStatement.retrievedAt
            ? new Date(systemStatement.retrievedAt).toISOString()
            : null,
        }
      : null,
  };
}
