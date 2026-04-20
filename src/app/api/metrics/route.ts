import { NextResponse } from "next/server";
import { getAllMetricDefinitionsWithCoverage } from "@/lib/db/queries";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const yearParam = searchParams.get("year");
  const year = yearParam ? parseInt(yearParam, 10) : undefined;

  if (yearParam && isNaN(year!)) {
    return NextResponse.json({ error: "Invalid year" }, { status: 400 });
  }

  const rows = await getAllMetricDefinitionsWithCoverage(year);
  const metrics = Array.isArray(rows) ? rows : (rows as { rows: unknown[] }).rows ?? [];

  return NextResponse.json({ metrics });
}
