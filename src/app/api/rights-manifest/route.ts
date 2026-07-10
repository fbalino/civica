import { NextResponse } from "next/server";

import { buildRightsManifest } from "@/lib/rights/manifest";

export function GET() {
  return NextResponse.json(buildRightsManifest(), {
    headers: { "Cache-Control": "public, max-age=3600" },
  });
}
