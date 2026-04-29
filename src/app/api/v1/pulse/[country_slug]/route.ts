import { apiResponse, apiError, corsOptions, withRateLimit } from "@/lib/api/helpers";
import { db } from "@/lib/db";
import { jurisdictions, pulseDailyScores, pulseEvents } from "@/lib/db/schema";
import { eq, sql, desc } from "drizzle-orm";
import { NextResponse } from "next/server";

/**
 * Phase 5.6 deprecation notice. The merged-scalar Pulse shape this
 * endpoint returns is the v1 methodology. The Beta methodology
 * publishes dimensional deltas — see the v2 endpoints listed in the
 * Sunset / Deprecation headers below. Legacy callers continue to
 * work until the 90-day sunset window closes (2026-12-31, 90 days
 * after the targeted CI v2 cut-over on 2026-09-30).
 */
const DEPRECATION_HEADERS: Record<string, string> = {
  Deprecation: "true",
  Sunset: "Thu, 31 Dec 2026 00:00:00 GMT",
  Link: '</api/v1/pulse/{country_slug}/dimensions>; rel="successor-version"',
};

function withDeprecation(res: NextResponse): NextResponse {
  for (const [k, v] of Object.entries(DEPRECATION_HEADERS)) {
    res.headers.set(k, v);
  }
  return res;
}

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
      return withDeprecation(apiError("Country not found", 404));
    }

    const latestScore = await db
      .select()
      .from(pulseDailyScores)
      .where(eq(pulseDailyScores.jurisdictionId, jurisdiction.id))
      .orderBy(desc(pulseDailyScores.scoreDate))
      .limit(1);

    const pulse = latestScore[0];
    if (!pulse) {
      return withDeprecation(
        apiError("No Pulse data available for this country", 404)
      );
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

    return withDeprecation(
      apiResponse({
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
      })
    );
  } catch (e) {
    console.error("API /v1/pulse/[country_slug] error:", e);
    return withDeprecation(apiError("Internal server error", 500));
  }
}

export async function OPTIONS() {
  return corsOptions();
}
