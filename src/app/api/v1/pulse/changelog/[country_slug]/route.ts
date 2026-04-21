import { apiResponse, apiError, corsOptions, withRateLimit } from "@/lib/api/helpers";
import { db } from "@/lib/db";
import { jurisdictions, pulseChangelog, pulseEvents } from "@/lib/db/schema";
import { eq, sql, desc, asc } from "drizzle-orm";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ country_slug: string }> }
) {
  const rateLimited = withRateLimit(request);
  if (rateLimited) return rateLimited;

  try {
    const { country_slug } = await params;
    const slug = country_slug.toLowerCase();

    const url = new URL(request.url);
    const limitParam = url.searchParams.get("limit");
    const offsetParam = url.searchParams.get("offset");
    const since = url.searchParams.get("since");

    const limit = Math.min(Math.max(parseInt(limitParam ?? "50", 10) || 50, 1), 250);
    const offset = Math.max(parseInt(offsetParam ?? "0", 10) || 0, 0);

    const jurisdictionRows = await db
      .select({ id: jurisdictions.id, slug: jurisdictions.slug, name: jurisdictions.name })
      .from(jurisdictions)
      .where(sql`LOWER(${jurisdictions.slug}) = ${slug}`)
      .limit(1);

    const jurisdiction = jurisdictionRows[0];
    if (!jurisdiction) {
      return apiError("Country not found", 404);
    }

    const conditions = [sql`${pulseChangelog.jurisdictionId} = ${jurisdiction.id}`];
    if (since) {
      conditions.push(sql`${pulseChangelog.scoreDate} >= ${since}`);
    }
    const where = sql.join(conditions, sql` AND `);

    const [rows, countResult] = await Promise.all([
      db
        .select({
          scoreDate: pulseChangelog.scoreDate,
          decayedImpact: pulseChangelog.decayedImpact,
          daysSinceEvent: pulseChangelog.daysSinceEvent,
          eventId: pulseChangelog.eventId,
          headline: pulseEvents.headline,
          category: pulseEvents.category,
          severity: pulseEvents.severity,
          eventDate: pulseEvents.eventDate,
        })
        .from(pulseChangelog)
        .innerJoin(pulseEvents, eq(pulseChangelog.eventId, pulseEvents.id))
        .where(where)
        .orderBy(desc(pulseChangelog.scoreDate), asc(pulseChangelog.daysSinceEvent))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(pulseChangelog)
        .where(where),
    ]);

    const total = countResult[0]?.count ?? 0;

    return apiResponse({
      data: rows,
      meta: { total, limit, offset, hasMore: offset + limit < total },
    });
  } catch (e) {
    console.error("API /v1/pulse/changelog/[country_slug] error:", e);
    return apiError("Internal server error", 500);
  }
}

export async function OPTIONS() {
  return corsOptions();
}
