import { NextResponse } from "next/server";
import { enforceRequestRateLimit } from "@/lib/api/rate-limit-request";
import { getRequestRateLimitPolicy } from "@/lib/api/rate-limit-runtime-policy";
import { parsePathContract, parseQueryContract } from "@/lib/api/request-contract";
import { apiProblem, withSafeJsonErrors } from "@/lib/api/problem-response";
import { getAtlasEntityChangeHistory } from "@/lib/atlas/change-history-query";
import { ENTITY_CITATION_RESOLVERS } from "@/lib/citations/resolvers";
import { cacheControlFor } from "@/lib/platform/cache-consistency";

export async function GET(request: Request, { params }: { params: Promise<{ entityType: string; id: string }> }) {
  return withSafeJsonErrors("api/citations/[entityType]/[id]/history", async () => {
    const limited = await enforceRequestRateLimit(request, getRequestRateLimitPolicy("public-dynamic-read"));
    if (limited) return limited;
    const path = await parsePathContract(params, "entity-citation-params/v1");
    if (!path.ok) return path.response;
    const query = parseQueryContract(request, "atlas-entity-history-query/v1");
    if (!query.ok) return query.response;
    const citation = await ENTITY_CITATION_RESOLVERS[path.data.entityType](
      path.data.id,
    );
    if (!citation) {
      return apiProblem("NOT_FOUND", {
        headers: { "X-Robots-Tag": "noindex" },
      });
    }
    const document = await getAtlasEntityChangeHistory({
      citation,
      ...query.data,
    });
    return NextResponse.json(document, { headers: { "Cache-Control": cacheControlFor("public-live"), "X-Robots-Tag": "noindex" } });
  });
}
