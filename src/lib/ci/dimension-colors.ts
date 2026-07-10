/**
 * dimension-colors — the single source of truth for the fixed, per-dimension
 * color assigned to each of the six Civica Index governance/outcome
 * dimensions. Every surface that draws a dimension as ITS OWN colored series
 * (the long-run indicator trend chart, and future multi-series widgets) reads
 * from here so a dimension's established color is consistent site-wide.
 *
 * Colors are design-system tokens ONLY (no hex): the four headline governance
 * dimensions inherit the established methodology-page palette
 * (src/app/(reader)/civica-index/methodology/page.tsx → DIMENSION_PRESENTATION);
 * the two remaining dimensions reuse existing tokens that are otherwise unused
 * in that palette, so all six stay visually distinct.
 *
 * The CI dimension bar breakdown also uses these fixed identity colors. Color
 * therefore means "which source dimension," never a qualitative judgment
 * about a country's numeric estimate.
 */

import type { CIDimension } from "./types";

export interface DimensionColorMeta {
  /** Human label for legends/toggles. */
  label: string;
  /** Design-token CSS var — the dimension's established series color. */
  colorVar: string;
}

export const DIMENSION_COLORS: Record<CIDimension, DimensionColorMeta> = {
  // Headline governance dimensions — established methodology palette.
  democratic_quality: {
    label: "Democratic Quality",
    colorVar: "var(--tier-exceptional)", // Deep Teal
  },
  rule_of_law: {
    label: "Rule of Law",
    colorVar: "var(--tier-strong)", // Green
  },
  freedom_rights: {
    label: "Freedoms & Rights",
    colorVar: "var(--color-accent)", // Terracotta
  },
  corruption_control: {
    label: "Corruption Control",
    colorVar: "var(--tier-weak)", // Ochre
  },
  // Remaining dimensions — distinct existing tokens.
  human_development: {
    label: "Human Development",
    colorVar: "var(--tier-mixed)", // Gold
  },
  stability_security: {
    label: "Stability & Security",
    colorVar: "var(--gov-semi)", // Violet
  },
};

export function dimensionColorVar(dimension: string): string {
  return (
    DIMENSION_COLORS[dimension as CIDimension]?.colorVar ??
    "var(--color-text-primary)"
  );
}

export function dimensionLabel(dimension: string): string {
  return (
    DIMENSION_COLORS[dimension as CIDimension]?.label ??
    dimension.replaceAll("_", " ")
  );
}
