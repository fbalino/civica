/*
 * Dev Design Mode — controllable token registry.
 *
 * Source of truth for the live token editor at <DevDesignPanel>. Every
 * entry maps a CSS custom property defined in `src/app/globals.css` (or
 * `src/app/atlas.css`) to a default value and an editor type so the
 * panel can render the right control.
 *
 * Defaults below MUST match the v2 light values in globals.css. When
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
      ft("--font-heading", "Heading family", 'var(--font-fraunces), "Georgia", "Times New Roman", serif'),
      ft("--font-body", "Body family", 'var(--font-inter), -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'),
      ft("--font-mono", "Mono family", 'ui-monospace, "SF Mono", Menlo, monospace'),
      sz("--text-9",  "text-9",  "12px"),
      sz("--text-10", "text-10", "12px"),
      sz("--text-11", "text-11", "12px"),
      sz("--text-12", "text-12", "13px"),
      sz("--text-13", "text-13", "14px"),
      sz("--text-14", "text-14", "15px"),
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
      c("--color-bg",                "Page bg (Parchment)",  "#FAF7F2"),
      c("--color-surface-elevated",  "Surface (Canvas)",     "#FFFCF8"),
      c("--color-select-bg",         "Surface alt",          "#F2F4F7"),
      c("--color-text-primary",      "Text primary (Ink)",   "#0B1220"),
      c("--color-text-60",           "Text-60 (Slate)",      "#334155"),
      c("--color-text-50",           "Text-50",              "#475569"),
      c("--color-text-40",           "Text-40 (Stone)",      "#64748B"),
      c("--color-text-30",           "Text-30 (Pewter)",     "#94A3B8"),
      c("--color-divider",           "Divider",              "#E4E7EC"),
      c("--color-stat-border",       "Stat border",          "#ECEFF3"),
      c("--color-card-bg",           "Card bg",              "#FFFCF8"),
      c("--color-card-border",       "Card border",          "#E4E7EC"),
      c("--color-card-hover-bg",     "Card hover bg",        "#F6F2EB"),
      c("--color-card-hover-border", "Card hover border",    "#94A3B8"),
      c("--color-tooltip-bg",        "Tooltip bg",           "#FFFCF8"),
      c("--color-tooltip-text",      "Tooltip text",         "#334155"),
      c("--color-tooltip-border",    "Tooltip border",       "#E4E7EC"),
      c("--color-grid-bg",           "Grid bg",              "#FFFCF8"),
      c("--color-grid-cell",         "Grid cell",            "#FAF7F2"),
      c("--color-grid-cell-hover",   "Grid cell hover",      "#F2F4F7"),
      c("--color-grid-row-hover",    "Grid row hover",       "#F6F2EB"),
    ],
  },
  {
    id: "accent",
    title: "Accent",
    tokens: [
      c("--color-accent", "Accent (Bronze)", "#A87241"),
    ],
  },
  {
    id: "signal",
    title: "Signal colors",
    tokens: [
      c("--color-success", "Success",  "#2E7D59"),
      c("--color-warn",    "Warning",  "#E0A800"),
      c("--color-danger",  "Danger",   "#C62828"),
      c("--color-info",    "Info",     "#1565C0"),
    ],
  },
  {
    id: "tier",
    title: "Civica Index tier ramp",
    tokens: [
      c("--tier-exceptional", "Exceptional (Deep Teal)", "#0B3D4E"),
      c("--tier-strong",      "Strong (Sage)",           "#6B7566"),
      c("--tier-mixed",       "Mixed (Gold)",            "#C9A24B"),
      c("--tier-weak",        "Weak (Bronze)",           "#A87241"),
      c("--tier-failed",      "Failed (Terracotta)",     "#C25D3A"),
    ],
  },
  {
    id: "indicator-ramp",
    title: "Indicator ramp (choropleth)",
    tokens: [
      c("--ramp-indicator-1", "Indicator 1 (warm sand)",  "#EDE4D5"),
      c("--ramp-indicator-2", "Indicator 2 (cool grey)",  "#D2D6DC"),
      c("--ramp-indicator-3", "Indicator 3 (light blue)", "#ACC1D2"),
      c("--ramp-indicator-4", "Indicator 4 (mid steel)",  "#6086A8"),
      c("--ramp-indicator-5", "Indicator 5 (deep navy)",  "#1A4970"),
      c("--ramp-no-data",     "No data",                  "#E6E1D4"),
    ],
  },
  {
    id: "gov",
    title: "Government type palette",
    tokens: [
      c("--gov-parl",  "Parliamentary (Azure)",   "#2D6CDF"),
      c("--gov-pres",  "Presidential (Terracotta)","#C25D3A"),
      c("--gov-semi",  "Semi-presidential (Violet)","#7C59C9"),
      c("--gov-mon",   "Monarchy (Gold)",         "#C9A24B"),
      c("--gov-abs",   "Absolutism (Rose)",       "#CC4C7A"),
      c("--gov-theo",  "Theocracy (Leaf)",        "#4C9F6E"),
      c("--gov-one",   "One-party (Slate)",       "#334155"),
      c("--gov-mil",   "Military (Charcoal)",     "#1F2937"),
      c("--gov-other", "Other (Stone)",           "#64748B"),
    ],
  },
  {
    id: "branch",
    title: "Government branch palette",
    tokens: [
      c("--color-branch-executive",   "Executive",   "#C25D3A"),
      c("--color-branch-legislative", "Legislative", "#2D6CDF"),
      c("--color-branch-judicial",    "Judicial",    "#6B7566"),
      c("--color-branch-monarchy",    "Monarchy",    "#7C59C9"),
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
      c("--color-source-live",   "Live (Success)",   "#2E7D59"),
      c("--color-source-frozen", "Frozen (Warning)", "#E0A800"),
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
      sz("--radius-sm", "radius-sm", "6px"),
      sz("--radius-md", "radius-md", "10px"),
      sz("--radius-lg", "radius-lg", "14px"),
      sz("--radius-xl", "radius-xl", "20px"),
    ],
  },
  {
    id: "shadows",
    title: "Shadows",
    tokens: [
      sh("--shadow-hard",    "shadow-hard",    "0 1px 2px rgba(11, 18, 32, 0.04), 0 8px 18px rgba(11, 18, 32, 0.07)"),
      sh("--shadow-hard-sm", "shadow-hard-sm", "0 1px 2px rgba(11, 18, 32, 0.05)"),
      sh("--shadow-hard-md", "shadow-hard-md", "0 1px 2px rgba(11, 18, 32, 0.04), 0 4px 10px rgba(11, 18, 32, 0.05)"),
      sh("--shadow-hard-lg", "shadow-hard-lg", "0 1px 2px rgba(11, 18, 32, 0.04), 0 12px 28px rgba(11, 18, 32, 0.08)"),
      sh("--shadow-dark",    "shadow-dark",    "0 4px 12px rgba(11, 18, 32, 0.10)"),
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
