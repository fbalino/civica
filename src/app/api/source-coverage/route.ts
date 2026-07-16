import { NextResponse } from "next/server";
import report from "@/lib/provenance/domain-coverage.generated.json";
import { cacheControlFor } from "@/lib/platform/cache-consistency";

// PUBLIC_CLAIM: methodology.domain-source-coverage
export async function GET() {
  return NextResponse.json(report, {
    headers: {
      "Cache-Control": cacheControlFor("checked-build-artifact"),
    },
  });
}
