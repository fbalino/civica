/**
 * API deprecation contract for the `structural_family` retirement
 * (peer-grouping resolution v1, 2026-05-02).
 *
 *   Plan:        ~/civica/plan/structural-family-removal-implementation-plan.md §B-Phase 4
 *   Resolution:  ~/civica/plan/peer-grouping-resolution-v1.md §6 Q3
 *   Methodology: /civica-index/methodology/peer-grouping
 *
 * The Civica API serves the legacy `structuralFamily` /
 * `structuralSubtype` fields and the `?taxonomy=structural`
 * filter through 2027-03-31 (two full quarterly vintages past
 * Phase 4 ship). After that date the legacy fields are removed
 * from response bodies and the legacy filter values return 400.
 *
 * The user-locked sunset date (2027-03-31) is **calendar-anchored,
 * not vintage-anchored**: shifting Phase 4 by a few days does not
 * shift the sunset. Consumers can plan against a fixed cutover.
 *
 * Mirrors the existing Pulse v1 → v2 deprecation pattern at
 * `src/app/api/v1/pulse/[country_slug]/route.ts`. RFC 8594 +
 * draft-ietf-httpapi-deprecation-header.
 */

import type { NextResponse } from "next/server";

/**
 * Sunset date in HTTP-date format (RFC 5322). 23:59:59 UTC on
 * 2027-03-31 = Wed, 31 Mar 2027 23:59:59 GMT. Anything after this
 * instant returns the v1.0 hard-cut behavior.
 */
export const STRUCTURAL_FAMILY_SUNSET_DATE =
  "Wed, 31 Mar 2027 23:59:59 GMT" as const;

/** Successor endpoint introduced in Phase 4. */
export const PEER_GROUPINGS_SUCCESSOR_HREF =
  "/api/v1/peer-groupings" as const;

/**
 * HTTP headers to attach to every endpoint that still serves
 * `structural_family`-shaped data or accepts the legacy
 * `?taxonomy=structural` filter. Apply via
 * `withStructuralFamilyDeprecation(res)`.
 */
export const STRUCTURAL_FAMILY_DEPRECATION_HEADERS: Record<string, string> = {
  Deprecation: "true",
  Sunset: STRUCTURAL_FAMILY_SUNSET_DATE,
  Link: `<${PEER_GROUPINGS_SUCCESSOR_HREF}>; rel="successor-version"`,
};

/**
 * `meta.deprecations` block to merge into JSON response envelopes.
 * Browser-based consumers that don't surface HTTP headers easily
 * still see the deprecation info in the response body. The shape
 * extends Phase F's `meta.reconciliation` envelope rather than
 * introducing a parallel one — same `meta` object, additional key.
 *
 * `field` enumerates the deprecated identifiers (response-body
 * fields and query-param values) so consumers can grep for what
 * applies to them.
 */
export const STRUCTURAL_FAMILY_DEPRECATION_META = Object.freeze({
  deprecations: [
    Object.freeze({
      identifier: "structural_family",
      kind: "field+filter",
      sunset: "2027-03-31",
      successor: PEER_GROUPINGS_SUCCESSOR_HREF,
      replacedBy: [
        "world_bank_region",
        "world_bank_income_group",
        "vdem_row",
        "monarchy_status",
        "government_form_description",
      ],
      reason:
        "The `structural_family` taxonomy was a regex-derived heuristic. " +
        "The 2026-05-02 peer-grouping resolution replaced it with " +
        "domain-specific peer lenses sourced from World Bank and V-Dem. " +
        "See https://civicaatlas.org/civica-index/methodology/peer-grouping " +
        "for the methodology and the per-country migration table.",
      migrationTable:
        "/civica-index/methodology/peer-grouping/migration",
    }),
  ],
});

/**
 * Decorate a `NextResponse` with the structural_family deprecation
 * headers. Wrap every successful response from a deprecated
 * endpoint, plus error responses from those endpoints (consumers
 * still need the Sunset signal even on 4xx).
 */
export function withStructuralFamilyDeprecation(
  res: NextResponse,
): NextResponse {
  for (const [k, v] of Object.entries(STRUCTURAL_FAMILY_DEPRECATION_HEADERS)) {
    res.headers.set(k, v);
  }
  return res;
}
