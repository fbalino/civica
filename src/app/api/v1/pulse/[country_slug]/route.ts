import { apiResponse, apiError, corsOptions, withRateLimit } from "@/lib/api/helpers";
import { db } from "@/lib/db";
import { jurisdictions, pulseDailyScores, pulseEvents } from "@/lib/db/schema";
import { eq, sql, desc } from "drizzle-orm";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ country_slug: string }> }
) {
  const rateLimited = withRateLimit(request);
  if (rateLimited) return rateLimited;

  try {
    const { country_slug } = await params;
    const slug = country_slug.toLowerCase();

    const jurisdictionRows = await db
      .select({ id: jurisdictions.id, slug: jurisdictions.slug, name: jurisdictions.name })
      .from(jurisdictions)
      .where(sql`LOWER(${jurisdictions.slug}) = ${slug}`)
      .limit(1);

    const jurisdiction = jurisdictionRows[0];
    if (!jurisdiction) {
      return apiError("Country not found", 404);
    }

    const latestScore = await db
      .select()
      .from(pulseDailyScores)
      .where(eq(pulseDailyScores.jurisdictionId, jurisdiction.id))
      .orderBy(desc(pulseDailyScores.scoreDate))
      .limit(1);

    const pulse = latestScore[0];
    if (!pulse) {
      return apiError("No Pulse data available for this country", 404);
    }

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const cutoff = thirtyDaysAgo.toISOString().slice(0, 10);

    const recentEvents = await db
      .select({
        id: pulseEvents.id,
        eventDate: pulseEvents.eventDate,
        category: pulseEvents.category,
        severity: pulseEvents.severity,
        confidence: pulseEvents.confidence,
        headline: pulseEvents.headline,
        sourceUrl: pulseEvents.sourceUrl,
        sourceName: pulseEvents.sourceName,
      })
      .from(pulseEvents)
      .where(
        sql`${pulseEvents.jurisdictionId} = ${jurisdiction.id}
          AND ${pulseEvents.isActive} = true
          AND ${pulseEvents.eventDate} >= ${cutoff}`
      )
      .orderBy(desc(pulseEvents.eventDate));

    return apiResponse({
      data: {
        slug: jurisdiction.slug,
        name: jurisdiction.name,
        scoreDate: pulse.scoreDate,
        ciBaseline: pulse.ciBaseline,
        eventImpact: pulse.eventImpact,
        pulseScore: pulse.pulseScore,
        activeEvents: pulse.activeEvents,
        isLowConfidence: pulse.isLowConfidence,
        methodologyVersion: pulse.methodologyVersion,
        recentEvents,
      },
    });
  } catch (e) {
    console.error("API /v1/pulse/[country_slug] error:", e);
    return apiError("Internal server error", 500);
  }
}

export async function OPTIONS() {
  return corsOptions();
}
