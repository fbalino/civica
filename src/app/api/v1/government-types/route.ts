import { apiResponse, apiError, corsOptions, withRateLimit } from "@/lib/api/helpers";
import { getAllJurisdictions } from "@/lib/db/queries";
import { STRUCTURAL_GOVERNMENT_TYPES } from "@/lib/data/structural-government-types";

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

    return apiResponse({
      data,
      meta: { total: data.length },
    });
  } catch (e) {
    console.error("API /v1/government-types error:", e);
    return apiError("Internal server error", 500);
  }
}

export async function OPTIONS() {
  return corsOptions();
}
