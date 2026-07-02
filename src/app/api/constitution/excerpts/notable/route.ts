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
import { getTopicLabel } from "@/lib/constitute/topics";

export const revalidate = 3600;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const topicKey = (url.searchParams.get("topic") ?? "").trim();
  const excludeSlug = (url.searchParams.get("exclude") ?? "").trim();

  if (!topicKey) {
    return Response.json(
      { error: "Missing required `topic` query parameter." },
      { status: 400 },
    );
  }

  try {
    let excludeId = "00000000-0000-0000-0000-000000000000";
    if (excludeSlug) {
      const rows = await getJurisdictionsBySlugs([excludeSlug]);
      if (rows[0]) excludeId = rows[0].id;
    }
    const countries = await getNotableTopicPeers(topicKey, excludeId, 3);
    return Response.json({
      topicKey,
      topicLabel: getTopicLabel(topicKey),
      countries,
    });
  } catch (err) {
    console.error("[/api/constitution/excerpts/notable]", err);
    return Response.json(
      { error: "Failed to load notable constitution excerpts." },
      { status: 500 },
    );
  }
}
