import { eq, desc, asc, sql } from "drizzle-orm";
import { db } from "./index";
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
  countryMetrics,
  metricDefinitions,
  ciCompositeScores,
  ciDimensionScores,
  ciMethodologyVersions,
  pulseEvents,
  pulseDailyScores,
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
      sql`${jurisdictions.type} = 'sovereign_state' AND LOWER(${jurisdictions.name}) <> 'none'`
    )
    .orderBy(
      sql`${jurisdictions.population} DESC NULLS LAST`,
      asc(jurisdictions.name)
    );
  const classificationMap = await buildGovernmentClassificationMap(rows);
  return rows.map((row) => ({
    ...row,
    governmentClassification: classificationMap.get(row.id) ?? null,
  }));
}

// Non-territory sovereign states with population data. Used for the homepage
// featured grid so we never surface Akrotiri / Antarctica / Bouvet Island first.
export async function getFeaturedCountries(limit = 24) {
  const rows = await db
    .select()
    .from(jurisdictions)
    .where(
      sql`${jurisdictions.type} = 'sovereign_state'
        AND ${jurisdictions.population} IS NOT NULL
        AND ${jurisdictions.population} > 0
        AND ${jurisdictions.iso2} IS NOT NULL
        AND LOWER(${jurisdictions.name}) <> 'none'`
    )
    .orderBy(desc(jurisdictions.population), asc(jurisdictions.name))
    .limit(limit);
  const classificationMap = await buildGovernmentClassificationMap(rows);
  return rows.map((row) => ({
    ...row,
    governmentClassification: classificationMap.get(row.id) ?? null,
  }));
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
  sectionName: string
) {
  const results = await db
    .select()
    .from(countryFactbookSections)
    .where(
      sql`${countryFactbookSections.jurisdictionId} = ${jurisdictionId} AND ${countryFactbookSections.sectionName} = ${sectionName}`
    )
    .limit(1);
  return results[0] ?? null;
}

export async function getCountryFacts(
  jurisdictionId: string,
  category?: string
) {
  const query = db
    .select()
    .from(countryFacts)
    .where(
      category
        ? sql`${countryFacts.jurisdictionId} = ${jurisdictionId} AND ${countryFacts.category} = ${category}`
        : eq(countryFacts.jurisdictionId, jurisdictionId)
    );
  return query;
}

export async function rankCountriesByFact(
  factKey: string,
  direction: "asc" | "desc" = "desc",
  limit = 20
) {
  return db
    .select({
      jurisdiction: jurisdictions,
      fact: countryFacts,
    })
    .from(countryFacts)
    .innerJoin(jurisdictions, eq(countryFacts.jurisdictionId, jurisdictions.id))
    .where(
      sql`${countryFacts.factKey} = ${factKey} AND ${countryFacts.factValueNumeric} IS NOT NULL`
    )
    .orderBy(
      direction === "desc"
        ? desc(countryFacts.factValueNumeric)
        : asc(countryFacts.factValueNumeric)
    )
    .limit(limit);
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
    .where(sql`${offices.bodyId} IN ${bodyIds}`);

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
      sql`${terms.officeId} IN ${officeIds} AND ${terms.isCurrent} = true`
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
  if (bodyIds.length === 0) return { bodies: [], offices: [], currentTerms: [], parties: [] };

  const allOffices = await db
    .select()
    .from(offices)
    .where(sql`${offices.bodyId} IN ${bodyIds}`);

  const officeIds = allOffices.map((o) => o.id);

  const currentTerms = officeIds.length > 0
    ? await db
        .select({ term: terms, person: persons })
        .from(terms)
        .innerJoin(persons, eq(terms.personId, persons.id))
        .where(sql`${terms.officeId} IN ${officeIds} AND ${terms.isCurrent} = true`)
    : [];

  const parties = await db
    .select()
    .from(legislatureParties)
    .where(sql`${legislatureParties.bodyId} IN ${bodyIds}`)
    .orderBy(desc(legislatureParties.seatCount));

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
  const keys = ["population", "gdp_ppp", "total_area", "life_expectancy", "gdp_per_capita_ppp"];
  const result = await db.execute(sql`
    SELECT fact_key, rank, total
    FROM (
      SELECT
        fact_key,
        jurisdiction_id,
        RANK() OVER (PARTITION BY fact_key ORDER BY fact_value_numeric DESC) AS rank,
        COUNT(*) OVER (PARTITION BY fact_key) AS total
      FROM country_facts
      WHERE fact_key IN ${keys} AND fact_value_numeric IS NOT NULL
    ) ranked
    WHERE jurisdiction_id = ${jurisdictionId}
  `);
  const rows = Array.isArray(result) ? result : (result as { rows: unknown[] }).rows ?? [];
  return (rows as { fact_key: string; rank: string | number; total: string | number }[]).map((r) => ({
    key: r.fact_key,
    rank: Number(r.rank),
    total: Number(r.total),
  }));
}

export async function getRelatedCountries(
  jurisdictionId: string,
  continent: string | null,
  limit = 6
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
      sql`${jurisdictions.continent} = ${continent} AND ${jurisdictions.id} != ${jurisdictionId} AND ${jurisdictions.type} = 'sovereign_state'`
    )
    .orderBy(desc(jurisdictions.population))
    .limit(limit);
}

export async function getLegislatureComposition(jurisdictionId: string) {
  const bodies = await db
    .select()
    .from(governmentBodies)
    .where(
      sql`${governmentBodies.jurisdictionId} = ${jurisdictionId} AND ${governmentBodies.branch} = 'legislative'`
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

export async function getDistinctGovernmentTypes() {
  const results = await db
    .select({
      governmentType: jurisdictions.governmentType,
    })
    .from(jurisdictions)
    .where(
      sql`${jurisdictions.type} = 'sovereign_state' AND ${jurisdictions.governmentType} IS NOT NULL`
    )
    .groupBy(jurisdictions.governmentType)
    .orderBy(asc(jurisdictions.governmentType));
  return results.map((r) => r.governmentType!);
}

export async function getJurisdictionsByGovernmentTypePattern(
  patterns: string[]
) {
  if (patterns.length === 0) return [];
  const conditions = patterns.map(
    (p) => sql`(LOWER(${jurisdictions.governmentTypeDetail}) LIKE ${`%${p.toLowerCase()}%`} OR LOWER(${jurisdictions.governmentType}) LIKE ${`%${p.toLowerCase()}%`})`
  );
  const combined =
    conditions.length === 1
      ? conditions[0]
      : sql.join(conditions, sql` OR `);
  const rows = await db
    .select()
    .from(jurisdictions)
    .where(
      sql`${jurisdictions.type} = 'sovereign_state' AND (${combined})`
    )
    .orderBy(desc(jurisdictions.population), asc(jurisdictions.name));
  const classificationMap = await buildGovernmentClassificationMap(rows);
  return rows.map((row) => ({
    ...row,
    governmentClassification: classificationMap.get(row.id) ?? null,
  }));
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
      sql`${countryFacts.jurisdictionId} = ${jurisdictionId} AND ${countryFacts.factKey} LIKE 'freedom_house%'`
    );

  return {
    democracyIndex: jurisdiction[0]?.democracyIndex ?? null,
    continent: jurisdiction[0]?.continent ?? null,
    freedomHouseFacts,
  };
}

export async function getRegionalDemocracyComparison(
  jurisdictionId: string,
  continent: string | null
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
      sql`${jurisdictions.continent} = ${continent} AND ${jurisdictions.type} = 'sovereign_state' AND ${jurisdictions.democracyIndex} IS NOT NULL`
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

  const allTerms = await db
    .select({ term: terms, person: persons })
    .from(terms)
    .innerJoin(persons, eq(terms.personId, persons.id))
    .where(sql`${terms.officeId} IN ${officeIds}`)
    .orderBy(desc(terms.startDate));

  return allTerms.map((t) => {
    const office = allOffices.find((o) => o.id === t.term.officeId);
    return {
      personName: t.person.name,
      photoUrl: t.person.photoUrl,
      officeName: office?.name ?? "Unknown",
      officeType: office?.officeType ?? "unknown",
      partyName: t.term.partyName,
      partyColor: t.term.partyColor,
      startDate: t.term.startDate,
      endDate: t.term.endDate,
      isCurrent: t.term.isCurrent,
    };
  });
}

export async function getElectionsByJurisdiction(jurisdictionId: string) {
  const rows = await db
    .select()
    .from(elections)
    .where(eq(elections.jurisdictionId, jurisdictionId))
    .orderBy(desc(elections.electionDate));

  const electionIds = rows.map((e) => e.id);
  if (electionIds.length === 0) return rows.map((e) => ({ election: e, results: [] as typeof allResults }));

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

export async function getRecentElections(limit = 20) {
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
    .where(sql`${elections.electionDate} < CURRENT_DATE`)
    .orderBy(desc(elections.electionDate))
    .limit(limit);
}

export async function getRecentElectionsWithResults(limit = 40) {
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
    .where(sql`${elections.electionDate} < CURRENT_DATE`)
    .orderBy(desc(elections.electionDate))
    .limit(limit);

  const electionIds = rows.map((r) => r.election.id);
  if (electionIds.length === 0) return rows.map((r) => ({ ...r, results: [] as typeof allResults }));

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

export async function getCountryMetrics(
  jurisdictionId: string,
  metricId?: string
) {
  return db
    .select({
      metric: countryMetrics,
      definition: metricDefinitions,
    })
    .from(countryMetrics)
    .innerJoin(
      metricDefinitions,
      eq(countryMetrics.metricId, metricDefinitions.id)
    )
    .where(
      metricId
        ? sql`${countryMetrics.jurisdictionId} = ${jurisdictionId} AND ${countryMetrics.metricId} = ${metricId}`
        : eq(countryMetrics.jurisdictionId, jurisdictionId)
    )
    .orderBy(asc(countryMetrics.metricId), desc(countryMetrics.year));
}

export async function getLatestMetricsForCountry(jurisdictionId: string) {
  return db.execute(sql`
    SELECT DISTINCT ON (cm.metric_id)
      cm.metric_id, cm.year, cm.value, cm.rank, cm.total_ranked,
      cm.source_id, cm.source_url,
      md.name, md.description, md.category, md.unit,
      md.higher_is_better, md.value_min, md.value_max
    FROM country_metrics cm
    JOIN metric_definitions md ON cm.metric_id = md.id
    WHERE cm.jurisdiction_id = ${jurisdictionId}
    ORDER BY cm.metric_id, cm.year DESC
  `);
}

export async function getMetricRankings(
  metricId: string,
  year?: number,
  limit = 20
) {
  const yearFilter = year
    ? sql`AND cm.year = ${year}`
    : sql`AND cm.year = (SELECT MAX(year) FROM country_metrics WHERE metric_id = ${metricId})`;

  return db.execute(sql`
    SELECT
      cm.value, cm.year, cm.rank, cm.total_ranked,
      j.id AS jurisdiction_id, j.slug, j.name, j.iso2, j.iso3,
      j.government_type, j.continent,
      RANK() OVER (ORDER BY cm.value DESC) AS computed_rank
    FROM country_metrics cm
    JOIN jurisdictions j ON cm.jurisdiction_id = j.id
    WHERE cm.metric_id = ${metricId} ${yearFilter}
    ORDER BY cm.value DESC
    LIMIT ${limit}
  `);
}

export async function getMetricsByGovernmentType(
  metricId: string,
  year?: number
) {
  const yearFilter = year
    ? sql`AND cm.year = ${year}`
    : sql`AND cm.year = (SELECT MAX(year) FROM country_metrics WHERE metric_id = ${metricId})`;

  return db.execute(sql`
    SELECT
      j.government_type,
      COUNT(*) AS country_count,
      AVG(cm.value) AS avg_value,
      MIN(cm.value) AS min_value,
      MAX(cm.value) AS max_value,
      PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY cm.value) AS median_value
    FROM country_metrics cm
    JOIN jurisdictions j ON cm.jurisdiction_id = j.id
    WHERE cm.metric_id = ${metricId}
      AND j.government_type IS NOT NULL
      ${yearFilter}
    GROUP BY j.government_type
    HAVING COUNT(*) >= 3
    ORDER BY avg_value DESC
  `);
}

export async function getAllMetricDefinitions() {
  return db.select().from(metricDefinitions).orderBy(asc(metricDefinitions.category), asc(metricDefinitions.name));
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
      const classification =
        classificationMap.get(row.countryId) ?? null;
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

export async function getMetricCoverage(metricId: string, year: number) {
  return db.execute(sql`
    WITH sovereign AS (
      SELECT id FROM jurisdictions WHERE type = 'sovereign_state'
    ),
    latest_data AS (
      SELECT DISTINCT ON (cm.jurisdiction_id)
        cm.jurisdiction_id,
        cm.year AS data_year
      FROM country_metrics cm
      WHERE cm.metric_id = ${metricId}
        AND cm.year <= ${year}
      ORDER BY cm.jurisdiction_id, cm.year DESC
    )
    SELECT
      (SELECT COUNT(*) FROM sovereign)::int                                            AS "totalCountries",
      COUNT(ld.jurisdiction_id)::int                                                   AS "countriesWithData",
      ((SELECT COUNT(*) FROM sovereign) - COUNT(ld.jurisdiction_id))::int              AS "countriesWithoutData",
      COUNT(CASE WHEN ld.data_year >= ${year - 5} THEN 1 END)::int                    AS "countriesWithFreshData",
      COUNT(CASE WHEN ld.data_year IS NOT NULL AND ld.data_year < ${year - 5} THEN 1 END)::int AS "countriesWithStaleData"
    FROM sovereign s
    LEFT JOIN latest_data ld ON s.id = ld.jurisdiction_id
  `);
}

// --- Civica Index queries ---

export async function getCIRankings(
  quarter?: string,
  filters?: { continent?: string; governmentType?: string }
) {
  const q = quarter ?? await getLatestAvailableQuarter();
  const continentFilter = filters?.continent
    ? sql`AND j.continent = ${filters.continent}`
    : sql``;
  const govTypeFilter = filters?.governmentType
    ? sql`AND j.government_type = ${filters.governmentType}`
    : sql``;

  const result = await db.execute(sql`
    SELECT
      cs.score,
      cs.rank,
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
      AND j.type = 'sovereign_state'
      ${continentFilter}
      ${govTypeFilter}
    ORDER BY cs.rank ASC
  `);
  const rows = Array.isArray(result)
    ? result
    : ((result as { rows?: unknown[] }).rows ?? []);
  const typedRows = rows as Array<{
    jurisdictionId: string;
    slug: string;
    iso3?: string | null;
    governmentType?: string | null;
    governmentTypeDetail?: string | null;
  } & Record<string, unknown>>;
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
    governmentClassification:
      classificationMap.get(row.jurisdictionId) ?? null,
  }));
}

export async function getCICountryDetail(slug: string, quarter?: string) {
  const q = quarter ?? await getLatestAvailableQuarter();

  const jurisdiction = await db
    .select()
    .from(jurisdictions)
    .where(eq(jurisdictions.slug, slug))
    .limit(1);

  if (!jurisdiction[0]) return null;

  const jId = jurisdiction[0].id;

  const [composite] = await db
    .select()
    .from(ciCompositeScores)
    .where(
      sql`${ciCompositeScores.jurisdictionId} = ${jId} AND ${ciCompositeScores.quarter} = ${q}`
    )
    .limit(1);

  const dimensions = await db
    .select({
      dimension: ciDimensionScores.dimension,
      normalizedScore: ciDimensionScores.normalizedScore,
      rawValue: ciDimensionScores.rawValue,
      sourceId: ciDimensionScores.sourceId,
    })
    .from(ciDimensionScores)
    .where(
      sql`${ciDimensionScores.jurisdictionId} = ${jId} AND ${ciDimensionScores.quarter} = ${q}`
    );

  const pulseLatest = await db
    .select()
    .from(pulseDailyScores)
    .where(eq(pulseDailyScores.jurisdictionId, jId))
    .orderBy(desc(pulseDailyScores.scoreDate))
    .limit(1);

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
    dimensions,
    pulse: pulseLatest[0] ?? null,
  };
}

export async function getCICountryHistory(slug: string) {
  const jurisdiction = await db
    .select({ id: jurisdictions.id })
    .from(jurisdictions)
    .where(eq(jurisdictions.slug, slug))
    .limit(1);

  if (!jurisdiction[0]) return [];

  return db
    .select({
      quarter: ciCompositeScores.quarter,
      score: ciCompositeScores.score,
      rank: ciCompositeScores.rank,
      totalRanked: ciCompositeScores.totalRanked,
      isPartial: ciCompositeScores.isPartial,
    })
    .from(ciCompositeScores)
    .where(eq(ciCompositeScores.jurisdictionId, jurisdiction[0].id))
    .orderBy(asc(ciCompositeScores.quarter));
}

export async function compareCICountries(slugs: string[], quarter?: string) {
  if (slugs.length === 0) return [];
  const q = quarter ?? await getLatestAvailableQuarter();

  const countries = await db
    .select()
    .from(jurisdictions)
    .where(sql`${jurisdictions.slug} IN ${slugs}`);

  const jIds = countries.map((c) => c.id);
  if (jIds.length === 0) return [];

  const composites = await db
    .select()
    .from(ciCompositeScores)
    .where(
      sql`${ciCompositeScores.jurisdictionId} IN ${jIds} AND ${ciCompositeScores.quarter} = ${q}`
    );

  const dimensions = await db
    .select()
    .from(ciDimensionScores)
    .where(
      sql`${ciDimensionScores.jurisdictionId} IN ${jIds} AND ${ciDimensionScores.quarter} = ${q}`
    );

  const classificationMap = await buildGovernmentClassificationMap(countries);

  return countries.map((country) => ({
    jurisdiction: {
      ...country,
      governmentClassification: classificationMap.get(country.id) ?? null,
    },
    composite: composites.find((c) => c.jurisdictionId === country.id) ?? null,
    dimensions: dimensions.filter((d) => d.jurisdictionId === country.id),
  }));
}

export async function getCIByGovernmentType(quarter?: string) {
  const q = quarter ?? await getLatestAvailableQuarter();

  return db.execute(sql`
    SELECT
      j.government_type                                                     AS "governmentType",
      COUNT(*)::int                                                         AS "countryCount",
      AVG(cs.score)                                                         AS "avgScore",
      MIN(cs.score)                                                         AS "minScore",
      MAX(cs.score)                                                         AS "maxScore",
      PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY cs.score)                AS "medianScore",
      PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY cs.score)               AS "q1",
      PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY cs.score)               AS "q3"
    FROM ci_composite_scores cs
    JOIN jurisdictions j ON cs.jurisdiction_id = j.id
    WHERE cs.quarter = ${q}
      AND j.government_type IS NOT NULL
      AND j.type = 'sovereign_state'
    GROUP BY j.government_type
    HAVING COUNT(*) >= 3
    ORDER BY AVG(cs.score) DESC
  `);
}

export async function getCIByGovernmentTypeDots(quarter?: string) {
  const q = quarter ?? await getLatestAvailableQuarter();
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
    governmentClassification:
      classificationMap.get(row.jurisdictionId) ?? null,
  }));
}

export async function getGovTypeTrajectory() {
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
    WHERE j.government_type IS NOT NULL
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
    governmentClassification:
      classificationMap.get(row.jurisdictionId) ?? null,
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

export async function getPulseChangelog(
  slug?: string,
  limit = 50,
  offset = 0
) {
  const slugFilter = slug
    ? sql`AND j.slug = ${slug}`
    : sql``;

  return db.execute(sql`
    SELECT
      pe.id,
      pe.event_date             AS "eventDate",
      pe.category,
      pe.severity,
      pe.confidence,
      pe.headline,
      pe.justification,
      pe.source_url             AS "sourceUrl",
      pe.source_name            AS "sourceName",
      pe.is_active              AS "isActive",
      j.slug,
      j.name                    AS "countryName",
      j.iso2,
      j.flag_url                AS "flagUrl",
      j.continent,
      j.capital,
      (
        SELECT pds.pulse_score
        FROM pulse_daily_scores pds
        WHERE pds.jurisdiction_id = j.id
        ORDER BY pds.score_date DESC
        LIMIT 1
      )                         AS "pulseLatest"
    FROM pulse_events pe
    JOIN jurisdictions j ON pe.jurisdiction_id = j.id
    WHERE j.type = 'sovereign_state'
      ${slugFilter}
    ORDER BY pe.event_date DESC, pe.created_at DESC
    LIMIT ${limit}
    OFFSET ${offset}
  `);
}

export async function getPulseChangelogSummary(days = 30) {
  return db.execute(sql`
    WITH scoped AS (
      SELECT pe.*, j.name AS country_name, j.continent
      FROM pulse_events pe
      JOIN jurisdictions j ON pe.jurisdiction_id = j.id
      WHERE j.type = 'sovereign_state'
        AND pe.event_date >= CURRENT_DATE - ${days}
    ),
    biggest_drop AS (
      SELECT country_name, SUM(severity * confidence / 10.0) AS total
      FROM scoped
      GROUP BY country_name
      ORDER BY total ASC
      LIMIT 1
    ),
    biggest_gain AS (
      SELECT country_name, SUM(severity * confidence / 10.0) AS total
      FROM scoped
      GROUP BY country_name
      ORDER BY total DESC
      LIMIT 1
    )
    SELECT
      (SELECT COUNT(*)::int FROM scoped)                                 AS "totalEvents",
      (SELECT COUNT(DISTINCT country_name)::int FROM scoped)             AS "countriesMoved",
      (SELECT COUNT(*)::int FROM jurisdictions WHERE type = 'sovereign_state') AS "totalCountries",
      (SELECT country_name FROM biggest_drop)                            AS "biggestDropCountry",
      (SELECT total        FROM biggest_drop)                            AS "biggestDropValue",
      (SELECT country_name FROM biggest_gain)                            AS "biggestGainCountry",
      (SELECT total        FROM biggest_gain)                            AS "biggestGainValue"
  `);
}

export async function getPulseChangelogDailyGlobal(days = 30) {
  return db.execute(sql`
    SELECT
      pe.event_date                                                           AS "eventDate",
      SUM(CASE WHEN pe.severity > 0 THEN pe.severity * pe.confidence ELSE 0 END)::float AS "positiveImpact",
      SUM(CASE WHEN pe.severity < 0 THEN pe.severity * pe.confidence ELSE 0 END)::float AS "negativeImpact",
      SUM(pe.severity * pe.confidence)::float                                 AS "netImpact",
      COUNT(*)::int                                                           AS "eventCount"
    FROM pulse_events pe
    JOIN jurisdictions j ON pe.jurisdiction_id = j.id
    WHERE j.type = 'sovereign_state'
      AND pe.event_date >= CURRENT_DATE - ${days}
    GROUP BY pe.event_date
    ORDER BY pe.event_date ASC
  `);
}

export async function getPulseHistory(slug: string, days = 90) {
  return db.execute(sql`
    SELECT
      pds.score_date            AS "scoreDate",
      pds.ci_baseline           AS "ciBaseline",
      pds.event_impact          AS "eventImpact",
      pds.pulse_score           AS "pulseScore",
      pds.active_events         AS "activeEvents",
      pds.is_low_confidence     AS "isLowConfidence"
    FROM pulse_daily_scores pds
    JOIN jurisdictions j ON pds.jurisdiction_id = j.id
    WHERE j.slug = ${slug}
      AND pds.score_date >= CURRENT_DATE - ${days}
    ORDER BY pds.score_date ASC
  `);
}

async function getLatestAvailableQuarter(): Promise<string> {
  const [row] = await db
    .select({ quarter: ciCompositeScores.quarter })
    .from(ciCompositeScores)
    .orderBy(desc(ciCompositeScores.quarter))
    .limit(1);
  if (row) return row.quarter;
  const now = new Date();
  const q = Math.ceil((now.getMonth() + 1) / 3);
  return `${now.getFullYear()}-Q${q}`;
}
