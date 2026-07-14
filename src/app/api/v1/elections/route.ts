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

const date = /^\d{4}-\d{2}-\d{2}$/;
const boolean = (value: string | null) =>
  value == null
    ? undefined
    : value === "true"
      ? true
      : value === "false"
        ? false
        : null;

export async function GET(request: Request) {
  const rateLimited = await withRateLimit(request);
  if (rateLimited) return rateLimited;
  const searchParams = new URL(request.url).searchParams;
  const format = searchParams.get("format") ?? "json";
  if (!(["json", "csv"] as const).includes(format as "json" | "csv"))
    return NextResponse.json(
      { error: "format must be json or csv" },
      { status: 400, headers: CORS_HEADERS },
    );

  const type = searchParams.get("type");
  const temporalClass = searchParams.get("temporal_class");
  const sourceStatus = searchParams.get("source_status");
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const hasResults = boolean(searchParams.get("has_results"));
  const hasTurnout = boolean(searchParams.get("has_turnout"));
  if (type && !["legislative", "presidential"].includes(type))
    return NextResponse.json(
      { error: "invalid election type" },
      { status: 400, headers: CORS_HEADERS },
    );
  if (
    temporalClass &&
    !["historical", "source_dated_upcoming", "projection_due"].includes(
      temporalClass,
    )
  )
    return NextResponse.json(
      { error: "invalid temporal_class" },
      { status: 400, headers: CORS_HEADERS },
    );
  if (
    sourceStatus &&
    !["held", "source_dated", "tentative", "unknown"].includes(sourceStatus)
  )
    return NextResponse.json(
      { error: "invalid source_status" },
      { status: 400, headers: CORS_HEADERS },
    );
  if ((from && !date.test(from)) || (to && !date.test(to)))
    return NextResponse.json(
      { error: "from and to must be YYYY-MM-DD" },
      { status: 400, headers: CORS_HEADERS },
    );
  if (hasResults === null || hasTurnout === null)
    return NextResponse.json(
      { error: "has_results and has_turnout must be true or false" },
      { status: 400, headers: CORS_HEADERS },
    );

  const decision = evaluatePublicExport("election-qualified-export-v1", [
    "wikidata",
  ]);
  if (!decision.allowed)
    return NextResponse.json(
      {
        error: "Election research export is unavailable",
        reason: decision.reason,
        rightsManifest: RIGHTS_MANIFEST_PATH,
      },
      {
        status: 503,
        headers: { ...CORS_HEADERS, "Cache-Control": "no-store" },
      },
    );

  const filters: ElectionResearchFilters = {
    ...(searchParams.get("jurisdiction")
      ? { jurisdiction: searchParams.get("jurisdiction")! }
      : {}),
    ...(type ? { type: type as ElectionResearchFilters["type"] } : {}),
    ...(temporalClass
      ? {
          temporalClass:
            temporalClass as ElectionResearchFilters["temporalClass"],
        }
      : {}),
    ...(sourceStatus ? { sourceStatus } : {}),
    ...(searchParams.get("jurisdiction_status")
      ? { jurisdictionStatus: searchParams.get("jurisdiction_status")! }
      : {}),
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
}

export async function OPTIONS() {
  return corsOptions();
}
