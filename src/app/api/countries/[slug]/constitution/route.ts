import { NextResponse } from "next/server";
import { getJurisdictionBySlug, getConstitution } from "@/lib/db/queries";
import { enforceRequestRateLimit } from "@/lib/api/rate-limit-request";
import { getRequestRateLimitPolicy } from "@/lib/api/rate-limit-runtime-policy";
import { parsePathContract } from "@/lib/api/request-contract";
import { apiProblem, withSafeJsonErrors } from "@/lib/api/problem-response";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  return withSafeJsonErrors("api/countries/[slug]/constitution", async () => {
    const limited = await enforceRequestRateLimit(
      req,
      getRequestRateLimitPolicy("public-dynamic-read"),
    );
    if (limited) return limited;

    const path = await parsePathContract(params, "jurisdiction-slug-params/v1");
    if (!path.ok) return path.response;
    const { slug } = path.data;
    const jurisdiction = await getJurisdictionBySlug(slug);
    if (!jurisdiction) return apiProblem("NOT_FOUND");

    const constitution = await getConstitution(jurisdiction.id);

    return NextResponse.json({
      country: jurisdiction.name,
      year: constitution?.year ?? null,
      yearUpdated: constitution?.yearUpdated ?? null,
      hasFullText: !!constitution?.fullTextHtml,
      constituteProjectId: constitution?.constituteProjectId ?? null,
      readerUrl: constitution
        ? `/constitution?c=${encodeURIComponent(slug)}`
        : null,
      source: constitution
        ? {
            id: "constitute_project",
            name: "Constitute Project",
            license: "CC-BY-NC-3.0",
            termsUrl: "https://www.constituteproject.org/content/terms",
            access: "interactive-noncommercial-display-only",
            bulkExport: "blocked",
          }
        : null,
    });
  });
}
