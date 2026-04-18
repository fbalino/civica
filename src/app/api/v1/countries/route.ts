import { apiResponse, apiError, corsOptions, withRateLimit } from "@/lib/api/helpers";
import { db } from "@/lib/db";
import { jurisdictions } from "@/lib/db/schema";
import { sql, asc, desc } from "drizzle-orm";

export async function GET(request: Request) {
  const rateLimited = withRateLimit(request);
  if (rateLimited) return rateLimited;

  try {
    const url = new URL(request.url);
    const continent = url.searchParams.get("continent");
    const governmentType = url.searchParams.get("government_type");
    const limitParam = url.searchParams.get("limit");
    const offsetParam = url.searchParams.get("offset");

    const limit = Math.min(Math.max(parseInt(limitParam ?? "50", 10) || 50, 1), 250);
    const offset = Math.max(parseInt(offsetParam ?? "0", 10) || 0, 0);

    const conditions = [
      sql`${jurisdictions.type} = 'sovereign_state'`,
      sql`LOWER(${jurisdictions.name}) <> 'none'`,
    ];

    if (continent) {
      conditions.push(sql`LOWER(${jurisdictions.continent}) = ${continent.toLowerCase()}`);
    }
    if (governmentType) {
      conditions.push(
        sql`(LOWER(${jurisdictions.governmentType}) LIKE ${`%${governmentType.toLowerCase()}%`} OR LOWER(${jurisdictions.governmentTypeDetail}) LIKE ${`%${governmentType.toLowerCase()}%`})`
      );
    }

    const where = sql.join(conditions, sql` AND `);

    const [countries, countResult] = await Promise.all([
      db
        .select({
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

    const total = countResult[0]?.count ?? 0;

    return apiResponse({
      data: countries,
      meta: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
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
