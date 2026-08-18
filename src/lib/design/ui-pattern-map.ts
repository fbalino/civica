/**
 * EXP-002 — the executable map from every live UI pattern to its canonical
 * design-system token, primitive, composition, class, or approved exception.
 *
 * DESIGN.md is the prose specification; this module is the machine-checkable
 * inventory. `validateUiPatternMap()` proves that every canonical binding named
 * here actually exists in the codebase (a referenced token is defined in the
 * token blocks, a primitive file exists, a class is declared in a stylesheet),
 * so the map cannot silently reference a phantom, and that all fourteen
 * required pattern families are covered. Any pattern with no canonical binding
 * must be flagged `unmatched` and name the follow-up task that will canonicalize
 * it — the "unmatched patterns become explicit design-system tasks" clause.
 *
 * This is the doc-concepts pattern (src/lib/docs/doc-concepts.ts) applied to UI
 * patterns, and the source of truth the EXP-028 blind visual audit checks live
 * surfaces against.
 */
import { readFileSync, existsSync } from "node:fs";

/** How a live pattern is satisfied by the design system. */
export type CanonicalKind =
  | "token" // resolves entirely from design tokens
  | "primitive" // a shared React component
  | "composition" // a documented arrangement of primitives/classes
  | "class" // a shared editorial CSS class
  | "approved-exception"; // a deliberate, documented deviation

export interface UiPattern {
  /** Human name of the live pattern. */
  pattern: string;
  kind: CanonicalKind;
  /** `var(--x)` or bare `--x` token names this pattern must resolve from. */
  tokens?: string[];
  /** Repo-relative primitive component files that own this pattern. */
  primitives?: string[];
  /** Shared CSS class names (without the leading dot). */
  classes?: string[];
  /** One-line rationale / canonical reference. */
  note: string;
  /** True when no canonical binding exists yet. */
  unmatched?: boolean;
  /** Required when `unmatched` or `approved-exception`: the task that owns it. */
  followUpTaskId?: string;
}

export interface UiPatternFamily {
  family: string;
  patterns: UiPattern[];
}

/**
 * The fourteen pattern families EXP-002 must cover, verbatim from the task.
 */
export const REQUIRED_FAMILIES = [
  "typography",
  "spacing",
  "colors",
  "elevation",
  "forms",
  "tabs",
  "tables",
  "charts",
  "maps",
  "disclosures",
  "data states",
  "navigation",
  "overlays",
  "editorial layouts",
] as const;

export const UI_PATTERN_MAP: UiPatternFamily[] = [
  {
    family: "typography",
    patterns: [
      {
        pattern: "Display / editorial headings",
        kind: "token",
        tokens: ["--font-heading", "--text-56", "--tracking-tight"],
        note: "Source Serif 4 via --font-heading; canonical H1 is --text-56. --font-serif is a deprecated alias.",
      },
      {
        pattern: "Body / interface text, eyebrows, numeric UI",
        kind: "token",
        tokens: [
          "--font-body",
          "--font-weight-semibold",
          "--tracking-caps",
        ],
        note: "Inter via --font-body. Eyebrows = Inter uppercase + --tracking-caps; aligned numbers = Inter tabular-nums. Never monospace.",
      },
      {
        pattern: "Literal code / API snippets",
        kind: "token",
        tokens: ["--font-code"],
        note: "Monospace via --font-code ONLY for code/curl/endpoint paths. Legacy --font-mono is repointed to Inter as a safety net.",
      },
    ],
  },
  {
    family: "spacing",
    patterns: [
      {
        pattern: "Layout and component spacing",
        kind: "token",
        tokens: ["--space-1", "--space-5", "--space-9"],
        note: "The --space-1..9 scale for all new spacing; no magic-number margins/padding.",
      },
      {
        pattern: "Header-offset scroll margin",
        kind: "token",
        tokens: ["--header-height", "--space-5"],
        note: "calc(var(--header-height) + var(--space-5)) for scroll-margin-top, not the magic 80px.",
      },
    ],
  },
  {
    family: "colors",
    patterns: [
      {
        pattern: "Surface / text / border roles",
        kind: "token",
        tokens: [
          "--color-bg",
          "--color-surface-primary",
          "--color-text-primary",
          "--color-text-secondary",
          "--color-border-default",
          "--color-accent",
        ],
        note: "Semantic role tokens only; hex/rgb/oklch belong in token blocks or the swatch primitive.",
      },
      {
        pattern: "Status / signal colors",
        kind: "token",
        tokens: ["--color-status-warning"],
        note: "Olive success / amber warn / brick danger / slate info via status tokens.",
      },
      {
        pattern: "Government-type & experimental-score palettes",
        kind: "token",
        tokens: ["--gov-parl", "--gov-pres", "--ramp-indicator-1", "--tier-failed"],
        note: "Government hues via --gov-*; neutral country scores via --ramp-indicator-*; --tier-* reserved for non-country state UI.",
      },
      {
        pattern: "Legacy numeric text-alpha tokens",
        kind: "approved-exception",
        tokens: ["--color-text-primary"],
        note: "--color-text-85/-60/-50 etc. are preserved for legacy code; new work uses the semantic role names. Ratcheting is EXP-003.",
        followUpTaskId: "EXP-003",
      },
    ],
  },
  {
    family: "elevation",
    patterns: [
      {
        pattern: "Low / raised / overlay elevation",
        kind: "token",
        tokens: ["--shadow-hard", "--shadow-dark", "--border-hairline"],
        note: "Soft navy-tinted shadows; most surfaces are a 1px hairline plus at most a subtle shadow.",
      },
      {
        pattern: "--shadow-hard* token naming",
        kind: "approved-exception",
        tokens: ["--shadow-hard"],
        note: "Token NAMES read 'hard' while values are soft; owner-gated rename deferred (DESIGN.md Elevation). Not a new path.",
        followUpTaskId: "EXP-002",
      },
    ],
  },
  {
    family: "forms",
    patterns: [
      {
        pattern: "Search fields",
        kind: "primitive",
        primitives: ["src/components/CountrySearchCombobox.tsx"],
        tokens: ["--radius-search"],
        note: "Fully rounded (--radius-search) leading-magnifier Inter search box; canonical site-wide.",
      },
      {
        pattern: "Single-select filter popover",
        kind: "primitive",
        primitives: ["src/components/editorial/SingleSelectMenu.tsx"],
        note: "Shared tokenised single-select filter; used by OutcomesExplorer and PartyExplorer, never re-implemented per page.",
      },
      {
        pattern: "Buttons / CTAs",
        kind: "primitive",
        primitives: ["src/components/editorial/Button.tsx"],
        classes: ["btn"],
        tokens: ["--radius-control"],
        note: "The .btn system (primary/secondary/tertiary/text) via Button; no ad-hoc button styling.",
      },
    ],
  },
  {
    family: "tabs",
    patterns: [
      {
        pattern: "Country / atlas tab bar",
        kind: "primitive",
        primitives: ["src/components/country/CountryTabBar.tsx"],
        tokens: ["--font-body"],
        note: "Inter body text, normal casing (Structure/Bills/Leaders). No Roman numerals or monospace tabs.",
      },
      {
        pattern: "Mutually-exclusive view toggles",
        kind: "primitive",
        primitives: ["src/components/editorial/SegmentedControl.tsx"],
        note: "SegmentedControl pill/well with a navy active segment.",
      },
    ],
  },
  {
    family: "tables",
    patterns: [
      {
        pattern: "Structured data tables",
        kind: "primitive",
        primitives: ["src/components/editorial/DataTable.tsx"],
        note: "DataTable primitive; aligned numeric columns use Inter tabular-nums.",
      },
      {
        pattern: "Editorial prose tables",
        kind: "class",
        classes: ["editorial-section"],
        note: "Tables inside .editorial-section inherit correct typography automatically.",
      },
    ],
  },
  {
    family: "charts",
    patterns: [
      {
        pattern: "Legislature hemicycle (canonical SVG reference)",
        kind: "primitive",
        primitives: ["src/components/factbook/FactbookLegislatureChart.tsx"],
        note: "viewBox scaling, var(--color-*) fills, 1px ink axes, no decorative shadows. The SVG-construction reference.",
      },
      {
        pattern: "PCA scree / trend / ideology charts",
        kind: "primitive",
        primitives: [
          "src/components/methodology/EigenvalueChart.tsx",
          "src/components/ci/IndicatorTrendChart.tsx",
          "src/components/parties/IdeologyCompass.tsx",
        ],
        note: "Same canonical chart style: fluid viewBox SVG, hairline ink axes, tabular-nums, 2-decimal coord rounding, canonical Tooltip.",
      },
      {
        pattern: "Experimental country score marker",
        kind: "primitive",
        primitives: ["src/components/editorial/ScorePosition.tsx"],
        note: "Neutral sequential-blue marker; never letter grades, verdicts, or traffic-light colors.",
      },
    ],
  },
  {
    family: "maps",
    patterns: [
      {
        pattern: "Interactive world / country maps",
        kind: "primitive",
        primitives: ["src/components/atlas/AtlasWorldMap.tsx"],
        tokens: ["--map-label-fg", "--map-label-halo"],
        note: "MapLibre with a screen-space label layer; theme-independent label fg/halo tokens. Provider attribution rendered beside the tile.",
      },
    ],
  },
  {
    family: "disclosures",
    patterns: [
      {
        pattern: "Provenance markers",
        kind: "primitive",
        primitives: ["src/components/SourceDot.tsx"],
        note: "Every data point carries a SourceDot (green live / amber frozen); never hand-rolled.",
      },
      {
        pattern: "Editorial-illustration / AI-assisted disclosure",
        kind: "composition",
        primitives: ["src/components/PageHero.tsx"],
        classes: ["factbook-hero-caption"],
        note: "PageHero renders the 'Editorial illustration · AI-assisted, non-documentary' link; country mastheads render .factbook-hero-caption linking /licensing#imagery.",
      },
      {
        pattern: "Inline info / estimate tooltips",
        kind: "primitive",
        primitives: ["src/components/editorial/Tooltip.tsx"],
        classes: ["editorial-tooltip"],
        note: "Canonical instant Tooltip / InfoTip instead of native title attributes.",
      },
    ],
  },
  {
    family: "data states",
    patterns: [
      {
        pattern: "Observed / absence / disputed / withheld values",
        kind: "primitive",
        primitives: ["src/components/DataValueState.tsx"],
        note: "DataValueState renders all seven availability states; preserves observed zeroes; never an em dash/blank substitute.",
      },
      {
        pattern: "Tinted status chips",
        kind: "primitive",
        primitives: ["src/components/editorial/Pill.tsx"],
        classes: ["editorial-chip"],
        tokens: ["--radius-chip"],
        note: "Chip (Pill alias) tonal variants replace every old badge/filter/status pill and the Beta tag. CSS filter chips use .editorial-chip.",
      },
      {
        pattern: "Empty state",
        kind: "class",
        classes: ["editorial-empty"],
        note: "Shared .editorial-empty copy; a module must not silently disappear (see ATL-018).",
        followUpTaskId: "ATL-018",
      },
    ],
  },
  {
    family: "navigation",
    patterns: [
      {
        pattern: "Explore dropdown",
        kind: "composition",
        primitives: ["src/components/ExploreMenuPanel.tsx"],
        classes: ["explore-menu"],
        note: "Single Explore disclosure opens a standard grouped dropdown (Start with a place / Research tools) of plain text links; the eight hrefs live in exploreNavItems.ts and are consumed by desktop and mobile.",
      },
      {
        pattern: "Full-screen atlas / mobile menu",
        kind: "composition",
        classes: ["mobile-menu"],
        note: "MobileNav full-viewport menu: scroll lock, focus trap, Escape/nav close, reduced-motion aware.",
      },
      {
        pattern: "Section / reader sidebar (On this page)",
        kind: "primitive",
        primitives: ["src/components/editorial/ReaderSidebar.tsx"],
        note: "Shared sticky section-anchor sidebar for methodology and country-tab bodies.",
      },
      {
        pattern: "A–Z country directory",
        kind: "primitive",
        primitives: ["src/components/country/CountryDirectory.tsx"],
        note: "Canonical directory shared by /country, /governance-evidence, and the /design-system demo; never a page-local link grid.",
      },
    ],
  },
  {
    family: "overlays",
    patterns: [
      {
        pattern: "Popovers / modals / toasts stacking",
        kind: "token",
        tokens: ["--z-popover", "--z-overlay", "--z-modal", "--z-toast"],
        note: "Stacking-order tokens instead of raw integers; overlays portal to body to escape overflow clips.",
      },
      {
        pattern: "Motion / transitions",
        kind: "token",
        tokens: ["--motion-base", "--motion-ease-out"],
        note: "Motion + easing tokens; all nonessential motion respects prefers-reduced-motion (see EXP-022).",
        followUpTaskId: "EXP-022",
      },
    ],
  },
  {
    family: "editorial layouts",
    patterns: [
      {
        pattern: "Container widths",
        kind: "class",
        classes: [
          "editorial-page",
          "methodology-layout",
          "factbook-body",
        ],
        note: "Pick a documented layout row (DESIGN.md table); never invent a page width. Multi-section documents use methodology-layout + ReaderSidebar.",
      },
      {
        pattern: "Canonical page hero",
        kind: "primitive",
        primitives: ["src/components/PageHero.tsx"],
        tokens: ["--hero-height"],
        note: "Exactly one hero shell; shared --hero-height; never a hand-rolled hero. Blog/methodology/compact-tool exclusions documented.",
      },
      {
        pattern: "Editorial section / card / filter / footer classes",
        kind: "class",
        classes: [
          "editorial-section",
          "editorial-card",
          "editorial-filter-bar",
          "editorial-footer-nav",
        ],
        note: "Reader pages compose editorial.css classes; no per-page <style> block for layout/type/filter/card. Page-local styling cleanup is EXP-004.",
        followUpTaskId: "EXP-004",
      },
      {
        pattern: "Markdown reader prose",
        kind: "primitive",
        primitives: ["src/components/content/MarkdownContent.tsx"],
        note: "content/*.md rendered via MarkdownContent inside .editorial-section for automatic editorial typography.",
      },
    ],
  },
];

/* ────────────────────────────────────────────────────────────────
 * Validation
 * ──────────────────────────────────────────────────────────────── */

/** Stylesheets scanned for shared class declarations. */
const STYLESHEETS = [
  "src/app/globals.css",
  "src/app/editorial.css",
  "src/app/atlas.css",
  "src/app/factbook.css",
  "src/app/shell.css",
  "src/app/civica-index.css",
  "src/app/civica-index-detail.css",
  "src/app/parties.css",
];

/** Files that may define design tokens (`--x: …`). */
const TOKEN_SOURCES = ["src/app/globals.css", "src/app/atlas.css"];

export interface UiPatternMapDeps {
  readFile: (path: string) => string;
  fileExists: (path: string) => boolean;
}

const realDeps: UiPatternMapDeps = {
  readFile: (path) => readFileSync(path, "utf8"),
  fileExists: (path) => existsSync(path),
};

function bareToken(t: string): string {
  const m = t.match(/--[\w-]+/);
  return m ? m[0] : t;
}

/**
 * Returns a list of errors; an empty array means the map is internally
 * consistent and every canonical binding it names exists. Pure aside from the
 * injected `deps` (defaults to real fs), so tests can feed a seeded map / stub
 * filesystem.
 */
export function validateUiPatternMap(
  map: UiPatternFamily[] = UI_PATTERN_MAP,
  deps: UiPatternMapDeps = realDeps,
): string[] {
  const errors: string[] = [];

  // 1. All fourteen required families are covered exactly once.
  const families = map.map((f) => f.family);
  for (const required of REQUIRED_FAMILIES) {
    const count = families.filter((f) => f === required).length;
    if (count === 0) errors.push(`missing required family: ${required}`);
    else if (count > 1) errors.push(`duplicate family: ${required}`);
  }
  for (const f of families) {
    if (!(REQUIRED_FAMILIES as readonly string[]).includes(f)) {
      errors.push(`unknown family (not in REQUIRED_FAMILIES): ${f}`);
    }
  }

  // 2. Build the defined-token set and per-stylesheet class corpus.
  const definedTokens = new Set<string>();
  for (const src of TOKEN_SOURCES) {
    let css = "";
    try {
      css = deps.readFile(src);
    } catch {
      errors.push(`cannot read token source: ${src}`);
      continue;
    }
    for (const m of css.matchAll(/(--[\w-]+)\s*:/g)) definedTokens.add(m[1]);
  }
  let allCss = "";
  for (const src of STYLESHEETS) {
    try {
      allCss += "\n" + deps.readFile(src);
    } catch {
      // A missing optional stylesheet is not fatal; class checks below will
      // surface any genuinely-absent class.
    }
  }

  // 3. Each pattern's bindings must exist, and unmatched/exception rows must
  //    name a follow-up task.
  for (const family of map) {
    for (const p of family.patterns) {
      const where = `${family.family} › ${p.pattern}`;

      if (p.unmatched && !p.followUpTaskId) {
        errors.push(`${where}: unmatched pattern must name a followUpTaskId`);
      }
      if (p.kind === "approved-exception" && !p.followUpTaskId) {
        errors.push(
          `${where}: approved-exception must name a followUpTaskId (owning task)`,
        );
      }

      // A non-unmatched pattern must actually bind to something.
      const hasBinding =
        (p.tokens?.length ?? 0) +
          (p.primitives?.length ?? 0) +
          (p.classes?.length ?? 0) >
        0;
      if (!p.unmatched && !hasBinding) {
        errors.push(`${where}: no canonical binding (token/primitive/class)`);
      }

      for (const t of p.tokens ?? []) {
        const bare = bareToken(t);
        if (!definedTokens.has(bare)) {
          errors.push(`${where}: token ${bare} is not defined in token sources`);
        }
      }
      for (const file of p.primitives ?? []) {
        if (!deps.fileExists(file)) {
          errors.push(`${where}: primitive file does not exist: ${file}`);
        }
      }
      for (const cls of p.classes ?? []) {
        if (!allCss.includes(`.${cls}`)) {
          errors.push(`${where}: class .${cls} is not declared in any stylesheet`);
        }
      }
    }
  }

  return errors;
}

/** Convenience: the patterns explicitly flagged as needing follow-up work. */
export function unmatchedPatterns(
  map: UiPatternFamily[] = UI_PATTERN_MAP,
): Array<{ family: string; pattern: string; followUpTaskId?: string }> {
  const out: Array<{ family: string; pattern: string; followUpTaskId?: string }> =
    [];
  for (const family of map) {
    for (const p of family.patterns) {
      if (p.unmatched) {
        out.push({
          family: family.family,
          pattern: p.pattern,
          followUpTaskId: p.followUpTaskId,
        });
      }
    }
  }
  return out;
}
