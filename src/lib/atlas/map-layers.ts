/**
 * Atlas map choropleth LAYER SWITCHER definitions (Wave 6).
 *
 * The /atlas world map can color countries by one of four categorical data
 * layers. This module is the single source of truth for:
 *   - the valid layer keys + URL-param validation
 *   - each layer's fill color per country (design-token only)
 *   - each layer's legend classes (swatch + label)
 *   - the human-readable value shown in the hover tooltip
 *
 * Color-token mapping (all tokens exist in BOTH light + dark themes):
 *   - government → `govColor()` (src/lib/data/government-category.ts): the
 *     existing canonical classifier → `--color-gov-*` (+ a couple of literal
 *     hues for communist/military/one-party that predate this feature).
 *   - ci        → neutral sequential-blue numeric bins (`--ramp-indicator-*`),
 *     pinned to methodology_version='beta' upstream. Color encodes magnitude,
 *     not a qualitative country verdict.
 *   - regime    → `VDEM_ROW_META[value].colorVar` → `--tier-*` family
 *     (already the documented tone for V-Dem RoW in lens-metadata.ts).
 *   - income    → `WORLD_BANK_INCOME_GROUP_META[value].colorVar` →
 *     `--peer-income-*` (the canonical income palette used sitewide).
 * Countries with no value for the active layer fall back to `--ramp-no-data`
 * (a neutral fill, distinct in both themes) and a "No data" legend row —
 * never a wrong category.
 */

import { govColor, govLabel } from "@/lib/data/government-category";
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

export type AtlasLayerKey = "government" | "ci" | "regime" | "income";

export const ATLAS_LAYER_KEYS: readonly AtlasLayerKey[] = [
  "government",
  "ci",
  "regime",
  "income",
];

export const DEFAULT_LAYER: AtlasLayerKey = "government";

/** SegmentedControl options (short labels for the compact control). */
export const ATLAS_LAYER_OPTIONS: ReadonlyArray<{
  value: AtlasLayerKey;
  label: string;
}> = [
  { value: "government", label: "Government" },
  { value: "ci", label: "Civica Index" },
  { value: "regime", label: "Regime" },
  { value: "income", label: "Income" },
];

/** Legend / eyebrow title for each layer. */
export const ATLAS_LAYER_TITLE: Record<AtlasLayerKey, string> = {
  government: "Government type",
  ci: "Civica Index score (research beta)",
  regime: "Regime type (V-Dem)",
  income: "Income group (World Bank)",
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

const CI_SCORE_BINS = [
  { min: 80, label: "80–100", fill: "var(--ramp-indicator-5)" },
  { min: 60, label: "60–79", fill: "var(--ramp-indicator-4)" },
  { min: 40, label: "40–59", fill: "var(--ramp-indicator-3)" },
  { min: 20, label: "20–39", fill: "var(--ramp-indicator-2)" },
  { min: 0, label: "0–19", fill: "var(--ramp-indicator-1)" },
] as const;

function ciScoreFill(score: number): string {
  const clamped = Math.max(0, Math.min(100, score));
  return CI_SCORE_BINS.find((bin) => clamped >= bin.min)?.fill ?? NO_DATA_FILL;
}

/**
 * Legend rows for a layer, in display order. The final "No data" row is
 * appended by the caller only when at least one country lacks a value — but
 * we keep it out of here so the legend list can decide.
 */
export function legendFor(layer: AtlasLayerKey): LegendEntry[] {
  switch (layer) {
    case "government":
      // The classifier folds several raw labels into a fixed set of public
      // categories; list the canonical public buckets in a stable order.
      return [
        { label: "Presidential", fill: "var(--color-gov-presidential)" },
        { label: "Parliamentary / Federal", fill: "var(--color-gov-parliamentary)" },
        { label: "Semi-presidential", fill: "var(--color-gov-semi-presidential)" },
        { label: "Constitutional monarchy", fill: "var(--color-gov-parliamentary)" },
        { label: "Absolute monarchy", fill: "var(--color-gov-absolute)" },
        { label: "Theocratic", fill: "var(--color-gov-theocratic)" },
        { label: "Communist", fill: "#E44040" },
        { label: "Military", fill: "#9B6DC6" },
        { label: "One-party", fill: "#C4764E" },
        { label: "Other", fill: "var(--color-gov-other)" },
      ];
    case "ci":
      return CI_SCORE_BINS.map(({ label, fill }) => ({ label, fill }));
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
    case "government":
      // `country.gov` is the CIA display label; classifyGovernment always
      // returns a category (falls back to "Other"), so this is never no-data.
      return govColor(country.govDetail || country.gov);
    case "ci": {
      const score = values?.ciScore;
      if (score == null) return NO_DATA_FILL;
      return ciScoreFill(score);
    }
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
    case "government":
      return govLabel(country.govDetail || country.gov);
    case "ci": {
      const score = values?.ciScore;
      if (score == null) return NO_DATA_LABEL;
      return `${score} / 100 · research beta`;
    }
    case "regime":
      return values?.regimeType ?? NO_DATA_LABEL;
    case "income":
      return values?.incomeGroup ?? NO_DATA_LABEL;
  }
}
