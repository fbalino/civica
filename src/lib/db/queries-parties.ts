import { eq, inArray, sql } from "drizzle-orm";
import { db } from "./index";
import {
  legislatureParties,
  governmentBodies,
  jurisdictions,
  partyPositions,
  sources,
} from "./schema";

// ---------------------------------------------------------------------------
// Party browser — read layer for the cross-country political-party browser +
// ideology compass (/parties). Contract:
// plan/party-ideology-sourcing-resolution-v1.md.
//
// Joins every `legislature_parties` row to its jurisdiction + chamber and, when
// a V-Party v2 ideology match exists, to its `party_positions` row. The join to
// positions is a LEFT join on purpose: provenance is load-bearing (§5) — a
// party with no recorded position keeps its seats and country but returns
// `position: null`, which the UI renders as an honest "ideology not recorded"
// state (never a fabricated dot/bucket).
//
// Every field below is a real column; nothing is generated. Aggregate/procedural
// buckets ("Others", "Independents", …) are NOT filtered here — they are real
// seat-holding rows and the page decides how to present them; they simply never
// carry a `position` (the ingest never matches them).
//
// Soft-fail: like the other reader queries, a DB error yields an empty result
// rather than throwing, so /parties renders coherently when the DB is
// unreachable.
// ---------------------------------------------------------------------------

/** A V-Party v2 compass position attached to a party (source id `vparty`). */
export interface PartyPosition {
  /**
   * Economic left–right (`v2pariglef` interval point estimate). Roughly
   * −4 (far-left) … +4 (far-right); this is the compass X axis.
   */
  economicLR: number;
  /**
   * `v2pariglef_ord` 0–6 ordinal bucket (0 Far-left … 6 Far-right), for
   * labelling. Null when V-Party did not publish the ordinal.
   */
  economicLROrd: number | null;
  /**
   * Anti-Pluralism Index (`v2xpa_antiplural`), 0 (pluralist) … 1
   * (anti-pluralist); the compass Y axis.
   */
  antiPlural: number;
  /** Populism Index (`v2xpa_popul`), 0–1. Optional third lens. */
  populism: number | null;
  /** The V-Party election year the stored position is coded for. */
  codedYear: number;
  /** How the Civica row was matched: 'exact' | 'abbrev' | 'token'. */
  matchMethod: string;
}

/**
 * A recorded position is only surfaced as DISPLAYABLE when its match is
 * high-confidence (resolution §4.2). 'review' rows — the fuzzy token matches
 * awaiting curation AND every party seated in a one-party / non-competitive
 * legislature — are kept in the table but never returned as a `position`: the
 * UI renders "ideology not recorded" instead. A wrong ideology is worse than an
 * honest gap, so the gate lives in the read layer and the raw rows stay put for
 * a future curation pass.
 */
const DISPLAYABLE_CONFIDENCE = "high";

/** The country a party sits in, denormalised for the browser list + filters. */
export interface PartyCountry {
  name: string;
  iso2: string | null;
  slug: string;
  /** World region (the jurisdiction's `continent`, e.g. "Europe"). */
  region: string | null;
}

/** One legislature party, enriched for the browser + compass. */
export interface BrowserParty {
  /** `legislature_parties.id` (stable key for the row). */
  id: string;
  partyName: string;
  /** Party brand colour hex from the source data, if recorded. Null → neutral. */
  color: string | null;
  seatCount: number;
  /**
   * This party's share of its own chamber's seats, 0–1. Computed from the
   * summed seats of every party in the same body. Null when the chamber total
   * is 0 (should not happen for seat-holding rows).
   */
  seatShare: number | null;
  isRulingCoalition: boolean;
  country: PartyCountry;
  /** Chamber name, e.g. "German Bundestag". */
  chamber: string;
  /** "upper" | "lower" (the chamber's `chamber_type`), if recorded. */
  chamberType: string | null;
  /** V-Party position, or null when no ideology is recorded for this party. */
  position: PartyPosition | null;
}

/**
 * Every legislature party, joined to country + chamber + (optional) V-Party
 * position. Ordered by country then descending seats so the browser can group
 * by country and lead with the largest parties.
 *
 * Soft-fails to `[]` on any error.
 */
export async function getPartiesForBrowser(): Promise<BrowserParty[]> {
  try {
    // Per-body seat totals, so each party's chamber seat-share is exact.
    const bodyTotals = db
      .select({
        bodyId: legislatureParties.bodyId,
        totalSeats: sql<number>`sum(${legislatureParties.seatCount})`.as(
          "body_total_seats",
        ),
      })
      .from(legislatureParties)
      .groupBy(legislatureParties.bodyId)
      .as("body_totals");

    const rows = await db
      .select({
        id: legislatureParties.id,
        partyName: legislatureParties.partyName,
        color: legislatureParties.partyColor,
        seatCount: legislatureParties.seatCount,
        isRulingCoalition: legislatureParties.isRulingCoalition,
        bodyTotalSeats: bodyTotals.totalSeats,
        countryName: jurisdictions.name,
        iso2: jurisdictions.iso2,
        slug: jurisdictions.slug,
        region: jurisdictions.continent,
        chamber: governmentBodies.name,
        chamberType: governmentBodies.chamberType,
        economicLR: partyPositions.economicLeftRight,
        economicLROrd: partyPositions.economicLrOrd,
        antiPlural: partyPositions.antiPluralism,
        populism: partyPositions.populism,
        codedYear: partyPositions.codedYear,
        matchMethod: partyPositions.matchMethod,
        matchConfidence: partyPositions.matchConfidence,
      })
      .from(legislatureParties)
      .innerJoin(
        governmentBodies,
        eq(legislatureParties.bodyId, governmentBodies.id),
      )
      .innerJoin(
        jurisdictions,
        eq(governmentBodies.jurisdictionId, jurisdictions.id),
      )
      .leftJoin(bodyTotals, eq(bodyTotals.bodyId, legislatureParties.bodyId))
      .leftJoin(
        partyPositions,
        eq(partyPositions.legislaturePartyId, legislatureParties.id),
      )
      .orderBy(jurisdictions.name, sql`${legislatureParties.seatCount} DESC`);

    return rows.map((r) => {
      const total = r.bodyTotalSeats != null ? Number(r.bodyTotalSeats) : 0;
      const seatCount = r.seatCount ?? 0;
      const seatShare = total > 0 ? seatCount / total : null;

      // Only high-confidence matches are DISPLAYABLE (§4.2). 'review' rows —
      // fuzzy token matches and every one-party / non-competitive legislature —
      // resolve to position:null so the UI shows "ideology not recorded", never
      // a fabricated competitive dot. The raw rows remain in the table.
      const position: PartyPosition | null =
        r.matchConfidence === DISPLAYABLE_CONFIDENCE &&
        r.economicLR != null &&
        r.antiPlural != null &&
        r.codedYear != null
          ? {
              economicLR: Number(r.economicLR),
              economicLROrd: r.economicLROrd != null ? Number(r.economicLROrd) : null,
              antiPlural: Number(r.antiPlural),
              populism: r.populism != null ? Number(r.populism) : null,
              codedYear: Number(r.codedYear),
              matchMethod: r.matchMethod ?? "exact",
            }
          : null;

      return {
        id: r.id,
        partyName: r.partyName,
        color: r.color,
        seatCount,
        seatShare,
        isRulingCoalition: r.isRulingCoalition ?? false,
        country: {
          name: r.countryName,
          iso2: r.iso2,
          slug: r.slug,
          region: r.region,
        },
        chamber: r.chamber,
        chamberType: r.chamberType,
        position,
      };
    });
  } catch {
    return [];
  }
}

/** Coverage + filter-facet aggregates for the browser header, caption, and filters. */
export interface PartyBrowserFacets {
  /** Distinct countries that have at least one party row. */
  countries: { name: string; slug: string; iso2: string | null; region: string | null }[];
  /** Distinct regions (jurisdiction continents) present, sorted. */
  regions: string[];
  /** Total party rows across all chambers. */
  totalParties: number;
  /** Party rows carrying a V-Party position (plotted on the compass). */
  partiesWithPosition: number;
  /** Total seats across all party rows. */
  totalSeats: number;
  /** Seats held by parties that carry a V-Party position. */
  seatsWithPosition: number;
}

/**
 * Aggregates the browser needs for its filters and honest coverage caption
 * (e.g. "Plotting N of M parties with a V-Party position (≈X% of seats)").
 *
 * Soft-fails to a zeroed, empty-list shape on any error.
 */
export async function getPartyBrowserFacets(): Promise<PartyBrowserFacets> {
  const empty: PartyBrowserFacets = {
    countries: [],
    regions: [],
    totalParties: 0,
    partiesWithPosition: 0,
    totalSeats: 0,
    seatsWithPosition: 0,
  };

  try {
    // Distinct countries that hold at least one party row.
    const countries = await db
      .selectDistinct({
        name: jurisdictions.name,
        slug: jurisdictions.slug,
        iso2: jurisdictions.iso2,
        region: jurisdictions.continent,
      })
      .from(legislatureParties)
      .innerJoin(
        governmentBodies,
        eq(legislatureParties.bodyId, governmentBodies.id),
      )
      .innerJoin(
        jurisdictions,
        eq(governmentBodies.jurisdictionId, jurisdictions.id),
      )
      .orderBy(jurisdictions.name);

    const regions = Array.from(
      new Set(
        countries
          .map((c) => c.region)
          .filter((r): r is string => Boolean(r)),
      ),
    ).sort();

    // Row + seat totals, and the DISPLAYABLE position-covered subset, in one
    // pass. Only high-confidence matches count toward the coverage caption
    // (§4.2) — a 'review' row is never plotted, so counting it would overstate
    // coverage. The join is gated on match_confidence='high'.
    const totalsRows = await db
      .select({
        totalParties: sql<number>`count(*)`,
        totalSeats: sql<number>`coalesce(sum(${legislatureParties.seatCount}), 0)`,
        partiesWithPosition: sql<number>`count(${partyPositions.id})`,
        seatsWithPosition: sql<number>`coalesce(sum(case when ${partyPositions.id} is not null then ${legislatureParties.seatCount} else 0 end), 0)`,
      })
      .from(legislatureParties)
      .leftJoin(
        partyPositions,
        sql`${partyPositions.legislaturePartyId} = ${legislatureParties.id} and ${partyPositions.matchConfidence} = ${DISPLAYABLE_CONFIDENCE}`,
      );

    const t = totalsRows[0];

    return {
      countries: countries.map((c) => ({
        name: c.name,
        slug: c.slug,
        iso2: c.iso2,
        region: c.region,
      })),
      regions,
      totalParties: t ? Number(t.totalParties) : 0,
      partiesWithPosition: t ? Number(t.partiesWithPosition) : 0,
      totalSeats: t ? Number(t.totalSeats) : 0,
      seatsWithPosition: t ? Number(t.seatsWithPosition) : 0,
    };
  } catch {
    return empty;
  }
}

/** last_sync_at (ISO) for the two provenance sources the browser SourceDots mark. */
export interface PartySourceFreshness {
  /** Seat provenance — IPU Parline. */
  seatsSyncedAt: string | null;
  /** Position provenance — V-Party v2. */
  positionsSyncedAt: string | null;
}

/**
 * Reads the last sync timestamp for the seat source (IPU Parline) and the
 * ideology-position source (V-Party). Soft-fails to nulls so the SourceDots
 * still render an honest "Not yet synced" when the DB is unreachable.
 */
export async function getPartySourceFreshness(): Promise<PartySourceFreshness> {
  try {
    const rows = await db
      .select({ id: sources.id, lastSyncAt: sources.lastSyncAt })
      .from(sources)
      .where(inArray(sources.id, ["ipu_parline", "vparty"]));

    const iso = (v: unknown) =>
      v ? new Date(v as unknown as string).toISOString() : null;

    const seats = rows.find((r) => r.id === "ipu_parline");
    const positions = rows.find((r) => r.id === "vparty");

    return {
      seatsSyncedAt: iso(seats?.lastSyncAt),
      positionsSyncedAt: iso(positions?.lastSyncAt),
    };
  } catch {
    return { seatsSyncedAt: null, positionsSyncedAt: null };
  }
}
