import type { ReactNode } from "react";

/*
 * Chip (component spec v1 §2) — tinted, rounded, SANS, MIXED-CASE.
 *
 * Replaces the old mono/uppercase Pill entirely. One component now backs every
 * filter chip, status pill, income/tier tag, AND the Beta tag. Never uppercase,
 * never mono.
 *
 * Tonal recipe (per spec): a subtle wash on the paper bg, a same-hue low-alpha
 * border, and darkened-hue text for AA contrast. Computed with
 * color-mix(in oklab, …) so every tone stays theme-safe (light + dark inherit
 * the same tokens). On white card surfaces the same recipe reads fine.
 *
 *   background: color-mix(in oklab, <hue> 16%, var(--color-page-bg))
 *   border:     1px solid color-mix(in oklab, <hue> 32%, transparent)
 *   color:      color-mix(in oklab, <hue>, black 32%)
 *
 * `neutral` is the one exception: it uses the explicit hairline/page tokens
 * rather than a tint, matching the spec's default chip.
 */

/** Canonical tonal variants from the spec. */
type ChipTone = "neutral" | "sage" | "sand" | "rose" | "blue" | "accent";

/**
 * Legacy Pill variants kept as a thin alias so existing
 * `<Pill variant="success" />` call-sites keep working. Mapped onto the
 * tonal set below.
 */
type LegacyVariant = "default" | "accent" | "success" | "warn" | "danger" | "info";

type ChipVariant = ChipTone | LegacyVariant;
type ChipSize = "sm" | "md";

/** Map every accepted variant name onto the hue token that drives the tint. */
const TONE_HUE: Record<ChipTone, string | null> = {
  // neutral has no single hue — handled explicitly below.
  neutral: null,
  sage: "var(--color-status-success)",
  sand: "var(--color-status-warning)",
  rose: "var(--color-status-danger)",
  blue: "var(--color-status-info)",
  accent: "var(--color-accent)",
};

/** Normalise legacy variant names to canonical tones. */
const VARIANT_TONE: Record<ChipVariant, ChipTone> = {
  // canonical tones map to themselves
  neutral: "neutral",
  sage: "sage",
  sand: "sand",
  rose: "rose",
  blue: "blue",
  accent: "accent",
  // legacy aliases
  default: "neutral",
  success: "sage",
  warn: "sand",
  danger: "rose",
  info: "blue",
};

interface ChipProps {
  children: ReactNode;
  variant?: ChipVariant;
  size?: ChipSize;
  className?: string;
}

function chipStyle(tone: ChipTone, size: ChipSize) {
  const base = {
    display: "inline-flex",
    alignItems: "center",
    borderRadius: "var(--radius-sm)",
    padding: size === "sm" ? "3px 9px" : "4px 11px",
    fontFamily: "var(--font-body)",
    fontSize: size === "sm" ? "var(--text-12)" : "var(--text-13)",
    fontWeight: 500,
    letterSpacing: 0,
    textTransform: "none" as const,
    whiteSpace: "nowrap" as const,
  };

  if (tone === "neutral") {
    return {
      ...base,
      background: "var(--color-page-bg)",
      border: "1px solid var(--color-card-border)",
      color: "var(--color-text-60)",
    };
  }

  const hue = TONE_HUE[tone]!;
  return {
    ...base,
    background: `color-mix(in oklab, ${hue} 16%, var(--color-page-bg))`,
    border: `1px solid color-mix(in oklab, ${hue} 32%, transparent)`,
    color: `color-mix(in oklab, ${hue}, black 32%)`,
  };
}

/** The Chip — canonical export. */
export function Chip({
  children,
  variant = "neutral",
  size = "sm",
  className,
}: ChipProps) {
  const tone = VARIANT_TONE[variant];
  return (
    <span className={className} style={chipStyle(tone, size)}>
      {children}
    </span>
  );
}

/**
 * `Pill` — backwards-compatible alias. Existing imports
 * (`import { Pill } from "@/components/editorial/Pill"`) and the legacy variant
 * names keep working; the rendered look is now the new mixed-case sans Chip.
 */
export const Pill = Chip;
