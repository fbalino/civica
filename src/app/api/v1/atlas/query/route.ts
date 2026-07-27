import { NextResponse } from "next/server";

import { CORS_HEADERS, corsOptions, withRateLimit } from "@/lib/api/helpers";
import { parseQueryContract } from "@/lib/api/request-contract";
import { withSafeJsonErrors } from "@/lib/api/problem-response";
import {
  ATLAS_QUERY_RIGHTS_MANIFEST,
  atlasQueryCompatibilityError,
  atlasQueryCsv,
  atlasQueryInputFromRequest,
  loadAtlasQueryRelease,
  runAtlasQuery,
} from "@/lib/exports/atlas-query";
import { cacheControlFor } from "@/lib/platform/cache-consistency";

export async function GET(request: Request) {
  return withSafeJsonErrors(
    "api/v1/atlas/query",
    async () => {
      const rateLimited = await withRateLimit(request);
      if (rateLimited) return rateLimited;

      const query = parseQueryContract(request, "v1-atlas-query/v1", {
        errorHeaders: CORS_HEADERS,
      });
      if (!query.ok) return query.response;

      const input = atlasQueryInputFromRequest(query.data);
      const compatibilityError = atlasQueryCompatibilityError(input);
      if (compatibilityError) {
        return NextResponse.json(
          {
            error:
              "The query contains a field or filter that does not apply to the selected Atlas table.",
            code: "INVALID_ATLAS_QUERY",
            rightsManifest: ATLAS_QUERY_RIGHTS_MANIFEST,
          },
          {
            status: 400,
            headers: { ...CORS_HEADERS, "Cache-Control": "no-store" },
          },
        );
      }

      let loaded;
      try {
        loaded = await loadAtlasQueryRelease();
      } catch {
        console.error("[atlas-query] frozen release unavailable");
        return NextResponse.json(
          {
            error: "The frozen Atlas query release is temporarily unavailable.",
            code: "ATLAS_QUERY_UNAVAILABLE",
            rightsManifest: ATLAS_QUERY_RIGHTS_MANIFEST,
          },
          {
            status: 503,
            headers: { ...CORS_HEADERS, "Cache-Control": "no-store" },
          },
        );
      }

      const result = runAtlasQuery(loaded, input);
      const headers = {
        ...CORS_HEADERS,
        "Cache-Control": cacheControlFor("public-live"),
        "X-Civica-Atlas-Release": result.release.id,
        "X-Civica-Atlas-Schema": result.release.exportSchemaVersion,
        "X-Civica-Rights-Manifest": ATLAS_QUERY_RIGHTS_MANIFEST,
        "X-Civica-Total-Count": String(result.meta.total),
      };
      if (query.data.format === "csv") {
        return new Response(atlasQueryCsv(result), {
          headers: {
            ...headers,
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": `attachment; filename="civica-atlas-${result.query.table}.csv"`,
          },
        });
      }
      return NextResponse.json(result, { headers });
    },
    {
      errorHeaders: {
        ...CORS_HEADERS,
        "X-Civica-Rights-Manifest": ATLAS_QUERY_RIGHTS_MANIFEST,
      },
    },
  );
}

export async function OPTIONS() {
  return corsOptions();
}
