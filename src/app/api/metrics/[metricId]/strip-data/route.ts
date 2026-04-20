import { NextResponse } from "next/server";
import { getMetricStripData, getGovTypeStripBands } from "@/lib/db/queries";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ metricId: string }> }
) {
  const { metricId } = await params;
  const { searchParams } = new URL(req.url);

  const yearParam = searchParams.get("year");
  if (!yearParam) {
    return NextResponse.json({ error: "year is required" }, { status: 400 });
  }
  const year = parseInt(yearParam, 10);
  if (isNaN(year)) {
    return NextResponse.json({ error: "Invalid year" }, { status: 400 });
  }

  const govTypesParam = searchParams.get("govTypes");
  const govTypes = govTypesParam
    ? govTypesParam.split(",").map((t) => t.trim()).filter(Boolean)
    : undefined;

  const [rawRows, rawBands] = await Promise.all([
    getMetricStripData(metricId, year, govTypes),
    getGovTypeStripBands(metricId, year, govTypes),
  ]);

  const rows = Array.isArray(rawRows) ? rawRows : (rawRows as { rows: unknown[] }).rows ?? [];
  const bands = Array.isArray(rawBands) ? rawBands : (rawBands as { rows: unknown[] }).rows ?? [];

  // Index peer-band stats by govType for O(1) lookup
  const bandByGovType = Object.fromEntries(
    (bands as Array<{ govType: string; [k: string]: unknown }>).map((b) => [b.govType, b])
  );

  return NextResponse.json({
    metricId,
    year,
    data: rows,
    govTypeBands: bandByGovType,
  });
}
