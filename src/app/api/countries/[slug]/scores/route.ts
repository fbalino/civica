import { NextResponse } from "next/server";
import { getJurisdictionBySlug } from "@/lib/db/queries";
import { getScoresForJurisdiction } from "@/lib/db/queries-scores";
import { shapePublicCountryScores } from "@/lib/ci/publisher-scores";
import { governanceEvidenceRights } from "@/lib/ci/governance-evidence";
import { enforceRequestRateLimit } from "@/lib/api/rate-limit-request";
import { getRequestRateLimitPolicy } from "@/lib/api/rate-limit-runtime-policy";
import { parsePathContract } from "@/lib/api/request-contract";
import { apiProblem, withSafeJsonErrors } from "@/lib/api/problem-response";
import { isCiReleaseConsistencyError } from "@/lib/ci/release-selection";
import { cacheControlFor } from "@/lib/platform/cache-consistency";

/**
 * GET /api/countries/:slug/scores — country-publisher-scores/v2 (CLM-020).
 *
 * The same two publisher measures as the country Civica Data "Rankings"
 * table: V-Dem's own Liberal Democracy Index figure and the Freedom House
 * status produced by Freedom House's published rule, each with its publisher
 * edition, observation year, manifest retrieval time, and Civica release. No
 * Civica rescale, rank, or trend is returned.
 *
 * Values are rights-filtered with the same rule as the Governance Evidence
 * API: a publisher's figure stays only when its verified terms permit public
 * export; otherwise the row is withheld and links to the publisher's terms.
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
      shapePublicCountryScores(jurisdiction.name, rows, governanceEvidenceRights),
      {
        headers: {
          "Cache-Control": cacheControlFor("public-live"),
        },
      },
    );
  });
}
