/**
 * GET /api/v1/peer-groupings — Civica's peer-grouping successor
 * endpoint. Replaces the retired `/api/v1/government-types` and the
 * `?taxonomy=structural` filter values on the older endpoints, per
 * the 2026-05-02 peer-grouping resolution.
 *
 *   Plan:        ~/civica/plan/structural-family-removal-implementation-plan.md §B-Phase 4
 *   Methodology: /civica-index/methodology/peer-grouping
 *
 * Returns the four peer-grouping lenses (World Bank region, World
 * Bank income group, V-Dem RoW, BR/CGV regime) plus the constitutional-
 * form descriptive metadata (`monarchy_status`) in a single response.
 * One round-trip for embed builders and external consumers; sub-paths
 * (`/peer-groupings/regions`, etc.) were considered and rejected
 * because the common case is "all lenses for orientation."
 *
 * Response envelope mirrors Phase F's `meta.reconciliation` shape so
 * consumers see the same metadata conventions across the API.
 */

import { apiResponse, apiError, corsOptions, withRateLimit } from "@/lib/api/helpers";
import {
  getWorldBankRegionDistribution,
  getWorldBankIncomeGroupDistribution,
  getVDemRowDistribution,
  getCgvRegimeDistribution,
  getMonarchyStatusDistribution,
} from "@/lib/db/queries-peer-grouping";
import {
  WORLD_BANK_REGION_META,
  WORLD_BANK_INCOME_GROUP_META,
  VDEM_ROW_META,
  CGV_REGIME_TYPE_META,
  MONARCHY_STATUS_META,
  PEER_LENS_SOURCE_ID,
  type WorldBankRegionKey,
  type WorldBankIncomeGroupKey,
  type VDemRowKey,
  type CGVRegimeTypeKey,
  type MonarchyStatusKey,
} from "@/lib/peer-grouping/lens-metadata";
import { shapePeerGroupingsData } from "@/lib/api/contract/shapes";

const SOURCE_NAMES: Record<string, string> = {
  world_bank: "World Bank",
  vdem: "V-Dem",
  bjornskov_rode: "Bjørnskov-Rode / CGV",
  cia_factbook: "CIA World Factbook",
};

interface LensValue {
  /** Canonical value as written in `country_facts` (or, for
   *  `cgv_regime`, `government_taxonomies.regime_type_cgv`). */
  value: string;
  /** Display label from the lens metadata. Same as `value` for the
   *  World Bank lenses; metadata-mapped for V-Dem RoW / CGV / monarchy. */
  label: string;
  /** Total countries with this canonical value. */
  totalCountries: number;
  /** Subset of the above that have a CI composite score in the
   *  current published quarter. */
  scoredCountries: number;
}

interface LensBlock {
  /** The Phase F fact-key consumers should query for individual
   *  countries (or the legacy taxonomy column for CGV). */
  factKey: string;
  /** Stable taxonomy parameter value the legacy endpoints accept
   *  (e.g. pass `?taxonomy=region` to `/api/v1/index/rankings`). */
  filterParam: string;
  /** Source-row identifier; matches the `provenance.source` field
   *  on `/api/v1/countries/[code]`. */
  source: string;
  /** Human-readable source label, matches Phase F's `sourceName`
   *  convention. */
  sourceName: string;
  /** Brief description of the lens for API consumers. */
  description: string;
  /** Sorted list of canonical values + their cohort sizes. */
  values: LensValue[];
}

function decorateLens<K extends string>(
  raw: Array<{ key: string; totalCount: number; scoredCount: number }>,
  meta: Record<K, { label: string; order: number }>,
): LensValue[] {
  return [...raw]
    .filter((r) => typeof r.key === "string" && r.key.length > 0)
    .sort((a, b) => {
      const orderA = meta[a.key as K]?.order ?? 999;
      const orderB = meta[b.key as K]?.order ?? 999;
      if (orderA !== orderB) return orderA - orderB;
      return b.totalCount - a.totalCount;
    })
    .map((r) => ({
      value: r.key,
      label: meta[r.key as K]?.label ?? r.key,
      totalCountries: r.totalCount,
      scoredCountries: r.scoredCount,
    }));
}

export async function GET(request: Request) {
  const rateLimited = withRateLimit(request);
  if (rateLimited) return rateLimited;

  try {
    const [region, income, vdem, cgv, monarchy] = await Promise.all([
      getWorldBankRegionDistribution(),
      getWorldBankIncomeGroupDistribution(),
      getVDemRowDistribution(),
      getCgvRegimeDistribution(),
      getMonarchyStatusDistribution(),
    ]);

    // No explicit `Record<string, LensBlock>` annotation — this object
    // literal's exact 5-key shape must flow through to
    // `shapePeerGroupingsData`/`zPeerGroupingsData` unwidened so the
    // contract layer can catch a missing/renamed lens at compile time.
    const lenses = {
      world_bank_region: {
        factKey: "world_bank_region",
        filterParam: "region",
        source: PEER_LENS_SOURCE_ID.world_bank_region,
        sourceName: SOURCE_NAMES[PEER_LENS_SOURCE_ID.world_bank_region],
        description:
          "World Bank Country and Lending Groups regional classification (7 regions). Default material peer lens — pair with `world_bank_income_group` for the canonical material cohort. Refreshed annually each July.",
        values: decorateLens<WorldBankRegionKey>(region, WORLD_BANK_REGION_META),
      } satisfies LensBlock,
      world_bank_income_group: {
        factKey: "world_bank_income_group",
        filterParam: "income",
        source: PEER_LENS_SOURCE_ID.world_bank_income_group,
        sourceName: SOURCE_NAMES[PEER_LENS_SOURCE_ID.world_bank_income_group],
        description:
          "World Bank income group classification (4 tiers, low → high). Pairs with `world_bank_region` for the canonical material cohort. Refreshed annually each July.",
        values: decorateLens<WorldBankIncomeGroupKey>(
          income,
          WORLD_BANK_INCOME_GROUP_META,
        ),
      } satisfies LensBlock,
      vdem_row: {
        factKey: "vdem_row",
        filterParam: "vdem",
        source: PEER_LENS_SOURCE_ID.vdem_row,
        sourceName: SOURCE_NAMES[PEER_LENS_SOURCE_ID.vdem_row],
        description:
          "V-Dem Regimes of the World (Lührmann, Tannenberg & Lindberg 2018). Default governance peer lens — 4 tiers spanning closed autocracy through liberal democracy. Annual cadence.",
        values: decorateLens<VDemRowKey>(vdem, VDEM_ROW_META),
      } satisfies LensBlock,
      cgv_regime: {
        factKey: "regime_type_cgv",
        filterParam: "cgv",
        source: PEER_LENS_SOURCE_ID.cgv_regime,
        sourceName: SOURCE_NAMES[PEER_LENS_SOURCE_ID.cgv_regime],
        description:
          "Bjørnskov-Rode / Cheibub-Gandhi-Vreeland regime classification (6 categories). Optional alternate governance lens distinguishing democracies by executive form and authoritarian systems by ruling-elite structure.",
        values: decorateLens<CGVRegimeTypeKey>(cgv, CGV_REGIME_TYPE_META),
      } satisfies LensBlock,
      monarchy_status: {
        factKey: "monarchy_status",
        filterParam: "monarchy",
        source: PEER_LENS_SOURCE_ID.monarchy_status,
        sourceName: SOURCE_NAMES[PEER_LENS_SOURCE_ID.monarchy_status],
        description:
          "Monarchy status (6-value enum: none / constitutional / absolute / ceremonial / elective / theocratic). Descriptive constitutional-form metadata, NOT an analytical peer lens. Provided here for filterability ('show me ceremonial monarchies').",
        values: decorateLens<MonarchyStatusKey>(monarchy, MONARCHY_STATUS_META),
      } satisfies LensBlock,
    };

    return apiResponse({
      data: shapePeerGroupingsData(lenses),
      meta: {
        peerGrouping: {
          status: "stable",
          version: "v1.0",
          versionDate: "2026-05-02",
          methodology:
            "https://civicaatlas.org/civica-index/methodology/peer-grouping",
        },
      },
    });
  } catch (e) {
    console.error("API /v1/peer-groupings error:", e);
    return apiError("Internal server error", 500);
  }
}

export async function OPTIONS() {
  return corsOptions();
}
