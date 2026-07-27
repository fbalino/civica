import { NextResponse } from "next/server";

import { buildRightsManifest } from "@/lib/rights/manifest";
import { cacheControlFor } from "@/lib/platform/cache-consistency";

export function GET() {
  return NextResponse.json(buildRightsManifest(), {
    headers: {
      "Cache-Control": cacheControlFor("checked-build-artifact"),
    },
  });
}
