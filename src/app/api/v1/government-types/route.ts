import { apiResponse, apiError, corsOptions, withRateLimit } from "@/lib/api/helpers";
import { db } from "@/lib/db";
import { jurisdictions } from "@/lib/db/schema";
import { sql, asc } from "drizzle-orm";

export async function GET(request: Request) {
  const rateLimited = withRateLimit(request);
  if (rateLimited) return rateLimited;

  try {
    const results = await db
      .select({
        governmentType: jurisdictions.governmentType,
        count: sql<number>`count(*)::int`,
        examples: sql<string>`string_agg(${jurisdictions.name}, ', ' ORDER BY ${jurisdictions.population} DESC NULLS LAST) FILTER (WHERE ${jurisdictions.population} IS NOT NULL)`,
      })
      .from(jurisdictions)
      .where(
        sql`${jurisdictions.type} = 'sovereign_state' AND ${jurisdictions.governmentType} IS NOT NULL AND LOWER(${jurisdictions.name}) <> 'none'`
      )
      .groupBy(jurisdictions.governmentType)
      .orderBy(asc(jurisdictions.governmentType));

    const data = results.map((r) => {
      const allExamples = r.examples?.split(", ") ?? [];
      return {
        governmentType: r.governmentType,
        count: r.count,
        topExamples: allExamples.slice(0, 5),
      };
    });

    return apiResponse({
      data,
      meta: { total: data.length },
    });
  } catch (e) {
    console.error("API /v1/government-types error:", e);
    return apiError("Internal server error", 500);
  }
}

export async function OPTIONS() {
  return corsOptions();
}
