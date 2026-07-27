import {
  apiResponse,
  apiError,
  corsOptions,
  withRateLimit,
  CORS_HEADERS,
} from "@/lib/api/helpers";
import { db } from "@/lib/db";
import { buildGovernmentClassificationMap } from "@/lib/db/government-taxonomy";
import { jurisdictions, ciCompositeScores } from "@/lib/db/schema";
import { eq, sql, asc } from "drizzle-orm";
import type { GovernmentTaxonomyLens } from "@/lib/government-taxonomy";
import {
  INDEX_COMPOSITE_DEPRECATION_HEADERS,
  STRUCTURAL_FAMILY_DEPRECATION_HEADERS,
  retiredIndexApiResponse,
  withIndexDispositionDeprecation,
  withStructuralFamilyDeprecation,
} from "@/lib/api/deprecation";
import {
  assertCiReleaseCompositeRow,
  isCiReleaseConsistencyError,
} from "@/lib/ci/release-selection";
import { loadPublishedCiRelease } from "@/lib/ci/release-store";
import { DEFAULT_GOVERNMENT_TAXONOMY_VERSION } from "@/lib/government-taxonomy";
import { parsePublishedCiCompleteness } from "@/lib/ci/missingness-policy";
import {
  shapeIndexRankingsItem,
  shapeIndexRankingsMeta,
} from "@/lib/api/contract/shapes";
import { retiredPulseScalarResponse } from "@/lib/api/pulse-scalar-retirement";
import { parseQueryContract } from "@/lib/api/request-contract";

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
        AND gt.taxonomy_version = ${DEFAULT_GOVERNMENT_TAXONOMY_VERSION}
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
  const rateLimited = await withRateLimit(request);
  if (rateLimited) return withIndexDispositionDeprecation(rateLimited);
  const query = parseQueryContract(request, "v1-index-rankings-query/v1", {
    errorHeaders: {
      ...CORS_HEADERS,
      ...INDEX_COMPOSITE_DEPRECATION_HEADERS,
      ...STRUCTURAL_FAMILY_DEPRECATION_HEADERS,
    },
  });
  if (!query.ok) return query.response;
  if (query.data.sort === "cp") return retiredPulseScalarResponse();
  const retired = retiredIndexApiResponse();
  if (retired) return retired;

  try {
    const {
      quarter: quarterParam,
      continent,
      government_type: governmentType,
      taxonomy,
      limit,
      offset,
    } = query.data;
    const release = await loadPublishedCiRelease(query.data.release);
    const methodologyVersion = release.methodologyVersion;
    if (quarterParam && quarterParam !== release.quarter) {
      return withIndexDispositionDeprecation(
        apiError("The requested quarter is unavailable for this release.", 400),
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
              release,
              series: release.series,
            }),
          }),
        ),
      );
    }

    const conditions = [
      sql`${ciCompositeScores.quarter} = ${quarter}`,
      sql`${ciCompositeScores.methodologyVersion} = ${methodologyVersion}`,
      sql`${ciCompositeScores.releaseId} = ${release.releaseId}`,
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
      quarter: ciCompositeScores.quarter,
      rank: ciCompositeScores.rank,
      score: ciCompositeScores.score,
      scoreLower: ciCompositeScores.scoreLower,
      scoreUpper: ciCompositeScores.scoreUpper,
      completenessFlag: ciCompositeScores.completenessFlag,
      vintageLabel: ciCompositeScores.vintageLabel,
      supersedesVintageLabel: ciCompositeScores.supersedesVintageLabel,
      isPartial: ciCompositeScores.isPartial,
      missingDimensions: ciCompositeScores.missingDimensions,
      // CLM-012 addition — every sibling CI endpoint (index/[slug],
      // index/compare) already surfaces this completeness signal.
      dimensionsAvailable: ciCompositeScores.dimensionsAvailable,
      methodologyVersion: ciCompositeScores.methodologyVersion,
      releaseId: ciCompositeScores.releaseId,
      contentHash: ciCompositeScores.contentHash,
      derivationVersionKey: ciCompositeScores.derivationVersionKey,
      derivationVersions: ciCompositeScores.derivationVersions,
      totalRanked: ciCompositeScores.totalRanked,
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
        .map((row) => {
          assertCiReleaseCompositeRow(row, release.releaseId);
          const completeness = parsePublishedCiCompleteness(row);
          return {
            rank: row.rank,
            score: row.score,
            scoreLower: row.scoreLower,
            scoreUpper: row.scoreUpper,
            completenessFlag: completeness.completenessFlag,
            vintageLabel: row.vintageLabel,
            isPartial: row.isPartial,
            missingDimensions: completeness.missingDimensions,
            dimensionsAvailable: completeness.dimensionsAvailable,
            methodologyVersion: row.methodologyVersion,
            slug: row.slug,
            name: row.name,
            iso2: row.iso2,
            iso3: row.iso3,
            continent: row.continent,
            governmentType: row.governmentType,
            governmentTypeDetail: row.governmentTypeDetail,
            governmentClassification:
              classificationMap.get(row.jurisdictionId) ?? null,
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
              release,
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
          data: rows.map((row) => {
            assertCiReleaseCompositeRow(row, release.releaseId);
            const completeness = parsePublishedCiCompleteness(row);
            return shapeIndexRankingsItem({
              rank: row.rank,
              score: row.score,
              scoreLower: row.scoreLower,
              scoreUpper: row.scoreUpper,
              completenessFlag: completeness.completenessFlag,
              vintageLabel: row.vintageLabel,
              isPartial: row.isPartial,
              missingDimensions: completeness.missingDimensions,
              dimensionsAvailable: completeness.dimensionsAvailable,
              methodologyVersion: row.methodologyVersion,
              slug: row.slug,
              name: row.name,
              iso2: row.iso2,
              iso3: row.iso3,
              continent: row.continent,
              governmentType: row.governmentType,
              governmentTypeDetail: row.governmentTypeDetail,
              governmentClassification:
                classificationMap.get(row.jurisdictionId) ?? null,
            });
          }),
          meta: shapeIndexRankingsMeta({
            total,
            limit,
            offset,
            hasMore: offset + limit < total,
            quarter,
            taxonomy,
            release,
            series: release.series,
          }),
        }),
      ),
    );
  } catch (e) {
    console.error("API /v1/index/rankings error:", e);
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
