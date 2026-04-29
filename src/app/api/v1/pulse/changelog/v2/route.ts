/**
 * Phase 5.6 — v2 global Pulse changelog.
 *
 * GET /api/v1/pulse/changelog/v2
 *
 * Query params:
 *   country=<slug>            country slug filter
 *   dimension=<dim id>        dimension filter (democratic_quality | rule_of_law | …)
 *   severity=<tier>           severity_tier filter (severe_neg | moderate_pos | …)
 *   since=<YYYY-MM-DD>        only events on/after this date
 *   published_only=1          exclude review-queued events
 *   limit=<n>                 page size (default 50, max 250)
 *   offset=<n>                page offset
 */

import {
  apiResponse,
  apiError,
  corsOptions,
  withRateLimit,
  CI_METHODOLOGY_META,
} from "@/lib/api/helpers";
import { getPulseV2Changelog } from "@/lib/db/queries-pulse-v2";
import type { PulseDimension } from "@/lib/pulse/v2/types";
import { PULSE_DIMENSIONS } from "@/lib/pulse/v2/types";

export async function GET(request: Request) {
  const rateLimited = withRateLimit(request);
  if (rateLimited) return rateLimited;

  try {
    const url = new URL(request.url);
    const limit = Math.min(
      Math.max(parseInt(url.searchParams.get("limit") ?? "50", 10) || 50, 1),
      250
    );
    const offset = Math.max(
      parseInt(url.searchParams.get("offset") ?? "0", 10) || 0,
      0
    );

    const dimensionRaw = url.searchParams.get("dimension");
    const dimension: PulseDimension | undefined =
      dimensionRaw && (PULSE_DIMENSIONS as string[]).includes(dimensionRaw)
        ? (dimensionRaw as PulseDimension)
        : undefined;

    const result = await getPulseV2Changelog({
      country: url.searchParams.get("country") ?? undefined,
      dimension,
      severityTier: url.searchParams.get("severity") ?? undefined,
      sinceDate: url.searchParams.get("since") ?? undefined,
      publishedOnly: url.searchParams.get("published_only") === "1",
      limit,
      offset,
    });

    return apiResponse({
      data: result.rows,
      meta: {
        methodology: CI_METHODOLOGY_META,
        limit,
        offset,
        hasMore: result.hasMore,
      },
    });
  } catch (e) {
    console.error("API /v1/pulse/changelog/v2 error:", e);
    return apiError("Internal server error", 500);
  }
}

export async function OPTIONS() {
  return corsOptions();
}
