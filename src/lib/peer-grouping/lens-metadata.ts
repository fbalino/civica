/**
 * Peer-grouping lens metadata.
 *
 * Color, label, and sort-order constants for each of the four
 * peer-lenses adopted by the 2026-05-02 peer-grouping resolution
 * (~/civica/plan/peer-grouping-resolution-v1.md):
 *
 *   1. World Bank region (material indicators — region axis)
 *   2. World Bank income group (material indicators — income axis)
 *   3. V-Dem Regimes of the World (governance indicators)
 *   4. Bjørnskov-Rode / CGV regime type (alternate governance lens)
 *
 * Plus descriptive constitutional-form metadata (`monarchy_status`)
 * which is NOT a peer-grouping primitive — it's filterable metadata.
 *
 * Implementation plan:
 *   ~/civica/plan/structural-family-removal-implementation-plan.md
 */

import {
  REGIME_TYPE_META,
  type RegimeTypeKey,
  type RegimeTypeMeta,
} from "@/lib/government-taxonomy";

/* ────────────────────────────────────────────────────────────────
 * World Bank region (7 buckets)
 * ────────────────────────────────────────────────────────────────
 *
 * Keys match the canonical-fact-layer values written by Phase F's
 * World Bank sync (verified 2026-05-02 against `country_facts`).
 * Phase F preserves the upstream World Bank human-readable labels
 * verbatim — including the non-standard "Middle East, North Africa,
 * Afghanistan & Pakistan" label which is the World Bank's lending-
 * grouping name for that region.
 */

export type WorldBankRegionKey =
  | "East Asia & Pacific"
  | "Europe & Central Asia"
  | "Latin America & Caribbean"
  | "Middle East, North Africa, Afghanistan & Pakistan"
  | "North America"
  | "South Asia"
  | "Sub-Saharan Africa";

export interface PeerLensValueMeta {
  label: string;
  colorVar: string;
  fallback: string;
  order: number;
}

export const WORLD_BANK_REGION_META: Record<
  WorldBankRegionKey,
  PeerLensValueMeta
> = {
  "East Asia & Pacific": {
    label: "East Asia & Pacific",
    colorVar: "var(--peer-region-eap)",
    fallback: "var(--peer-region-eap)",
    order: 100,
  },
  "Europe & Central Asia": {
    label: "Europe & Central Asia",
    colorVar: "var(--peer-region-eca)",
    fallback: "var(--peer-region-eca)",
    order: 200,
  },
  "Latin America & Caribbean": {
    label: "Latin America & Caribbean",
    colorVar: "var(--peer-region-lac)",
    fallback: "var(--peer-region-lac)",
    order: 300,
  },
  "Middle East, North Africa, Afghanistan & Pakistan": {
    label: "Middle East, North Africa, Afghanistan & Pakistan",
    colorVar: "var(--peer-region-mena)",
    fallback: "var(--peer-region-mena)",
    order: 400,
  },
  "North America": {
    label: "North America",
    colorVar: "var(--peer-region-na)",
    fallback: "var(--peer-region-na)",
    order: 500,
  },
  "South Asia": {
    label: "South Asia",
    colorVar: "var(--peer-region-sa)",
    fallback: "var(--peer-region-sa)",
    order: 600,
  },
  "Sub-Saharan Africa": {
    label: "Sub-Saharan Africa",
    colorVar: "var(--peer-region-ssa)",
    fallback: "var(--peer-region-ssa)",
    order: 700,
  },
};

/* ────────────────────────────────────────────────────────────────
 * World Bank income group (4 tiers)
 * ────────────────────────────────────────────────────────────────
 *
 * Keys match the canonical-fact-layer values written by Phase F's
 * World Bank sync — the upstream sentence-case labels preserved
 * verbatim ("High income" / "Upper middle income" etc.). Distinct
 * CSS tokens from the CI tier ramp to avoid conflating "income tier"
 * with "governance tier" — different domains.
 */

export type WorldBankIncomeGroupKey =
  | "Low income"
  | "Lower middle income"
  | "Upper middle income"
  | "High income";

export const WORLD_BANK_INCOME_GROUP_META: Record<
  WorldBankIncomeGroupKey,
  PeerLensValueMeta
> = {
  "Low income": {
    label: "Low income",
    colorVar: "var(--peer-income-low)",
    fallback: "var(--peer-income-low)",
    order: 100,
  },
  "Lower middle income": {
    label: "Lower middle income",
    colorVar: "var(--peer-income-lower-mid)",
    fallback: "var(--peer-income-lower-mid)",
    order: 200,
  },
  "Upper middle income": {
    label: "Upper middle income",
    colorVar: "var(--peer-income-upper-mid)",
    fallback: "var(--peer-income-upper-mid)",
    order: 300,
  },
  "High income": {
    label: "High income",
    colorVar: "var(--peer-income-high)",
    fallback: "var(--peer-income-high)",
    order: 400,
  },
};

/* ────────────────────────────────────────────────────────────────
 * V-Dem Regimes of the World (4 tiers)
 * ────────────────────────────────────────────────────────────────
 *
 * Lührmann, Tannenberg & Lindberg 2018 four-fold classification.
 * Keys match the canonical-fact-layer values written by Phase F's
 * V-Dem sync ("Closed Autocracy" / "Electoral Autocracy" etc.,
 * Title Case). Tiers map to the existing CI-tier color ramp
 * (failed → exceptional) to maintain visual continuity with Civica
 * Index scoring presentation — readers already associate that ramp
 * with governance quality.
 */

export type VDemRowKey =
  | "Closed Autocracy"
  | "Electoral Autocracy"
  | "Electoral Democracy"
  | "Liberal Democracy";

export const VDEM_ROW_META: Record<VDemRowKey, PeerLensValueMeta> = {
  "Closed Autocracy": {
    label: "Closed Autocracy",
    colorVar: "var(--tier-failed)",
    fallback: "var(--tier-failed)",
    order: 100,
  },
  "Electoral Autocracy": {
    label: "Electoral Autocracy",
    colorVar: "var(--tier-weak)",
    fallback: "var(--tier-weak)",
    order: 200,
  },
  "Electoral Democracy": {
    label: "Electoral Democracy",
    colorVar: "var(--tier-strong)",
    fallback: "var(--tier-strong)",
    order: 300,
  },
  "Liberal Democracy": {
    label: "Liberal Democracy",
    colorVar: "var(--tier-exceptional)",
    fallback: "var(--tier-exceptional)",
    order: 400,
  },
};

/* ────────────────────────────────────────────────────────────────
 * Monarchy status (descriptive metadata, NOT analytical taxonomy)
 * ────────────────────────────────────────────────────────────────
 *
 * 6-value enum from the implementation plan §C-Q2. If Phase F's
 * derivation lands a different vocabulary, this plan adopts theirs
 * (canonical-fact-layer is the authority); update this map to
 * match whatever Phase F.2.1 writes.
 */

export type MonarchyStatusKey =
  | "none"
  | "constitutional"
  | "absolute"
  | "ceremonial"
  | "elective"
  | "theocratic";

export const MONARCHY_STATUS_META: Record<
  MonarchyStatusKey,
  PeerLensValueMeta
> = {
  none: {
    label: "No monarchy",
    colorVar: "var(--gov-other)",
    fallback: "var(--gov-other)",
    order: 100,
  },
  constitutional: {
    label: "Constitutional monarchy",
    colorVar: "var(--gov-mon)",
    fallback: "var(--gov-mon)",
    order: 200,
  },
  ceremonial: {
    label: "Ceremonial monarchy",
    colorVar: "var(--gov-mon)",
    fallback: "var(--gov-mon)",
    order: 300,
  },
  elective: {
    label: "Elective monarchy",
    colorVar: "var(--gov-mon)",
    fallback: "var(--gov-mon)",
    order: 400,
  },
  absolute: {
    label: "Absolute monarchy",
    colorVar: "var(--gov-abs)",
    fallback: "var(--gov-abs)",
    order: 500,
  },
  theocratic: {
    label: "Theocratic monarchy",
    colorVar: "var(--gov-theo)",
    fallback: "var(--gov-theo)",
    order: 600,
  },
};

/* ────────────────────────────────────────────────────────────────
 * Re-export Bjørnskov-Rode / CGV metadata
 * ────────────────────────────────────────────────────────────────
 *
 * Already defined in src/lib/government-taxonomy. Re-exported here
 * so all peer-lens metadata is available from a single import.
 */

export {
  REGIME_TYPE_META as CGV_REGIME_TYPE_META,
  type RegimeTypeKey as CGVRegimeTypeKey,
};

/* ────────────────────────────────────────────────────────────────
 * Lens identifiers + dispatch helpers
 * ────────────────────────────────────────────────────────────────
 */

export type PeerLensName =
  | "world_bank_region"
  | "world_bank_income_group"
  | "vdem_row"
  | "cgv_regime"
  | "monarchy_status";

export const PEER_LENS_DISPLAY_NAME: Record<PeerLensName, string> = {
  world_bank_region: "World Bank region",
  world_bank_income_group: "World Bank income group",
  vdem_row: "V-Dem Regimes of the World",
  cgv_regime: "Bjørnskov-Rode / CGV regime",
  monarchy_status: "Monarchy status",
};

export const PEER_LENS_SOURCE_ID: Record<PeerLensName, string> = {
  world_bank_region: "world_bank",
  world_bank_income_group: "world_bank",
  vdem_row: "vdem",
  cgv_regime: "bjornskov_rode",
  monarchy_status: "cia_factbook",
};

/**
 * Resolve a (lens, raw value string) pair to the lens-meta record.
 * Tolerant of unknown values — returns `null` so callers can render
 * an "Unclassified" fallback rather than crash on a Phase F vocabulary
 * drift.
 */
export function getPeerLensValueMeta(
  lens: PeerLensName,
  value: string | null | undefined,
): PeerLensValueMeta | RegimeTypeMeta | null {
  if (value == null) return null;
  switch (lens) {
    case "world_bank_region":
      return (
        WORLD_BANK_REGION_META[value as WorldBankRegionKey] ?? null
      );
    case "world_bank_income_group":
      return (
        WORLD_BANK_INCOME_GROUP_META[value as WorldBankIncomeGroupKey] ?? null
      );
    case "vdem_row":
      return VDEM_ROW_META[value as VDemRowKey] ?? null;
    case "cgv_regime":
      return REGIME_TYPE_META[value as RegimeTypeKey] ?? null;
    case "monarchy_status":
      return MONARCHY_STATUS_META[value as MonarchyStatusKey] ?? null;
  }
}
