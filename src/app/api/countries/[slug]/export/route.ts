import { NextResponse } from "next/server";

import {
  RIGHTS_MANIFEST_PATH,
  evaluatePublicExport,
} from "@/lib/rights/manifest";

/**
 * DAT-003: the legacy mixed-source country dump is withheld until DAT-027
 * replaces it with a rights-filtered canonical-plus-alternates export.
 * Serving a convenient file without source/field license closure would make
 * the download itself the rights violation this gate is meant to prevent.
 */
// PUBLIC_CLAIM: export.provenance-coverage
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const decision = evaluatePublicExport("country-export-json-csv", []);
  return NextResponse.json(
    {
      error: "Country data export is not published.",
      code: "EXPORT_RIGHTS_BLOCKED",
      country: slug,
      reason: decision.reason,
      rightsManifest: RIGHTS_MANIFEST_PATH,
      replacementGate: "DAT-027",
    },
    {
      status: 503,
      headers: {
        "Cache-Control": "no-store",
        "Retry-After": "86400",
      },
    },
  );
}
