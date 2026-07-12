import { sql, desc, asc } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  elections,
  governmentBodies,
  legislatureParties,
} from "@/lib/db/schema";
import { resolvePartyColor } from "@/lib/data/party-colors";
import {
  ELECTION_CORPUS_AUDIT,
  getElectionAuditRow,
  isAuditedProjection,
  isAuditedPublicElection,
  isPrimaryElectionEvent,
} from "@/lib/elections/corpus-audit-runtime";
import { loadLiveElectionContentFingerprints } from "@/lib/elections/corpus-audit-live";

export interface LegislatureParty {
  id: string;
  name: string;
  seats: number;
  color: string;
}

export interface LegislatureChamber {
  /** Stable id used for keying / routing */
  id: string;
  /** "Lower" | "Upper" — the slot the body occupies. Unicameral always "Lower". */
  slot: "lower" | "upper";
  name: string;
  total: number;
  /** Friendly subtitle like "360 seats" — hover-hint will pull from this */
  sub: string;
  parties: LegislatureParty[];
}

export interface LegislatureData {
  /** Always present when data exists. Unicameral chambers go here. */
  lower: LegislatureChamber;
  /** Bicameral upper chamber, or null. */
  upper: LegislatureChamber | null;
  /** Curated coalition label, when known. */
  coalition: string | null;
  /** ISO year of the next scheduled election, when known. */
  nextElection: string | null;
  nextElectionBasis: "source_dated" | "term_projection" | null;
  nextElectionStatus: "tentative" | "source_dated" | "unknown" | null;
}

/**
 * Loads chamber composition for ONE jurisdiction. Mirrors the data shape
 * used by the atlas loader (`src/lib/atlas/load-atlas-data.ts`) but scoped
 * to a single country so the factbook page doesn't pay the cost of the
 * full atlas index just to render one section.
 *
 * Returns `null` if the country has no legislative bodies (e.g. Vatican,
 * absolute monarchies with no legislature ingested) — the parent should
 * hide the section entirely in that case.
 */
export async function getLegislatureForJurisdiction(
  jurisdictionId: string,
): Promise<LegislatureData | null> {
  const bodies = await db
    .select()
    .from(governmentBodies)
    .where(
      sql`${governmentBodies.jurisdictionId} = ${jurisdictionId}
        AND ${governmentBodies.branch} = 'legislative'`,
    )
    .orderBy(asc(governmentBodies.hierarchyLevel));

  if (bodies.length === 0) return null;

  const lowerBody = bodies.find((b) => b.chamberType === "lower") ?? bodies[0];
  const upperBody = bodies.find((b) => b.chamberType === "upper") ?? null;

  const bodyIds = [lowerBody.id, ...(upperBody ? [upperBody.id] : [])];
  const allParties = await db
    .select()
    .from(legislatureParties)
    .where(sql`${legislatureParties.bodyId} IN ${bodyIds}`)
    .orderBy(desc(legislatureParties.seatCount));

  function buildChamber(
    body: typeof lowerBody,
    slot: "lower" | "upper",
  ): LegislatureChamber {
    const bp = allParties.filter((p) => p.bodyId === body.id);
    const totalSeats =
      body.totalSeats || bp.reduce((sum, p) => sum + p.seatCount, 0);
    const sumPartySeats = bp.reduce((sum, p) => sum + p.seatCount, 0);

    // Same data-quality guard as the atlas loader: if the sum of party
    // seats is 20%+ over the chamber total (multi-election aggregation
    // bug in some IPU/Wikidata syncs), normalise into the chamber total.
    const isAggregated = sumPartySeats > 0 && sumPartySeats > totalSeats * 1.2;

    const seen = new Set<string>();
    let parties: LegislatureParty[] = bp.map((p, i) => {
      let slug = p.partyName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
      if (!slug || seen.has(slug)) slug = `${slug || "party"}-${i}`;
      seen.add(slug);
      const normalisedSeats = isAggregated
        ? Math.round((p.seatCount / sumPartySeats) * totalSeats)
        : p.seatCount;
      return {
        id: slug,
        name: p.partyName,
        seats: normalisedSeats,
        color: resolvePartyColor(p.partyColor, p.partyName, i),
      };
    });

    if (isAggregated) parties = parties.filter((p) => p.seats > 0);

    return {
      id: body.id,
      slot,
      name: body.name,
      total: totalSeats,
      sub: `${totalSeats} seats`,
      parties,
    };
  }

  const lower = buildChamber(lowerBody, "lower");
  const upper = upperBody ? buildChamber(upperBody, "upper") : null;

  // Empty-state guard: if there are no parties AND no totalSeats, the
  // composition section would be a hollow shell. Treat as "no data".
  if (
    lower.total === 0 &&
    lower.parties.length === 0 &&
    (!upper || (upper.total === 0 && upper.parties.length === 0))
  ) {
    return null;
  }

  // Pull most-recent past election to extrapolate "next election" hints.
  // We don't have a future-election table, but the latest past election
  // year is informative as a "last election" stat for the masthead.
  const latestPastRows = await db
    .select({ id: elections.id, electionDate: elections.electionDate })
    .from(elections)
    .where(
      sql`${elections.jurisdictionId} = ${jurisdictionId}
        AND ${elections.electionType} ILIKE 'legislativ%'
        AND ${elections.electionDate} <= ${ELECTION_CORPUS_AUDIT.asOf}`,
    )
    .orderBy(desc(elections.electionDate));

  const futureElectionRows = await db
    .select({ id: elections.id, electionDate: elections.electionDate })
    .from(elections)
    .where(
      sql`${elections.jurisdictionId} = ${jurisdictionId}
        AND ${elections.electionType} ILIKE 'legislativ%'
        AND ${elections.electionDate} > ${ELECTION_CORPUS_AUDIT.asOf}`,
    )
    .orderBy(asc(elections.electionDate));

  const liveFingerprints = await loadLiveElectionContentFingerprints([
    ...latestPastRows.map((row) => row.id),
    ...futureElectionRows.map((row) => row.id),
  ]);

  const latestPast = latestPastRows.find((row) =>
    isAuditedPublicElection(row.id, liveFingerprints.get(row.id)),
  );
  const futureElection = futureElectionRows.find(
    (row) =>
      isPrimaryElectionEvent(row.id) &&
      (isAuditedPublicElection(row.id, liveFingerprints.get(row.id)) ||
        isAuditedProjection(row.id, liveFingerprints.get(row.id))),
  );
  const futureAudit = futureElection
    ? getElectionAuditRow(futureElection.id)
    : null;

  let nextElection: string | null = null;
  if (futureElection?.electionDate) {
    const year = new Date(
      futureElection.electionDate as unknown as string,
    ).getUTCFullYear();
    nextElection =
      futureAudit?.temporalClass === "projection_due"
        ? `Est. due ${year}`
        : `Source-dated ${year}`;
  } else if (latestPast?.electionDate) {
    // No upcoming election scheduled, show the year of the most recent.
    nextElection = `Last: ${new Date(
      latestPast.electionDate as unknown as string,
    ).getUTCFullYear()}`;
  }

  return {
    lower,
    upper,
    coalition: null, // Coalition copy is not currently in the schema.
    nextElection,
    nextElectionBasis:
      futureAudit?.temporalClass === "projection_due"
        ? "term_projection"
        : futureAudit?.temporalClass === "source_dated_upcoming"
          ? "source_dated"
          : null,
    nextElectionStatus:
      futureAudit?.temporalClass === "projection_due"
        ? "unknown"
        : futureAudit?.sourceEventStatus === "tentative"
          ? "tentative"
          : futureAudit?.sourceEventStatus === "source_dated"
            ? "source_dated"
            : futureAudit
              ? "unknown"
              : null,
  };
}
