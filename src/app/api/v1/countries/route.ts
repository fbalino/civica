import { apiResponse, apiError, corsOptions, withRateLimit } from "@/lib/api/helpers";
import { db } from "@/lib/db";
import { buildGovernmentClassificationMap } from "@/lib/db/government-taxonomy";
import { jurisdictions } from "@/lib/db/schema";
import { sql, asc, desc } from "drizzle-orm";
import type { GovernmentTaxonomyLens } from "@/lib/government-taxonomy";

export async function GET(request: Request) {
  const rateLimited = withRateLimit(request);
  if (rateLimited) return rateLimited;

  try {
    const url = new URL(request.url);
    const continent = url.searchParams.get("continent");
    const governmentType = url.searchParams.get("government_type");
    const taxonomyParam = url.searchParams.get("taxonomy");
    const limitParam = url.searchParams.get("limit");
    const offsetParam = url.searchParams.get("offset");
    const taxonomy: GovernmentTaxonomyLens =
      taxonomyParam === "structural" || taxonomyParam === "regime"
        ? taxonomyParam
        : "raw";

    const limit = Math.min(Math.max(parseInt(limitParam ?? "50", 10) || 50, 1), 250);
    const offset = Math.max(parseInt(offsetParam ?? "0", 10) || 0, 0);

    const conditions = [
      sql`${jurisdictions.type} = 'sovereign_state'`,
      sql`LOWER(${jurisdictions.name}) <> 'none'`,
    ];

    if (continent) {
      conditions.push(sql`LOWER(${jurisdictions.continent}) = ${continent.toLowerCase()}`);
    }
    if (governmentType && taxonomy === "raw") {
      conditions.push(
        sql`(LOWER(${jurisdictions.governmentType}) LIKE ${`%${governmentType.toLowerCase()}%`} OR LOWER(${jurisdictions.governmentTypeDetail}) LIKE ${`%${governmentType.toLowerCase()}%`})`
      );
    }

    const where = sql.join(conditions, sql` AND `);

    if (taxonomy !== "raw" && governmentType) {
      const countries = await db
        .select({
          id: jurisdictions.id,
          slug: jurisdictions.slug,
          name: jurisdictions.name,
          iso2: jurisdictions.iso2,
          iso3: jurisdictions.iso3,
          continent: jurisdictions.continent,
          capital: jurisdictions.capital,
          population: jurisdictions.population,
          governmentType: jurisdictions.governmentType,
          governmentTypeDetail: jurisdictions.governmentTypeDetail,
          gdpBillions: jurisdictions.gdpBillions,
          areaSqKm: jurisdictions.areaSqKm,
          flagUrl: jurisdictions.flagUrl,
        })
        .from(jurisdictions)
        .where(where)
        .orderBy(desc(jurisdictions.population), asc(jurisdictions.name));

      const classificationMap = await buildGovernmentClassificationMap(countries);
      const filtered = countries
        .map((country) => ({
          ...country,
          governmentClassification: classificationMap.get(country.id) ?? null,
        }))
        .filter((country) => {
          const label =
            taxonomy === "regime"
              ? country.governmentClassification?.regimeTypeLabel
              : country.governmentClassification?.structuralFamilyLabel;
          return label
            ? label.toLowerCase().includes(governmentType.toLowerCase())
            : false;
        });

      const paged = filtered.slice(offset, offset + limit);
      return apiResponse({
        data: paged,
        meta: {
          total: filtered.length,
          limit,
          offset,
          hasMore: offset + limit < filtered.length,
          taxonomy,
        },
      });
    }

    const [countries, countResult] = await Promise.all([
      db
        .select({
          id: jurisdictions.id,
          slug: jurisdictions.slug,
          name: jurisdictions.name,
          iso2: jurisdictions.iso2,
          iso3: jurisdictions.iso3,
          continent: jurisdictions.continent,
          capital: jurisdictions.capital,
          population: jurisdictions.population,
          governmentType: jurisdictions.governmentType,
          governmentTypeDetail: jurisdictions.governmentTypeDetail,
          gdpBillions: jurisdictions.gdpBillions,
          areaSqKm: jurisdictions.areaSqKm,
          flagUrl: jurisdictions.flagUrl,
        })
        .from(jurisdictions)
        .where(where)
        .orderBy(desc(jurisdictions.population), asc(jurisdictions.name))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(jurisdictions)
        .where(where),
    ]);
    const classificationMap = await buildGovernmentClassificationMap(countries);

    const total = countResult[0]?.count ?? 0;

    return apiResponse({
      data: countries.map(({ id, ...country }) => ({
        ...country,
        governmentClassification: classificationMap.get(id) ?? null,
      })),
      meta: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
        taxonomy,
      },
    });
  } catch (e) {
    console.error("API /v1/countries error:", e);
    return apiError("Internal server error", 500);
  }
}

export async function OPTIONS() {
  return corsOptions();
}
