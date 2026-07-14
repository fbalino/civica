import { NextResponse } from "next/server";

import { corsOptions, CORS_HEADERS, withRateLimit } from "@/lib/api/helpers";
import { getQualifiedElectionResearchRows } from "@/lib/db/queries";
import {
  buildElectionResearchExport,
  electionResearchExportCsv,
  type ElectionResearchFilters,
} from "@/lib/elections/research-export";
import { ELECTION_CORPUS_AUDIT } from "@/lib/elections/corpus-audit-runtime";
import {
  RIGHTS_MANIFEST_PATH,
  evaluatePublicExport,
} from "@/lib/rights/manifest";
import { parseQueryContract } from "@/lib/api/request-contract";
import { withSafeJsonErrors } from "@/lib/api/problem-response";

export async function GET(request: Request) {
  return withSafeJsonErrors(
    "api/v1/elections",
    async () => {
      const rateLimited = await withRateLimit(request);
      if (rateLimited) return rateLimited;
      const query = parseQueryContract(request, "v1-elections-query/v1", {
        errorHeaders: CORS_HEADERS,
      });
      if (!query.ok) return query.response;
      const {
        format,
        jurisdiction,
        type,
        temporal_class: temporalClass,
        source_status: sourceStatus,
        jurisdiction_status: jurisdictionStatus,
        from,
        to,
        has_results: hasResults,
        has_turnout: hasTurnout,
      } = query.data;

      const decision = evaluatePublicExport("election-qualified-export-v1", [
        "wikidata",
      ]);
      if (!decision.allowed)
        return NextResponse.json(
          {
            error: "Election research export is unavailable",
            code: "EXPORT_UNAVAILABLE",
            reason: decision.reason,
            rightsManifest: RIGHTS_MANIFEST_PATH,
          },
          {
            status: 503,
            headers: { ...CORS_HEADERS, "Cache-Control": "no-store" },
          },
        );

      const filters: ElectionResearchFilters = {
        ...(jurisdiction ? { jurisdiction } : {}),
        ...(type ? { type } : {}),
        ...(temporalClass
          ? {
              temporalClass:
                temporalClass as ElectionResearchFilters["temporalClass"],
            }
          : {}),
        ...(sourceStatus ? { sourceStatus } : {}),
        ...(jurisdictionStatus ? { jurisdictionStatus } : {}),
        ...(from ? { from } : {}),
        ...(to ? { to } : {}),
        ...(hasResults !== undefined ? { hasResults } : {}),
        ...(hasTurnout !== undefined ? { hasTurnout } : {}),
      };
      const rows = await getQualifiedElectionResearchRows();
      const document = buildElectionResearchExport({
        rows,
        filters,
        auditVersion: ELECTION_CORPUS_AUDIT.schemaVersion,
        auditAsOf: ELECTION_CORPUS_AUDIT.asOf,
        generatedAt: ELECTION_CORPUS_AUDIT.generatedAt,
      });
      const headers = {
        ...CORS_HEADERS,
        "Cache-Control": "public, max-age=3600",
        "X-Civica-Rights-Manifest": RIGHTS_MANIFEST_PATH,
      };
      if (format === "csv")
        return new Response(electionResearchExportCsv(document), {
          headers: {
            ...headers,
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition":
              'attachment; filename="civica-election-research.csv"',
          },
        });
      return NextResponse.json(document, { headers });
    },
    {
      errorHeaders: {
        ...CORS_HEADERS,
        "X-Civica-Rights-Manifest": RIGHTS_MANIFEST_PATH,
      },
    },
  );
}

export async function OPTIONS() {
  return corsOptions();
}
