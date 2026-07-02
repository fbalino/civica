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
import { getTopicLabel } from "@/lib/constitute/topics";
import { parseCountrySlugs } from "@/lib/constitution/slugs";

export const revalidate = 3600;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const topicKey = (url.searchParams.get("topic") ?? "").trim();
  const slugs = parseCountrySlugs(url.searchParams.getAll("c"));

  if (!topicKey) {
    return Response.json(
      { error: "Missing required `topic` query parameter." },
      { status: 400 },
    );
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

    const countries = await getTopicExcerpts(topicKey, orderedIds);

    return Response.json({
      topicKey,
      topicLabel: getTopicLabel(topicKey),
      countries,
    });
  } catch (err) {
    console.error("[/api/constitution/excerpts]", err);
    return Response.json(
      { error: "Failed to load constitution excerpts." },
      { status: 500 },
    );
  }
}
