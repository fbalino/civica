import { NextResponse } from "next/server";
import { getJurisdictionBySlug, getCountryOutcomes } from "@/lib/db/queries";
import { enforceInMemoryRateLimit } from "@/lib/api/rate-limit";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const limited = enforceInMemoryRateLimit(req, { scope: "countries-outcomes" });
  if (limited) return limited;

  const { slug } = await params;
  const { searchParams } = new URL(req.url);

  const yearParam = searchParams.get("year");
  const year = yearParam ? parseInt(yearParam, 10) : new Date().getFullYear();
  if (isNaN(year)) {
    return NextResponse.json({ error: "Invalid year" }, { status: 400 });
  }

  const jurisdiction = await getJurisdictionBySlug(slug);
  if (!jurisdiction) {
    return NextResponse.json({ error: "Country not found" }, { status: 404 });
  }

  const { metrics: rawMetrics, peerBands: rawBands, govType } =
    await getCountryOutcomes(jurisdiction.id, year);

  const metrics = Array.isArray(rawMetrics)
    ? rawMetrics
    : (rawMetrics as { rows: unknown[] }).rows ?? [];
  const peerBands = Array.isArray(rawBands)
    ? rawBands
    : (rawBands as { rows: unknown[] }).rows ?? [];

  // Index peer bands by metricId
  const peerByMetric = Object.fromEntries(
    (peerBands as Array<{ metricId: string; [k: string]: unknown }>).map(
      (b) => [b.metricId, b]
    )
  );

  // Merge peer band into each metric row
  const merged = (metrics as Array<{ metricId: string; [k: string]: unknown }>).map(
    (m) => ({
      ...m,
      peer: peerByMetric[m.metricId] ?? null,
    })
  );

  return NextResponse.json({
    countryId: jurisdiction.id,
    countrySlug: jurisdiction.slug,
    countryName: jurisdiction.name,
    govType,
    year,
    metrics: merged,
  });
}
