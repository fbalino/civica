import {
  apiResponse,
  apiError,
  corsOptions,
  withRateLimit,
  CI_METHODOLOGY_META,
  CORS_HEADERS,
} from "@/lib/api/helpers";
import { compareCICountries } from "@/lib/db/queries";
import {
  displayCiReleaseDimensionScore,
  isCiReleaseConsistencyError,
  publicCiReleaseIdentity,
} from "@/lib/ci/release-selection";
import { loadPublishedCiRelease } from "@/lib/ci/release-store";
import { parsePublishedCiCompleteness } from "@/lib/ci/missingness-policy";
import {
  INDEX_COMPOSITE_DEPRECATION_HEADERS,
  STRUCTURAL_FAMILY_DEPRECATION_META,
  STRUCTURAL_FAMILY_DEPRECATION_HEADERS,
  retiredIndexApiResponse,
  withIndexDispositionDeprecation,
  withStructuralFamilyDeprecation,
} from "@/lib/api/deprecation";
import { shapeIndexCompareResult } from "@/lib/api/contract/shapes";
import { parseQueryContract } from "@/lib/api/request-contract";
import { publicCiPublicationComponents } from "@/lib/ci/publication-components";

export async function GET(request: Request) {
  const rateLimited = await withRateLimit(request);
  if (rateLimited) return withIndexDispositionDeprecation(rateLimited);
  const query = parseQueryContract(request, "v1-index-compare-query/v1", {
    errorHeaders: {
      ...CORS_HEADERS,
      ...INDEX_COMPOSITE_DEPRECATION_HEADERS,
      ...STRUCTURAL_FAMILY_DEPRECATION_HEADERS,
    },
  });
  if (!query.ok) return query.response;
  const retired = retiredIndexApiResponse();
  if (retired) return retired;

  try {
    const { slug: slugs, quarter } = query.data;
    const release = await loadPublishedCiRelease(query.data.release);
    if (quarter && quarter !== release.quarter) {
      return withIndexDispositionDeprecation(
        withStructuralFamilyDeprecation(
          apiError("The requested quarter is unavailable for this release.", 400),
        ),
      );
    }
    const rows = await compareCICountries(slugs, quarter, release.releaseId);

    // Curate a public response shape rather than spreading the raw DB rows.
    // `compareCICountries` returns the full `jurisdictions` row (internal
    // `id`, `factCacheRefreshedAt`, `createdAt`/`updatedAt`) and full
    // `ci_dimension_scores` rows (`id`, `ingestionId`, `jurisdictionId`,
    // `createdAt`) — none of which belong in the public API. Every other
    // v1 route curates its fields; mirror /api/v1/index/[country_slug].
    //
    // Emit each per-dimension `normalizedScore` on the SAME v2 fixed-bound
    // scale as the archived headline composite, so this sunset endpoint
    // reconciles with /api/v1/index/[slug]. The stored
    // `normalized_score` column is the legacy v1 observed-min-max value and
    // does NOT sum to the v2 headline; fall back to it only when raw value /
    // source is missing. Mirrors src/app/api/v1/index/[country_slug]/route.ts.
    const results = rows.map((row) =>
      shapeIndexCompareResult({
        jurisdiction: {
          slug: row.jurisdiction.slug,
          name: row.jurisdiction.name,
          iso2: row.jurisdiction.iso2,
          iso3: row.jurisdiction.iso3,
          continent: row.jurisdiction.continent,
          governmentType: row.jurisdiction.governmentType,
          governmentTypeDetail: row.jurisdiction.governmentTypeDetail,
          governmentClassification:
            row.jurisdiction.governmentClassification ?? null,
        },
        composite: row.composite
          ? (() => {
              const completeness = parsePublishedCiCompleteness(row.composite);
              return {
                quarter: row.composite.quarter,
                vintageLabel: row.composite.vintageLabel,
                score: row.composite.score,
                scoreLower: row.composite.scoreLower,
                scoreUpper: row.composite.scoreUpper,
                completenessFlag: completeness.completenessFlag,
                rank: row.composite.rank,
                totalRanked: row.composite.totalRanked,
                isPartial: row.composite.isPartial,
                missingDimensions: completeness.missingDimensions,
                dimensionsAvailable: completeness.dimensionsAvailable,
                methodologyVersion: row.composite.methodologyVersion,
              };
            })()
          : null,
        dimensions: row.dimensions.map((d) => ({
          dimension: d.dimension,
          normalizedScore:
            displayCiReleaseDimensionScore(d, release.releaseId) ??
            d.normalizedScore,
          rawValue: d.rawValue,
          sourceId: d.sourceId,
          valueStatus: "observed" as const,
        })),
      }),
    );

    // `jurisdiction.governmentClassification` still carries the deprecated
    // `structuralFamily` / `structuralSubtype` fields — attach the same
    // sunset signal the other structural surfaces use (rankings, countries,
    // index/[slug]).
    return withIndexDispositionDeprecation(
      withStructuralFamilyDeprecation(
        apiResponse({
          data: results,
          meta: {
            quarter: release.quarter,
            count: results.length,
            methodology: CI_METHODOLOGY_META,
            release: publicCiReleaseIdentity(release),
            series: release.series,
            components: publicCiPublicationComponents(release, {
              jurisdiction: "live_current",
              taxonomy: "live_current",
            }),
            deprecations: STRUCTURAL_FAMILY_DEPRECATION_META.deprecations,
          },
        }),
      ),
    );
  } catch (e) {
    console.error("API /v1/index/compare error:", e);
    if (isCiReleaseConsistencyError(e)) {
      return withIndexDispositionDeprecation(
        withStructuralFamilyDeprecation(
          apiError(
            "The requested release is temporarily unavailable.",
            503,
            "RELEASE_INCONSISTENT",
          ),
        ),
      );
    }
    return withIndexDispositionDeprecation(
      withStructuralFamilyDeprecation(apiError("Internal server error", 500)),
    );
  }
}

export async function OPTIONS() {
  return withIndexDispositionDeprecation(corsOptions());
}
