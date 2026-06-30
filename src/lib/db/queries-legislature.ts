import { sql, desc, asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  elections,
  governmentBodies,
  legislatureParties,
  sources,
} from "@/lib/db/schema";

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
}

export interface LegislatureContext {
  keyFacts: LegislatureKeyFacts;
  /** One entry per legislative body that has coalition flags. May be empty. */
  coalitions: ChamberCoalition[];
  /** ISO timestamp of the last IPU Parline sync (drives the SourceDot). */
  partySyncAt: string | null;
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
  jurisdictionId: string
): Promise<LegislatureContext> {
  const empty: LegislatureContext = {
    keyFacts: {
      electoralSystem: null,
      turnoutPercent: null,
      lastElectionYear: null,
      lastElectionName: null,
      nextElectionYear: null,
    },
    coalitions: [],
    partySyncAt: null,
  };

  // 1. Coalition flags, scoped to this jurisdiction's legislative bodies.
  const legislativeBodies = await db
    .select({ id: governmentBodies.id })
    .from(governmentBodies)
    .where(
      sql`${governmentBodies.jurisdictionId} = ${jurisdictionId}
        AND ${governmentBodies.branch} = 'legislative'`
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
          AND ${legislatureParties.isRulingCoalition} = true`
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
      electoralSystem: elections.electoralSystem,
      turnoutPercent: elections.turnoutPercent,
      electionDate: elections.electionDate,
      electionName: elections.electionName,
    })
    .from(elections)
    .where(
      sql`${elections.jurisdictionId} = ${jurisdictionId}
        AND ${elections.electionType} ILIKE 'legislativ%'
        AND ${elections.electionDate} <= CURRENT_DATE`
    )
    .orderBy(desc(elections.electionDate))
    .limit(1);

  const nextLegislative = await db
    .select({ electionDate: elections.electionDate })
    .from(elections)
    .where(
      sql`${elections.jurisdictionId} = ${jurisdictionId}
        AND ${elections.electionType} ILIKE 'legislativ%'
        AND ${elections.electionDate} > CURRENT_DATE`
    )
    .orderBy(asc(elections.electionDate))
    .limit(1);

  const past = pastLegislative[0];
  const next = nextLegislative[0];

  const partySyncAt = await getPartySourceSyncAt().catch(() => null);

  return {
    keyFacts: {
      electoralSystem: past?.electoralSystem ?? null,
      turnoutPercent:
        past?.turnoutPercent != null ? Number(past.turnoutPercent) : null,
      lastElectionYear: yearOf(past?.electionDate),
      lastElectionName: past?.electionName ?? null,
      nextElectionYear: yearOf(next?.electionDate),
    },
    coalitions: coalitions.length > 0 ? coalitions : empty.coalitions,
    partySyncAt,
  };
}
