import { NextResponse } from "next/server";

import { withSafeJsonErrors } from "@/lib/api/problem-response";
import {
  checkHealthStatus,
  healthHttpStatus,
} from "@/lib/platform/health-status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Public, no-store availability surface for the status page and independent
 * monitors. The response is intentionally component-level and content-free.
 */
export async function GET() {
  return withSafeJsonErrors("api/health", async () => {
    const report = await checkHealthStatus();
    return NextResponse.json(report, { status: healthHttpStatus(report) });
  });
}
