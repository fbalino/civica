/**
 * ATL-019 — GET /api/citations/{entityType}/{id}
 *
 * The single generic stable-identifier citation endpoint for fact,
 * institution, office, person, election, constitution-passage, organization,
 * and indicator entities. `entityType` is validated against the closed
 * `ENTITY_TYPES` enum (404 on anything else); `id` is format-checked per
 * kind before touching the database (404 on malformed ids, never a DB
 * error). The resolved `EntityCitation` is strictly Zod-parsed before it
 * leaves the server, so a resolver bug can never publish a shape the
 * contract doesn't allow.
 */
import { NextResponse } from "next/server";
import { enforceRequestRateLimit } from "@/lib/api/rate-limit-request";
import { getRequestRateLimitPolicy } from "@/lib/api/rate-limit-runtime-policy";
import { parsePathContract } from "@/lib/api/request-contract";
import { ENTITY_CITATION_RESOLVERS } from "@/lib/citations/resolvers";
import { zEntityCitation } from "@/lib/citations/stable-identity";
import { apiProblem } from "@/lib/api/problem-response";
import { cacheControlFor } from "@/lib/platform/cache-consistency";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ entityType: string; id: string }> },
) {
  const limited = await enforceRequestRateLimit(
    request,
    getRequestRateLimitPolicy("public-dynamic-read"),
  );
  if (limited) return limited;

  const path = await parsePathContract(params, "entity-citation-params/v1");
  if (!path.ok) return path.response;
  const { entityType, id } = path.data;

  try {
    const resolver = ENTITY_CITATION_RESOLVERS[entityType];
    const citation = await resolver(id);
    if (!citation) {
      return apiProblem("NOT_FOUND", {
        headers: { "X-Robots-Tag": "noindex" },
      });
    }

    const parsed = zEntityCitation.safeParse(citation);
    if (!parsed.success) {
      console.error(
        "[/api/citations] resolver produced an invalid citation shape",
        entityType,
        parsed.error.flatten(),
      );
      return apiProblem("DATA_UNAVAILABLE", {
        headers: { "X-Robots-Tag": "noindex" },
      });
    }

    return NextResponse.json(parsed.data, {
      headers: {
        "Cache-Control": cacheControlFor("public-live"),
        "X-Robots-Tag": "noindex",
      },
    });
  } catch (error) {
    console.error("[/api/citations]", error);
    return apiProblem("DATA_UNAVAILABLE", {
      headers: { "X-Robots-Tag": "noindex" },
    });
  }
}
