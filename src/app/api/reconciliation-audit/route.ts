import { NextResponse } from "next/server";
import report from "@/lib/factbook/reconcile/reconciliation-audit.generated.json";
import { cacheControlFor } from "@/lib/platform/cache-consistency";

// PUBLIC_CLAIM: methodology.dataset-provenance-coverage
export async function GET() {
  return NextResponse.json(report, {
    headers: {
      "Cache-Control": cacheControlFor("checked-build-artifact"),
    },
  });
}
