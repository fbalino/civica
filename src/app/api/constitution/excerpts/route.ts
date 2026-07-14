/**
 * GET /api/constitution/excerpts?topic=<key>&c=<slug>&c=<slug>…
 *
 * Internal endpoint backing the Constitution Explorer's cross-reference pane.
 * Given a Constitute ontology topic key and a set of civica country slugs, it
 * returns how each of those countries' constitutions treats the topic — a pure
 * indexed lookup against `constitution_topic_excerpts`, never a live Constitute
 * call.
 *
 * The client passes SLUGS (mirroring the page's `?c=` scheme); this handler
 * resolves them to jurisdiction ids so the client never has to know db ids.
 * Order is preserved: excerpts come back in the same order the slugs were
 * passed.
 *
 * Response: `{ topicKey, topicLabel, countries: TopicExcerptCountry[] }`.
 * Display-only, non-commercial (Constitute CC BY-NC 3.0).
 */
import { getJurisdictionsBySlugs } from "@/lib/db/queries";
import { getTopicExcerpts } from "@/lib/db/queries-constitution";
import { getTopicLabel, isKnownTopic } from "@/lib/constitute/topics";
import { enforceRequestRateLimit } from "@/lib/api/rate-limit-request";
import { getRequestRateLimitPolicy } from "@/lib/api/rate-limit-runtime-policy";
import { apiProblem } from "@/lib/api/problem-response";
import { parseQueryContract } from "@/lib/api/request-contract";

export const revalidate = 3600;

export async function GET(request: Request) {
  const limited = await enforceRequestRateLimit(
    request,
    getRequestRateLimitPolicy("public-dynamic-read"),
  );
  if (limited) return limited;

  const query = parseQueryContract(request, "constitution-excerpts-query/v1");
  if (!query.ok) return query.response;
  const { topic: topicKey, c: slugs } = query.data;

  // Reject unknown topic keys up front — a bogus key would otherwise return
  // 200 + an empty set, masking client bugs and inviting cache pollution.
  if (!isKnownTopic(topicKey)) {
    return apiProblem("INVALID_QUERY");
  }

  if (slugs.length === 0) {
    return Response.json({
      topicKey,
      topicLabel: getTopicLabel(topicKey),
      countries: [],
    });
  }

  try {
    // Resolve slugs → jurisdiction ids, preserving the requested slug order.
    const rows = await getJurisdictionsBySlugs(slugs);
    const bySlug = new Map(rows.map((r) => [r.slug, r]));
    const orderedIds = slugs
      .map((s) => bySlug.get(s)?.id)
      .filter((id): id is string => typeof id === "string");

    const countries = await getTopicExcerpts(topicKey, orderedIds, {
      throwOnError: true,
    });

    return Response.json({
      topicKey,
      topicLabel: getTopicLabel(topicKey),
      countries,
    });
  } catch (err) {
    console.error("[/api/constitution/excerpts]", err);
    return Response.json(
      {
        error: "data_unavailable",
        code: "DATA_UNAVAILABLE",
        message: "Constitution excerpts are temporarily unavailable.",
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
