import { apiResponse, apiError, corsOptions, withRateLimit } from "@/lib/api/helpers";
import { db } from "@/lib/db";
import { jurisdictions, ciCompositeScores, pulseDailyScores } from "@/lib/db/schema";
import { eq, sql, desc, asc } from "drizzle-orm";

export async function GET(request: Request) {
  const rateLimited = withRateLimit(request);
  if (rateLimited) return rateLimited;

  try {
    const url = new URL(request.url);
    const quarterParam = url.searchParams.get("quarter");
    const sort = url.searchParams.get("sort") ?? "ci";
    const continent = url.searchParams.get("continent");
    const governmentType = url.searchParams.get("government_type");
    const limitParam = url.searchParams.get("limit");
    const offsetParam = url.searchParams.get("offset");

    const limit = Math.min(Math.max(parseInt(limitParam ?? "50", 10) || 50, 1), 250);
    const offset = Math.max(parseInt(offsetParam ?? "0", 10) || 0, 0);

    // Resolve the target quarter: explicit param or latest available
    let quarter = quarterParam;
    if (!quarter) {
      const latest = await db
        .select({ quarter: ciCompositeScores.quarter })
        .from(ciCompositeScores)
        .orderBy(desc(ciCompositeScores.quarter))
        .limit(1);
      quarter = latest[0]?.quarter ?? null;
    }

    if (!quarter) {
      return apiResponse({ data: [], meta: { total: 0, limit, offset, hasMore: false, quarter: null } });
    }

    const conditions = [sql`${ciCompositeScores.quarter} = ${quarter}`];

    if (continent) {
      conditions.push(sql`LOWER(${jurisdictions.continent}) = ${continent.toLowerCase()}`);
    }
    if (governmentType) {
      conditions.push(
        sql`(LOWER(${jurisdictions.governmentType}) LIKE ${`%${governmentType.toLowerCase()}%`}
          OR LOWER(${jurisdictions.governmentTypeDetail}) LIKE ${`%${governmentType.toLowerCase()}%`})`
      );
    }

    const where = sql.join(conditions, sql` AND `);

    const isCpSort = sort === "cp";

    const baseSelect = {
      rank: ciCompositeScores.rank,
      score: ciCompositeScores.score,
      isPartial: ciCompositeScores.isPartial,
      missingDimensions: ciCompositeScores.missingDimensions,
      methodologyVersion: ciCompositeScores.methodologyVersion,
      slug: jurisdictions.slug,
      name: jurisdictions.name,
      continent: jurisdictions.continent,
      governmentType: jurisdictions.governmentType,
    };

    const cpSelect = isCpSort
      ? {
          ...baseSelect,
          pulseScore: pulseDailyScores.pulseScore,
          eventImpact: pulseDailyScores.eventImpact,
          activeEvents: pulseDailyScores.activeEvents,
          isLowConfidence: pulseDailyScores.isLowConfidence,
          pulseDate: pulseDailyScores.scoreDate,
        }
      : baseSelect;

    let rowsQuery = db
      .select(cpSelect)
      .from(ciCompositeScores)
      .innerJoin(jurisdictions, eq(ciCompositeScores.jurisdictionId, jurisdictions.id))
      .$dynamic();

    if (isCpSort) {
      rowsQuery = rowsQuery.leftJoin(
        pulseDailyScores,
        sql`${pulseDailyScores.jurisdictionId} = ${ciCompositeScores.jurisdictionId}
          AND ${pulseDailyScores.scoreDate} = (
            SELECT MAX(score_date) FROM pulse_daily_scores
            WHERE jurisdiction_id = ${ciCompositeScores.jurisdictionId}
          )`
      );
    }

    const orderCol = isCpSort
      ? sql`${pulseDailyScores.pulseScore} DESC NULLS LAST`
      : asc(ciCompositeScores.rank);

    const [rows, countResult] = await Promise.all([
      rowsQuery
        .where(where)
        .orderBy(orderCol)
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(ciCompositeScores)
        .innerJoin(jurisdictions, eq(ciCompositeScores.jurisdictionId, jurisdictions.id))
        .where(where),
    ]);

    const total = countResult[0]?.count ?? 0;

    return apiResponse({
      data: rows,
      meta: { total, limit, offset, hasMore: offset + limit < total, quarter },
    });
  } catch (e) {
    console.error("API /v1/index/rankings error:", e);
    return apiError("Internal server error", 500);
  }
}

export async function OPTIONS() {
  return corsOptions();
}
