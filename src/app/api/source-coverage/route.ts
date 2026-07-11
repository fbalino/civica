import { NextResponse } from "next/server";
import report from "@/lib/provenance/domain-coverage.generated.json";

// PUBLIC_CLAIM: methodology.domain-source-coverage
export async function GET() {
  return NextResponse.json(report, {
    headers: { "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400" },
  });
}
