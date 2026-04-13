import { eq, sql, asc, desc } from "drizzle-orm";
import { db } from "../db";
import {
  countryFactbookSections,
  countryFacts,
  jurisdictions,
} from "../db/schema";

export async function getFactbookSection(
  countrySlug: string,
  sectionName: string
) {
  const results = await db
    .select({ sectionData: countryFactbookSections.sectionData })
    .from(countryFactbookSections)
    .innerJoin(
      jurisdictions,
      eq(countryFactbookSections.jurisdictionId, jurisdictions.id)
    )
    .where(
      sql`${jurisdictions.slug} = ${countrySlug} AND ${countryFactbookSections.sectionName} = ${sectionName}`
    )
    .limit(1);
  return (results[0]?.sectionData as Record<string, unknown>) ?? null;
}

export async function getFactbookFact(countrySlug: string, factKey: string) {
  const results = await db
    .select({
      factValue: countryFacts.factValue,
      factValueNumeric: countryFacts.factValueNumeric,
      factUnit: countryFacts.factUnit,
      factYear: countryFacts.factYear,
      sourceNote: countryFacts.sourceNote,
    })
    .from(countryFacts)
    .innerJoin(
      jurisdictions,
      eq(countryFacts.jurisdictionId, jurisdictions.id)
    )
    .where(
      sql`${jurisdictions.slug} = ${countrySlug} AND ${countryFacts.factKey} = ${factKey}`
    )
    .limit(1);
  return results[0] ?? null;
}

export async function compareCountriesByFact(
  factKey: string,
  options?: { sortDir?: "asc" | "desc"; limit?: number }
) {
  const dir = options?.sortDir ?? "desc";
  const lim = options?.limit ?? 20;

  return db
    .select({
      slug: jurisdictions.slug,
      name: jurisdictions.name,
      flagUrl: jurisdictions.flagUrl,
      factValue: countryFacts.factValue,
      factValueNumeric: countryFacts.factValueNumeric,
      factUnit: countryFacts.factUnit,
      factYear: countryFacts.factYear,
    })
    .from(countryFacts)
    .innerJoin(
      jurisdictions,
      eq(countryFacts.jurisdictionId, jurisdictions.id)
    )
    .where(
      sql`${countryFacts.factKey} = ${factKey} AND ${countryFacts.factValueNumeric} IS NOT NULL`
    )
    .orderBy(
      dir === "desc"
        ? desc(countryFacts.factValueNumeric)
        : asc(countryFacts.factValueNumeric)
    )
    .limit(lim);
}

export function renderFactbookValue(data: unknown): string {
  if (data === null || data === undefined) return "";
  if (typeof data === "string") return data;
  if (typeof data === "number") return data.toLocaleString();
  if (typeof data === "object" && "text" in (data as Record<string, unknown>)) {
    return String((data as Record<string, unknown>).text);
  }
  if (Array.isArray(data)) {
    return data.map(renderFactbookValue).join(", ");
  }
  return JSON.stringify(data);
}
