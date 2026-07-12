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
import { enforceInMemoryRateLimit } from "@/lib/api/rate-limit";
import { ENTITY_CITATION_RESOLVERS } from "@/lib/citations/resolvers";
import {
  ENTITY_ID_PATTERNS,
  ENTITY_TYPES,
  isEntityType,
  zEntityCitation,
} from "@/lib/citations/stable-identity";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ entityType: string; id: string }> },
) {
  const limited = enforceInMemoryRateLimit(request, {
    scope: "entity-citation",
    max: 120,
  });
  if (limited) return limited;

  const { entityType, id } = await params;
  if (!isEntityType(entityType)) {
    return NextResponse.json(
      { error: "unknown_entity_type", allowed: ENTITY_TYPES },
      { status: 404 },
    );
  }
  if (!ENTITY_ID_PATTERNS[entityType].test(id)) {
    return NextResponse.json({ error: "invalid_id" }, { status: 404 });
  }

  try {
    const resolver = ENTITY_CITATION_RESOLVERS[entityType];
    const citation = await resolver(id);
    if (!citation) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const parsed = zEntityCitation.safeParse(citation);
    if (!parsed.success) {
      console.error(
        "[/api/citations] resolver produced an invalid citation shape",
        entityType,
        parsed.error.flatten(),
      );
      return NextResponse.json(
        { error: "data_unavailable", message: "Citation is unavailable." },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    }

    return NextResponse.json(parsed.data, {
      headers: {
        "Cache-Control": "public, max-age=300",
        "X-Robots-Tag": "noindex",
      },
    });
  } catch (error) {
    console.error("[/api/citations]", error);
    return NextResponse.json(
      { error: "data_unavailable", message: "Citation is unavailable." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
