import { apiResponse, apiError, corsOptions, withRateLimit, CI_METHODOLOGY_META } from "@/lib/api/helpers";
import { db } from "@/lib/db";
import { buildGovernmentClassificationMap } from "@/lib/db/government-taxonomy";
import { jurisdictions, ciCompositeScores, pulseDailyScores } from "@/lib/db/schema";
import { eq, sql, desc, asc } from "drizzle-orm";
import type { GovernmentTaxonomyLens } from "@/lib/government-taxonomy";
import {
  STRUCTURAL_FAMILY_DEPRECATION_META,
  withStructuralFamilyDeprecation,
} from "@/lib/api/deprecation";

type ExtendedTaxonomy =
  | GovernmentTaxonomyLens
  | "region"
  | "income"
  | "vdem"
  | "cgv"
  | "monarchy";

const PEER_LENS_FACT_KEY: Partial<Record<ExtendedTaxonomy, string>> = {
  region: "world_bank_region",
  income: "world_bank_income_group",
  vdem: "vdem_row",
  monarchy: "monarchy_status",
};

function buildPeerLensCondition(
  taxonomy: ExtendedTaxonomy,
  value: string,
) {
  if (taxonomy === "cgv") {
    return sql`EXISTS (
      SELECT 1 FROM government_taxonomies gt
      WHERE gt.jurisdiction_id = ${jurisdictions.id}
        AND gt.regime_type_cgv = ${value}
    )`;
  }
  const factKey = PEER_LENS_FACT_KEY[taxonomy];
  if (!factKey) return null;
  return sql`EXISTS (
    SELECT 1 FROM country_facts cf
    WHERE cf.jurisdiction_id = ${jurisdictions.id}
      AND cf.fact_key = ${factKey}
      AND cf.status = 'active'
      AND cf.fact_value = ${value}
  )`;
}

export async function GET(request: Request) {
  const rateLimited = withRateLimit(request);
  if (rateLimited) return rateLimited;

  try {
    const url = new URL(request.url);
    const quarterParam = url.searchParams.get("quarter");
    const sort = url.searchParams.get("sort") ?? "ci";
    const continent = url.searchParams.get("continent");
    const governmentType = url.searchParams.get("government_type");
    const taxonomyParam = url.searchParams.get("taxonomy");
    const limitParam = url.searchParams.get("limit");
    const offsetParam = url.searchParams.get("offset");
    const ALLOWED_TAXONOMIES = new Set<ExtendedTaxonomy>([
      "raw",
      "structural",
      "regime",
      "region",
      "income",
      "vdem",
      "cgv",
      "monarchy",
    ]);
    const taxonomy: ExtendedTaxonomy = ALLOWED_TAXONOMIES.has(
      taxonomyParam as ExtendedTaxonomy,
    )
      ? (taxonomyParam as ExtendedTaxonomy)
      : "raw";

    const limit = Math.min(Math.max(parseInt(limitParam ?? "50", 10) || 50, 1), 250);
    const offset = Math.max(parseInt(offsetParam ?? "0", 10) || 0, 0);
    const methodologyVersion = url.searchParams.get("methodology") ?? "beta";

    // Resolve the target quarter: explicit param or latest available for
    // the requested methodology version.
    let quarter = quarterParam;
    if (!quarter) {
      const latest = await db
        .select({ quarter: ciCompositeScores.quarter })
        .from(ciCompositeScores)
        .where(eq(ciCompositeScores.methodologyVersion, methodologyVersion))
        .orderBy(desc(ciCompositeScores.quarter))
        .limit(1);
      quarter = latest[0]?.quarter ?? null;
    }

    if (!quarter) {
      return withStructuralFamilyDeprecation(
        apiResponse({
          data: [],
          meta: {
            total: 0,
            limit,
            offset,
            hasMore: false,
            quarter: null,
            methodology: CI_METHODOLOGY_META,
            ...STRUCTURAL_FAMILY_DEPRECATION_META,
          },
        }),
      );
    }

    const conditions = [
      sql`${ciCompositeScores.quarter} = ${quarter}`,
      sql`${ciCompositeScores.methodologyVersion} = ${methodologyVersion}`,
    ];

    if (continent) {
      conditions.push(sql`LOWER(${jurisdictions.continent}) = ${continent.toLowerCase()}`);
    }
    if (governmentType && taxonomy === "raw") {
      conditions.push(
        sql`(LOWER(${jurisdictions.governmentType}) LIKE ${`%${governmentType.toLowerCase()}%`}
          OR LOWER(${jurisdictions.governmentTypeDetail}) LIKE ${`%${governmentType.toLowerCase()}%`})`
      );
    }

    // Phase 4 — peer-lens taxonomies (`region`, `income`, `vdem`,
    // `cgv`, `monarchy`) filter via EXISTS subqueries against
    // `country_facts` / `government_taxonomies`. Paginated, no
    // in-memory filter step.
    const isPeerLensFilter =
      governmentType &&
      (taxonomy === "region" ||
        taxonomy === "income" ||
        taxonomy === "vdem" ||
        taxonomy === "cgv" ||
        taxonomy === "monarchy");
    if (isPeerLensFilter && governmentType) {
      const cond = buildPeerLensCondition(taxonomy, governmentType);
      if (cond) conditions.push(cond);
    }

    const where = sql.join(conditions, sql` AND `);

    const isCpSort = sort === "cp";

    const baseSelect = {
      jurisdictionId: jurisdictions.id,
      rank: ciCompositeScores.rank,
      score: ciCompositeScores.score,
      scoreLower: ciCompositeScores.scoreLower,
      scoreUpper: ciCompositeScores.scoreUpper,
      band: ciCompositeScores.band,
      completenessFlag: ciCompositeScores.completenessFlag,
      vintageLabel: ciCompositeScores.vintageLabel,
      isPartial: ciCompositeScores.isPartial,
      missingDimensions: ciCompositeScores.missingDimensions,
      methodologyVersion: ciCompositeScores.methodologyVersion,
      slug: jurisdictions.slug,
      name: jurisdictions.name,
      iso3: jurisdictions.iso3,
      continent: jurisdictions.continent,
      governmentType: jurisdictions.governmentType,
      governmentTypeDetail: jurisdictions.governmentTypeDetail,
    };

    const cpSelect = isCpSort
      ? {
          ...baseSelect,
          pulseScore: pulseDailyScores.pulseScore,
          eventImpact: pulseDailyScores.eventImpact,
          activeEvents: pulseDailyScores.activeEvents,
          isLowConfidence: pulseDailyScores.isLowConfidence,
          pulseDate: pulseDailyScores.scoreDate,
        }
      : baseSelect;

    let rowsQuery = db
      .select(cpSelect)
      .from(ciCompositeScores)
      .innerJoin(jurisdictions, eq(ciCompositeScores.jurisdictionId, jurisdictions.id))
      .$dynamic();

    if (isCpSort) {
      rowsQuery = rowsQuery.leftJoin(
        pulseDailyScores,
        sql`${pulseDailyScores.jurisdictionId} = ${ciCompositeScores.jurisdictionId}
          AND ${pulseDailyScores.scoreDate} = (
            SELECT MAX(score_date) FROM pulse_daily_scores
            WHERE jurisdiction_id = ${ciCompositeScores.jurisdictionId}
          )`
      );
    }

    const orderCol = isCpSort
      ? sql`${pulseDailyScores.pulseScore} DESC NULLS LAST`
      : asc(ciCompositeScores.rank);

    // Legacy slow path — `?taxonomy=structural|regime` + governmentType
    // text-match in memory against the classification labels. Retained
    // through 2027-03-31; deprecation headers attached on the way out.
    if (
      (taxonomy === "structural" || taxonomy === "regime") &&
      governmentType
    ) {
      const rows = await rowsQuery
        .where(where)
        .orderBy(orderCol);

      const classificationMap = await buildGovernmentClassificationMap(
        rows.map((row) => ({
          id: row.jurisdictionId,
          slug: row.slug,
          iso3: row.iso3,
          governmentType: row.governmentType,
          governmentTypeDetail: row.governmentTypeDetail,
        })),
      );

      const filtered = rows
        .map(({ jurisdictionId, ...row }) => ({
          ...row,
          governmentClassification: classificationMap.get(jurisdictionId) ?? null,
        }))
        .filter((row) => {
          const label =
            taxonomy === "regime"
              ? row.governmentClassification?.regimeTypeLabel
              : row.governmentClassification?.structuralFamilyLabel;
          return label
            ? label.toLowerCase().includes(governmentType.toLowerCase())
            : false;
        });

      return withStructuralFamilyDeprecation(
        apiResponse({
          data: filtered.slice(offset, offset + limit),
          meta: {
            total: filtered.length,
            limit,
            offset,
            hasMore: offset + limit < filtered.length,
            quarter,
            taxonomy,
            methodology: CI_METHODOLOGY_META,
            ...STRUCTURAL_FAMILY_DEPRECATION_META,
          },
        }),
      );
    }

    const [rows, countResult] = await Promise.all([
      rowsQuery
        .where(where)
        .orderBy(orderCol)
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(ciCompositeScores)
        .innerJoin(jurisdictions, eq(ciCompositeScores.jurisdictionId, jurisdictions.id))
        .where(where),
    ]);

    const total = countResult[0]?.count ?? 0;
    const classificationMap = await buildGovernmentClassificationMap(
      rows.map((row) => ({
        id: row.jurisdictionId,
        slug: row.slug,
        iso3: row.iso3,
        governmentType: row.governmentType,
        governmentTypeDetail: row.governmentTypeDetail,
      })),
    );

    return withStructuralFamilyDeprecation(
      apiResponse({
        data: rows.map(({ jurisdictionId, ...row }) => ({
          ...row,
          governmentClassification: classificationMap.get(jurisdictionId) ?? null,
        })),
        meta: {
          total,
          limit,
          offset,
          hasMore: offset + limit < total,
          quarter,
          taxonomy,
          methodology: CI_METHODOLOGY_META,
          ...STRUCTURAL_FAMILY_DEPRECATION_META,
        },
      }),
    );
  } catch (e) {
    console.error("API /v1/index/rankings error:", e);
    return withStructuralFamilyDeprecation(apiError("Internal server error", 500));
  }
}

export async function OPTIONS() {
  return corsOptions();
}
