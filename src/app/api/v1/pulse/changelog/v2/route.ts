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
  PULSE_METHODOLOGY_META,
  CORS_HEADERS,
} from "@/lib/api/helpers";
import { getPulseV2Changelog } from "@/lib/db/queries-pulse-v2";
import { shapePulseChangelogRow } from "@/lib/api/contract/shapes";
import { parseQueryContract } from "@/lib/api/request-contract";

export async function GET(request: Request) {
  const rateLimited = await withRateLimit(request);
  if (rateLimited) return rateLimited;
  const query = parseQueryContract(request, "v1-pulse-changelog-query/v1", {
    errorHeaders: CORS_HEADERS,
  });
  if (!query.ok) return query.response;

  try {
    const {
      country,
      dimension,
      severity,
      since,
      published_only: publishedOnly,
      limit,
      offset,
    } = query.data;

    const result = await getPulseV2Changelog({
      country,
      dimension,
      severityTier: severity,
      sinceDate: since,
      publishedOnly,
      limit,
      offset,
    });

    const publicRows = result.rows.map((row) =>
      shapePulseChangelogRow(
        row.category === "none"
          ? {
              ...row,
              dimension: null,
              severityTier: null,
              severityValue: null,
            }
          : row,
      ),
    );

    return apiResponse({
      data: publicRows,
      meta: {
        methodology: PULSE_METHODOLOGY_META,
        limit,
        offset,
        hasMore: result.hasMore,
        versionSet: result.versionSet,
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
