/**
 * Atlas map choropleth LAYER SWITCHER definitions (Wave 6).
 *
 * The /atlas world map can color countries by one of two publisher-native
 * categorical layers. This module is the single source of truth for:
 *   - the valid layer keys + URL-param validation
 *   - each layer's fill color per country (design-token only)
 *   - each layer's legend classes (swatch + label)
 *   - the human-readable value shown in the hover tooltip
 *
 * Color-token mapping (all tokens exist in BOTH light + dark themes):
 *   - regime    → `VDEM_ROW_META[value].colorVar` → `--tier-*` family
 *     (already the documented tone for V-Dem RoW in lens-metadata.ts).
 *   - income    → `WORLD_BANK_INCOME_GROUP_META[value].colorVar` →
 *     `--peer-income-*` (the canonical income palette used sitewide).
 * Countries with no value for the active layer fall back to `--ramp-no-data`
 * (a neutral fill, distinct in both themes) and a "No data" legend row —
 * never a wrong category.
 */

import {
  VDEM_ROW_META,
  WORLD_BANK_INCOME_GROUP_META,
  type VDemRowKey,
  type WorldBankIncomeGroupKey,
} from "@/lib/peer-grouping/lens-metadata";
import type { Country } from "@/components/atlas/data";
import type { AtlasLayerValues } from "@/lib/atlas/load-atlas-data";

export const NO_DATA_FILL = "var(--ramp-no-data)";
export const NO_DATA_LABEL = "No data";

/**
 * The map is deliberately limited to publisher-native categorical variables.
 * Civica Index and Pulse do not appear here, and the former government
 * classifier has been retired from this switcher because it was a Civica
 * grouping rather than an upstream variable.
 */
export type AtlasLayerKey = "regime" | "income";

export const ATLAS_LAYER_KEYS: readonly AtlasLayerKey[] = [
  "regime",
  "income",
];

export const DEFAULT_LAYER: AtlasLayerKey = "regime";

/** SegmentedControl options (short labels for the compact control). */
export const ATLAS_LAYER_OPTIONS: ReadonlyArray<{
  value: AtlasLayerKey;
  label: string;
}> = [
  { value: "regime", label: "Regime (V-Dem)" },
  { value: "income", label: "Income (World Bank)" },
];

/** Legend / eyebrow title for each layer. */
export const ATLAS_LAYER_TITLE: Record<AtlasLayerKey, string> = {
  regime: "Regime type (V-Dem)",
  income: "Income group (World Bank)",
};

/** Plain-language definitions displayed with both the map and table. */
export const ATLAS_LAYER_DESCRIPTION: Record<AtlasLayerKey, string> = {
  regime:
    "V-Dem Regimes of the World is a categorical source variable. It is not a Civica score, country ranking, or verdict.",
  income:
    "World Bank income group is a categorical source variable. It is not ordered as a governance ranking or Civica score.",
};

export const ATLAS_LAYER_MISSINGNESS: Record<AtlasLayerKey, string> = {
  regime:
    "No data means no active V-Dem regime observation is retained for that map-eligible country; it does not assign a regime category.",
  income:
    "No data means no active World Bank income-group observation is retained for that map-eligible country; it does not assign an income group.",
};

/** Validate + normalize an arbitrary `?layer=` param. */
export function parseLayerParam(raw: string | null | undefined): AtlasLayerKey {
  return ATLAS_LAYER_KEYS.includes(raw as AtlasLayerKey)
    ? (raw as AtlasLayerKey)
    : DEFAULT_LAYER;
}

export interface LegendEntry {
  label: string;
  fill: string;
}

/**
 * Legend rows for a layer, in display order. The final "No data" row is
 * appended by the caller only when at least one country lacks a value — but
 * we keep it out of here so the legend list can decide.
 */
export function legendFor(layer: AtlasLayerKey): LegendEntry[] {
  switch (layer) {
    case "regime":
      return (Object.keys(VDEM_ROW_META) as VDemRowKey[])
        .sort((a, b) => VDEM_ROW_META[a].order - VDEM_ROW_META[b].order)
        .map((k) => ({
          label: VDEM_ROW_META[k].label,
          fill: VDEM_ROW_META[k].colorVar,
        }));
    case "income":
      return (Object.keys(WORLD_BANK_INCOME_GROUP_META) as WorldBankIncomeGroupKey[])
        .sort(
          (a, b) =>
            WORLD_BANK_INCOME_GROUP_META[a].order -
            WORLD_BANK_INCOME_GROUP_META[b].order
        )
        .map((k) => ({
          label: WORLD_BANK_INCOME_GROUP_META[k].label,
          fill: WORLD_BANK_INCOME_GROUP_META[k].colorVar,
        }));
  }
}

/** Resolve the choropleth fill for one country under the active layer. */
export function fillForLayer(
  layer: AtlasLayerKey,
  country: Country | null | undefined,
  values: AtlasLayerValues | undefined
): string {
  if (!country) return NO_DATA_FILL;
  switch (layer) {
    case "regime": {
      const v = values?.regimeType;
      const meta = v ? VDEM_ROW_META[v as VDemRowKey] : undefined;
      return meta ? meta.colorVar : NO_DATA_FILL;
    }
    case "income": {
      const v = values?.incomeGroup;
      const meta = v
        ? WORLD_BANK_INCOME_GROUP_META[v as WorldBankIncomeGroupKey]
        : undefined;
      return meta ? meta.colorVar : NO_DATA_FILL;
    }
  }
}

/** Human-readable value of the active layer for the hover tooltip. */
export function tooltipValueForLayer(
  layer: AtlasLayerKey,
  country: Country | null | undefined,
  values: AtlasLayerValues | undefined
): string {
  if (!country) return NO_DATA_LABEL;
  switch (layer) {
    case "regime":
      return values?.regimeType ?? NO_DATA_LABEL;
    case "income":
      return values?.incomeGroup ?? NO_DATA_LABEL;
  }
}
