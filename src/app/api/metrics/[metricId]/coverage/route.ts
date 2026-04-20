import { NextResponse } from "next/server";
import { getMetricCoverage } from "@/lib/db/queries";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ metricId: string }> }
) {
  const { metricId } = await params;
  const { searchParams } = new URL(req.url);

  const yearParam = searchParams.get("year");
  const year = yearParam ? parseInt(yearParam, 10) : new Date().getFullYear();
  if (isNaN(year)) {
    return NextResponse.json({ error: "Invalid year" }, { status: 400 });
  }

  const rawResult = await getMetricCoverage(metricId, year);
  const rows = Array.isArray(rawResult)
    ? rawResult
    : (rawResult as { rows: unknown[] }).rows ?? [];

  const summary = (rows as Array<Record<string, unknown>>)[0] ?? {
    totalCountries: 0,
    countriesWithData: 0,
    countriesWithoutData: 0,
    countriesWithFreshData: 0,
    countriesWithStaleData: 0,
  };

  return NextResponse.json({
    metricId,
    year,
    totalCountries: Number(summary.totalCountries),
    countriesWithData: Number(summary.countriesWithData),
    countriesExcluded: Number(summary.countriesWithoutData),
    exclusionBreakdown: [
      { reason: "no_data", count: Number(summary.countriesWithoutData) },
    ],
    dataQuality: {
      freshCount: Number(summary.countriesWithFreshData),
      staleCount: Number(summary.countriesWithStaleData),
      staleThresholdYears: 5,
    },
  });
}
