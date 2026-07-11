import { NextResponse } from "next/server";

import { getAllSources, getCountryFacts, getJurisdictionBySlug } from "@/lib/db/queries";
import { getCanonicalFactsForJurisdiction } from "@/lib/factbook/reconcile/api";
import {
  buildCountryResearchExport,
  countryResearchExportCsv,
} from "@/lib/exports/country-research-export";
import {
  RIGHTS_MANIFEST_PATH,
  SOURCE_RIGHTS,
  evaluatePublicExport,
} from "@/lib/rights/manifest";

// PUBLIC_CLAIM: export.provenance-coverage
export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const format = new URL(request.url).searchParams.get("format") ?? "json";
  if (format !== "json" && format !== "csv") {
    return NextResponse.json(
      { error: "format must be json or csv" },
      { status: 400 },
    );
  }

  const productDecision = evaluatePublicExport("country-export-json-csv", []);
  if (!productDecision.allowed) {
    return NextResponse.json(
      {
        error: "Country research export is unavailable.",
        code: "EXPORT_PRODUCT_BLOCKED",
        reason: productDecision.reason,
        rightsManifest: RIGHTS_MANIFEST_PATH,
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  const jurisdiction = await getJurisdictionBySlug(slug);
  if (!jurisdiction) {
    return NextResponse.json({ error: "Country not found" }, { status: 404 });
  }

  const [factRows, sourceRows] = await Promise.all([
    getCountryFacts(jurisdiction.id),
    getAllSources(),
  ]);
  const factKeys = [...new Set(factRows.map((row) => row.factKey))].sort();
  const resolutions = await getCanonicalFactsForJurisdiction(
    jurisdiction.id,
    factKeys,
  );
  const document = buildCountryResearchExport({
    generatedAt: new Date().toISOString(),
    jurisdiction: {
      id: jurisdiction.id,
      slug: jurisdiction.slug,
      name: jurisdiction.name,
      iso2: jurisdiction.iso2,
      iso3: jurisdiction.iso3,
      status: jurisdiction.type,
    },
    resolutions,
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
    rights: new Map(SOURCE_RIGHTS.map((record) => [record.sourceId, record])),
  });

  const filename = `${jurisdiction.slug}-civica-research-export.${format}`;
  const headers = {
    "Cache-Control": "private, max-age=0, must-revalidate",
    "Content-Disposition": `attachment; filename="${filename}"`,
    "X-Civica-Rights-Manifest": RIGHTS_MANIFEST_PATH,
  };
  if (format === "csv") {
    return new Response(countryResearchExportCsv(document), {
      headers: { ...headers, "Content-Type": "text/csv; charset=utf-8" },
    });
  }
  return NextResponse.json(document, { headers });
}
