---
name: Civica Design System
version: 0.2
updated: 2026-06-28
source: src/app/globals.css
canonical_preview: /design-system
tokens:
  color:
    bg: var(--color-bg)
    surface_primary: var(--color-surface-primary)
    surface_secondary: var(--color-surface-secondary)
    text_primary: var(--color-text-primary)
    text_secondary: var(--color-text-secondary)
    border_default: var(--color-border-default)
    accent: var(--color-accent)
  typography:
    heading: var(--font-heading)
    body: var(--font-body)
    mono: var(--font-mono)
  spacing:
    scale: var(--space-1) through var(--space-9)
  radius:
    sm: var(--radius-sm)
    md: var(--radius-md)
    lg: var(--radius-lg)
    xl: var(--radius-xl)
    control: var(--radius-control)
    chip: var(--radius-chip)
    search: var(--radius-search)
  elevation:
    hard: var(--shadow-hard)
    dark: var(--shadow-dark)
---

# Civica Design System

## Overview

Civica uses a fine-press almanac system: warm ivory paper, ink-navy type, a terracotta editorial accent, hairline rules, antique engraved illustration, and provenance-first data display. The canonical implementation lives in `src/app/globals.css`; the canonical visual preview is `/design-system`.

Any page that does not feel like an extension of `/design-system` is off-system.

## Colors

Use global CSS variables only. Component code and page CSS should use role tokens such as `var(--color-bg)`, `var(--color-surface-primary)`, `var(--color-text-primary)`, `var(--color-text-secondary)`, `var(--color-border-default)`, `var(--color-accent)`, and status tokens such as `var(--color-status-warning)`.

Hex, `rgb`, `rgba`, and raw `oklch` literals belong only in token-definition blocks or the documented swatch primitive.

Text colors use **semantic role tokens**: `var(--color-text-primary)`, `var(--color-text-secondary)`, `var(--color-text-muted)`. The numeric scheme (`--color-text-85`, `-60`, `-50`, `-40`, `-30`, `-25`, `-20`) is preserved for legacy code but new work prefers the semantic names. Note: the numeric suffixes do NOT match the actual alpha values (`--color-text-85` is alpha 0.88, `--color-text-50` is alpha 0.62–0.64) — another reason to prefer semantic names.

## Typography

Use Source Serif 4 for display and country/editorial headings through **`var(--font-heading)`**. (`--font-serif` is a deprecated alias preserved for backwards compatibility — new code uses `--font-heading`.) The canonical page H1 is 56px (`var(--text-56)`) except for `/blog`, which is allowed to keep its heavier editorial nameplate. Use Inter for body/interface text through **`var(--font-body)`**. (`--font-body-sans` and `--font-sans` are deprecated aliases preserved for backwards compatibility — new code uses `--font-body`.)

**Monospace is reserved for literal code/API snippets only.** Use **`var(--font-code)`** for code blocks, curl examples, endpoint paths, and cssVar display chips. Do NOT use monospace for labels, IDs, source/meta rows, eyebrows, numeric UI, or any readable fact — those are Inter. (The legacy `var(--font-mono)` token is now repointed to the Inter stack as a safety net, so any straggler renders Inter, not monospace.) Small-caps "eyebrow" labels use Inter with `text-transform: uppercase` + letter-spacing — not a monospace font. For numeric columns that need to align (tables, scores, stat values), use Inter with `font-variant-numeric: tabular-nums`.

Use `var(--text-*)` tokens for font sizes. Do not add new pixel font sizes in page-level CSS.

Font weight tokens: `--font-weight-regular` (400), `--font-weight-medium` (500), `--font-weight-semibold` (600), `--font-weight-bold` (700). (`--font-weight-mono` is a legacy alias of medium kept for backwards compatibility — new code uses the named weights directly.) Avoid hardcoded `font-weight: 400` etc. in new code.

Letter-spacing uses `--tracking-*` tokens: `--tracking-tighter` (-0.04em), `--tracking-tight` (-0.03em), `--tracking-snug` (-0.02em), `--tracking-normal` (0), `--tracking-wide` (0.03em), `--tracking-wider` (0.08em), `--tracking-caps` (0.15em), `--tracking-widest` (0.2em). Avoid hardcoded em values in new code.

## Layout

Use the standard container widths:

- `.editorial-page` — 760px narrow reading column.
- `.editorial-page--wide` — 960px medium editorial/list surface.
- `.editorial-page--full` — 1200px standard product/editorial surface. This is the default target for most pages.
- `.methodology-layout` — 1200px methodology shell with a left `ReaderSidebar` and no country search input.
- `.factbook-body` — 1280px is allowed only for the factbook surface because it carries two sidebars.
- **The `/country/[slug]` tabs (Factbook · Civica Data · Constitution) are ONE surface**: every tab uses the `.factbook-body` geometry (1280px cap, 240px left column, `--space-7` gap, same padding — `.civica-data-body` is a documented clone) and the SAME `<FactbookSidebar>`/`ReaderSidebar` component for its "On this page" nav, with `<CountryJumpSearch>` at the identical position above the body grid. Never give a country tab its own nav markup, column widths, or search placement (owner mandate 2026-07-05, after the tabs drifted).

**Hero sections** are full-bleed bands (`width: 100vw; margin-left: calc(50% - 50vw)`) and MUST share one canonical height via **`var(--hero-height)`** (`clamp(460px, 44vw, 640px)`) so every hero reads as one design language — the homepage (`.home-hero`), the factbook landing (`.factbook-landing-hero`), and the about page (`.about-hero`) all use it. On mobile they relax to content height. The per-country factbook masthead (`.factbook-hero--art`) is a distinct engraving-overlay pattern, not a section hero. Do NOT give a new hero a one-off height; use the token.

Use `var(--space-*)` for new spacing decisions unless an existing component contract requires a fixed dimension.

## Elevation

Use soft, subtle, navy-tinted shadows. `var(--shadow-hard)` is the default low elevation (`0 1px 2px rgba(15,23,42,.06)`), `var(--shadow-hard-lg)` is the raised level, and `var(--shadow-dark)` is a deeper variant for overlays. (The token names still read `--shadow-hard*` for backwards compatibility; the values are soft, not hard-offset — a rename is pending in a later pass.)

Elevation is restrained: most surfaces use a 1px hairline (`var(--color-border-default)`) plus at most a subtle shadow. Avoid heavy or decorative blur.

## Shapes

Use the radius scale by surface type. Large surfaces use the small print-like scale: `var(--radius-sm)` (4px), `var(--radius-md)` (8px), `var(--radius-lg)` (12px — the default for cards and country/data cards), `var(--radius-xl)` (16px), and `var(--radius-2xl)` (24px). Interactive controls are fully rounded: buttons use `var(--radius-control)`, chips/pills/badges use `var(--radius-chip)`, and search fields use `var(--radius-search)`. `var(--radius-full)` remains the primitive value behind these semantic control tokens and is also used for true circular controls such as avatars, dots, and spinners.

## Stacking, motion, breakpoints, and header

- Stacking order tokens: `--z-base`, `--z-rule`, `--z-sticky`, `--z-popover`, `--z-overlay`, `--z-modal`, `--z-toast`. Use these instead of raw integers.
- Motion tokens: `--motion-fast` (120ms), `--motion-base` (180ms), `--motion-slow` (300ms), `--motion-slower` (500ms). Plus easing tokens: `--motion-ease`, `--motion-ease-out`, `--motion-ease-in-out`, `--motion-linear`.
- Breakpoint tokens: `--bp-sm` (480px), `--bp-md` (768px), `--bp-lg` (960px), `--bp-xl` (1200px), `--bp-2xl` (1280px). These are declarative — `@media` rules cannot read CSS custom properties, so use the values directly in `@media`. The tokens exist as the source of truth for which breakpoints are canonical.
- Header height: `--header-height` (56px). Use `calc(var(--header-height) + var(--space-5))` for `scroll-margin-top` instead of the magic `80px`.

## Components

Prefer shared primitives for new editorial UI:

- `EditorialPage`
- `SectionHeader`
- `Banner`
- `Chip` (`src/components/editorial/Pill.tsx`, exported as both `Chip` and the legacy `Pill` alias) — the single tinted, fully rounded (`--radius-chip`), mixed-case, **sans** chip. Tonal variants `neutral / sage / sand / rose / blue / accent` (via `color-mix`). This replaces every old badge/filter/status pill AND the "Beta" tag. Never uppercase-mono. CSS filter chips use `.editorial-chip` + the `.editorial-chip--{sage,sand,rose,blue,accent}` tonal modifiers.
- `Button` (`src/components/editorial/Button.tsx`) + the `.btn` system: fully rounded `.btn--primary` (navy fill, white text, auto-inverts in dark via `color: var(--color-page-bg)`, optional trailing `.btn__arrow`), `.btn--secondary` (hairline outline), `.btn--tertiary`, `.btn--text`; sizes `.btn--sm`/`.btn--lg`; states (hover/active/disabled/loading) + focus-visible ring. Use this for all CTAs — no ad-hoc button styling.
- `SegmentedControl` (`src/components/editorial/SegmentedControl.tsx`) — pill/well container with a navy active segment; for mutually-exclusive view toggles.
- Search fields are **fully rounded** (`--radius-search`) with a leading magnifier + Inter placeholder (see `CountrySearchCombobox` / `GlobalSearch`). This is the canonical shape for every search box site-wide (owner decision 2026-07-01).
- `DataTable`
- `SourceDot`
- `Tooltip` / `InfoTip` (`src/components/editorial/Tooltip.tsx`) — the canonical INSTANT tooltip: an inverted (ink-navy in light, ivory in dark), no-arrow surface portalled to `<body>` so it escapes overflow clips, positioned above the trigger and flipping below when it would clip. `<Tooltip content={…}>{trigger}</Tooltip>` wraps any hoverable/focusable node; `<InfoTip content={…}/>` is a circled-i button carrying one (used to mark Civica-derived estimates). Styled in `editorial.css` under `.editorial-tooltip`. Use this instead of native `title` attributes.

Every visible data point should carry provenance where possible. Use `SourceDot`; do not hand-roll provenance markers.

The canonical legislature/hemicycle pattern is the factbook legislature component (`FactbookLegislatureChart`): rostrum, majority line, seat hover, stats grid, and all-party rows. Older standalone hemicycle demos are non-canonical.

Tabs use Inter body text with normal casing, matching the Atlas tab bar (`Structure`, `Bills`, `Leaders`, etc.). Do not use Roman numerals or monospace for tabs.

Dropdown triggers use a token-sized SVG chevron (`ChevronDown` from `lucide-react`) aligned with the text. Do not use text chevron glyphs.

## Editorial layout classes

Reader-style pages (methodology, replication, corrections, changelog, etc.) compose global layout classes from `src/app/editorial.css`. **Do not ship inline `<style>` blocks for layout, typography, spacing, or container width on a new editorial page.** If a missing class would force a `<style>` block, add the class to `editorial.css` and reuse it.

### Picking the layout — read this before writing a new page

Page type drives the layout, not the prose length. **Do not default to `width="narrow"` because the prose is long.** The narrow column is for short-form editorial content (blog posts, single-topic essays). Methodology pages, regardless of how long the prose is, use the methodology layout with a sidebar.

| Page type | Class / prop | Width | Sidebar? | Examples |
|---|---|---|---|---|
| Methodology page or methodology subpage | `<EditorialPage className="methodology-layout">` + `<ReaderSidebar>` | 1200px | Yes (left, sticky, section anchors) | `/methodology`, `/methodology/approach`, `/civica-index/methodology`, `/country/methodology/reconciliation`, `/civica-index/methodology/peer-grouping`, `/civica-index/methodology/pulse` |
| Legal / policy / ANY multi-section document page | `<EditorialPage className="methodology-layout">` + `<ReaderSidebar>` | 1200px | Yes (left, sticky, section anchors) | `/privacy`, `/terms` |
| Filterable list / changelog | `<EditorialPage width="wide">` | 960px | No | `/civica-index/changelog`, `/civica-index/pulse-changelog` |
| Standard product/editorial page | `<EditorialPage width="full">` | 1200px | No | Atlas-scale layouts |
| Short-form editorial / blog | `<EditorialPage>` (default `width="narrow"`) | 760px | No | Single-topic blog posts, short essays |

**Default disambiguation rule**: if the URL is under `/methodology`, `/*/methodology`, or otherwise documents a methodology decision, use `methodology-layout`. Reaching for `width="narrow"` on a methodology page is wrong even if the prose feels short — methodology pages share a sidebar convention readers expect to find.

**Owner rule (2026-07-04, restated after repeated drift): NEVER invent a new page width or layout shell.** Every new page picks a row from this table — a sectioned document of any kind (legal, policy, reference, explainer) gets the `methodology-layout` + `ReaderSidebar` shell, NOT a bare narrow column. `width="narrow"` is reserved for blog-style essays. If none of the rows fit, the fix is to extend this table (one decision, reused everywhere), never to hand-roll a one-off layout on the page.

The `<EditorialPage>` component's prop docstring describes what each width prop *technically* does. This document describes which one to *pick*. When they conflict, this document wins.

Container classes:

- `.editorial-page` — narrow column (760px), default. Applied by `<EditorialPage>` automatically when no className/width override is set.
- `.editorial-page--wide` — 960px column for filterable lists / changelogs. Pass `width="wide"` to `<EditorialPage>`.
- `.editorial-page--full` — 1200px standard product/editorial width. Pass `width="full"` to `<EditorialPage>`.
- `.methodology-layout` — 1200px methodology shell with left sidebar (220px) + content (max 800px). Pass via `className="methodology-layout"` and pair with `<ReaderSidebar items={...} className="methodology-sidebar">` plus `<article className="methodology-content">` wrapping the prose.

Header chrome:

- `.editorial-breadcrumbs` — small-caps Inter breadcrumb row with separators.
- `.editorial-page-title` (or default `<h1>` inside `.editorial-page`) — display heading at 56px desktop.
- `.editorial-page-subtitle` — serif subtitle / dek.
- `.editorial-page-meta` — small-caps Inter meta strip.
- `.editorial-beta-tag` — inline Beta pill for use next to a heading.
- `.editorial-warning` — full-width warning callout (companion to `<Banner variant="warn">` for inline content).

Body:

- `.editorial-section` — section block; nested `<h2>`, `<h3>`, `<p>`, `<ul>`, `<ol>`, `<strong>`, `<a>`, `<code>`, `<table>` all get correct typography automatically.

Lists & cards:

- `.editorial-card` — bordered + hard-shadow card with `editorial-card-head`, `editorial-card-pills`, `editorial-card-headline`, `editorial-card-desc`, `editorial-card-foot`.
- `.editorial-filter-bar`, `.editorial-filter-row`, `.editorial-filter-label`, `.editorial-chip`, `.editorial-chip--active`, `.editorial-filter-form` — link-driven faceted filter UI.
- `.editorial-pagination` — prev/next pagination row.
- `.editorial-empty` — empty-state copy.
- `.editorial-footer-nav` — link row at the bottom of an editorial page.

Methodology presentation primitives (extracted from inline `<style>` blocks during the 2026-05-06 content-templating engagement; reusable across the methodology surface):

- `.meth-abstract` — pull-quote with accent left border (page-top abstract).
- `.meth-num` — "Section N" eyebrow inside an `<h2>` (numbered-section convention used by the Civica Index methodology page).
- `.meth-formula` — styled `<pre>` block with accent left border for formulas, citation examples, API reference snippets.
- `.meth-weights-bar` + `.meth-weight-slice` — colored horizontal bar visualizing dimension weights (currently used at `/civica-index/methodology` §2).
- `.meth-band-scale` + `.meth-band-cell` — colored vertical ladder visualizing rank bands A–F (`/civica-index/methodology` §6).
- `.meth-version-strip` + `.meth-version-cell` + `.meth-version-label` + `.meth-version-value` — 4-column metadata grid for status/revision/cutover/cadence (`/civica-index/methodology` §14).
- `.meth-figure` + `.meth-figure-caption` — wrapper for inline-SVG methodology charts (e.g. `<EigenvalueChart>` on the PCA appendix §4). Print-inspired card aesthetic: grid-cell background, card-border, small-caps Inter caption.

Methodology charts:

- **`<EigenvalueChart>`** (`src/components/methodology/EigenvalueChart.tsx`) — inline SVG scree plot. Composite of bars (one per principal component, dominant PC in `var(--color-accent)`, subordinate PCs in `var(--color-text-30)`) + cumulative-variance line overlay (accent thin path with marker circles) + Kaiser-threshold dashed reference rule. Server-rendered, accessible (`role="img"`, `<title>` + per-PC `<desc>`), dark-mode automatic via design tokens. Reusable for any PCA scree visualization. Currently used at `/civica-index/methodology/pca-appendix` §4.
- **`<IndicatorTrendChart>`** (`src/components/ci/IndicatorTrendChart.tsx`) — multi-series long-run trend chart (fluid `viewBox` SVG, hairline ink axes, Inter tabular-nums labels, 2-decimal coordinate rounding). Each series is one source indicator's full published history in its established dimension color (`src/lib/ci/dimension-colors.ts`); series toggle via the `.editorial-chip` filter row and time range via `SegmentedControl`, with the canonical `Tooltip` on hover. Sources publish on different native scales, so each series is rescaled to a shared 0–100 "higher is better" axis while the tooltip keeps the source-native value. Soft-fails to nothing when there is no history. Used on the country page's Civica Data tab (`<CountryTrendSection>`) and demoed on `/design-system`.

Civica's canonical SVG-construction reference is `src/components/factbook/FactbookLegislatureChart.tsx` (the hemicycle); follow its style — `viewBox` for fluid scaling, `var(--color-*)` for fills/strokes, hard 1px ink axis rules, no decorative shadows.

Markdown rendering primitive:

- **`<MarkdownContent>`** (`src/components/content/MarkdownContent.tsx`) — server component that reads a `content/*.md` file, runs Phase 5 substitutions (`{{state.X}}`, `{{stats.X | "fallback"}}`, `{{ctx.X}}`), and pipes through `react-markdown` with `remark-gfm` (tables + footnotes + GFM features) and a custom `remark-civica-anchors` plugin (for `## Heading {#anchor-id}` syntax). Used by every reader-style page whose prose lives under `content/`. Wrap the markdown body in `<section className="editorial-section">` so descendant `<h2>`/`<p>`/`<ul>`/`<table>` inherit editorial typography automatically. Optional `slice={{ from?, to? }}` prop renders only the lines between two heading anchors (used when interleaving markdown with TSX-only rich blocks). Full architecture documented at `~/civica/plan/content-templating-implementation-v1.md`.

These classes are typed only against role tokens (`var(--color-*)`, `var(--text-*)`, `var(--space-*)`, `var(--radius-*)`, `var(--font-*)`). Read the file for the exact set; extend with new classes when a new pattern is needed.

## Do's & Don'ts

Do use the live `/design-system` page before building UI.

Do use role tokens instead of raw colors and fonts.

Do keep Civica Index and Civica Pulse visually prominent.

Don't create local page themes.

Don't introduce parallel token names for the same semantic role.

Don't hide source, license, or freshness context.
