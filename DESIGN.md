---
name: Civica Design System
version: 0.2
updated: 2026-07-10
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
  border:
    hairline: var(--border-hairline)
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

Use exactly four outer container widths. The CSS values live in `html:root`;
components and page CSS consume the named tokens rather than repeating numbers:

- `.editorial-page` — `--width-page-reading`, the narrow reading column.
- `.editorial-page--wide` — `--width-page-wide`, the medium editorial/list surface.
- `.editorial-page--full` — `--width-page-standard`, the standard product/editorial surface and default target for most pages.
- `.editorial-page--reference` — `var(--width-reference-content)` (1280px) plus standard outer gutters for multi-pane reference surfaces such as the country tabs and Constitution Explorer. Pass `width="reference"` to `<EditorialPage>`.
- `.methodology-layout` — the standard page width with `--width-document-rail` and `--width-document-body`, plus a left `ReaderSidebar` and no country search input.
- `.factbook-body` — uses the reference-width contract because it carries two sidebars. The paired `--width-reference-shell` adds the standard `--space-6` gutters outside that content width; never treat 1280px as the padded outer box.
- **The `/country/[slug]` tabs (Factbook · Civica Data · Constitution) are ONE surface**: every tab uses the `.factbook-body` geometry (`--width-reference-content`, `--width-country-rail`, `--width-country-context`, `--space-7`, and the same padding — `.civica-data-body` is the two-track variant) and the SAME `<FactbookSidebar>`/`ReaderSidebar` component for its "On this page" nav, with `<CountryJumpSearch>` at the identical position above the body grid. The masthead, tab bar, body grids, sticky country search, country Constitution reading shell, and Constitution Explorer all resolve from the same reference-width tokens. Never give a country tab its own nav markup, column widths, or search placement (owner mandate 2026-07-05, after the tabs drifted).

Outer width and internal reading geometry are separate decisions. Methodology,
country-reference, Constitution, and Record layouts use named rail/body tokens
inside one of the four outer containers; their narrower prose columns do not
create additional page widths. A new layout either composes those roles or
extends this system once in `globals.css`, `/design-system`, and this document.

**Hero sections** are full-bleed bands (`width: 100vw; margin-left: calc(50% - 50vw)`) and MUST share one canonical height via **`var(--hero-height)`** (`clamp(460px, 44vw, 640px)`) so every hero reads as one design language. **The single canonical page hero is the `<PageHero>` component** (`src/components/PageHero.tsx`) — every browse/landing page uses it, never a hand-rolled hero (see the Hero subsection under "Editorial layout classes" below). It composes the `.factbook-landing-hero` / `.factbook-hero-*` class family, which the homepage (`.home-hero`) also mirrors. On mobile heroes relax to content height. The per-country factbook masthead (`.factbook-hero--art`) is a distinct art-overlay pattern, not a section hero. Its default imagery remains engraving-style; explicitly registered full-color photographic trials use the same geometry, scrim, paired light/dark asset behavior, and disclosure placement. Do NOT give a new hero a one-off height, width, or markup; use `<PageHero>`. Whenever a country/territory masthead renders art (`engravingSrc` set), `FactbookHeaderStrip` always renders the `.factbook-hero-caption` disclosure — "Editorial engraving" + "AI-assisted illustration" for the engraving corpus, or "Editorial image" + "AI-assisted image" for a registered photographic treatment — linking to `/licensing#imagery`, even when no landmark caption text is available. The link uses `pointer-events: auto` against the caption's own `pointer-events: none`; keep that override if you touch the caption styles.

**Engraving color is versioned, not session-tuned.** Japan light is the canonical owner-approved reference, and the current dark corpus uses the approved strength-60 grade. Exact hashes, tone/saturation/warmth ranges, contrast floors, output format, line/geometry invariants, and pass/fail references live in `plan/decisions/engraving-color-contract-v1.md` and its machine-readable JSON companion. Run `npm run validate:engraving-color-contract` after changing a canonical reference, grading parameters, or the batch report. Color grading may not disguise a semantic or landmark defect; those assets enter regeneration review.

Every `<PageHero>` with engraving art visibly renders the canonical `Editorial illustration · AI-assisted, non-documentary` policy link. Country and territory mastheads use their landmark caption plus the equivalent accessible policy disclosure. Background art remains `alt=""` and `aria-hidden="true"` because the adjacent disclosure/caption carries the meaning once. Do not remove, rename, or page-localize these disclosures.

### Alternative text

Every image on the site is either **meaningful** (it conveys information a screen-reader user cannot get from surrounding text) or **decorative** (adjacent visible text already names it, or it is pure ornament). This is a closed policy — every image class below resolves to exactly one treatment. Meaningful images carry a real descriptive `alt`; decorative images carry `alt=""`, and inline SVG icons additionally carry `aria-hidden="true"` paired with the existing `focusable="false"`. `npm run validate:alt-text-policy` enforces the mechanical half of this (missing `alt`, decorative images missing `aria-hidden`) with the same baseline-ratchet approach as `validate:design-tokens` — run it before any UI commit that touches an image.

- **Flags** (`<CountryFlag>`) — the `decorative` prop is REQUIRED (no default), forcing every call site to choose explicitly. `true` renders `alt="" aria-hidden`; `false` renders a descriptive `Flag of {ISO2}`. Every current call site has a visible country name immediately adjacent (a card title, table cell, or heading), so `decorative` is `true` almost everywhere — pass `false` only for a flag with no adjacent name (e.g. a bare legend key).
- **Portraits** (`<LeaderPortrait>`) — always `alt="" aria-hidden`. The person's name always renders next to the portrait (card heading or row name), so the photo itself never carries unique information; the instant `<Tooltip>` still exposes the office and photo credit on hover/focus.
- **Maps and charts** — data-bearing visualizations (the interactive Civica map, the legislature hemicycle, PCA/eigenvalue charts, the weights bar) are meaningful: give them a real accessible name/description (`aria-label`, `<title>`/`<desc>`, or an adjacent heading) plus a tabular or text alternative where one already exists (the hemicycle's stats grid, a ranking's `DataTable`). Static map/photo thumbnails and the enlarged lightbox image are decorative (`alt=""`) precisely because a caption with the same description renders immediately beside them (`FactbookHeaderStrip` cover tiles, `FactbookLightbox` thumbnails and main image) — a matching `alt` would announce the same sentence twice.
- **Country masthead art, engravings, and Record (blog) art** — always decorative (`alt="" aria-hidden="true"`). The visible `Editorial engraving` / `AI-assisted illustration` or `Editorial image` / `AI-assisted image` disclosure link documented above carries the accessible description, not the image. Blog inline figures (`post-figure`) already follow this rule (EXP-036) — leave that file alone.
- **Organization marks / logos** — meaningful only when the mark is the sole identifier on its row (no adjacent name); decorative when a name label sits next to the mark.
- **Icons** — inline SVG icons (chevrons, the info glyph, the "more sources" plus glyph, the `<CivicaLogo>` mark) are ornamentation next to a control that already has its own accessible name/label. They carry both `focusable="false"` (removes the legacy IE/Edge SVG tab stop) and `aria-hidden="true"` (removes the icon from the accessibility tree so assistive tech announces the control's label once, not "chevron down, Explore" or "plus, more sources").

Use `var(--space-*)` for new spacing decisions unless an existing component contract requires a fixed dimension.

Hairline rules use `var(--border-hairline)`. New components must not repeat a
raw pixel border width.

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
- `<CountryDirectory>` (`src/components/country/CountryDirectory.tsx`) — the canonical A–Z country directory shared by `/country`, `/governance-evidence`, and the `/design-system` demo. It owns alphabet grouping, serif rows, flags, region signals, hairline headings, and responsive columns; callers provide only their country data and destination (`hrefPrefix` plus optional `queryParam`). Never recreate a page-local country link grid.
- Search fields are **fully rounded** (`--radius-search`) with a leading magnifier + Inter placeholder (see `CountrySearchCombobox` / `GlobalSearch`). This is the canonical shape for every search box site-wide (owner decision 2026-07-01).
- `DataTable`
- `DataValueState` (`src/components/DataValueState.tsx`) — the canonical rendering for observed, missing, unknown, not-applicable, not-observed, disputed, and withheld values. It preserves observed zeroes, adds the state label beside disputed values, and renders every absence as a distinct canonical `Chip`. Never substitute an em dash, zero, or empty string for one of these states.
- `SourceDot`
- `Tooltip` / `InfoTip` (`src/components/editorial/Tooltip.tsx`) — the canonical INSTANT tooltip: an inverted (ink-navy in light, ivory in dark), no-arrow surface portalled to `<body>` so it escapes overflow clips, positioned above the trigger and flipping below when it would clip. `<Tooltip content={…}>{trigger}</Tooltip>` wraps any hoverable/focusable node; `<InfoTip content={…}/>` is a circled-i button carrying one (used to mark Civica-derived estimates). Styled in `editorial.css` under `.editorial-tooltip`. Use this instead of native `title` attributes.
- `SingleSelectMenu` (`src/components/editorial/SingleSelectMenu.tsx`) — the canonical tokenised single-select filter popover: a small-caps label above a token-styled trigger button that opens a `role="listbox"` popover of options with a check on the active item. Caller owns open/close state (so a parent can enforce "one menu open at a time") and outside-click / Escape dismissal. Props: `label`, `value`, `items` (`{value,label}[]`), `open`/`onOpenChange`, `onSelect`, optional `minWidth` / `tabularNums`, `ariaLabel`. Used by the Civica Conditions explorer (`OutcomesExplorer`) and the party browser (`PartyExplorer`) for their region / country / metric / year / lens filters — one shared control, never re-implemented per page.
- **Explore megamenu candidate** (`ExploreMenuPanel`, `.explore-menu` in `globals.css`; data in `src/components/exploreNavItems.ts`) — the current EXP-015 candidate, revised per the 2026-08-09 owner review. One `Explore` disclosure opens a near-page-width image-led panel with a terracotta top rule, `--radius-xl`, and restrained elevation; the panel enters with a short fade-and-settle from the header (`@starting-style`, `--motion-fast`/`--motion-base` + `--motion-ease-out`; reduced motion keeps only the fade) and closes instantly. The slim header is one eyebrow + dek row — no headline. The two registers, `Start with a place` and `Research tools`, are each a 2 × 2 grid of destination cards sharing the card gutter (`--space-3`) so the panel reads as one even four-column rhythm. Every card pairs its own square, full-bleed, active-theme editorial motif (`public/engravings/navigation/explore-*.webp` + `-dark`) with a serif destination name and an Inter description; hover/focus is a single quiet response — accent-tinted border/background plus arrow color — with no lift, zoom, or underline choreography. Images are decorative and mount only while navigation is open; the text is the accessible identity. The eight hrefs — `/country`, `/atlas`, `/compare`, `/constitution`, `/parties`, `/elections`, `/rankings`, `/organizations` — are the single source consumed by both desktop `NavLinks` and the full-screen `MobileNav` browse register. Demoed on `/design-system`. Add or reorder surfaces in `exploreNavItems.ts`, never per-consumer, and render desktop cards through `ExploreMenuPanel` rather than recreating the composition.
- **Full-screen atlas menu** (`MobileNav`, `.mobile-menu*` in `globals.css`) — the hamburger opens a full-viewport, scroll-contained navigation surface rather than a side drawer. It uses the canonical hero engraving as a quiet full-canvas plate, the shared `EXPLORE_NAV_GROUPS` spot engravings for browse destinations, a separate research/methodology register, the global search slot, operational status, and reference/legal links. The modal locks body scroll, focuses Close on entry, traps Tab, closes on Escape or navigation, restores trigger focus, respects reduced motion, and collapses from the desktop two-register composition to a single mobile reading order. The live component is demoed on `/design-system`.

Every visible data point should carry provenance where possible. Use `SourceDot`; do not hand-roll provenance markers.

The canonical legislature/hemicycle pattern is the factbook legislature component (`FactbookLegislatureChart`): rostrum, majority line, seat hover, stats grid, and all-party rows. Older standalone hemicycle demos are non-canonical.

Tabs use Inter body text with normal casing, matching the Atlas tab bar (`Structure`, `Bills`, `Leaders`, etc.). Do not use Roman numerals or monospace for tabs.

Dropdown triggers use a token-sized SVG chevron (`ChevronDown` from `lucide-react`) aligned with the text. Do not use text chevron glyphs.

## Editorial layout classes

Reader-style pages (methodology, replication, corrections, changelog, etc.) compose global layout classes from `src/app/editorial.css`. **Do not ship inline `<style>` blocks for layout, typography, spacing, or container width on a new editorial page.** If a missing class would force a `<style>` block, add the class to `editorial.css` and reuse it.

### Picking the layout — read this before writing a new page

Page type drives the layout, not the prose length. **Do not default to `width="narrow"` because the prose is long.** The narrow column is for short-form editorial content (blog posts, single-topic essays). Methodology pages, regardless of how long the prose is, use the methodology layout with a sidebar.

| Page type                                        | Class / prop                                                         | Width                    | Sidebar?                            | Examples                                                                                                                                                                                  |
| ------------------------------------------------ | -------------------------------------------------------------------- | ------------------------ | ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Methodology page or methodology subpage          | `<EditorialPage className="methodology-layout">` + `<ReaderSidebar>` | `--width-page-standard`  | Yes (left, sticky, section anchors) | `/methodology`, `/methodology/approach`, `/civica-index/methodology`, `/country/methodology/reconciliation`, `/civica-index/methodology/peer-grouping`, `/civica-index/methodology/pulse` |
| Legal / policy / ANY multi-section document page | `<EditorialPage className="methodology-layout">` + `<ReaderSidebar>` | `--width-page-standard`  | Yes (left, sticky, section anchors) | `/privacy`, `/terms`                                                                                                                                                                      |
| Filterable list / changelog                      | `<EditorialPage width="wide">`                                       | `--width-page-wide`      | No                                  | `/civica-index/pulse-changelog`                                                                                                                                                           |
| Standard product/editorial page                  | `<EditorialPage width="full">`                                       | `--width-page-standard`  | No                                  | Atlas-scale layouts                                                                                                                                                                       |
| Multi-pane reference surface                     | `<EditorialPage width="reference">`                                  | reference + gutters      | Optional                            | `/constitution`, `/country/[slug]` tabs, Record articles                                                                                                                                 |
| Short-form editorial / blog                      | `<EditorialPage>` (default `width="narrow"`)                         | `--width-page-reading`   | No                                  | Single-topic blog posts, short essays                                                                                                                                                     |

**Default disambiguation rule**: if the URL is under `/methodology`, `/*/methodology`, or otherwise documents a methodology decision, use `methodology-layout`. Reaching for `width="narrow"` on a methodology page is wrong even if the prose feels short — methodology pages share a sidebar convention readers expect to find.

**Owner rule (2026-07-04, restated after repeated drift): NEVER invent a new page width or layout shell.** Every new page picks a row from this table — a sectioned document of any kind (legal, policy, reference, explainer) gets the `methodology-layout` + `ReaderSidebar` shell, NOT a bare narrow column. `width="narrow"` is reserved for blog-style essays. If none of the rows fit, the fix is to extend this table (one decision, reused everywhere), never to hand-roll a one-off layout on the page.

**The page hero is orthogonal to the container.** A browse/landing page opens with the canonical `<PageHero>` full-bleed band (see the Hero subsection below), then drops its body into one of the container rows above. Never hand-roll a hero, and never give one a one-off width — the government-types-vs-pulse-changelog width mismatch that this replaced is exactly the drift to avoid.

The `<EditorialPage>` component's prop docstring describes what each width prop _technically_ does. This document describes which one to _pick_. When they conflict, this document wins.

### Page hero — `<PageHero>` (the one canonical hero)

**Every browse/landing page opens with `<PageHero>` (`src/components/PageHero.tsx`) — there is exactly one hero shell, and it never varies.** Same full-bleed band, same shared `var(--hero-height)`, same 1200px inner column, same eyebrow → serif H1 → dek type scale, same optional engraving + scrim, same on-mount stagger. Only the _content_ changes per page. Given the same content it renders pixel-for-pixel identical to the home, `/country`, and `/about` heroes. Demoed live on `/design-system` (section 05).

Props:

- `eyebrow` — small-caps terracotta label above the title (e.g. `"Rankings"`, `"Civica Index · Government types"`). For a sub-page, encode the section context here instead of a breadcrumb — the hero carries no breadcrumb.
- `title` (required) — the serif H1. Accepts a `ReactNode`, so an inline `<BetaChip inHeading />` is fine.
- `description` — the standfirst / dek paragraph.
- `engraving` — `{ src, darkSrc? }` for the parallax engraving + left-protecting scrim. **Omit it** for pages with no dedicated engraving; the hero renders clean on paper. Page engravings live in `public/engravings/pages/*.webp` (+ `-dark`); the generic fallback is `/engravings/hero.webp`.
- `search` — optional slot for a `<CountrySearchCombobox>` / `<GlobalSearch>` in the canonical hero search position.
- `chips` — optional slot for a filter/region chip row.
- `children` — optional trailing slot for anything else (a stat strip, a status row, CTAs), rendered last inside the same stagger.
- `titleId` — id wired to the section's `aria-labelledby` (defaults to `page-hero-title`).
- `className` — layout escape hatch on the outer `<section>` (e.g. `ci-landing-hero` adds only the Civica Index beta-status row).

`PageHero` is a server component (it only composes the `"use client"` motion primitives), so it drops straight into any server page. When the hero content is interactive (a live search box or filter chips wired to client state — `/country`, `/parties`, `/elections`, `/constitution`), render `PageHero` from inside that page's existing client component and pass the interactive nodes as slots.

**Exclusions — do NOT use `<PageHero>`:** `/blog` and `/blog/*` keep their editorial nameplate; every methodology page uses `methodology-layout` + `ReaderSidebar`; and interactive data-explorer tools whose whole point is a compact tool header above the controls (`/civica-conditions`, which uses `editorial-tool-title`) keep that compact header rather than a 460–640px band that would push the tool below the fold.

Container classes:

- `.editorial-page` — `--width-page-reading`, default. Applied by `<EditorialPage>` automatically when no className/width override is set.
- `.editorial-page--wide` — `--width-page-wide` for filterable lists / changelogs. Pass `width="wide"` to `<EditorialPage>`.
- `.editorial-page--full` — `--width-page-standard` for standard product/editorial surfaces. Pass `width="full"` to `<EditorialPage>`.
- `.editorial-page--reference` — `--width-reference-content` plus gutters for multi-pane reference surfaces. Pass `width="reference"` to `<EditorialPage>`.
- `.methodology-layout` — standard page shell with `--width-document-rail` + `--width-document-body`. Pass via `className="methodology-layout"` and pair with `<ReaderSidebar items={...} className="methodology-sidebar">` plus `<article className="methodology-content">` wrapping the prose.

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
- `<ScorePosition>` — neutral sequential-blue marker on a declared numeric scale, with optional input-variation range. This is the canonical presentation for experimental country scores; it never maps countries to letter grades, qualitative verdicts, or traffic-light colors.
- `.meth-version-strip` + `.meth-version-cell` + `.meth-version-label` + `.meth-version-value` — 4-column metadata grid for status/revision/review/cadence (`/civica-index/methodology` §14).
- `.meth-figure` + `.meth-figure-caption` — wrapper for inline-SVG methodology charts (e.g. `<EigenvalueChart>` on the PCA appendix §4). Print-inspired card aesthetic: grid-cell background, card-border, small-caps Inter caption.

Methodology charts:

- **`<EigenvalueChart>`** (`src/components/methodology/EigenvalueChart.tsx`) — inline SVG scree plot. Composite of bars (one per principal component, dominant PC in `var(--color-accent)`, subordinate PCs in `var(--color-text-30)`) + cumulative-variance line overlay (accent thin path with marker circles) + Kaiser-threshold dashed reference rule. Server-rendered, accessible (`role="img"`, `<title>` + per-PC `<desc>`), dark-mode automatic via design tokens. Reusable for any PCA scree visualization. Currently used at `/civica-index/methodology/pca-appendix` §4.
- **`<IndicatorTrendChart>`** (`src/components/ci/IndicatorTrendChart.tsx`) — multi-series long-run trend chart (fluid `viewBox` SVG, hairline ink axes, Inter tabular-nums labels, 2-decimal coordinate rounding). Each series is one source indicator's full published history in its established dimension color (`src/lib/ci/dimension-colors.ts`); series toggle via the `.editorial-chip` filter row and time range via `SegmentedControl`, with the canonical `Tooltip` on hover. Sources publish on different native scales, so each series is rescaled to a shared 0–100 "higher is better" axis while the tooltip keeps the source-native value. Soft-fails to nothing when there is no history. Used on the country page's Civica Data tab (`<CountryTrendSection>`) and demoed on `/design-system`.
- **`<IdeologyCompass>`** (`src/components/parties/IdeologyCompass.tsx`) — 2-D party-ideology scatter ("political compass") in the canonical chart style (fluid `viewBox` SVG, hairline ink axes through the centre, no decorative shadows, 2-decimal coordinate rounding, styling in `src/app/parties.css`). X = economic left↔right (V-Party `v2pariglef`, centred on 0); Y = **Pluralist↔Anti-pluralist** (`v2xpa_antiplural` 0–1 — the honest label, NOT authoritarian/libertarian). Each party is a dot in its brand colour (a token fallback when null), radius optionally scaled by seat share; hover shows the canonical `Tooltip`. Parties with no recorded position are never plotted (they carry an "ideology not recorded" `Chip` in the list instead). Powers `/parties` and demoed on `/design-system`.

Civica's canonical SVG-construction reference is `src/components/factbook/FactbookLegislatureChart.tsx` (the hemicycle); follow its style — `viewBox` for fluid scaling, `var(--color-*)` for fills/strokes, hard 1px ink axis rules, no decorative shadows.

Markdown rendering primitive:

- **`<MarkdownContent>`** (`src/components/content/MarkdownContent.tsx`) — server component that reads a `content/*.md` file, runs Phase 5 substitutions (`{{state.X}}`, `{{stats.X | "fallback"}}`, `{{ctx.X}}`), and pipes through `react-markdown` with `remark-gfm` (tables + footnotes + GFM features) and a custom `remark-civica-anchors` plugin (for `## Heading {#anchor-id}` syntax). Used by every reader-style page whose prose lives under `content/`. Wrap the markdown body in `<section className="editorial-section">` so descendant `<h2>`/`<p>`/`<ul>`/`<table>` inherit editorial typography automatically. Optional `slice={{ from?, to? }}` prop renders only the lines between two heading anchors (used when interleaving markdown with TSX-only rich blocks).

These classes are typed only against role tokens (`var(--color-*)`, `var(--text-*)`, `var(--space-*)`, `var(--radius-*)`, `var(--font-*)`). Read the file for the exact set; extend with new classes when a new pattern is needed.

## Do's & Don'ts

Do use the live `/design-system` page before building UI.

Do use role tokens instead of raw colors and fonts.

Do keep the reference atlas visually primary. Present the Civica Index and
Civica Pulse as clearly labelled secondary research experiments until their
validation gates pass.

Don't create local page themes.

Don't introduce parallel token names for the same semantic role.

Don't hide source, license, or freshness context.
