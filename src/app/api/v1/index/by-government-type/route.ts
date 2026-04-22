import { apiResponse, apiError, corsOptions, withRateLimit } from "@/lib/api/helpers";
import { getCIByGovernmentTypeDots } from "@/lib/db/queries";
import {
  getGovernmentTaxonomyGroupingKey,
  getGovernmentTaxonomyGroupingLabel,
  type GovernmentTaxonomyLens,
} from "@/lib/government-taxonomy";

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
  const rateLimited = withRateLimit(request);
  if (rateLimited) return rateLimited;

  try {
    const url = new URL(request.url);
    const quarter = url.searchParams.get("quarter") ?? undefined;
    const taxonomyParam = url.searchParams.get("taxonomy");
    const taxonomy: GovernmentTaxonomyLens =
      taxonomyParam === "structural" || taxonomyParam === "regime"
        ? taxonomyParam
        : "raw";

    const rows = await getCIByGovernmentTypeDots(quarter);
    const grouped = new Map<
      string,
      { label: string; scores: number[] }
    >();

    for (const row of rows) {
      const label = row.governmentClassification
        ? getGovernmentTaxonomyGroupingLabel(row.governmentClassification, taxonomy)
        : row.governmentType;
      const key = row.governmentClassification
        ? getGovernmentTaxonomyGroupingKey(row.governmentClassification, taxonomy)
        : row.governmentType;
      const bucket = grouped.get(key) ?? { label, scores: [] };
      bucket.scores.push(Number(row.score));
      grouped.set(key, bucket);
    }

    const data = [...grouped.entries()]
      .map(([key, bucket]) => {
        const scores = [...bucket.scores].sort((a, b) => a - b);
        const total = scores.reduce((sum, score) => sum + score, 0);
        return {
          key,
          governmentType: bucket.label,
          count: scores.length,
          avgScore: total / Math.max(1, scores.length),
          minScore: scores[0] ?? 0,
          maxScore: scores[scores.length - 1] ?? 0,
          medianScore: quantile(scores, 0.5),
          q1: quantile(scores, 0.25),
          q3: quantile(scores, 0.75),
        };
      })
      .sort((a, b) => b.avgScore - a.avgScore || a.governmentType.localeCompare(b.governmentType));

    return apiResponse({
      data,
      meta: { quarter: quarter ?? null, taxonomy },
    });
  } catch (e) {
    console.error("API /v1/index/by-government-type error:", e);
    return apiError("Internal server error", 500);
  }
}

export async function OPTIONS() {
  return corsOptions();
}
