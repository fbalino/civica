/**
 * GET /api/v1/government-types — DEPRECATED.
 *
 * The `structural_family` taxonomy this endpoint exposes was retired
 * by the 2026-05-02 peer-grouping resolution. Until 2027-03-31 the
 * endpoint continues to serve the legacy shape with `Deprecation`,
 * `Sunset`, and `Link: rel="successor-version"` headers. The
 * successor is `/api/v1/peer-groupings` — see
 * /civica-index/methodology/peer-grouping for the methodology.
 *
 * Files:
 *   Helper:  src/lib/api/deprecation.ts
 *   Plan:    ~/civica/plan/structural-family-removal-implementation-plan.md §B-Phase 4
 */

import { apiResponse, apiError, corsOptions, withRateLimit } from "@/lib/api/helpers";
import { getAllJurisdictions } from "@/lib/db/queries";
import { STRUCTURAL_GOVERNMENT_TYPES } from "@/lib/data/structural-government-types";
import {
  STRUCTURAL_FAMILY_DEPRECATION_META,
  withStructuralFamilyDeprecation,
} from "@/lib/api/deprecation";

export async function GET(request: Request) {
  const rateLimited = withRateLimit(request);
  if (rateLimited) return rateLimited;

  try {
    const countries = await getAllJurisdictions();

    const data = STRUCTURAL_GOVERNMENT_TYPES.map((type) => {
      const matches = countries.filter(
        (country) =>
          country.governmentClassification?.structuralFamily === type.familyKey,
      );

      return {
        governmentType: type.name,
        structuralFamily: type.familyKey,
        count: matches.length,
        topExamples: matches
          .slice()
          .sort((a, b) => (b.population ?? 0) - (a.population ?? 0))
          .slice(0, 5)
          .map((country) => country.name),
      };
    }).filter((row) => row.count > 0);

    return withStructuralFamilyDeprecation(
      apiResponse({
        data,
        meta: {
          total: data.length,
          ...STRUCTURAL_FAMILY_DEPRECATION_META,
        },
      }),
    );
  } catch (e) {
    console.error("API /v1/government-types error:", e);
    return withStructuralFamilyDeprecation(apiError("Internal server error", 500));
  }
}

export async function OPTIONS() {
  return corsOptions();
}
