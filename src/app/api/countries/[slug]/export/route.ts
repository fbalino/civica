import { NextResponse } from "next/server";

import { enforceRequestRateLimit } from "@/lib/api/rate-limit-request";
import { getRequestRateLimitPolicy } from "@/lib/api/rate-limit-runtime-policy";
import {
  getAllSources,
  getCountryFacts,
  getJurisdictionBySlug,
} from "@/lib/db/queries";
import { getCanonicalFactsForJurisdiction } from "@/lib/factbook/reconcile/api";
import {
  getFrozenFactsForJurisdiction,
  metadataFromResolutions,
  parseAtlasReadSelection,
} from "@/lib/factbook/read-selection";
import {
  buildCountryResearchExport,
  countryResearchExportCsv,
} from "@/lib/exports/country-research-export";
import {
  RIGHTS_MANIFEST_PATH,
  SOURCE_RIGHTS,
  evaluatePublicExport,
} from "@/lib/rights/manifest";
import { shapeCountryExportJson } from "@/lib/api/contract/shapes";
import {
  parsePathContract,
  parseQueryContract,
} from "@/lib/api/request-contract";
import { apiProblem, withSafeJsonErrors } from "@/lib/api/problem-response";

// PUBLIC_CLAIM: export.provenance-coverage
export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  return withSafeJsonErrors(
    "api/countries/[slug]/export",
    async () => {
      const limited = await enforceRequestRateLimit(
        request,
        getRequestRateLimitPolicy("public-dynamic-export"),
      );
      if (limited) return limited;

      const path = await parsePathContract(
        params,
        "jurisdiction-slug-params/v1",
      );
      if (!path.ok) return path.response;
      const query = parseQueryContract(request, "country-export-query/v1");
      if (!query.ok) return query.response;
      const { slug } = path.data;
      const { format } = query.data;
      const parsedSelection = parseAtlasReadSelection(query.data.as_of);
      if (!parsedSelection.selection)
        return NextResponse.json(
          { error: "Invalid read selection.", code: "INVALID_AS_OF" },
          {
            status: 400,
            headers: {
              "X-Civica-Rights-Manifest": RIGHTS_MANIFEST_PATH,
              "Cache-Control": "no-store",
            },
          },
        );
      const selection = parsedSelection.selection;

      const productDecision = evaluatePublicExport(
        "country-export-json-csv",
        [],
      );
      if (!productDecision.allowed) {
        return NextResponse.json(
          {
            error: "Country research export is unavailable.",
            code: "EXPORT_PRODUCT_BLOCKED",
            reason: productDecision.reason,
            rightsManifest: RIGHTS_MANIFEST_PATH,
          },
          {
            status: 503,
            headers: {
              "X-Civica-Rights-Manifest": RIGHTS_MANIFEST_PATH,
              "Cache-Control": "no-store",
            },
          },
        );
      }

      const jurisdiction = await getJurisdictionBySlug(slug);
      if (!jurisdiction) {
        return apiProblem("NOT_FOUND", {
          headers: { "X-Civica-Rights-Manifest": RIGHTS_MANIFEST_PATH },
        });
      }

      const [factRows, sourceRows] = await Promise.all([
        getCountryFacts(jurisdiction.id),
        getAllSources(),
      ]);
      const factKeys = [...new Set(factRows.map((row) => row.factKey))].sort();
      const frozen =
        selection.mode === "vintage"
          ? await getFrozenFactsForJurisdiction(
              jurisdiction.id,
              [],
              selection.asOf,
            )
          : null;
      if (frozen && !frozen.exists)
        return NextResponse.json(
          {
            error: "Unsupported immutable vintage",
            code: "UNSUPPORTED_VINTAGE",
            asOf: selection.asOf,
          },
          {
            status: 400,
            headers: {
              "X-Civica-Rights-Manifest": RIGHTS_MANIFEST_PATH,
              "Cache-Control": "no-store",
            },
          },
        );
      const resolutions =
        frozen?.resolutions ??
        (await getCanonicalFactsForJurisdiction(jurisdiction.id, factKeys));
      const document = buildCountryResearchExport({
        generatedAt: new Date().toISOString(),
        selection: metadataFromResolutions(
          selection,
          resolutions,
          frozen ?? undefined,
        ),
        jurisdiction: {
          id: jurisdiction.id,
          slug: jurisdiction.slug,
          name: jurisdiction.name,
          iso2: jurisdiction.iso2,
          iso3: jurisdiction.iso3,
          status: jurisdiction.type,
          statusDetails: jurisdiction.jurisdictionStatus,
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
        rights: new Map(
          SOURCE_RIGHTS.map((record) => [record.sourceId, record]),
        ),
      });

      const filename = `${jurisdiction.slug}-civica-research-export.${format}`;
      const headers = {
        "Cache-Control":
          selection.mode === "vintage"
            ? "public, max-age=31536000, immutable"
            : "private, max-age=0, must-revalidate",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "X-Civica-Rights-Manifest": RIGHTS_MANIFEST_PATH,
      };
      if (format === "csv") {
        return new Response(countryResearchExportCsv(document), {
          headers: { ...headers, "Content-Type": "text/csv; charset=utf-8" },
        });
      }
      return NextResponse.json(shapeCountryExportJson(document), { headers });
    },
    {
      errorHeaders: { "X-Civica-Rights-Manifest": RIGHTS_MANIFEST_PATH },
    },
  );
}
