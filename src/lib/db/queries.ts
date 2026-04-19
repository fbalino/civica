import { eq, desc, asc, sql } from "drizzle-orm";
import { db } from "./index";
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
} from "./schema";

export async function getJurisdictionBySlug(slug: string) {
  const results = await db
    .select()
    .from(jurisdictions)
    .where(eq(jurisdictions.slug, slug))
    .limit(1);
  return results[0] ?? null;
}

export async function getAllJurisdictions() {
  return db
    .select()
    .from(jurisdictions)
    .where(
      sql`${jurisdictions.type} = 'sovereign_state' AND LOWER(${jurisdictions.name}) <> 'none'`
    )
    .orderBy(
      sql`${jurisdictions.population} DESC NULLS LAST`,
      asc(jurisdictions.name)
    );
}

// Non-territory sovereign states with population data. Used for the homepage
// featured grid so we never surface Akrotiri / Antarctica / Bouvet Island first.
export async function getFeaturedCountries(limit = 24) {
  return db
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

export async function getJurisdictionsBySlugs(slugs: string[]) {
  if (slugs.length === 0) return [];
  return db
    .select()
    .from(jurisdictions)
    .where(sql`${jurisdictions.slug} IN ${slugs}`);
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
  return db
    .select()
    .from(jurisdictions)
    .where(
      sql`${jurisdictions.type} = 'sovereign_state' AND (${combined})`
    )
    .orderBy(desc(jurisdictions.population), asc(jurisdictions.name));
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
