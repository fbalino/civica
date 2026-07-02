import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import {
  buildGovTypeStripBands,
  getMetricStripData,
} from "@/lib/db/queries";
import { db } from "@/lib/db";
import { jurisdictions, metricDefinitions, sources } from "@/lib/db/schema";
import type { GovernmentTaxonomyLens } from "@/lib/government-taxonomy";
import { enforceInMemoryRateLimit } from "@/lib/api/rate-limit";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ metricId: string }> }
) {
  const limited = enforceInMemoryRateLimit(req, { scope: "metrics-strip-data" });
  if (limited) return limited;

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
  const regionsParam = searchParams.get("regions");
  const regions = regionsParam
    ? regionsParam.split(",").map((t) => t.trim()).filter(Boolean)
    : undefined;
  const taxonomyParam = searchParams.get("taxonomy");
  const taxonomy: GovernmentTaxonomyLens =
    taxonomyParam === "structural" || taxonomyParam === "regime"
      ? taxonomyParam
      : "raw";

  const rawRows = await getMetricStripData(
    metricId,
    year,
    govTypes,
    taxonomy,
    regions,
  );

  const rows = Array.isArray(rawRows) ? rawRows : (rawRows as { rows: unknown[] }).rows ?? [];
  const bands = buildGovTypeStripBands(
    rows as Array<{ govType: string; value: number }>,
  );
  const [metricDefRows, coverageRows] = await Promise.all([
    db
      .select({
        id: metricDefinitions.id,
        name: metricDefinitions.name,
        description: metricDefinitions.description,
        category: metricDefinitions.category,
        unit: metricDefinitions.unit,
        higherIsBetter: metricDefinitions.higherIsBetter,
        valueMin: metricDefinitions.valueMin,
        valueMax: metricDefinitions.valueMax,
        sourceName: sources.name,
      })
      .from(metricDefinitions)
      .leftJoin(sources, eq(metricDefinitions.defaultSourceId, sources.id))
      .where(eq(metricDefinitions.id, metricId))
      .limit(1),
    db
      .select({
        total: sql<number>`COUNT(*) FILTER (WHERE ${jurisdictions.type} = 'sovereign_state')::int`,
      })
      .from(jurisdictions),
  ]);

  const metricDef = metricDefRows[0];
  if (!metricDef) {
    return NextResponse.json({ error: "Metric not found" }, { status: 404 });
  }

  // Index peer-band stats by govType for O(1) lookup
  const bandByGovType = Object.fromEntries(
    (bands as Array<{ govType: string; [k: string]: unknown }>).map((b) => [b.govType, b])
  );

  return NextResponse.json({
    metricId,
    year,
    taxonomy,
    data: rows,
    govTypeBands: bandByGovType,
    metricDef,
    coverage: {
      total: Number(coverageRows[0]?.total ?? 0),
      withData: rows.length,
    },
  });
}
