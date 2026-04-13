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
    .where(eq(jurisdictions.type, "sovereign_state"))
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

export async function getSource(sourceId: string) {
  const results = await db
    .select()
    .from(sources)
    .where(eq(sources.id, sourceId))
    .limit(1);
  return results[0] ?? null;
}
