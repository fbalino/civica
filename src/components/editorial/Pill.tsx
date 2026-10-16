import type { ReactNode } from "react";

/*
 * Chip (component spec v1 §2) — tinted, fully rounded, SANS, MIXED-CASE.
 *
 * Replaces the old mono/uppercase Pill entirely. One component now backs every
 * filter chip, status pill, income/tier tag, AND the Beta tag. Never uppercase,
 * never mono.
 *
 * Tonal recipe (per spec): a subtle wash on the paper bg, a same-hue low-alpha
 * border, and role-text foreground for AA contrast. Computed with
 * color-mix(in oklab, …) so every tone stays theme-safe (light + dark inherit
 * the same tokens). On white card surfaces the same recipe reads fine.
 *
 *   background: color-mix(in oklab, <hue> 16%, var(--color-page-bg))
 *   border:     1px solid color-mix(in oklab, <hue> 32%, transparent)
 *   color:      var(--color-text-primary)
 *
 * `neutral` is the one exception: it uses the explicit hairline/page tokens
 * rather than a tint, matching the spec's default chip.
 *
 * Styling lives in CSS classes (`.ui-chip*` in src/app/editorial.css), never in
 * inline style objects.
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
  /** Extra class names (layout modifiers such as `ui-chip--heading-inline`). */
  className?: string;
  /** Accessible label, forwarded to the rendered element. */
  "aria-label"?: string;
  /** Native tooltip, forwarded to the rendered element. */
  title?: string;
}

/**
 * Class names are the whole styling contract: `.ui-chip` plus a tone modifier
 * and, for the medium size, `.ui-chip--md` (all in editorial.css). No inline
 * style is emitted, so repeated chips cost a short class string instead of a
 * style object in every page's HTML and React payload.
 */
export function Chip({
  children,
  variant = "neutral",
  size = "sm",
  className,
  "aria-label": ariaLabel,
  title,
}: ChipProps) {
  const tone = VARIANT_TONE[variant];
  const classes = ["ui-chip", `ui-chip--${tone}`];
  if (size === "md") classes.push("ui-chip--md");
  if (className) classes.push(className);
  return (
    <span className={classes.join(" ")} aria-label={ariaLabel} title={title}>
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
