import { NextResponse } from "next/server";
import { enforceRequestRateLimit } from "@/lib/api/rate-limit-request";
import { getRequestRateLimitPolicy } from "@/lib/api/rate-limit-runtime-policy";
import { buildGovernanceEvidenceExport } from "@/lib/ci/governance-evidence";
import {
  GOVERNANCE_EVIDENCE_AVAILABLE_SERIES_TYPES,
  GOVERNANCE_EVIDENCE_SERIES,
} from "@/lib/ci/governance-evidence";
import { getGovernanceEvidence } from "@/lib/db/queries-governance-evidence";
import { normalizeCiSeriesType } from "@/lib/ci/series-provenance";
import {
  parsePathContract,
  parseQueryContract,
} from "@/lib/api/request-contract";
import { withSafeJsonErrors } from "@/lib/api/problem-response";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  return withSafeJsonErrors("api/governance-evidence/[slug]", async () => {
    const limited = await enforceRequestRateLimit(
      request,
      getRequestRateLimitPolicy("public-dynamic-export"),
    );
    if (limited) return limited;

    const path = await parsePathContract(params, "jurisdiction-slug-params/v1");
    if (!path.ok) return path.response;
    const query = parseQueryContract(request, "governance-evidence-query/v1");
    if (!query.ok) return query.response;
    const { slug } = path.data;
    const requested = query.data.series_type;
    let seriesType = GOVERNANCE_EVIDENCE_SERIES.seriesType;
    if (requested) {
      try {
        seriesType = normalizeCiSeriesType(requested);
      } catch {
        return NextResponse.json(
          {
            error: "Unknown series_type",
            code: "INVALID_SERIES_TYPE",
            allowed: ["as_published_release", "harmonized_backcast"],
          },
          { status: 400, headers: { "Cache-Control": "no-store" } },
        );
      }
    }
    if (!GOVERNANCE_EVIDENCE_AVAILABLE_SERIES_TYPES.includes(seriesType)) {
      return NextResponse.json(
        {
          error: "That series type has no Governance Evidence release",
          code: "SERIES_NOT_AVAILABLE",
          requestedSeriesType: seriesType,
          availableSeriesTypes: GOVERNANCE_EVIDENCE_AVAILABLE_SERIES_TYPES,
        },
        { status: 404, headers: { "Cache-Control": "no-store" } },
      );
    }
    const evidence = await getGovernanceEvidence(slug, seriesType);

    if (!evidence) {
      return NextResponse.json(
        { error: "Country not found", code: "COUNTRY_NOT_FOUND" },
        { status: 404, headers: { "Cache-Control": "no-store" } },
      );
    }

    return NextResponse.json(buildGovernanceEvidenceExport(evidence), {
      headers: {
        "Content-Disposition": `attachment; filename="civica-governance-evidence-${slug}-${evidence.year}-${seriesType}.json"`,
      },
    });
  });
}
