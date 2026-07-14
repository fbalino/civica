import { NextResponse } from "next/server";

import { enforceRequestRateLimit } from "@/lib/api/rate-limit-request";
import { getRequestRateLimitPolicy } from "@/lib/api/rate-limit-runtime-policy";
import {
  getAllSources,
  getIndicatorHistoryForCountry,
  getJurisdictionBySlug,
} from "@/lib/db/queries";
import {
  buildIndicatorHistoryExport,
  indicatorHistoryExportCsv,
} from "@/lib/exports/indicator-history-export";
import {
  RIGHTS_MANIFEST_PATH,
  SOURCE_RIGHTS,
  evaluatePublicExport,
} from "@/lib/rights/manifest";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const limited = await enforceRequestRateLimit(
    request,
    getRequestRateLimitPolicy("public-dynamic-export"),
  );
  if (limited) return limited;

  const { slug } = await params;
  const url = new URL(request.url);
  const format = url.searchParams.get("format") ?? "json";
  const indicator = url.searchParams.get("indicator")?.trim() || null;
  if (format !== "json" && format !== "csv") {
    return NextResponse.json(
      { error: "format must be json or csv" },
      { status: 400 },
    );
  }

  const product = evaluatePublicExport("indicator-history-country-export", []);
  if (!product.allowed) {
    return NextResponse.json(
      {
        error: "Indicator-history export is unavailable.",
        code: "EXPORT_PRODUCT_BLOCKED",
        reason: product.reason,
        rightsManifest: RIGHTS_MANIFEST_PATH,
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  const jurisdiction = await getJurisdictionBySlug(slug);
  if (!jurisdiction) {
    return NextResponse.json({ error: "Country not found" }, { status: 404 });
  }

  const [allSeries, sourceRows] = await Promise.all([
    getIndicatorHistoryForCountry(slug),
    getAllSources(),
  ]);
  const selectedSeries = indicator
    ? allSeries.filter((series) => series.indicator === indicator)
    : allSeries;
  if (indicator && selectedSeries.length === 0) {
    return NextResponse.json(
      { error: "Indicator history not found for this country" },
      { status: 404 },
    );
  }

  const document = buildIndicatorHistoryExport({
    generatedAt: new Date().toISOString(),
    jurisdiction: {
      id: jurisdiction.id,
      slug: jurisdiction.slug,
      name: jurisdiction.name,
      iso3: jurisdiction.iso3,
    },
    series: selectedSeries,
    sources: new Map(
      sourceRows.map((source) => [
        source.id,
        {
          id: source.id,
          name: source.name,
          baseUrl: source.baseUrl,
          lastSyncAt: source.lastSyncAt?.toISOString() ?? null,
        },
      ]),
    ),
    rights: new Map(SOURCE_RIGHTS.map((rights) => [rights.sourceId, rights])),
  });

  const headers = {
    "Cache-Control": "private, max-age=0, must-revalidate",
    "X-Civica-Rights-Manifest": RIGHTS_MANIFEST_PATH,
  };
  if (format === "csv") {
    if (document.series.length === 0 && document.withheld.length > 0) {
      return NextResponse.json(
        {
          error:
            "No requested observation series is cleared for public export.",
          code: "SOURCE_EXPORT_BLOCKED",
          withheld: document.withheld,
          rightsManifest: RIGHTS_MANIFEST_PATH,
        },
        { status: 403, headers },
      );
    }
    return new Response(indicatorHistoryExportCsv(document), {
      headers: {
        ...headers,
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${jurisdiction.slug}-indicator-history.csv"`,
      },
    });
  }
  return NextResponse.json(document, { headers });
}
