/**
 * GET /api/v1/countries — list endpoint with optional taxonomy filter.
 *
 * Phase 4 (structural_family removal) extensions:
 *   - New `?taxonomy=` values: `region`, `income`, `vdem`, `cgv`,
 *     `monarchy`. These filter via Phase F's `country_facts` table
 *     (or `government_taxonomies.regime_type_cgv` for `cgv`) using
 *     EXISTS subqueries — paginated and indexed.
 *   - Legacy `?taxonomy=structural` and `?taxonomy=regime` remain
 *     functional through 2027-03-31 with `Deprecation` / `Sunset`
 *     headers.
 *   - Every response includes the headers + `meta.deprecations` block
 *     because `governmentClassification.structuralFamily*` fields are
 *     always served.
 *
 * Plan: ~/civica/plan/structural-family-removal-implementation-plan.md §B-Phase 4
 */

import { apiResponse, apiError, corsOptions, withRateLimit } from "@/lib/api/helpers";
import { db } from "@/lib/db";
import { buildGovernmentClassificationMap } from "@/lib/db/government-taxonomy";
import { jurisdictions } from "@/lib/db/schema";
import { sql, asc, desc } from "drizzle-orm";
import type { GovernmentTaxonomyLens } from "@/lib/government-taxonomy";
import {
  cachedJurisdictionColumns,
  getCanonicalFactsForJurisdictions,
} from "@/lib/factbook/reconcile/api";
import {
  STRUCTURAL_FAMILY_DEPRECATION_META,
  withStructuralFamilyDeprecation,
} from "@/lib/api/deprecation";

/**
 * Resolver-canonical display facts the list serves. Mirrors the
 * precedence + rounding in `/api/v1/countries/[code]`: the resolver IS
 * the source of truth, the `jurisdictions` cache columns are the
 * eventually-consistent fallback. Population/area round to integers.
 */
const LIST_FACT_FIELDS = {
  capital: "capital",
  population: "population_total",
  gdpBillions: "gdp_ppp_usd_billions",
  areaSqKm: "area_total_km2",
} as const;

interface ListDisplayRow {
  id: string;
  capital: string | null;
  population: number | null;
  gdpBillions: number | null;
  areaSqKm: number | null;
}

/**
 * Batch-resolve the four display facts for an entire result page in a
 * single query (no N+1), then overlay resolver-canonical values onto
 * each country's cache values. Returns a map keyed by jurisdiction id.
 */
async function resolveListDisplayFacts(
  rows: ListDisplayRow[],
): Promise<Map<string, {
  capital: string | null;
  population: number | null;
  gdpBillions: number | null;
  areaSqKm: number | null;
}>> {
  const out = new Map<string, {
    capital: string | null;
    population: number | null;
    gdpBillions: number | null;
    areaSqKm: number | null;
  }>();
  if (rows.length === 0) return out;

  let facts: Awaited<ReturnType<typeof getCanonicalFactsForJurisdictions>> = {};
  try {
    facts = await getCanonicalFactsForJurisdictions(
      rows.map((r) => r.id),
      Object.values(LIST_FACT_FIELDS),
    );
  } catch {
    /* resolver unavailable — fall back to cache values below */
  }

  for (const row of rows) {
    const f = facts[row.id] ?? {};
    const capText = f[LIST_FACT_FIELDS.capital]?.canonical?.factValue ?? null;
    const popNum =
      f[LIST_FACT_FIELDS.population]?.canonical?.factValueNumeric ?? null;
    const gdpNum =
      f[LIST_FACT_FIELDS.gdpBillions]?.canonical?.factValueNumeric ?? null;
    const areaNum =
      f[LIST_FACT_FIELDS.areaSqKm]?.canonical?.factValueNumeric ?? null;
    out.set(row.id, {
      capital: capText ?? row.capital,
      population: popNum != null ? Math.round(popNum) : row.population,
      gdpBillions: gdpNum ?? row.gdpBillions,
      areaSqKm: areaNum != null ? Math.round(areaNum) : row.areaSqKm,
    });
  }
  return out;
}

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

    const conditions = [
      sql`${jurisdictions.type} = 'sovereign_state'`,
      sql`LOWER(${jurisdictions.name}) <> 'none'`,
    ];

    if (continent) {
      conditions.push(sql`LOWER(${jurisdictions.continent}) = ${continent.toLowerCase()}`);
    }
    if (governmentType && taxonomy === "raw") {
      conditions.push(
        sql`(LOWER(${jurisdictions.governmentType}) LIKE ${`%${governmentType.toLowerCase()}%`} OR LOWER(${jurisdictions.governmentTypeDetail}) LIKE ${`%${governmentType.toLowerCase()}%`})`
      );
    }

    // Phase 4 — peer-lens taxonomies filter via EXISTS subqueries
    // against `country_facts` / `government_taxonomies`. Paginated;
    // no in-memory filter step.
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

    // Legacy slow path — `?taxonomy=structural|regime` + governmentType
    // text-match in memory against the classification labels. Retained
    // through 2027-03-31; deprecation headers attached on the way out.
    if (
      (taxonomy === "structural" || taxonomy === "regime") &&
      governmentType
    ) {
      const countries = await db
        .select({
          id: jurisdictions.id,
          slug: jurisdictions.slug,
          name: jurisdictions.name,
          iso2: jurisdictions.iso2,
          iso3: jurisdictions.iso3,
          continent: jurisdictions.continent,
          capital: cachedJurisdictionColumns.capital,
          population: cachedJurisdictionColumns.population,
          governmentType: jurisdictions.governmentType,
          governmentTypeDetail: jurisdictions.governmentTypeDetail,
          gdpBillions: cachedJurisdictionColumns.gdpBillions,
          areaSqKm: cachedJurisdictionColumns.areaSqKm,
          flagUrl: jurisdictions.flagUrl,
        })
        .from(jurisdictions)
        .where(where)
        .orderBy(desc(jurisdictions.population), asc(jurisdictions.name));

      const classificationMap = await buildGovernmentClassificationMap(countries);
      const filtered = countries
        .map((country) => ({
          ...country,
          governmentClassification: classificationMap.get(country.id) ?? null,
        }))
        .filter((country) => {
          const label =
            taxonomy === "regime"
              ? country.governmentClassification?.regimeTypeLabel
              : country.governmentClassification?.structuralFamilyLabel;
          return label
            ? label.toLowerCase().includes(governmentType.toLowerCase())
            : false;
        });

      const paged = filtered.slice(offset, offset + limit);
      const displayFacts = await resolveListDisplayFacts(paged);
      const pagedResolved = paged.map((country) => {
        const d = displayFacts.get(country.id);
        return {
          ...country,
          capital: d?.capital ?? country.capital,
          population: d?.population ?? country.population,
          gdpBillions: d?.gdpBillions ?? country.gdpBillions,
          areaSqKm: d?.areaSqKm ?? country.areaSqKm,
        };
      });
      return withStructuralFamilyDeprecation(
        apiResponse({
          data: pagedResolved,
          meta: {
            total: filtered.length,
            limit,
            offset,
            hasMore: offset + limit < filtered.length,
            taxonomy,
            ...STRUCTURAL_FAMILY_DEPRECATION_META,
          },
        }),
      );
    }

    const [countries, countResult] = await Promise.all([
      db
        .select({
          id: jurisdictions.id,
          slug: jurisdictions.slug,
          name: jurisdictions.name,
          iso2: jurisdictions.iso2,
          iso3: jurisdictions.iso3,
          continent: jurisdictions.continent,
          capital: cachedJurisdictionColumns.capital,
          population: cachedJurisdictionColumns.population,
          governmentType: jurisdictions.governmentType,
          governmentTypeDetail: jurisdictions.governmentTypeDetail,
          gdpBillions: cachedJurisdictionColumns.gdpBillions,
          areaSqKm: cachedJurisdictionColumns.areaSqKm,
          flagUrl: jurisdictions.flagUrl,
        })
        .from(jurisdictions)
        .where(where)
        .orderBy(desc(jurisdictions.population), asc(jurisdictions.name))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(jurisdictions)
        .where(where),
    ]);
    const classificationMap = await buildGovernmentClassificationMap(countries);
    const displayFacts = await resolveListDisplayFacts(countries);

    const total = countResult[0]?.count ?? 0;

    return withStructuralFamilyDeprecation(
      apiResponse({
        data: countries.map(({ id, ...country }) => {
          const d = displayFacts.get(id);
          return {
            ...country,
            // Resolver-canonical display facts override the cache,
            // mirroring /api/v1/countries/[code].
            capital: d?.capital ?? country.capital,
            population: d?.population ?? country.population,
            gdpBillions: d?.gdpBillions ?? country.gdpBillions,
            areaSqKm: d?.areaSqKm ?? country.areaSqKm,
            governmentClassification: classificationMap.get(id) ?? null,
          };
        }),
        meta: {
          total,
          limit,
          offset,
          hasMore: offset + limit < total,
          taxonomy,
          ...STRUCTURAL_FAMILY_DEPRECATION_META,
        },
      }),
    );
  } catch (e) {
    console.error("API /v1/countries error:", e);
    return withStructuralFamilyDeprecation(apiError("Internal server error", 500));
  }
}

export async function OPTIONS() {
  return corsOptions();
}
