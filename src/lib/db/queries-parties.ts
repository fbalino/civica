import { eq, sql } from "drizzle-orm";
import { db } from "./index";
import {
  legislatureParties,
  governmentBodies,
  jurisdictions,
  partyCompositionRuns,
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
// Default callers can retain the historical soft-fail behavior. The public
// Party Explorer requests `throwOnError` so it can render an outage separately
// from a successful query with no party rows.
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
  source: {
    id: string;
    retrievedAt: string;
    license: string;
    url: string;
  };
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

export interface PartyBrowserQueryOptions {
  throwOnError?: boolean;
}

/**
 * Raw fields needed to resolve a party's DISPLAYABLE V-Party position — the
 * shape of one joined `getPartiesForBrowser` row, narrowed to just the
 * position columns. Exported + pure (no DB access) so the honesty contract —
 * "only a high-confidence V-Party match may ever render as a fact" — is
 * unit-testable with fixtures, not just exercised implicitly by the live
 * query. See `src/lib/db/__tests__/atl-011-party-honesty.test.ts`.
 */
export interface RawPositionRow {
  matchConfidence: string | null;
  economicLR: number | string | null;
  economicLROrd: number | string | null;
  antiPlural: number | string | null;
  populism: number | string | null;
  codedYear: number | string | null;
  matchMethod: string | null;
  positionSourceId: string | null;
  positionSourceRetrievedAt: string | Date | null;
  positionSourceLicense: string | null;
  positionSourceUrl: string | null;
}

/**
 * Resolves a joined row to a DISPLAYABLE `PartyPosition`, or `null`.
 *
 * This is the single choke point that keeps ideology honest (resolution §5,
 * §4.2): a 'review'-confidence match (fuzzy token match, or ANY party in a
 * one-party / non-competitive legislature per
 * `scripts/ingest-vparty-positions.ts`) — even one that carries fully-formed
 * numeric axis values — is NEVER surfaced as a displayable position. Civica
 * never infers or guesses an ideology; a party without a trusted V-Party
 * match renders "ideology not recorded" instead.
 */
export function resolvePartyPosition(row: RawPositionRow): PartyPosition | null {
  if (
    row.matchConfidence !== DISPLAYABLE_CONFIDENCE ||
    row.economicLR == null ||
    row.antiPlural == null ||
    row.codedYear == null ||
    row.positionSourceId == null ||
    row.positionSourceRetrievedAt == null ||
    row.positionSourceLicense == null ||
    row.positionSourceUrl == null
  ) {
    return null;
  }
  return {
    economicLR: Number(row.economicLR),
    economicLROrd: row.economicLROrd != null ? Number(row.economicLROrd) : null,
    antiPlural: Number(row.antiPlural),
    populism: row.populism != null ? Number(row.populism) : null,
    codedYear: Number(row.codedYear),
    matchMethod: row.matchMethod ?? "exact",
    source: {
      id: row.positionSourceId,
      retrievedAt: new Date(row.positionSourceRetrievedAt).toISOString(),
      license: row.positionSourceLicense,
      url: row.positionSourceUrl,
    },
  };
}

/**
 * Raw fields needed to resolve a party's real seats/coalition source. Exported
 * + pure for the same reason as `resolvePartyPosition`.
 */
export interface RawSeatsSourceRow {
  seatsSourceId: string | null;
  seatsSourceRetrievedAt: string | Date | null;
  seatsSourceLicense: string | null;
  seatsSourceUrl: string | null;
}

/**
 * Resolves a joined row to the chamber's real `SeatsSource`, or `null` when
 * no complete immutable composition-run provenance exists for that chamber.
 * Never defaults to
 * `ipu_parline` (or any other fixed id) — a chamber with no recorded source
 * (legacy pre-provenance seed data) must render an honest "source not
 * recorded" state instead of a fabricated attribution.
 */
export function resolveSeatsSource(row: RawSeatsSourceRow): SeatsSource | null {
  if (
    row.seatsSourceId == null ||
    row.seatsSourceRetrievedAt == null ||
    row.seatsSourceLicense == null ||
    row.seatsSourceUrl == null
  ) {
    return null;
  }
  return {
    id: row.seatsSourceId,
    retrievedAt: new Date(row.seatsSourceRetrievedAt).toISOString(),
    license: row.seatsSourceLicense,
    url: row.seatsSourceUrl,
  };
}

/** The country a party sits in, denormalised for the browser list + filters. */
export interface PartyCountry {
  name: string;
  iso2: string | null;
  slug: string;
  /** World region (the jurisdiction's `continent`, e.g. "Europe"). */
  region: string | null;
}

/**
 * The provenance of a party's seat/coalition data, read from the immutable
 * `party_composition_runs` record linked to that chamber participation.
 *
 * Civica's two composition writers (`scripts/sync-ipu-parline.ts` → source
 * `ipu_parline`, CC-BY-NC-SA-4.0; `scripts/sync-wikidata-parties.ts` → source
 * `wikidata`, CC0) each populate different chambers, so a fixed source id can
 * NOT be assumed for every row — measured live, ~44% of party rows are
 * actually Wikidata-sourced, and a small legacy set (pre-provenance manual
 * seed chambers such as the UK House of Lords or China's National People's
 * Congress) was adopted from legacy data without a complete source tuple.
 * `null` here means exactly that: no complete source, vintage, license, and
 * URL tuple is recorded, so the browser does not invent one.
 */
export interface SeatsSource {
  /** `sources.id` of whichever composition sync last wrote this chamber. */
  id: string;
  /** ISO timestamp of the immutable source retrieval. */
  retrievedAt: string;
  license: string;
  url: string;
}

/** One legislature party, enriched for the browser + compass. */
export interface BrowserParty {
  /** Stable chamber-participation UUID retained across composition refreshes. */
  id: string;
  /** Stable cross-chamber party identity. */
  partyId: string;
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
  /**
   * The real source of this party's seat/coalition data, or null when the
   * chamber's retained row has no complete composition-run provenance (legacy
   * seed data; see `SeatsSource`). Never assume `ipu_parline`.
   */
  seatsSource: SeatsSource | null;
}

/**
 * Every legislature party, joined to country + chamber + (optional) V-Party
 * position. Ordered by country then descending seats so the browser can group
 * by country and lead with the largest parties.
 *
 * Soft-fails to `[]` by default; `throwOnError` lets the reader distinguish an
 * outage from a fulfilled empty result.
 */
export async function getPartiesForBrowser(
  options: PartyBrowserQueryOptions = {},
): Promise<BrowserParty[]> {
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
      .where(eq(legislatureParties.isCurrent, true))
      .groupBy(legislatureParties.bodyId)
      .as("body_totals");

    const rows = await db
      .select({
        id: legislatureParties.id,
        partyId: legislatureParties.partyId,
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
        positionSourceId: sources.id,
        positionSourceRetrievedAt: sources.lastSyncAt,
        positionSourceLicense: sources.license,
        positionSourceUrl: sources.baseUrl,
        seatsSourceId: partyCompositionRuns.sourceId,
        seatsSourceRetrievedAt: partyCompositionRuns.sourceRetrievedAt,
        seatsSourceLicense: partyCompositionRuns.sourceLicense,
        seatsSourceUrl: partyCompositionRuns.sourceUrl,
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
      .leftJoin(
        partyCompositionRuns,
        eq(partyCompositionRuns.id, legislatureParties.compositionRunId),
      )
      .leftJoin(sources, eq(sources.id, partyPositions.sourceId))
      .where(eq(legislatureParties.isCurrent, true))
      .orderBy(jurisdictions.name, sql`${legislatureParties.seatCount} DESC`);

    return rows.map((r) => {
      const total = r.bodyTotalSeats != null ? Number(r.bodyTotalSeats) : 0;
      const seatCount = r.seatCount ?? 0;
      const seatShare = total > 0 ? seatCount / total : null;

      // Only high-confidence matches are DISPLAYABLE (§4.2). 'review' rows —
      // fuzzy token matches and every one-party / non-competitive legislature —
      // resolve to position:null so the UI shows "ideology not recorded", never
      // a fabricated competitive dot. The raw rows remain in the table.
      const position = resolvePartyPosition(r);

      // Never fabricate seat provenance: a chamber with no complete source run
      // resolves to seatsSource:null, rendered as an honest "source not
      // recorded" chip instead of a SourceDot (see SeatsSource doc comment).
      const seatsSource = resolveSeatsSource(r);

      return {
        id: r.id,
        partyId: r.partyId,
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
        seatsSource,
      };
    });
  } catch (error) {
    if (options.throwOnError) throw error;
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
 * Soft-fails to a zeroed, empty-list shape by default; `throwOnError` lets the
 * reader distinguish an outage from an empty party catalog.
 */
export async function getPartyBrowserFacets(
  options: PartyBrowserQueryOptions = {},
): Promise<PartyBrowserFacets> {
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
      .where(eq(legislatureParties.isCurrent, true))
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
      )
      .where(eq(legislatureParties.isCurrent, true));

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
  } catch (error) {
    if (options.throwOnError) throw error;
    return empty;
  }
}

/**
 * last_sync_at (ISO) for the ideology-position source (V-Party v2) — the
 * single source `party_positions` is matched from, so one global timestamp is
 * accurate for every row. Seats have NO equivalent single-source timestamp:
 * each row carries its own real `seatsSource.retrievedAt` (see
 * `BrowserParty` / `getPartiesForBrowser`), because IPU Parline and the
 * Wikidata fallback sync populate different chambers at different times —
 * collapsing that into one global `sources.last_sync_at` value would
 * misrepresent rows synced by whichever source didn't run most recently.
 */
export interface PartySourceFreshness {
  /** Position provenance — V-Party v2. */
  positionsSyncedAt: string | null;
}

/**
 * Reads the last sync timestamp for the ideology-position source (V-Party).
 * Soft-fails to null so the SourceDot still renders an honest "Not yet
 * synced" when the DB is unreachable.
 */
export async function getPartySourceFreshness(): Promise<PartySourceFreshness> {
  try {
    const rows = await db
      .select({ id: sources.id, lastSyncAt: sources.lastSyncAt })
      .from(sources)
      .where(eq(sources.id, "vparty"));

    const iso = (v: unknown) =>
      v ? new Date(v as unknown as string).toISOString() : null;

    return { positionsSyncedAt: iso(rows[0]?.lastSyncAt) };
  } catch {
    return { positionsSyncedAt: null };
  }
}
