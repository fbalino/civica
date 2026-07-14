import {
  apiResponse,
  apiError,
  corsOptions,
  withRateLimit,
} from "@/lib/api/helpers";
import { db } from "@/lib/db";
import { buildGovernmentClassificationMap } from "@/lib/db/government-taxonomy";
import { jurisdictions, ciCompositeScores } from "@/lib/db/schema";
import { eq, sql, asc } from "drizzle-orm";
import type { GovernmentTaxonomyLens } from "@/lib/government-taxonomy";
import {
  retiredIndexApiResponse,
  withIndexDispositionDeprecation,
  withStructuralFamilyDeprecation,
} from "@/lib/api/deprecation";
import { CURRENT_CI_RELEASE_ID } from "@/lib/ci/current-release";
import { resolveCiRelease } from "@/lib/ci/release-selection";
import { parsePublishedCiCompleteness } from "@/lib/ci/missingness-policy";
import {
  shapeIndexRankingsItem,
  shapeIndexRankingsMeta,
} from "@/lib/api/contract/shapes";
import { retiredPulseScalarResponse } from "@/lib/api/pulse-scalar-retirement";

type ExtendedTaxonomy =
  GovernmentTaxonomyLens | "region" | "income" | "vdem" | "cgv" | "monarchy";

const PEER_LENS_FACT_KEY: Partial<Record<ExtendedTaxonomy, string>> = {
  region: "world_bank_region",
  income: "world_bank_income_group",
  vdem: "vdem_row",
  monarchy: "monarchy_status",
};

function buildPeerLensCondition(taxonomy: ExtendedTaxonomy, value: string) {
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
  const url = new URL(request.url);
  const requestedSort = url.searchParams.get("sort");
  if (requestedSort?.trim().toLowerCase() === "cp") {
    return retiredPulseScalarResponse();
  }
  const sort = requestedSort ?? "ci";
  if (sort !== "ci") {
    return withIndexDispositionDeprecation(
      apiError(
        "Unsupported sort. Civica Pulse is published only as named per-dimension experimental deltas, not as a scalar score or ranking.",
        400,
      ),
    );
  }

  const rateLimited = await withRateLimit(request);
  if (rateLimited) return withIndexDispositionDeprecation(rateLimited);
  const retired = retiredIndexApiResponse();
  if (retired) return retired;

  try {
    const quarterParam = url.searchParams.get("quarter");
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

    const limit = Math.min(
      Math.max(parseInt(limitParam ?? "50", 10) || 50, 1),
      250,
    );
    const offset = Math.max(parseInt(offsetParam ?? "0", 10) || 0, 0);
    const release = resolveCiRelease(
      url.searchParams.get("release") ?? CURRENT_CI_RELEASE_ID,
    );
    const methodologyVersion = release.methodologyVersion;
    if (quarterParam && quarterParam !== release.quarter) {
      return withIndexDispositionDeprecation(
        apiError(
          `${release.releaseId} does not contain quarter ${quarterParam}`,
          400,
        ),
      );
    }
    const quarter = release.quarter;

    if (!quarter) {
      // CLM-012 fix: this early-return branch previously omitted
      // `taxonomy` from meta, unlike the two branches below — every
      // /v1/index/rankings response now carries it consistently.
      return withIndexDispositionDeprecation(
        withStructuralFamilyDeprecation(
          apiResponse({
            data: [],
            meta: shapeIndexRankingsMeta({
              total: 0,
              limit,
              offset,
              hasMore: false,
              quarter: null,
              taxonomy,
              series: release.series,
            }),
          }),
        ),
      );
    }

    const conditions = [
      sql`${ciCompositeScores.quarter} = ${quarter}`,
      sql`${ciCompositeScores.methodologyVersion} = ${methodologyVersion}`,
    ];

    if (continent) {
      conditions.push(
        sql`LOWER(${jurisdictions.continent}) = ${continent.toLowerCase()}`,
      );
    }
    if (governmentType && taxonomy === "raw") {
      conditions.push(
        sql`(LOWER(${jurisdictions.governmentType}) LIKE ${`%${governmentType.toLowerCase()}%`}
          OR LOWER(${jurisdictions.governmentTypeDetail}) LIKE ${`%${governmentType.toLowerCase()}%`})`,
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

    const baseSelect = {
      jurisdictionId: jurisdictions.id,
      rank: ciCompositeScores.rank,
      score: ciCompositeScores.score,
      scoreLower: ciCompositeScores.scoreLower,
      scoreUpper: ciCompositeScores.scoreUpper,
      completenessFlag: ciCompositeScores.completenessFlag,
      vintageLabel: ciCompositeScores.vintageLabel,
      isPartial: ciCompositeScores.isPartial,
      missingDimensions: ciCompositeScores.missingDimensions,
      // CLM-012 addition — every sibling CI endpoint (index/[slug],
      // index/compare) already surfaces this completeness signal.
      dimensionsAvailable: ciCompositeScores.dimensionsAvailable,
      methodologyVersion: ciCompositeScores.methodologyVersion,
      slug: jurisdictions.slug,
      name: jurisdictions.name,
      iso2: jurisdictions.iso2,
      iso3: jurisdictions.iso3,
      continent: jurisdictions.continent,
      governmentType: jurisdictions.governmentType,
      governmentTypeDetail: jurisdictions.governmentTypeDetail,
    };

    const rowsQuery = db
      .select(baseSelect)
      .from(ciCompositeScores)
      .innerJoin(
        jurisdictions,
        eq(ciCompositeScores.jurisdictionId, jurisdictions.id),
      )
      .$dynamic();
    const orderCol = asc(ciCompositeScores.rank);

    // Legacy slow path — `?taxonomy=structural|regime` + governmentType
    // text-match in memory against the classification labels. Retained
    // through 2027-03-31; deprecation headers attached on the way out.
    if (
      (taxonomy === "structural" || taxonomy === "regime") &&
      governmentType
    ) {
      const rows = await rowsQuery.where(where).orderBy(orderCol);

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
        .map(({ jurisdictionId, ...row }) => {
          const completeness = parsePublishedCiCompleteness(row);
          return {
            ...row,
            ...completeness,
            governmentClassification:
              classificationMap.get(jurisdictionId) ?? null,
          };
        })
        .filter((row) => {
          const label =
            taxonomy === "regime"
              ? row.governmentClassification?.regimeTypeLabel
              : row.governmentClassification?.structuralFamilyLabel;
          return label
            ? label.toLowerCase().includes(governmentType.toLowerCase())
            : false;
        });

      return withIndexDispositionDeprecation(
        withStructuralFamilyDeprecation(
          apiResponse({
            data: filtered
              .slice(offset, offset + limit)
              .map(shapeIndexRankingsItem),
            meta: shapeIndexRankingsMeta({
              total: filtered.length,
              limit,
              offset,
              hasMore: offset + limit < filtered.length,
              quarter,
              taxonomy,
              series: release.series,
            }),
          }),
        ),
      );
    }

    const [rows, countResult] = await Promise.all([
      rowsQuery.where(where).orderBy(orderCol).limit(limit).offset(offset),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(ciCompositeScores)
        .innerJoin(
          jurisdictions,
          eq(ciCompositeScores.jurisdictionId, jurisdictions.id),
        )
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

    return withIndexDispositionDeprecation(
      withStructuralFamilyDeprecation(
        apiResponse({
          data: rows.map(({ jurisdictionId, ...row }) => {
            const completeness = parsePublishedCiCompleteness(row);
            return shapeIndexRankingsItem({
              ...row,
              ...completeness,
              governmentClassification:
                classificationMap.get(jurisdictionId) ?? null,
            });
          }),
          meta: shapeIndexRankingsMeta({
            total,
            limit,
            offset,
            hasMore: offset + limit < total,
            quarter,
            taxonomy,
            series: release.series,
          }),
        }),
      ),
    );
  } catch (e) {
    console.error("API /v1/index/rankings error:", e);
    return withIndexDispositionDeprecation(
      withStructuralFamilyDeprecation(apiError("Internal server error", 500)),
    );
  }
}

export async function OPTIONS() {
  return withIndexDispositionDeprecation(corsOptions());
}
