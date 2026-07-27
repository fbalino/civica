import {
  apiResponse,
  apiError,
  corsOptions,
  withRateLimit,
  CORS_HEADERS,
} from "@/lib/api/helpers";
import { getCIByGovernmentTypeDots } from "@/lib/db/queries";
import {
  getGovernmentTaxonomyGroupingKey,
  getGovernmentTaxonomyGroupingLabel,
} from "@/lib/government-taxonomy";
import {
  INDEX_COMPOSITE_DEPRECATION_HEADERS,
  STRUCTURAL_FAMILY_DEPRECATION_META,
  retiredIndexApiResponse,
  withIndexDispositionDeprecation,
  withStructuralFamilyDeprecation,
} from "@/lib/api/deprecation";
import { shapeIndexByGovernmentTypeItem } from "@/lib/api/contract/shapes";
import {
  isCiReleaseConsistencyError,
  publicCiReleaseIdentity,
} from "@/lib/ci/release-selection";
import { loadPublishedCiRelease } from "@/lib/ci/release-store";
import { parseQueryContract } from "@/lib/api/request-contract";
import { publicCiPublicationComponents } from "@/lib/ci/publication-components";

function quantile(sortedValues: number[], percentile: number): number {
  if (sortedValues.length === 0) return 0;
  if (sortedValues.length === 1) return sortedValues[0];
  const index = (sortedValues.length - 1) * percentile;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sortedValues[lower];
  const weight = index - lower;
  return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight;
}

export async function GET(request: Request) {
  const rateLimited = await withRateLimit(request);
  if (rateLimited) return withIndexDispositionDeprecation(rateLimited);
  const query = parseQueryContract(request, "v1-index-group-query/v1", {
    errorHeaders: {
      ...CORS_HEADERS,
      ...INDEX_COMPOSITE_DEPRECATION_HEADERS,
    },
  });
  if (!query.ok) return query.response;
  const { quarter, taxonomy } = query.data;
  const isDeprecatedTaxonomy =
    taxonomy === "structural" || taxonomy === "regime";
  const retired = retiredIndexApiResponse();
  if (retired) return retired;

  try {
    const release = await loadPublishedCiRelease(query.data.release);
    if (quarter && quarter !== release.quarter) {
      const response = apiError(
        "The requested quarter is unavailable for this release.",
        400,
      );
      return withIndexDispositionDeprecation(
        isDeprecatedTaxonomy
          ? withStructuralFamilyDeprecation(response)
          : response,
      );
    }
    const rows = await getCIByGovernmentTypeDots(quarter, release.releaseId);
    const grouped = new Map<string, { label: string; scores: number[] }>();

    for (const row of rows) {
      const label = row.governmentClassification
        ? getGovernmentTaxonomyGroupingLabel(
            row.governmentClassification,
            taxonomy,
          )
        : row.governmentType;
      const key = row.governmentClassification
        ? getGovernmentTaxonomyGroupingKey(
            row.governmentClassification,
            taxonomy,
          )
        : row.governmentType;
      const bucket = grouped.get(key) ?? { label, scores: [] };
      bucket.scores.push(Number(row.score));
      grouped.set(key, bucket);
    }

    const data = [...grouped.entries()]
      .map(([key, bucket]) => {
        const scores = [...bucket.scores].sort((a, b) => a - b);
        const total = scores.reduce((sum, score) => sum + score, 0);
        return shapeIndexByGovernmentTypeItem({
          key,
          governmentType: bucket.label,
          count: scores.length,
          avgScore: total / Math.max(1, scores.length),
          minScore: scores[0] ?? 0,
          maxScore: scores[scores.length - 1] ?? 0,
          medianScore: quantile(scores, 0.5),
          q1: quantile(scores, 0.25),
          q3: quantile(scores, 0.75),
        });
      })
      .sort(
        (a, b) =>
          b.avgScore - a.avgScore ||
          a.governmentType.localeCompare(b.governmentType),
      );

    const meta = isDeprecatedTaxonomy
      ? {
          quarter: release.quarter,
          taxonomy,
          release: publicCiReleaseIdentity(release),
          series: release.series,
          components: publicCiPublicationComponents(release, {
            jurisdiction: "live_current",
            taxonomy: "live_current",
          }),
          ...STRUCTURAL_FAMILY_DEPRECATION_META,
        }
      : {
          quarter: release.quarter,
          taxonomy,
          release: publicCiReleaseIdentity(release),
          series: release.series,
          components: publicCiPublicationComponents(release, {
            jurisdiction: "live_current",
            taxonomy: "live_current",
          }),
        };

    const response = apiResponse({ data, meta });
    return withIndexDispositionDeprecation(
      isDeprecatedTaxonomy
        ? withStructuralFamilyDeprecation(response)
        : response,
    );
  } catch (e) {
    console.error("API /v1/index/by-government-type error:", e);
    if (isCiReleaseConsistencyError(e)) {
      const response = apiError(
        "The requested release is temporarily unavailable.",
        503,
        "RELEASE_INCONSISTENT",
      );
      return withIndexDispositionDeprecation(
        isDeprecatedTaxonomy
          ? withStructuralFamilyDeprecation(response)
          : response,
      );
    }
    const response = apiError("Internal server error", 500);
    return withIndexDispositionDeprecation(
      isDeprecatedTaxonomy
        ? withStructuralFamilyDeprecation(response)
        : response,
    );
  }
}

export async function OPTIONS() {
  return withIndexDispositionDeprecation(corsOptions());
}
