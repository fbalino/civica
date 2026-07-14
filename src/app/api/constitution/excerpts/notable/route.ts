/**
 * GET /api/constitution/excerpts/notable?topic=<key>&exclude=<slug>
 *
 * Companion to `/api/constitution/excerpts` for the single-country state of the
 * Constitution Explorer. When the reader has selected only one country, the
 * cross-reference pane still wants to show how OTHER constitutions treat the
 * chosen topic — this returns a few "notable peers" (the countries with the
 * largest excerpt for the topic, so the comparison shows substance rather than
 * one-line stubs), excluding the reader's own country.
 *
 * Response: `{ topicKey, topicLabel, countries: TopicExcerptCountry[] }`.
 * Pure indexed lookup, display-only, non-commercial (Constitute CC BY-NC 3.0).
 */
import { getJurisdictionsBySlugs } from "@/lib/db/queries";
import { getNotableTopicPeers } from "@/lib/db/queries-constitution";
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

  const query = parseQueryContract(request, "constitution-notable-query/v1");
  if (!query.ok) return query.response;
  const { topic: topicKey, exclude: excludeSlug } = query.data;

  // Reject unknown topic keys up front (mirrors /api/constitution/excerpts).
  if (!isKnownTopic(topicKey)) {
    return apiProblem("INVALID_QUERY");
  }

  try {
    let excludeId = "00000000-0000-0000-0000-000000000000";
    if (excludeSlug) {
      const rows = await getJurisdictionsBySlugs([excludeSlug]);
      if (rows[0]) excludeId = rows[0].id;
    }
    const countries = await getNotableTopicPeers(topicKey, excludeId, 3, {
      throwOnError: true,
    });
    return Response.json({
      topicKey,
      topicLabel: getTopicLabel(topicKey),
      countries,
    });
  } catch (err) {
    console.error("[/api/constitution/excerpts/notable]", err);
    return Response.json(
      {
        error: "data_unavailable",
        code: "DATA_UNAVAILABLE",
        message: "Notable constitution excerpts are temporarily unavailable.",
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
