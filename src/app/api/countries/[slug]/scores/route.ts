import { NextResponse } from "next/server";
import { getJurisdictionBySlug } from "@/lib/db/queries";
import { getScoresForJurisdiction } from "@/lib/db/queries-scores";
import { enforceRequestRateLimit } from "@/lib/api/rate-limit-request";
import { getRequestRateLimitPolicy } from "@/lib/api/rate-limit-runtime-policy";
import { parsePathContract } from "@/lib/api/request-contract";
import { apiProblem, withSafeJsonErrors } from "@/lib/api/problem-response";
import { isCiReleaseConsistencyError } from "@/lib/ci/release-selection";
import { cacheControlFor } from "@/lib/platform/cache-consistency";

/**
 * P1.1 — Scores & Rankings feed for the atlas Scores tab.
 *
 * The atlas tab lives behind a `"use client"` boundary so it can't render
 * the `<ScoresAndRankings>` server component directly; it fetches the
 * pre-computed row list here and renders `<ScoresAndRankingsView>` with
 * the result. Same query, same shape, same row order — no drift between
 * factbook and atlas.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  return withSafeJsonErrors("api/countries/[slug]/scores", async () => {
    const limited = await enforceRequestRateLimit(
      req,
      getRequestRateLimitPolicy("public-dynamic-read"),
    );
    if (limited) return limited;

    const path = await parsePathContract(params, "jurisdiction-slug-params/v1");
    if (!path.ok) return path.response;
    const { slug } = path.data;
    const jurisdiction = await getJurisdictionBySlug(slug);
    if (!jurisdiction) {
      return apiProblem("NOT_FOUND");
    }
    let rows;
    try {
      rows = await getScoresForJurisdiction(jurisdiction.id);
    } catch (error) {
      if (isCiReleaseConsistencyError(error)) {
        return apiProblem("RELEASE_INCONSISTENT");
      }
      throw error;
    }
    return NextResponse.json(
      {
        country: jurisdiction.name,
        rows,
      },
      {
        headers: {
          "Cache-Control": cacheControlFor("public-live"),
        },
      },
    );
  });
}
