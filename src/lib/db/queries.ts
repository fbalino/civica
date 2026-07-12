import { eq, and, desc, asc, sql } from "drizzle-orm";
import { db } from "./index";
import { displayDimensionScore } from "@/lib/ci/normalize-v2";
import {
  CURRENT_CI_METHODOLOGY_VERSION,
  CURRENT_CI_RELEASE_ID,
} from "@/lib/ci/current-release";
import {
  resolveCiRelease,
  selectCiReleaseDimensionRows,
} from "@/lib/ci/release-selection";
import { parseDataValueStatus } from "@/lib/data/value-state";
import {
  buildGovernmentClassificationMap,
  type JurisdictionTaxonomyInput,
} from "./government-taxonomy";
import {
  getGovernmentTaxonomyGroupingLabel,
  type GovernmentTaxonomyLens,
} from "@/lib/government-taxonomy";
import {
  jurisdictions,
  countryFactbookSections,
  countryFacts,
  governmentBodies,
  offices,
  terms,
  persons,
  sources,
  legislatureParties,
  constitutions,
  elections,
  electionResults,
  ciCompositeScores,
  ciDimensionScores,
  ciMethodologyVersions,
  indicatorHistory,
  bills,
  organizations,
  organizationMemberships,
} from "./schema";

export async function getJurisdictionBySlug(slug: string) {
  const results = await db
    .select()
    .from(jurisdictions)
    .where(eq(jurisdictions.slug, slug))
    .limit(1);
  const jurisdiction = results[0] ?? null;
  if (!jurisdiction) return null;
  const classificationMap = await buildGovernmentClassificationMap([
    jurisdiction satisfies JurisdictionTaxonomyInput,
  ]);
  return {
    ...jurisdiction,
    governmentClassification: classificationMap.get(jurisdiction.id) ?? null,
  };
}

export async function getAllJurisdictions() {
  const rows = await db
    .select()
    .from(jurisdictions)
    .where(
      sql`${jurisdictions.type} = 'sovereign_state' AND LOWER(${jurisdictions.name}) <> 'none'`,
    )
    .orderBy(
      sql`${jurisdictions.population} DESC NULLS LAST`,
      asc(jurisdictions.name),
    );
  const classificationMap = await buildGovernmentClassificationMap(rows);
  return rows.map((row) => ({
    ...row,
    governmentClassification: classificationMap.get(row.id) ?? null,
  }));
}

export async function getFactbookCountryOptions() {
  return db
    .select({
      slug: jurisdictions.slug,
      name: jurisdictions.name,
      iso2: jurisdictions.iso2,
      iso3: jurisdictions.iso3,
    })
    .from(jurisdictions)
    .where(
      sql`${jurisdictions.type} = 'sovereign_state' AND LOWER(${jurisdictions.name}) <> 'none'`,
    )
    .orderBy(asc(jurisdictions.name));
}

export async function getFactbookSections(jurisdictionId: string) {
  return db
    .select()
    .from(countryFactbookSections)
    .where(eq(countryFactbookSections.jurisdictionId, jurisdictionId))
    .orderBy(asc(countryFactbookSections.displayOrder));
}

export async function getFactbookSection(
  jurisdictionId: string,
  sectionName: string,
) {
  const results = await db
    .select()
    .from(countryFactbookSections)
    .where(
      sql`${countryFactbookSections.jurisdictionId} = ${jurisdictionId} AND ${countryFactbookSections.sectionName} = ${sectionName}`,
    )
    .limit(1);
  return results[0] ?? null;
}

export async function getCountryFacts(
  jurisdictionId: string,
  category?: string,
) {
  const query = db
    .select()
    .from(countryFacts)
    .where(
      category
        ? sql`${countryFacts.jurisdictionId} = ${jurisdictionId} AND ${countryFacts.category} = ${category}`
        : eq(countryFacts.jurisdictionId, jurisdictionId),
    );
  return query;
}

export async function rankCountriesByFact(
  factKey: string,
  direction: "asc" | "desc" = "desc",
  limit = 20,
) {
  // `country_facts` carries one row per (jurisdiction, fact_key, source).
  // Rank over a deduplicated set — one row per (jurisdiction, fact_key) —
  // so a country can never repeat or inflate the ordering once a second
  // source row exists. DISTINCT ON picks the canonical row per country by
  // preferring status='active' (NULL treated as active for legacy rows),
  // then the most recent vintage (as_of, then retrieved_at). This is a
  // no-op today (single source per fact) but correct once a second source
  // appears.
  const canonicalFact = db
    .selectDistinctOn([countryFacts.jurisdictionId, countryFacts.factKey])
    .from(countryFacts)
    .where(
      sql`${countryFacts.factKey} = ${factKey} AND ${countryFacts.factValueNumeric} IS NOT NULL`,
    )
    .orderBy(
      countryFacts.jurisdictionId,
      countryFacts.factKey,
      sql`(${countryFacts.status} = 'active' OR ${countryFacts.status} IS NULL) DESC`,
      sql`${countryFacts.asOf} DESC NULLS LAST`,
      desc(countryFacts.retrievedAt),
    )
    .as("canonical_fact");

  return db
    .select({
      jurisdiction: jurisdictions,
      // Select the specific fact columns the consumers use (rankings page)
      // — Drizzle cannot select a whole multi-column subquery as one field.
      fact: {
        factValueNumeric: canonicalFact.factValueNumeric,
        factValue: canonicalFact.factValue,
        sourceId: canonicalFact.sourceId,
        retrievedAt: canonicalFact.retrievedAt,
        asOf: canonicalFact.asOf,
      },
    })
    .from(canonicalFact)
    .innerJoin(
      jurisdictions,
      eq(canonicalFact.jurisdictionId, jurisdictions.id),
    )
    .orderBy(
      direction === "desc"
        ? desc(canonicalFact.factValueNumeric)
        : asc(canonicalFact.factValueNumeric),
    )
    .limit(limit);
}

/**
 * Wide, one-row-per-country matrix backing the multi-column `/rankings`
 * table. Every sensible country-level metric Civica tracks with broad
 * coverage becomes a column, each carrying its own numeric value + source
 * provenance (source id + retrieved date) so the page can render a
 * per-column `<SourceDot>`. Consumers sort client-side.
 *
 * Two provenance layers are unioned per country:
 *  - Structural / factbook facts from `country_facts`, deduped to one
 *    canonical row per (jurisdiction, fact_key) with the same DISTINCT ON
 *    rule as `rankCountriesByFact` (prefer status='active', then newest
 *    vintage) so a second source row can never inflate or repeat a value.
 *  - Governance scores from the beta Civica Index: the composite
 *    (`ci_composite_scores`) plus the four normalized 0-100 dimension
 *    scores (`ci_dimension_scores`), both pinned to `methodology_version =
 *    'beta'` at the latest available quarter (see the CI read-query
 *    invariant — a v1.0/beta mix double-counts).
 *
 * A metric a country lacks is simply absent from `metrics`; the UI renders
 * an em-dash. Only sovereign states are included.
 */
export type RankingMetricCell = {
  /** Numeric value used for sorting + formatting. */
  value: number;
  /** Source id for the `<SourceDot>` (e.g. "cia_factbook", "undp_hdi"). */
  source: string;
  /** ISO string for the dot's freshness label, or null. */
  retrievedAt: string | null;
};

export type RankingCountryRow = {
  slug: string;
  name: string;
  iso2: string | null;
  /** Keyed by ranking-metric id (see RANKING_COLUMNS on the page). */
  metrics: Record<string, RankingMetricCell>;
};

/**
 * Build one Beta CI-dimension ranking cell from a raw `ci_dimension_scores`
 * row's `raw_value` + `source_id`, using the same v2 fixed-bound transform
 * as the headline composite (`displayDimensionScore`). Returns null when the
 * raw value is missing or the source isn't in the v2 bounds table — the
 * caller must hide the cell rather than fall back to the legacy
 * `normalized_score` column, which does not reconcile with the Beta
 * headline. Pure and DB-free so it is directly regression-testable.
 */
export function rankingDimensionCell(
  rawValue: number | string | null | undefined,
  sourceId: string,
  createdAt: string | Date | null,
): RankingMetricCell | null {
  const numeric =
    rawValue === null || rawValue === undefined ? null : Number(rawValue);
  const value = displayDimensionScore(numeric, sourceId);
  if (value === null) return null;
  return { value, source: sourceId, retrievedAt: toIso(createdAt) };
}

/** country_facts fact keys surfaced as ranking columns, keyed by the
 *  column id the page uses. Kept here so the pivot and the page agree. */
const RANKING_FACT_KEYS: Record<string, string> = {
  population: "population",
  gdp_ppp: "gdp_ppp",
  gdp_per_capita_ppp: "gdp_per_capita_ppp",
  total_area: "total_area",
  life_expectancy: "life_expectancy",
  hdi_score: "hdi_score",
  literacy_rate: "literacy_rate",
  median_age: "median_age",
};

export async function getRankingsMatrix(): Promise<RankingCountryRow[]> {
  const factKeys = Object.values(RANKING_FACT_KEYS);

  const byId = new Map<string, RankingCountryRow & { id: string }>();
  const ensure = (
    id: string,
    slug: string,
    name: string,
    iso2: string | null,
  ) => {
    let row = byId.get(id);
    if (!row) {
      row = { id, slug, name, iso2, metrics: {} };
      byId.set(id, row);
    }
    return row;
  };

  // Reverse maps: fact_key/dimension -> column id.
  const factKeyToColumn = new Map(
    Object.entries(RANKING_FACT_KEYS).map(([col, key]) => [key, col]),
  );

  // ── country_facts (canonical row per (jurisdiction, fact_key)) ──
  const factResult = await db.execute(sql`
    SELECT
      j.id            AS jurisdiction_id,
      j.slug,
      j.name,
      j.iso2,
      cf.fact_key,
      cf.fact_value_numeric,
      cf.source_id,
      cf.retrieved_at
    FROM (
      SELECT DISTINCT ON (jurisdiction_id, fact_key)
        jurisdiction_id, fact_key, fact_value_numeric, source_id, retrieved_at
      FROM country_facts
      WHERE fact_key IN ${factKeys} AND fact_value_numeric IS NOT NULL
      ORDER BY
        jurisdiction_id,
        fact_key,
        (status = 'active' OR status IS NULL) DESC,
        as_of DESC NULLS LAST,
        retrieved_at DESC
    ) cf
    JOIN jurisdictions j
      ON j.id = cf.jurisdiction_id
      AND j.type = 'sovereign_state' AND LOWER(j.name) <> 'none'
  `);
  const factRows = (
    Array.isArray(factResult)
      ? factResult
      : ((factResult as { rows?: unknown[] }).rows ?? [])
  ) as Array<{
    jurisdiction_id: string;
    slug: string;
    name: string;
    iso2: string | null;
    fact_key: string;
    fact_value_numeric: number | string | null;
    source_id: string;
    retrieved_at: string | Date | null;
  }>;

  for (const r of factRows) {
    const column = factKeyToColumn.get(r.fact_key);
    if (!column) continue;
    const value = Number(r.fact_value_numeric);
    if (!Number.isFinite(value)) continue;
    const row = ensure(r.jurisdiction_id, r.slug, r.name, r.iso2);
    row.metrics[column] = {
      value,
      source: r.source_id,
      retrievedAt: toIso(r.retrieved_at),
    };
  }

  return [...byId.values()].map(({ id: _id, ...row }) => row);
}

function toIso(value: string | Date | null | undefined): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export async function getGovernmentStructure(jurisdictionId: string) {
  const bodies = await db
    .select()
    .from(governmentBodies)
    .where(eq(governmentBodies.jurisdictionId, jurisdictionId))
    .orderBy(asc(governmentBodies.hierarchyLevel));

  const bodyIds = bodies.map((b) => b.id);
  if (bodyIds.length === 0) return { bodies, offices: [], currentTerms: [] };

  const allOffices = await db
    .select()
    .from(offices)
    .where(sql`${offices.bodyId} IN ${bodyIds}`)
    // display_order preserves the CIA "World Leaders" list order for cabinet
    // offices (protocol/seniority, not alphabetical). ASC NULLS LAST in
    // Postgres, so legacy offices with a null order sort after. The org chart's
    // sortRoles() re-groups by rank but is a STABLE sort, so within a rank
    // (e.g. all cabinet ministers) this order is preserved.
    .orderBy(asc(offices.displayOrder));

  const officeIds = allOffices.map((o) => o.id);
  if (officeIds.length === 0)
    return { bodies, offices: allOffices, currentTerms: [] };

  const currentTerms = await db
    .select({
      term: terms,
      person: persons,
    })
    .from(terms)
    .innerJoin(persons, eq(terms.personId, persons.id))
    .where(
      sql`${terms.officeId} IN ${officeIds} AND ${terms.isCurrent} = true`,
    );

  return { bodies, offices: allOffices, currentTerms };
}

export async function getGovernmentHierarchy(jurisdictionId: string) {
  const bodies = await db
    .select()
    .from(governmentBodies)
    .where(eq(governmentBodies.jurisdictionId, jurisdictionId))
    .orderBy(asc(governmentBodies.hierarchyLevel));

  const bodyIds = bodies.map((b) => b.id);
  if (bodyIds.length === 0)
    return { bodies: [], offices: [], currentTerms: [], parties: [] };

  const allOffices = await db
    .select()
    .from(offices)
    .where(sql`${offices.bodyId} IN ${bodyIds}`)
    // See getGovernmentStructure: preserve CIA cabinet list order via
    // display_order (ASC NULLS LAST); stable downstream sorts keep it.
    .orderBy(asc(offices.displayOrder));

  const officeIds = allOffices.map((o) => o.id);

  const currentTerms =
    officeIds.length > 0
      ? await db
          .select({ term: terms, person: persons })
          .from(terms)
          .innerJoin(persons, eq(terms.personId, persons.id))
          .where(
            sql`${terms.officeId} IN ${officeIds} AND ${terms.isCurrent} = true`,
          )
      : [];

  const rawParties = await db
    .select()
    .from(legislatureParties)
    .where(sql`${legislatureParties.bodyId} IN ${bodyIds}`)
    .orderBy(desc(legislatureParties.seatCount));

  // Mirror the load-atlas-data normalisation: when the IPU/Wikidata
  // sync aggregated multiple elections (Brazil's lower house reads as
  // 3,084 party seats vs a 513-seat chamber) rescale each party's
  // seatCount to the chamber's actual total, preserving the ordering.
  const partiesByBody = new Map<string, typeof rawParties>();
  for (const p of rawParties) {
    const arr = partiesByBody.get(p.bodyId) ?? [];
    arr.push(p);
    partiesByBody.set(p.bodyId, arr);
  }
  const parties: typeof rawParties = [];
  for (const body of bodies) {
    const bp = partiesByBody.get(body.id) ?? [];
    if (!bp.length) continue;
    const totalSeats =
      body.totalSeats ?? bp.reduce((s, p) => s + p.seatCount, 0);
    const sumSeats = bp.reduce((s, p) => s + p.seatCount, 0);
    const isAggregated = sumSeats > 0 && sumSeats > totalSeats * 1.2;
    for (const p of bp) {
      const seatCount = isAggregated
        ? Math.round((p.seatCount / sumSeats) * totalSeats)
        : p.seatCount;
      if (seatCount === 0 && isAggregated) continue;
      parties.push({ ...p, seatCount });
    }
  }

  return { bodies, offices: allOffices, currentTerms, parties };
}

export async function getJurisdictionsBySlugs(slugs: string[]) {
  if (slugs.length === 0) return [];
  const rows = await db
    .select()
    .from(jurisdictions)
    .where(sql`${jurisdictions.slug} IN ${slugs}`);
  const classificationMap = await buildGovernmentClassificationMap(rows);
  return rows.map((row) => ({
    ...row,
    governmentClassification: classificationMap.get(row.id) ?? null,
  }));
}

export async function getCountryRankings(jurisdictionId: string) {
  const keys = [
    "population",
    "gdp_ppp",
    "total_area",
    "life_expectancy",
    "gdp_per_capita_ppp",
  ];
  // `country_facts` carries one row per (jurisdiction, fact_key, source).
  // Rank/count over a deduplicated set — one canonical row per
  // (jurisdiction, fact_key) — so a second source row can never inflate a
  // country's rank/total or let a country rank against its own duplicate.
  // The DISTINCT ON canonical-selection rule mirrors `rankCountriesByFact`
  // above: prefer status='active' (NULL treated as active for legacy rows),
  // then the most recent vintage (as_of, then retrieved_at). No-op today
  // (single source per fact) but correct once a second source appears.
  const result = await db.execute(sql`
    SELECT fact_key, rank, total
    FROM (
      SELECT
        fact_key,
        jurisdiction_id,
        RANK() OVER (PARTITION BY fact_key ORDER BY fact_value_numeric DESC) AS rank,
        COUNT(*) OVER (PARTITION BY fact_key) AS total
      FROM (
        SELECT DISTINCT ON (jurisdiction_id, fact_key)
          jurisdiction_id,
          fact_key,
          fact_value_numeric
        FROM country_facts
        WHERE fact_key IN ${keys} AND fact_value_numeric IS NOT NULL
        ORDER BY
          jurisdiction_id,
          fact_key,
          (status = 'active' OR status IS NULL) DESC,
          as_of DESC NULLS LAST,
          retrieved_at DESC
      ) canonical_facts
    ) ranked
    WHERE jurisdiction_id = ${jurisdictionId}
  `);
  const rows = Array.isArray(result)
    ? result
    : ((result as { rows: unknown[] }).rows ?? []);
  return (
    rows as {
      fact_key: string;
      rank: string | number;
      total: string | number;
    }[]
  ).map((r) => ({
    key: r.fact_key,
    rank: Number(r.rank),
    total: Number(r.total),
  }));
}

export async function getRelatedCountries(
  jurisdictionId: string,
  continent: string | null,
  limit = 6,
) {
  if (!continent) return [];
  return db
    .select({
      slug: jurisdictions.slug,
      name: jurisdictions.name,
      iso2: jurisdictions.iso2,
      capital: jurisdictions.capital,
      population: jurisdictions.population,
    })
    .from(jurisdictions)
    .where(
      sql`${jurisdictions.continent} = ${continent} AND ${jurisdictions.id} != ${jurisdictionId} AND ${jurisdictions.type} = 'sovereign_state'`,
    )
    .orderBy(desc(jurisdictions.population))
    .limit(limit);
}

export async function getLegislatureComposition(jurisdictionId: string) {
  const bodies = await db
    .select()
    .from(governmentBodies)
    .where(
      sql`${governmentBodies.jurisdictionId} = ${jurisdictionId} AND ${governmentBodies.branch} = 'legislative'`,
    )
    .orderBy(asc(governmentBodies.hierarchyLevel));

  if (bodies.length === 0) return [];

  const bodyIds = bodies.map((b) => b.id);
  const parties = await db
    .select()
    .from(legislatureParties)
    .where(sql`${legislatureParties.bodyId} IN ${bodyIds}`)
    .orderBy(desc(legislatureParties.seatCount));

  return bodies.map((body) => ({
    body,
    parties: parties.filter((p) => p.bodyId === body.id),
  }));
}

export async function getSource(sourceId: string) {
  const results = await db
    .select()
    .from(sources)
    .where(eq(sources.id, sourceId))
    .limit(1);
  return results[0] ?? null;
}

export async function getAllSources() {
  return db.select().from(sources).orderBy(sources.name);
}

export async function getDemocracyScores(jurisdictionId: string) {
  const jurisdiction = await db
    .select({
      democracyIndex: jurisdictions.democracyIndex,
      continent: jurisdictions.continent,
    })
    .from(jurisdictions)
    .where(eq(jurisdictions.id, jurisdictionId))
    .limit(1);

  const freedomHouseFacts = await db
    .select()
    .from(countryFacts)
    .where(
      sql`${countryFacts.jurisdictionId} = ${jurisdictionId} AND ${countryFacts.factKey} LIKE 'freedom_house%'`,
    );

  return {
    democracyIndex: jurisdiction[0]?.democracyIndex ?? null,
    continent: jurisdiction[0]?.continent ?? null,
    freedomHouseFacts,
  };
}

export async function getRegionalDemocracyComparison(
  jurisdictionId: string,
  continent: string | null,
) {
  if (!continent) return [];
  return db
    .select({
      id: jurisdictions.id,
      name: jurisdictions.name,
      slug: jurisdictions.slug,
      iso2: jurisdictions.iso2,
      democracyIndex: jurisdictions.democracyIndex,
    })
    .from(jurisdictions)
    .where(
      sql`${jurisdictions.continent} = ${continent} AND ${jurisdictions.type} = 'sovereign_state' AND ${jurisdictions.democracyIndex} IS NOT NULL`,
    )
    .orderBy(desc(jurisdictions.democracyIndex))
    .limit(20);
}

export async function getConstitution(jurisdictionId: string) {
  const results = await db
    .select()
    .from(constitutions)
    .where(eq(constitutions.jurisdictionId, jurisdictionId))
    .limit(1);
  return results[0] ?? null;
}

export async function getLeaderTimeline(jurisdictionId: string) {
  const bodies = await db
    .select()
    .from(governmentBodies)
    .where(eq(governmentBodies.jurisdictionId, jurisdictionId));

  const bodyIds = bodies.map((b) => b.id);
  if (bodyIds.length === 0) return [];

  const allOffices = await db
    .select()
    .from(offices)
    .where(sql`${offices.bodyId} IN ${bodyIds}`);

  const officeIds = allOffices.map((o) => o.id);
  if (officeIds.length === 0) return [];

  // Layered ordering: rank by office type first (Head of State → Head of
  // Government → deputy → cabinet → legislative leader → other), then by
  // start date desc within rank. The pure desc(startDate) order used to
  // float a recently confirmed cabinet member above the head of state,
  // which read as the AG running the country. The full org-chart redesign
  // is still deferred to its own session
  // (~/.claude/plans/great-questions-1-build-tender-falcon.md Phase I);
  // this is the targeted fix for the leaders list ordering only.
  const allTerms = await db
    .select({ term: terms, person: persons })
    .from(terms)
    .innerJoin(persons, eq(terms.personId, persons.id))
    .where(sql`${terms.officeId} IN ${officeIds}`)
    .orderBy(desc(terms.startDate));

  const OFFICE_RANK: Record<string, number> = {
    head_of_state: 0,
    head_of_government: 1,
    deputy_head: 2,
    cabinet: 3,
    legislative_leader: 4,
    // The stored office_type for chief justices is `judicial_leader`, not
    // `judicial` — the bare `judicial` key never matched, so chief justices
    // fell to the `?? 99` "unknown" rank and sorted last. Key on the real
    // stored value (the legacy `judicial` alias is kept, harmless).
    judicial_leader: 5,
    judicial: 5,
    // CIA World Leaders cabinet import (P4) office_type tags — rank after the
    // legislative/judicial leadership so the Leaders list reads top-down.
    central_bank: 6,
    diplomatic: 7,
    official: 8,
  };
  const rankOf = (t: string | null | undefined) =>
    OFFICE_RANK[t ?? "unknown"] ?? 99;

  const enriched = allTerms.map((t) => {
    const office = allOffices.find((o) => o.id === t.term.officeId);
    return {
      personName: t.person.name,
      photoUrl: t.person.photoUrl,
      // P2 media enrichment (Wikidata P18 portrait + P569 birthdate). The
      // photo columns carry per-file Commons attribution; the renderer builds
      // the CDN thumbnail via wikimediaUrl(photoUrl). All nullable — a leader
      // with no free portrait keeps photoUrl null → monogram fallback.
      dateOfBirth: t.person.dateOfBirth,
      photoLicense: t.person.photoLicense,
      photoCredit: t.person.photoCredit,
      officeName: office?.name ?? "Unknown",
      officeType: office?.officeType ?? "unknown",
      partyName: t.term.partyName,
      partyColor: t.term.partyColor,
      startDate: t.term.startDate,
      endDate: t.term.endDate,
      isCurrent: t.term.isCurrent,
    };
  });

  enriched.sort((a, b) => {
    // Current leaders always before past leaders.
    if (a.isCurrent !== b.isCurrent) return a.isCurrent ? -1 : 1;
    const ra = rankOf(a.officeType);
    const rb = rankOf(b.officeType);
    if (ra !== rb) return ra - rb;
    // Within the same office rank, newer first.
    const aT = a.startDate ? new Date(a.startDate).getTime() : 0;
    const bT = b.startDate ? new Date(b.startDate).getTime() : 0;
    return bT - aT;
  });

  return enriched;
}

export async function getElectionsByJurisdiction(jurisdictionId: string) {
  const rows = await db
    .select()
    .from(elections)
    .where(eq(elections.jurisdictionId, jurisdictionId))
    .orderBy(desc(elections.electionDate));

  const electionIds = rows.map((e) => e.id);
  if (electionIds.length === 0)
    return rows.map((e) => ({ election: e, results: [] as typeof allResults }));

  const allResults = await db
    .select()
    .from(electionResults)
    .where(sql`${electionResults.electionId} IN ${electionIds}`)
    .orderBy(desc(electionResults.votesPercent));

  return rows.map((election) => ({
    election,
    results: allResults.filter((r) => r.electionId === election.id),
  }));
}

export async function getUpcomingElections(limit = 20) {
  return db
    .select({
      election: elections,
      jurisdiction: {
        slug: jurisdictions.slug,
        name: jurisdictions.name,
        iso2: jurisdictions.iso2,
        continent: jurisdictions.continent,
      },
    })
    .from(elections)
    .innerJoin(jurisdictions, eq(elections.jurisdictionId, jurisdictions.id))
    .where(sql`${elections.electionDate} >= CURRENT_DATE`)
    .orderBy(asc(elections.electionDate))
    .limit(limit);
}

export async function getRecentElectionsWithResults(limit = 60) {
  const rows = await db
    .select({
      election: elections,
      jurisdiction: {
        slug: jurisdictions.slug,
        name: jurisdictions.name,
        iso2: jurisdictions.iso2,
        continent: jurisdictions.continent,
      },
    })
    .from(elections)
    .innerJoin(jurisdictions, eq(elections.jurisdictionId, jurisdictions.id))
    // "Recent Results" is a results section: only surface past elections that
    // actually carry party/candidate result rows, so a card never renders as an
    // empty box (owner feedback: Sao Tome/Ethiopia/Guinea showed blank cards).
    // ~70% of past elections have no compiled results (IPU carries seats only
    // for the chambers it classifies; most Wikidata presidential rows carry no
    // results at all); showing muted "not compiled" cards for all of them would
    // read as broken. Result-less elections stay discoverable in the calendar
    // (upcoming) and on each country page. Only source-confirmed dates qualify —
    // a Civica-computed "estimated" next date never has results and is excluded
    // here regardless. See plan/elections-data-sourcing-resolution-v1.md §6.
    .where(
      sql`${elections.electionDate} < CURRENT_DATE
        AND ${elections.dateConfidence} IS DISTINCT FROM 'estimated'
        AND EXISTS (
          SELECT 1 FROM ${electionResults}
          WHERE ${electionResults.electionId} = ${elections.id}
        )`,
    )
    .orderBy(desc(elections.electionDate))
    .limit(limit);

  const electionIds = rows.map((r) => r.election.id);
  if (electionIds.length === 0)
    return rows.map((r) => ({ ...r, results: [] as typeof allResults }));

  const allResults = await db
    .select()
    .from(electionResults)
    .where(sql`${electionResults.electionId} IN ${electionIds}`)
    .orderBy(desc(electionResults.votesPercent));

  return rows.map((r) => ({
    ...r,
    results: allResults.filter((res) => res.electionId === r.election.id),
  }));
}

export async function getAllMetricDefinitionsWithCoverage(year?: number) {
  const asOfYear = year ?? new Date().getFullYear();
  return db.execute(sql`
    SELECT
      md.id,
      md.name,
      md.description,
      md.category,
      md.unit,
      md.higher_is_better      AS "higherIsBetter",
      md.value_min              AS "valueMin",
      md.value_max              AS "valueMax",
      md.default_source_id      AS "defaultSourceId",
      s.name                    AS "defaultSourceName",
      COUNT(DISTINCT cm.jurisdiction_id)
        FILTER (WHERE cm.year <= ${asOfYear}) AS "coverageCount",
      (SELECT COUNT(*) FROM jurisdictions WHERE type = 'sovereign_state')::int AS "totalCountries"
    FROM metric_definitions md
    LEFT JOIN sources s ON md.default_source_id = s.id
    LEFT JOIN country_metrics cm ON md.id = cm.metric_id
    GROUP BY md.id, md.name, md.description, md.category, md.unit,
             md.higher_is_better, md.value_min, md.value_max, md.default_source_id, s.name
    ORDER BY md.category, md.name
  `);
}

export async function getMetricStripData(
  metricId: string,
  year: number,
  govTypes?: string[],
  taxonomy: GovernmentTaxonomyLens = "raw",
  regions?: string[],
) {
  const result = await db.execute(sql`
    SELECT DISTINCT ON (cm.jurisdiction_id)
      cm.jurisdiction_id        AS "countryId",
      j.name                    AS "countryName",
      j.continent               AS "continent",
      j.government_type         AS "govType",
      j.government_type_detail  AS "governmentTypeDetail",
      j.slug                    AS "slug",
      j.iso2                    AS "iso2",
      j.iso3                    AS "iso3",
      cm.value,
      cm.rank,
      cm.total_ranked           AS "totalRanked",
      cm.year                   AS "asOfYear",
      (cm.year < ${year - 5})   AS "isStale"
    FROM country_metrics cm
    JOIN jurisdictions j ON cm.jurisdiction_id = j.id
    WHERE cm.metric_id = ${metricId}
      AND cm.year <= ${year}
      AND j.type = 'sovereign_state'
      AND j.government_type IS NOT NULL
    ORDER BY cm.jurisdiction_id, cm.year DESC
  `);

  const rows = Array.isArray(result)
    ? result
    : ((result as { rows?: unknown[] }).rows ?? []);
  const typedRows = rows as Array<{
    countryId: string;
    countryName: string;
    continent?: string | null;
    govType: string;
    governmentTypeDetail?: string | null;
    slug?: string | null;
    iso2?: string | null;
    iso3?: string | null;
    value: number;
    rank: number | null;
    totalRanked: number | null;
    asOfYear: number;
    isStale: boolean;
  }>;

  const classificationMap = await buildGovernmentClassificationMap(
    typedRows.map((row) => ({
      id: row.countryId,
      slug: row.slug ?? null,
      iso3: row.iso3 ?? null,
      governmentType: row.govType ?? null,
      governmentTypeDetail: row.governmentTypeDetail ?? null,
    })),
  );

  const filtered = typedRows
    .map((row) => {
      const classification = classificationMap.get(row.countryId) ?? null;
      const groupedGovType = classification
        ? getGovernmentTaxonomyGroupingLabel(classification, taxonomy)
        : row.govType;
      return {
        ...row,
        govType: groupedGovType,
        governmentClassification: classification,
      };
    })
    .filter((row) =>
      govTypes && govTypes.length > 0 ? govTypes.includes(row.govType) : true,
    )
    .filter((row) =>
      regions && regions.length > 0
        ? row.continent != null && regions.includes(row.continent)
        : true,
    )
    .sort(
      (a, b) =>
        a.govType.localeCompare(b.govType) || Number(a.value) - Number(b.value),
    );

  return filtered;
}

function quantile(sortedValues: number[], percentile: number): number {
  if (sortedValues.length === 0) return 0;
  if (sortedValues.length === 1) return sortedValues[0];
  const index = (sortedValues.length - 1) * percentile;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sortedValues[lower];
  const weight = index - lower;
  return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight;
}

export function buildGovTypeStripBands(
  rows: Array<{ govType: string; value: number }>,
) {
  const grouped = new Map<string, number[]>();

  for (const row of rows) {
    if (!Number.isFinite(row.value)) continue;
    const values = grouped.get(row.govType) ?? [];
    values.push(Number(row.value));
    grouped.set(row.govType, values);
  }

  return [...grouped.entries()]
    .map(([govType, values]) => {
      const sorted = [...values].sort((a, b) => a - b);
      const q1 = quantile(sorted, 0.25);
      const median = quantile(sorted, 0.5);
      const q3 = quantile(sorted, 0.75);
      return {
        govType,
        count: sorted.length,
        median,
        q1,
        q3,
        iqr: q3 - q1,
        min: sorted[0] ?? 0,
        max: sorted[sorted.length - 1] ?? 0,
      };
    })
    .sort((a, b) => a.govType.localeCompare(b.govType));
}

export async function getCountryOutcomes(jurisdictionId: string, year: number) {
  const countryData = await db.execute(sql`
    SELECT DISTINCT ON (cm.metric_id)
      cm.metric_id              AS "metricId",
      md.name,
      md.category,
      md.unit,
      md.higher_is_better       AS "higherIsBetter",
      cm.value,
      cm.year                   AS "asOfYear",
      cm.rank,
      cm.total_ranked           AS "totalRanked",
      (cm.year < ${year - 5})   AS "isStale"
    FROM country_metrics cm
    JOIN metric_definitions md ON cm.metric_id = md.id
    WHERE cm.jurisdiction_id = ${jurisdictionId}
      AND cm.year <= ${year}
    ORDER BY cm.metric_id, cm.year DESC
  `);

  const jurisdictionRow = await db
    .select({ governmentType: jurisdictions.governmentType })
    .from(jurisdictions)
    .where(eq(jurisdictions.id, jurisdictionId))
    .limit(1);

  const govType = jurisdictionRow[0]?.governmentType ?? null;

  if (!govType) {
    return { metrics: countryData, peerBands: [], govType: null };
  }

  const peerBands = await db.execute(sql`
    WITH latest_per_country AS (
      SELECT DISTINCT ON (cm.jurisdiction_id, cm.metric_id)
        cm.metric_id,
        cm.value
      FROM country_metrics cm
      JOIN jurisdictions j ON cm.jurisdiction_id = j.id
      WHERE j.government_type = ${govType}
        AND j.type = 'sovereign_state'
        AND cm.year <= ${year}
      ORDER BY cm.jurisdiction_id, cm.metric_id, cm.year DESC
    )
    SELECT
      metric_id                                                           AS "metricId",
      COUNT(*)::int                                                       AS "peerCount",
      MIN(value)                                                          AS "peerMin",
      PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY value)                 AS "peerMedian",
      MAX(value)                                                          AS "peerMax"
    FROM latest_per_country
    GROUP BY metric_id
  `);

  return { metrics: countryData, peerBands, govType };
}

// --- Civica Index queries ---

export async function getCIRankings(
  quarter?: string,
  filters?: {
    continent?: string;
    governmentType?: string;
    /** @deprecated Phase 3 of structural_family removal — pass
     *  `vdemRow` / `worldBankRegion` / `worldBankIncomeGroup` /
     *  `cgvRegime` instead. Retained for the API deprecation window
     *  but no longer wired to any UI surface as of 2026-05-02. */
    structuralFamily?: string;
    /** Phase 3 — peer-grouping filters. Multiple filters AND together. */
    vdemRow?: string;
    worldBankRegion?: string;
    worldBankIncomeGroup?: string;
    cgvRegime?: string;
    /** Defaults to the current public research-beta methodology. */
    methodologyVersion?: string;
    /** Exact closed release. Methodology-only selection is not sufficient. */
    releaseId?: string;
  },
) {
  const release = resolveCiRelease(filters?.releaseId ?? CURRENT_CI_RELEASE_ID);
  if (
    filters?.methodologyVersion &&
    filters.methodologyVersion !== release.methodologyVersion
  ) {
    throw new Error(
      `${release.releaseId} does not use methodology ${filters.methodologyVersion}`,
    );
  }
  if (quarter && quarter !== release.quarter)
    throw new Error(`${release.releaseId} does not contain quarter ${quarter}`);
  const methodologyVersion = release.methodologyVersion;
  const q = release.quarter;
  const continentFilter = filters?.continent
    ? sql`AND j.continent = ${filters.continent}`
    : sql``;
  const govTypeFilter = filters?.governmentType
    ? sql`AND j.government_type = ${filters.governmentType}`
    : sql``;
  const familyFilter = filters?.structuralFamily
    ? sql`AND EXISTS (
        SELECT 1 FROM government_taxonomies gt
        WHERE gt.jurisdiction_id = j.id
          AND gt.taxonomy_version = '2026_v1'
          AND gt.structural_family = ${filters.structuralFamily}
      )`
    : sql``;
  const peerLensFilter = (factKey: string, value: string | undefined) =>
    value
      ? sql`AND EXISTS (
          SELECT 1 FROM country_facts cf
          WHERE cf.jurisdiction_id = j.id
            AND cf.fact_key = ${factKey}
            AND cf.status = 'active'
            AND cf.fact_value = ${value}
        )`
      : sql``;
  const vdemFilter = peerLensFilter("vdem_row", filters?.vdemRow);
  const wbRegionFilter = peerLensFilter(
    "world_bank_region",
    filters?.worldBankRegion,
  );
  const wbIncomeFilter = peerLensFilter(
    "world_bank_income_group",
    filters?.worldBankIncomeGroup,
  );
  const cgvFilter = filters?.cgvRegime
    ? sql`AND EXISTS (
        SELECT 1 FROM government_taxonomies gt
        WHERE gt.jurisdiction_id = j.id
          AND gt.regime_type_cgv = ${filters.cgvRegime}
      )`
    : sql``;

  const result = await db.execute(sql`
    SELECT
      cs.score,
      cs.score_lower          AS "scoreLower",
      cs.score_upper          AS "scoreUpper",
      cs.completeness_flag    AS "completenessFlag",
      cs.vintage_label        AS "vintageLabel",
      cs.rank,
      (SELECT COUNT(*)::int
       FROM ci_composite_scores tied
       WHERE tied.quarter = cs.quarter
         AND tied.methodology_version = cs.methodology_version
         AND tied.score = cs.score) AS "tieCount",
      cs.total_ranked         AS "totalRanked",
      cs.is_partial           AS "isPartial",
      cs.dimensions_available AS "dimensionsAvailable",
      cs.missing_dimensions   AS "missingDimensions",
      cs.methodology_version  AS "methodologyVersion",
      j.id                    AS "jurisdictionId",
      j.slug,
      j.name,
      j.iso2,
      j.iso3,
      j.continent,
      j.government_type       AS "governmentType",
      j.government_type_detail AS "governmentTypeDetail",
      j.population,
      j.flag_url              AS "flagUrl"
    FROM ci_composite_scores cs
    JOIN jurisdictions j ON cs.jurisdiction_id = j.id
    WHERE cs.quarter = ${q}
      AND cs.methodology_version = ${methodologyVersion}
      AND j.type = 'sovereign_state'
      ${continentFilter}
      ${govTypeFilter}
      ${familyFilter}
      ${vdemFilter}
      ${wbRegionFilter}
      ${wbIncomeFilter}
      ${cgvFilter}
    ORDER BY cs.rank ASC, j.id ASC
  `);
  const rows = Array.isArray(result)
    ? result
    : ((result as { rows?: unknown[] }).rows ?? []);
  const typedRows = rows as Array<
    {
      jurisdictionId: string;
      slug: string;
      iso3?: string | null;
      governmentType?: string | null;
      governmentTypeDetail?: string | null;
    } & Record<string, unknown>
  >;
  const classificationMap = await buildGovernmentClassificationMap(
    typedRows.map((row) => ({
      id: row.jurisdictionId,
      slug: row.slug,
      iso3: (row.iso3 as string | null | undefined) ?? null,
      governmentType: (row.governmentType as string | null | undefined) ?? null,
      governmentTypeDetail:
        (row.governmentTypeDetail as string | null | undefined) ?? null,
    })),
  );
  return typedRows.map((row) => ({
    ...row,
    governmentClassification: classificationMap.get(row.jurisdictionId) ?? null,
  }));
}

export async function getCICountryDetail(
  slug: string,
  quarter?: string,
  releaseId: string = CURRENT_CI_RELEASE_ID,
) {
  const release = resolveCiRelease(releaseId);
  if (quarter && quarter !== release.quarter)
    throw new Error(`${release.releaseId} does not contain quarter ${quarter}`);
  const q = release.quarter;
  const methodologyVersion = release.methodologyVersion;

  const jurisdiction = await db
    .select()
    .from(jurisdictions)
    .where(eq(jurisdictions.slug, slug))
    .limit(1);

  if (!jurisdiction[0]) return null;

  const jId = jurisdiction[0].id;

  const [composite] = await db
    .select({
      jurisdictionId: ciCompositeScores.jurisdictionId,
      quarter: ciCompositeScores.quarter,
      score: ciCompositeScores.score,
      scoreLower: ciCompositeScores.scoreLower,
      scoreUpper: ciCompositeScores.scoreUpper,
      completenessFlag: ciCompositeScores.completenessFlag,
      vintageLabel: ciCompositeScores.vintageLabel,
      rank: ciCompositeScores.rank,
      tieCount: sql<number>`(
        SELECT COUNT(*)::int FROM ci_composite_scores tied
        WHERE tied.quarter = ${ciCompositeScores.quarter}
          AND tied.methodology_version = ${ciCompositeScores.methodologyVersion}
          AND tied.score = ${ciCompositeScores.score}
      )`,
      totalRanked: ciCompositeScores.totalRanked,
      isPartial: ciCompositeScores.isPartial,
      dimensionsAvailable: ciCompositeScores.dimensionsAvailable,
      missingDimensions: ciCompositeScores.missingDimensions,
      methodologyVersion: ciCompositeScores.methodologyVersion,
      calculatedAt: ciCompositeScores.calculatedAt,
    })
    .from(ciCompositeScores)
    .where(
      sql`${ciCompositeScores.jurisdictionId} = ${jId}
        AND ${ciCompositeScores.quarter} = ${q}
        AND ${ciCompositeScores.methodologyVersion} = ${methodologyVersion}`,
    )
    .limit(1);

  const dimensions = await db
    .select({
      jurisdictionId: ciDimensionScores.jurisdictionId,
      dimension: ciDimensionScores.dimension,
      normalizedScore: ciDimensionScores.normalizedScore,
      rawValue: ciDimensionScores.rawValue,
      sourceId: ciDimensionScores.sourceId,
      indicatorId: ciDimensionScores.indicatorId,
      quarter: ciDimensionScores.quarter,
      methodologyVersion: ciDimensionScores.methodologyVersion,
      transformationId: ciDimensionScores.transformationId,
      methodVersion: ciDimensionScores.methodVersion,
      artifactHash: ciDimensionScores.artifactHash,
    })
    .from(ciDimensionScores)
    .where(
      // Pin the methodology version — without it, quarters carrying both
      // v1.0 and beta rows (e.g. 2023-Q4) mix legacy raw values into a
      // beta-labeled breakdown. Matches the pin on the composite above and
      // on compareCICountries / getCIByGovernmentTypeDots.
      sql`${ciDimensionScores.jurisdictionId} = ${jId} AND ${ciDimensionScores.quarter} = ${q} AND ${ciDimensionScores.methodologyVersion} = ${methodologyVersion}`,
    );

  const releaseDimensions = selectCiReleaseDimensionRows(
    dimensions,
    release.releaseId,
  );
  const classificationMap = await buildGovernmentClassificationMap([
    jurisdiction[0],
  ]);

  return {
    jurisdiction: {
      ...jurisdiction[0],
      governmentClassification:
        classificationMap.get(jurisdiction[0].id) ?? null,
    },
    composite: composite ?? null,
    dimensions: releaseDimensions,
  };
}

export async function getCICountryHistory(
  slug: string,
  releaseId: string = CURRENT_CI_RELEASE_ID,
) {
  const release = resolveCiRelease(releaseId);
  const jurisdiction = await db
    .select({ id: jurisdictions.id })
    .from(jurisdictions)
    .where(eq(jurisdictions.slug, slug))
    .limit(1);

  if (!jurisdiction[0]) return [];

  // Filter to a single methodology version — without this the chart mixes
  // retired v1.0 and live beta rows for the same quarter, producing a
  // duplicate-quarter zig-zag timeline.
  return db
    .select({
      quarter: ciCompositeScores.quarter,
      score: ciCompositeScores.score,
      rank: ciCompositeScores.rank,
      totalRanked: ciCompositeScores.totalRanked,
      isPartial: ciCompositeScores.isPartial,
    })
    .from(ciCompositeScores)
    .where(
      and(
        eq(ciCompositeScores.jurisdictionId, jurisdiction[0].id),
        eq(ciCompositeScores.methodologyVersion, release.methodologyVersion),
        eq(ciCompositeScores.quarter, release.quarter),
      ),
    )
    .orderBy(asc(ciCompositeScores.quarter));
}

/**
 * Long-run indicator history for a country — every year of every source
 * indicator in `indicator_history` for the given slug, grouped by dimension.
 *
 * Backs the multi-series `<IndicatorTrendChart>` on the Civica Data tab.
 * Values are returned in each source's NATIVE scale (with bounds +
 * orientation) so the chart owns display normalisation. Soft-fails to an
 * empty result when the country has no history rows.
 */
export interface IndicatorHistorySeries {
  dimension: string;
  indicator: string;
  sourceId: string;
  nativeMin: number;
  nativeMax: number;
  isInverted: boolean;
  points: Array<{ year: number; value: number }>;
  availability: Array<{
    year: number;
    status: import("@/lib/data/value-state").DataValueStatus;
    reason: string | null;
  }>;
  lineage: Array<{
    upstreamRelease: string;
    artifactHash: string;
    artifactKind: string;
    temporalCoverage: string;
    licenseUrl: string;
    transformationId: string;
    substitutionReason: string | null;
    methodVersion: string;
  }>;
}

type IndicatorHistoryValueRow = {
  dimension: string;
  indicator: string;
  sourceId: string;
  nativeMin: number;
  nativeMax: number;
  isInverted: boolean;
  year: number;
  value: number | null;
  valueStatus: string | null;
  valueStatusReason: string | null;
  upstreamRelease: string;
  artifactHash: string;
  artifactKind: string;
  temporalCoverage: string;
  licenseUrl: string;
  transformationId: string;
  substitutionReason: string | null;
  methodVersion: string;
};

export function buildIndicatorHistorySeries(
  rows: IndicatorHistoryValueRow[],
): IndicatorHistorySeries[] {
  const byIndicator = new Map<string, IndicatorHistorySeries>();
  for (const r of rows) {
    const seriesKey = `${r.sourceId}:${r.indicator}`;
    let series = byIndicator.get(seriesKey);
    if (!series) {
      series = {
        dimension: r.dimension,
        indicator: r.indicator,
        sourceId: r.sourceId,
        nativeMin: r.nativeMin,
        nativeMax: r.nativeMax,
        isInverted: r.isInverted,
        points: [],
        availability: [],
        lineage: [],
      };
      byIndicator.set(seriesKey, series);
    }
    const lineage = {
      upstreamRelease: r.upstreamRelease,
      artifactHash: r.artifactHash,
      artifactKind: r.artifactKind,
      temporalCoverage: r.temporalCoverage,
      licenseUrl: r.licenseUrl,
      transformationId: r.transformationId,
      substitutionReason: r.substitutionReason,
      methodVersion: r.methodVersion,
    };
    if (
      !series.lineage.some(
        (entry) =>
          entry.artifactHash === lineage.artifactHash &&
          entry.upstreamRelease === lineage.upstreamRelease &&
          entry.transformationId === lineage.transformationId &&
          entry.methodVersion === lineage.methodVersion,
      )
    ) {
      series.lineage.push(lineage);
    }
    const status = parseDataValueStatus(r.valueStatus);
    if ((status === "observed" || status === "disputed") && r.value != null) {
      series.points.push({ year: r.year, value: r.value });
    }
    if (status !== "observed") {
      series.availability.push({
        year: r.year,
        status,
        reason: r.valueStatusReason?.trim() || null,
      });
    }
  }
  return Array.from(byIndicator.values())
    .map((series) => ({
      ...series,
      points: [...series.points].sort((a, b) => a.year - b.year),
      availability: [...series.availability].sort(
        (a, b) => a.year - b.year || a.status.localeCompare(b.status),
      ),
      lineage: [...series.lineage].sort(
        (a, b) =>
          a.upstreamRelease.localeCompare(b.upstreamRelease) ||
          a.artifactHash.localeCompare(b.artifactHash),
      ),
    }))
    .sort(
      (a, b) =>
        a.sourceId.localeCompare(b.sourceId) ||
        a.indicator.localeCompare(b.indicator),
    );
}

export async function getIndicatorHistoryForCountry(
  slug: string,
): Promise<IndicatorHistorySeries[]> {
  const jurisdiction = await db
    .select({ id: jurisdictions.id })
    .from(jurisdictions)
    .where(eq(jurisdictions.slug, slug))
    .limit(1);
  if (!jurisdiction[0]) return [];

  const rows = await db
    .select({
      dimension: indicatorHistory.dimension,
      indicator: indicatorHistory.indicator,
      sourceId: indicatorHistory.sourceId,
      nativeMin: indicatorHistory.nativeMin,
      nativeMax: indicatorHistory.nativeMax,
      isInverted: indicatorHistory.isInverted,
      year: indicatorHistory.year,
      value: indicatorHistory.value,
      valueStatus: indicatorHistory.valueStatus,
      valueStatusReason: indicatorHistory.valueStatusReason,
      upstreamRelease: indicatorHistory.upstreamRelease,
      artifactHash: indicatorHistory.artifactHash,
      artifactKind: indicatorHistory.artifactKind,
      temporalCoverage: indicatorHistory.temporalCoverage,
      licenseUrl: indicatorHistory.licenseUrl,
      transformationId: indicatorHistory.transformationId,
      substitutionReason: indicatorHistory.substitutionReason,
      methodVersion: indicatorHistory.methodVersion,
    })
    .from(indicatorHistory)
    .where(eq(indicatorHistory.jurisdictionId, jurisdiction[0].id))
    .orderBy(asc(indicatorHistory.indicator), asc(indicatorHistory.year));

  return buildIndicatorHistorySeries(rows);
}

export async function compareCICountries(
  slugs: string[],
  quarter?: string,
  releaseId: string = CURRENT_CI_RELEASE_ID,
) {
  if (slugs.length === 0) return [];
  const release = resolveCiRelease(releaseId);
  if (quarter && quarter !== release.quarter)
    throw new Error(`${release.releaseId} does not contain quarter ${quarter}`);
  const q = release.quarter;

  const countries = await db
    .select()
    .from(jurisdictions)
    .where(sql`${jurisdictions.slug} IN ${slugs}`);

  const jIds = countries.map((c) => c.id);
  if (jIds.length === 0) return [];

  // Pin the methodology version (beta) so /compare and /api/v1/index/compare
  // never surface a legacy v1.0 score that disagrees with the country page,
  // leaderboard, and detail API (all beta-only).
  const composites = await db
    .select({
      jurisdictionId: ciCompositeScores.jurisdictionId,
      quarter: ciCompositeScores.quarter,
      score: ciCompositeScores.score,
      scoreLower: ciCompositeScores.scoreLower,
      scoreUpper: ciCompositeScores.scoreUpper,
      completenessFlag: ciCompositeScores.completenessFlag,
      vintageLabel: ciCompositeScores.vintageLabel,
      rank: ciCompositeScores.rank,
      totalRanked: ciCompositeScores.totalRanked,
      isPartial: ciCompositeScores.isPartial,
      dimensionsAvailable: ciCompositeScores.dimensionsAvailable,
      missingDimensions: ciCompositeScores.missingDimensions,
      methodologyVersion: ciCompositeScores.methodologyVersion,
      calculatedAt: ciCompositeScores.calculatedAt,
    })
    .from(ciCompositeScores)
    .where(
      sql`${ciCompositeScores.jurisdictionId} IN ${jIds} AND ${ciCompositeScores.quarter} = ${q} AND ${ciCompositeScores.methodologyVersion} = ${release.methodologyVersion}`,
    );

  const dimensions = await db
    .select()
    .from(ciDimensionScores)
    .where(
      sql`${ciDimensionScores.jurisdictionId} IN ${jIds} AND ${ciDimensionScores.quarter} = ${q} AND ${ciDimensionScores.methodologyVersion} = ${release.methodologyVersion}`,
    );
  const releaseDimensions = selectCiReleaseDimensionRows(
    dimensions,
    release.releaseId,
  );

  const classificationMap = await buildGovernmentClassificationMap(countries);

  return countries.map((country) => ({
    jurisdiction: {
      ...country,
      governmentClassification: classificationMap.get(country.id) ?? null,
    },
    composite: composites.find((c) => c.jurisdictionId === country.id) ?? null,
    dimensions: releaseDimensions.filter(
      (d) => d.jurisdictionId === country.id,
    ),
  }));
}

export async function getCIByGovernmentTypeDots(
  quarter?: string,
  releaseId: string = CURRENT_CI_RELEASE_ID,
) {
  const release = resolveCiRelease(releaseId);
  if (quarter && quarter !== release.quarter)
    throw new Error(`${release.releaseId} does not contain quarter ${quarter}`);
  const q = release.quarter;
  const result = await db.execute(sql`
    SELECT
      j.id               AS "jurisdictionId",
      j.government_type  AS "governmentType",
      j.government_type_detail AS "governmentTypeDetail",
      j.slug,
      j.name,
      j.iso2,
      j.iso3,
      cs.score
    FROM ci_composite_scores cs
    JOIN jurisdictions j ON cs.jurisdiction_id = j.id
    WHERE cs.quarter = ${q}
      AND cs.methodology_version = ${release.methodologyVersion}
      AND j.government_type IS NOT NULL
      AND j.type = 'sovereign_state'
    ORDER BY j.government_type, cs.score DESC
  `);
  const rows = Array.isArray(result)
    ? result
    : ((result as { rows?: unknown[] }).rows ?? []);
  const typedRows = rows as Array<{
    jurisdictionId: string;
    governmentType: string;
    governmentTypeDetail?: string | null;
    slug: string;
    name: string;
    iso2?: string | null;
    iso3?: string | null;
    score: number;
  }>;
  const classificationMap = await buildGovernmentClassificationMap(
    typedRows.map((row) => ({
      id: row.jurisdictionId,
      slug: row.slug,
      iso3: row.iso3 ?? null,
      governmentType: row.governmentType ?? null,
      governmentTypeDetail: row.governmentTypeDetail ?? null,
    })),
  );
  return typedRows.map((row) => ({
    ...row,
    governmentClassification: classificationMap.get(row.jurisdictionId) ?? null,
  }));
}

export async function getGovTypeTrajectory() {
  const release = resolveCiRelease();
  const result = await db.execute(sql`
    SELECT
      cs.quarter,
      j.id               AS "jurisdictionId",
      j.government_type  AS "governmentType",
      j.government_type_detail AS "governmentTypeDetail",
      j.slug,
      j.iso3,
      cs.score
    FROM ci_composite_scores cs
    JOIN jurisdictions j ON cs.jurisdiction_id = j.id
    WHERE cs.methodology_version = ${release.methodologyVersion}
      AND cs.quarter = ${release.quarter}
      AND j.government_type IS NOT NULL
      AND j.type = 'sovereign_state'
    ORDER BY cs.quarter ASC, j.government_type ASC, cs.score DESC
  `);
  const rows = Array.isArray(result)
    ? result
    : ((result as { rows?: unknown[] }).rows ?? []);
  const typedRows = rows as Array<{
    quarter: string;
    jurisdictionId: string;
    governmentType: string;
    governmentTypeDetail?: string | null;
    slug: string;
    iso3?: string | null;
    score: number;
  }>;
  const classificationMap = await buildGovernmentClassificationMap(
    typedRows.map((row) => ({
      id: row.jurisdictionId,
      slug: row.slug,
      iso3: row.iso3 ?? null,
      governmentType: row.governmentType ?? null,
      governmentTypeDetail: row.governmentTypeDetail ?? null,
    })),
  );
  return typedRows.map((row) => ({
    ...row,
    governmentClassification: classificationMap.get(row.jurisdictionId) ?? null,
  }));
}

export async function getCIMethodology(versionId?: string) {
  if (versionId) {
    const [row] = await db
      .select()
      .from(ciMethodologyVersions)
      .where(eq(ciMethodologyVersions.id, versionId))
      .limit(1);
    return row ?? null;
  }
  const [row] = await db
    .select()
    .from(ciMethodologyVersions)
    .orderBy(desc(ciMethodologyVersions.publishedAt))
    .limit(1);
  return row ?? null;
}

export async function getCIMethodologyHistory() {
  return db
    .select()
    .from(ciMethodologyVersions)
    .orderBy(desc(ciMethodologyVersions.publishedAt));
}

/**
 * Organization memberships for a set of jurisdictions, grouped server-side
 * for the unified /compare page's International section. Returns one row
 * per (jurisdictionId, orgId) pair, sorted by type then name so the UI can
 * render a single row per org with a column per jurisdiction.
 */
export async function getInternationalMembershipsBySlugs(
  jurisdictionIds: string[],
) {
  if (jurisdictionIds.length === 0) return [];
  const rows = await db
    .select({
      jurisdictionId: organizationMemberships.jurisdictionId,
      orgId: organizations.id,
      orgSlug: organizations.slug,
      orgName: organizations.name,
      orgFullName: organizations.fullName,
      orgType: organizations.type,
      foundedYear: organizations.foundedYear,
      joinDate: organizationMemberships.joinDate,
      role: organizationMemberships.role,
    })
    .from(organizationMemberships)
    .innerJoin(
      organizations,
      eq(organizationMemberships.orgId, organizations.id),
    )
    .where(sql`${organizationMemberships.jurisdictionId} IN ${jurisdictionIds}`)
    .orderBy(asc(organizations.type), asc(organizations.name));
  return rows;
}

/**
 * Phase H.1 — read the most recent bills for a country, ordered by
 * last-action date desc. The route at
 * `src/app/api/countries/[slug]/bills/route.ts` calls this and shapes
 * the result for the UI.
 */
export async function getBillsForJurisdiction(slug: string, limit = 10) {
  const j = await db
    .select({
      id: jurisdictions.id,
      name: jurisdictions.name,
      iso2: jurisdictions.iso2,
    })
    .from(jurisdictions)
    .where(eq(jurisdictions.slug, slug))
    .limit(1);
  if (!j[0]) return null;

  const rows = await db
    .select()
    .from(bills)
    .where(eq(bills.jurisdictionId, j[0].id))
    .orderBy(desc(bills.lastActionDate))
    .limit(limit);

  return { jurisdiction: j[0], rows };
}

/**
 * Phase 5.4 — Civica Conditions companion layer.
 * Returns the latest score row for each of the 3 dimensions
 * (human_development, peace_security, economic_stability) for a given
 * jurisdictionId under the specified methodologyVersion.
 *
 * At most 3 rows are returned (one per dimension). If a dimension has
 * no data, it is simply absent from the array — callers render a
 * placeholder card for missing dimensions.
 */
export async function getCivicaConditionsForJurisdiction(
  jurisdictionId: string,
  methodologyVersion: string = "beta",
) {
  // For each dimension, pick the row with the latest quarter.
  const rows = await db.execute(sql`
    SELECT DISTINCT ON (ccs.dimension)
      ccs.dimension,
      ccs.quarter,
      ccs.normalized_score  AS "normalizedScore",
      ccs.raw_value         AS "rawValue",
      ccs.source_id         AS "sourceId",
      ccs.dataset_year      AS "datasetYear",
      ccs.methodology_version AS "methodologyVersion",
      s.name                AS "sourceName"
    FROM civica_conditions_scores ccs
    LEFT JOIN sources s ON ccs.source_id = s.id
    WHERE ccs.jurisdiction_id = ${jurisdictionId}
      AND ccs.methodology_version = ${methodologyVersion}
    ORDER BY ccs.dimension, ccs.quarter DESC
  `);

  const raw = Array.isArray(rows)
    ? rows
    : ((rows as { rows?: unknown[] }).rows ?? []);

  return raw as Array<{
    dimension: string;
    quarter: string;
    normalizedScore: number;
    rawValue: number | null;
    sourceId: string;
    datasetYear: number;
    methodologyVersion: string;
    sourceName: string | null;
  }>;
}

/**
 * Batch filter facts for the `/country` almanac index.
 *
 * Returns, keyed by jurisdiction id, the three Phase F peer-grouping
 * canonical facts used as list filters. All values are the human-readable canonical strings
 * ("North America", "High income", "Liberal Democracy") straight off the
 * active `country_facts` rows — no snake_case slugs (see
 * `lens-metadata.ts`).
 *
 * One pass over the whole listed set (~200 sovereign states) — cheap
 * enough to run in the landing's server component. Provenance-free by
 * design: this is a hot list path, not a citation-bearing surface (a
 * stale filter value only mis-buckets a card, never mis-cites a fact).
 */
export async function getAlmanacFilterFacts(): Promise<
  Record<
    string,
    {
      region: string | null;
      incomeGroup: string | null;
      regimeType: string | null;
    }
  >
> {
  const out: Record<
    string,
    {
      region: string | null;
      incomeGroup: string | null;
      regimeType: string | null;
    }
  > = {};

  const ensure = (id: string) => {
    let entry = out[id];
    if (!entry) {
      entry = { region: null, incomeGroup: null, regimeType: null };
      out[id] = entry;
    }
    return entry;
  };

  // Peer-grouping canonical facts — active rows only. The fact-keys
  // mirror PEER_GROUPING_FACT_KEYS in src/lib/peer-grouping/index.ts.
  const factRows = await db
    .select({
      jurisdictionId: countryFacts.jurisdictionId,
      factKey: countryFacts.factKey,
      factValue: countryFacts.factValue,
    })
    .from(countryFacts)
    .where(
      and(
        sql`${countryFacts.status} = 'active'`,
        sql`${countryFacts.factKey} IN ('world_bank_region', 'world_bank_income_group', 'vdem_row')`,
      ),
    );

  for (const row of factRows) {
    if (!row.factValue) continue;
    const entry = ensure(row.jurisdictionId);
    if (row.factKey === "world_bank_region") entry.region = row.factValue;
    else if (row.factKey === "world_bank_income_group")
      entry.incomeGroup = row.factValue;
    else if (row.factKey === "vdem_row") entry.regimeType = row.factValue;
  }

  return out;
}
