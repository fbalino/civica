import { NextResponse } from "next/server";
import { getJurisdictionBySlug } from "@/lib/db/queries";
import { getScoresForJurisdiction } from "@/lib/db/queries-scores";
import { enforceInMemoryRateLimit } from "@/lib/api/rate-limit";

/**
 * P1.1 — Scores & Rankings feed for the atlas Scores tab.
 *
 * The atlas tab lives behind a `"use client"` boundary so it can't render
 * the `<ScoresAndRankings>` server component directly; it fetches the
 * pre-computed row list here and renders `<ScoresAndRankingsView>` with
 * the result. Same query, same shape, same row order — no drift between
 * factbook and atlas.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const limited = enforceInMemoryRateLimit(req, { scope: "countries-scores" });
  if (limited) return limited;

  const { slug } = await params;
  const jurisdiction = await getJurisdictionBySlug(slug);
  if (!jurisdiction) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const rows = await getScoresForJurisdiction(jurisdiction.id);
  return NextResponse.json({
    country: jurisdiction.name,
    rows,
  });
}
