/*
 * Dev Design Mode — controllable token registry.
 *
 * Source of truth for the live token editor at <DevDesignPanel>. Every
 * entry maps a CSS custom property defined in `src/app/globals.css` (or
 * `src/app/atlas.css`) to a default value and an editor type so the
 * panel can render the right control.
 *
 * Defaults below MUST match the almanac light values in globals.css. When
 * globals.css changes, mirror the change here so the "Reset all"
 * button restores the actual current spec.
 */

export type DevTokenType =
  | "color"   // hex color → color picker + hex field
  | "size"    // px value → number + unit
  | "font"    // CSS font stack → text input
  | "weight"  // 100..900 → number stepper
  | "shadow"  // box-shadow string → multi-line text
  | "raw";    // free-form CSS value → text input

export type DevToken = {
  cssVar: string;
  label: string;
  type: DevTokenType;
  defaultValue: string;
  /** Optional hint shown next to the row. */
  hint?: string;
};

export type DevTokenGroup = {
  id: string;
  title: string;
  tokens: DevToken[];
};

/** Helper for color rows — keeps each block tight. */
const c = (cssVar: string, label: string, defaultValue: string, hint?: string): DevToken =>
  ({ cssVar, label, type: "color", defaultValue, hint });

const sz = (cssVar: string, label: string, defaultValue: string): DevToken =>
  ({ cssVar, label, type: "size", defaultValue });

const ft = (cssVar: string, label: string, defaultValue: string): DevToken =>
  ({ cssVar, label, type: "font", defaultValue });

const sh = (cssVar: string, label: string, defaultValue: string): DevToken =>
  ({ cssVar, label, type: "shadow", defaultValue });

const r = (cssVar: string, label: string, defaultValue: string): DevToken =>
  ({ cssVar, label, type: "raw", defaultValue });

export const DEV_TOKEN_GROUPS: DevTokenGroup[] = [
  {
    id: "typography",
    title: "Typography",
    tokens: [
      ft("--font-heading", "Heading family", 'var(--font-source-serif), "Georgia", "Times New Roman", serif'),
      ft("--font-body", "Body family", 'var(--font-inter), -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'),
      ft("--font-mono", "Mono family", 'ui-monospace, "SF Mono", Menlo, monospace'),
      sz("--text-12", "text-12", "12px"),
      sz("--text-13", "text-13", "13px"),
      sz("--text-14", "text-14", "14px"),
      sz("--text-15", "text-15", "15px"),
      sz("--text-16", "text-16", "16px"),
      sz("--text-18", "text-18", "18px"),
      sz("--text-20", "text-20", "20px"),
      sz("--text-22", "text-22", "22px"),
      sz("--text-24", "text-24", "24px"),
      sz("--text-26", "text-26", "26px"),
      sz("--text-28", "text-28", "28px"),
      sz("--text-32", "text-32", "32px"),
      sz("--text-36", "text-36", "36px"),
      sz("--text-40", "text-40", "40px"),
      sz("--text-44", "text-44", "44px"),
      sz("--text-48", "text-48", "48px"),
      sz("--text-52", "text-52", "52px"),
      sz("--text-56", "text-56", "56px"),
      sz("--text-64", "text-64", "64px"),
      r("--font-weight-regular",  "weight-regular",  "400"),
      r("--font-weight-medium",   "weight-medium",   "500"),
      r("--font-weight-semibold", "weight-semibold", "600"),
      r("--font-weight-bold",     "weight-bold",     "700"),
      r("--leading-tight",   "leading-tight",   "1.05"),
      r("--leading-snug",    "leading-snug",    "1.1"),
      r("--leading-normal",  "leading-normal",  "1.65"),
      r("--leading-relaxed", "leading-relaxed", "1.7"),
      r("--leading-loose",   "leading-loose",   "1.75"),
      r("--tracking-tighter", "tracking-tighter", "-0.04em"),
      r("--tracking-tight",   "tracking-tight",   "-0.03em"),
      r("--tracking-snug",    "tracking-snug",    "-0.02em"),
      r("--tracking-wide",    "tracking-wide",    "0.03em"),
      r("--tracking-wider",   "tracking-wider",   "0.08em"),
      r("--tracking-caps",    "tracking-caps",    "0.15em"),
    ],
  },
  {
    id: "surface",
    title: "Surface palette",
    tokens: [
      c("--color-bg",                "Page bg (Ivory)",        "#FAF7F2"),
      c("--color-surface-elevated",  "Surface (Canvas)",       "#FFFFFF"),
      c("--color-select-bg",         "Surface alt",            "#F3EFE6"),
      c("--color-text-primary",      "Text primary (Ink navy)","#0B1B2D"),
      c("--color-text-60",           "Text-60 (Slate)",        "#2A3648"),
      c("--color-text-50",           "Text-50",                "#44505F"),
      c("--color-text-40",           "Text-40 (Steel)",        "#6A7688"),
      c("--color-text-30",           "Text-30 (Mist)",         "#A7AFBC"),
      c("--color-divider",           "Divider",                "#E4E1DC"),
      c("--color-stat-border",       "Stat border",            "#EDE9E2"),
      c("--color-card-bg",           "Card bg",                "#FFFFFF"),
      c("--color-card-border",       "Card border",            "#E4E1DC"),
      c("--color-card-hover-bg",     "Card hover bg",          "#F6F2EA"),
      c("--color-card-hover-border", "Card hover border",      "#D2CEC5"),
      c("--color-tooltip-bg",        "Tooltip bg",             "#FFFFFF"),
      c("--color-tooltip-text",      "Tooltip text",           "#2A3648"),
      c("--color-tooltip-border",    "Tooltip border",         "#E4E1DC"),
      c("--color-grid-bg",           "Grid bg",                "#FFFFFF"),
      c("--color-grid-cell",         "Grid cell",              "#FAF7F2"),
      c("--color-grid-cell-hover",   "Grid cell hover",        "#F3EFE6"),
      c("--color-grid-row-hover",    "Grid row hover",         "#F6F2EA"),
    ],
  },
  {
    id: "accent",
    title: "Accent",
    tokens: [
      c("--color-accent", "Accent (Terracotta)", "#B7512B"),
    ],
  },
  {
    id: "signal",
    title: "Signal colors",
    tokens: [
      c("--color-success", "Success",  "#2E7D55"),
      c("--color-warn",    "Warning",  "#C08F3E"),
      c("--color-danger",  "Danger",   "#B71413"),
      c("--color-info",    "Info",     "#1C5BC3"),
    ],
  },
  {
    id: "tier",
    title: "Civica Index tier ramp",
    tokens: [
      c("--tier-exceptional", "Exceptional (Deep Teal)", "#0B4250"),
      c("--tier-strong",      "Strong (Green)",          "#2E7D55"),
      c("--tier-mixed",       "Mixed (Gold)",            "#C08F3E"),
      c("--tier-weak",        "Weak (Ochre)",            "#BD7A4A"),
      c("--tier-failed",      "Failed (Terracotta)",     "#B7512B"),
    ],
  },
  {
    id: "indicator-ramp",
    title: "Indicator ramp (choropleth)",
    tokens: [
      c("--ramp-indicator-1", "Indicator 1 (light blue)", "#D3E0F0"),
      c("--ramp-indicator-2", "Indicator 2",              "#B0CAE3"),
      c("--ramp-indicator-3", "Indicator 3",              "#6686A0"),
      c("--ramp-indicator-4", "Indicator 4",              "#41688A"),
      c("--ramp-indicator-5", "Indicator 5 (deep navy)",  "#1C4A75"),
      c("--ramp-no-data",     "No data",                  "#E6DED4"),
    ],
  },
  {
    id: "gov",
    title: "Government type palette",
    tokens: [
      c("--gov-parl",  "Parliamentary (Azure)",    "#1C5BC3"),
      c("--gov-pres",  "Presidential (Terracotta)","#B7512B"),
      c("--gov-semi",  "Semi-presidential (Violet)","#6749AB"),
      c("--gov-mon",   "Monarchy (Gold)",          "#C08F3E"),
      c("--gov-abs",   "Absolutism (Rose)",        "#B93D67"),
      c("--gov-theo",  "Theocracy (Leaf)",         "#418460"),
      c("--gov-one",   "One-party (Indigo)",       "#4D4C71"),
      c("--gov-mil",   "Military (Slate)",         "#2A3648"),
      c("--gov-other", "Other (Steel)",            "#6A7688"),
    ],
  },
  {
    id: "branch",
    title: "Government branch palette",
    tokens: [
      c("--color-branch-executive",   "Executive",      "#B7512B"),
      c("--color-branch-legislative", "Legislative",    "#1C5BC3"),
      c("--color-branch-judicial",    "Judicial (Sage)","#686F5F"),
      c("--color-branch-monarchy",    "Monarchy",       "#6749AB"),
    ],
  },
  {
    id: "peer",
    title: "Peer-grouping lenses",
    tokens: [
      c("--peer-region-eap",       "Region · EAP",       "#2D6CDF"),
      c("--peer-region-eca",       "Region · ECA",       "#6086A8"),
      c("--peer-region-lac",       "Region · LAC",       "#C25D3A"),
      c("--peer-region-mena",      "Region · MENA",      "#C9A24B"),
      c("--peer-region-na",        "Region · NA",        "#4FA3D9"),
      c("--peer-region-sa",        "Region · SA",        "#7C59C9"),
      c("--peer-region-ssa",       "Region · SSA",       "#4C9F6E"),
      c("--peer-income-low",       "Income · Low",       "#C25D3A"),
      c("--peer-income-lower-mid", "Income · Lower-mid", "#C9A24B"),
      c("--peer-income-upper-mid", "Income · Upper-mid", "#6B7566"),
      c("--peer-income-high",      "Income · High",      "#1A4970"),
    ],
  },
  {
    id: "source",
    title: "Source provenance",
    tokens: [
      c("--color-source-live",   "Live (Success)",   "#2E7D55"),
      c("--color-source-frozen", "Frozen (Warning)", "#C08F3E"),
    ],
  },
  {
    id: "atlas",
    title: "Atlas map",
    tokens: [
      c("--atlas-rule",          "Rule",          "#E4E7EC"),
      c("--atlas-rule-2",        "Rule 2",        "#ECEFF3"),
      c("--atlas-ocean",         "Ocean",         "#F2F4F7"),
      c("--atlas-land",          "Land",          "#D2D6DC"),
      c("--atlas-land-dim",      "Land dim",      "#ACC1D2"),
      c("--atlas-land-hover",    "Land hover",    "#0B1220"),
      c("--atlas-land-selected", "Land selected", "#1A4970"),
      c("--atlas-accent-soft",   "Accent soft",   "#F4EAE0"),
    ],
  },
  {
    id: "spacing",
    title: "Spacing",
    tokens: [
      sz("--space-1", "space-1", "2px"),
      sz("--space-2", "space-2", "4px"),
      sz("--space-3", "space-3", "8px"),
      sz("--space-4", "space-4", "12px"),
      sz("--space-5", "space-5", "16px"),
      sz("--space-6", "space-6", "24px"),
      sz("--space-7", "space-7", "32px"),
      sz("--space-8", "space-8", "48px"),
      sz("--space-9", "space-9", "64px"),
      sz("--spacing-page-x",      "Page padding X",     "40px"),
      sz("--spacing-section-y",   "Section padding Y",  "60px"),
      sz("--spacing-content-top", "Content top",        "32px"),
      sz("--spacing-hero-top",    "Hero top",           "100px"),
    ],
  },
  {
    id: "radii",
    title: "Radii",
    tokens: [
      sz("--radius-sm", "radius-sm", "4px"),
      sz("--radius-md", "radius-md", "8px"),
      sz("--radius-lg", "radius-lg", "12px"),
      sz("--radius-xl", "radius-xl", "16px"),
      sz("--radius-2xl", "radius-2xl", "24px"),
      sz("--radius-full", "radius-full", "9999px"),
      sz("--radius-control", "radius-control", "9999px"),
      sz("--radius-chip", "radius-chip", "9999px"),
      sz("--radius-search", "radius-search", "9999px"),
    ],
  },
  {
    id: "shadows",
    title: "Shadows",
    tokens: [
      sh("--shadow-hard",    "shadow-hard",    "0 1px 2px rgba(15, 23, 42, 0.06)"),
      sh("--shadow-hard-sm", "shadow-hard-sm", "0 1px 2px rgba(15, 23, 42, 0.05)"),
      sh("--shadow-hard-md", "shadow-hard-md", "0 2px 6px rgba(15, 23, 42, 0.08)"),
      sh("--shadow-hard-lg", "shadow-hard-lg", "0 4px 12px rgba(15, 23, 42, 0.10)"),
      sh("--shadow-dark",    "shadow-dark",    "0 4px 16px rgba(15, 23, 42, 0.16)"),
    ],
  },
  {
    id: "motion",
    title: "Motion",
    tokens: [
      r("--motion-fast",   "motion-fast",   "120ms"),
      r("--motion-base",   "motion-base",   "180ms"),
      r("--motion-slow",   "motion-slow",   "300ms"),
      r("--motion-slower", "motion-slower", "500ms"),
    ],
  },
];

/** Flat lookup of every token by cssVar. */
export const DEV_TOKEN_BY_VAR: Record<string, DevToken> = Object.fromEntries(
  DEV_TOKEN_GROUPS.flatMap((g) => g.tokens.map((t) => [t.cssVar, t])),
);

export const DEV_TOKEN_STORAGE_KEY = "civica-dev-tokens";
