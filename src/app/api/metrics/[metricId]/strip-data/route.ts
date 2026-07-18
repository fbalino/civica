import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { buildGovTypeStripBands, getMetricStripData } from "@/lib/db/queries";
import { db } from "@/lib/db";
import { jurisdictions, metricDefinitions, sources } from "@/lib/db/schema";
import { getMaterialMetricPeerCohort } from "@/lib/peer-grouping/material-metric-cohort";
import { enforceRequestRateLimit } from "@/lib/api/rate-limit-request";
import { getRequestRateLimitPolicy } from "@/lib/api/rate-limit-runtime-policy";
import {
  parsePathContract,
  parseQueryContract,
} from "@/lib/api/request-contract";
import { apiProblem, withSafeJsonErrors } from "@/lib/api/problem-response";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ metricId: string }> },
) {
  return withSafeJsonErrors("api/metrics/[metricId]/strip-data", async () => {
    const limited = await enforceRequestRateLimit(
      req,
      getRequestRateLimitPolicy("public-dynamic-read"),
    );
    if (limited) return limited;

    const path = await parsePathContract(params, "metric-id-params/v1");
    if (!path.ok) return path.response;
    const query = parseQueryContract(req, "metric-strip-query/v1");
    if (!query.ok) return query.response;
    const { metricId } = path.data;
    const { year, govTypes, regions, taxonomy, country } = query.data;

    const rawRows = await getMetricStripData(
      metricId,
      year,
      govTypes,
      taxonomy,
      regions,
    );

    const rows = Array.isArray(rawRows)
      ? rawRows
      : ((rawRows as { rows: unknown[] }).rows ?? []);
    const bands = buildGovTypeStripBands(
      rows as Array<{ govType: string; value: number }>,
    );
    const [metricDefRows, coverageRows] = await Promise.all([
      db
        .select({
          id: metricDefinitions.id,
          name: metricDefinitions.name,
          description: metricDefinitions.description,
          category: metricDefinitions.category,
          unit: metricDefinitions.unit,
          higherIsBetter: metricDefinitions.higherIsBetter,
          valueMin: metricDefinitions.valueMin,
          valueMax: metricDefinitions.valueMax,
          sourceName: sources.name,
        })
        .from(metricDefinitions)
        .leftJoin(sources, eq(metricDefinitions.defaultSourceId, sources.id))
        .where(eq(metricDefinitions.id, metricId))
        .limit(1),
      db
        .select({
          total: sql<number>`COUNT(*) FILTER (WHERE ${jurisdictions.type} = 'sovereign_state')::int`,
        })
        .from(jurisdictions),
    ]);

    const metricDef = metricDefRows[0];
    if (!metricDef) {
      return apiProblem("NOT_FOUND");
    }

    // Index peer-band stats by govType for O(1) lookup
    const bandByGovType = Object.fromEntries(
      (bands as Array<{ govType: string; [k: string]: unknown }>).map((b) => [
        b.govType,
        b,
      ]),
    );

    const peerCohort = country
      ? await (async () => {
          const subject = await db
            .select({ id: jurisdictions.id })
            .from(jurisdictions)
            .where(eq(jurisdictions.slug, country))
            .limit(1);
          if (!subject[0]) return null;
          const cohort = await getMaterialMetricPeerCohort({
            jurisdictionId: subject[0].id,
            metricId,
            year,
          });
          if (!cohort) return null;
          const { peerSet } = cohort;
          return {
            measureDomain: peerSet.measureDomain,
            metricId: peerSet.metricId,
            metricVintage: peerSet.metricVintage,
            available: peerSet.available,
            cohortLabel: peerSet.cohortLabel,
            lensUsed: peerSet.lensUsed,
            eligibleN: peerSet.eligibleN,
            attemptedN: peerSet.attemptedN,
            finalN: peerSet.finalN,
            fallbackChain: peerSet.fallbackChain,
            upstreamVintage: peerSet.upstreamVintage,
          };
        })()
      : null;

    return NextResponse.json({
      metricId,
      year,
      taxonomy,
      data: rows,
      govTypeBands: bandByGovType,
      metricDef,
      coverage: {
        total: Number(coverageRows[0]?.total ?? 0),
        withData: rows.length,
      },
      // `govTypeBands` are descriptive strata for the chart. A selected
      // country receives the actual material peer cohort separately, with the
      // observed universe, fallback, and upstream-vintage contract exposed.
      peerCohort,
    });
  });
}
