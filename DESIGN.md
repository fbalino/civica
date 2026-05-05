---
name: Civica Design System
version: 0.1
updated: 2026-04-29
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
  elevation:
    hard: var(--shadow-hard)
    dark: var(--shadow-dark)
---

# Civica Design System

## Overview

Civica uses a print-inspired civic editorial system: warm paper, inky type, one cinnabar accent, hard rules, and provenance-first data display. The canonical implementation lives in `src/app/globals.css`; the canonical visual preview is `/design-system`.

Any page that does not feel like an extension of `/design-system` is off-system.

## Colors

Use global CSS variables only. Component code and page CSS should use role tokens such as `var(--color-bg)`, `var(--color-surface-primary)`, `var(--color-text-primary)`, `var(--color-text-secondary)`, `var(--color-border-default)`, `var(--color-accent)`, and status tokens such as `var(--color-status-warning)`.

Hex, `rgb`, `rgba`, and raw `oklch` literals belong only in token-definition blocks or the documented swatch primitive.

## Typography

Use Fraunces for display and country/editorial headings through `var(--font-heading)`. The canonical page H1 is 56px (`var(--text-56)`) except for `/blog`, which is allowed to keep its heavier editorial nameplate. Use Inter for body/interface text through `var(--font-body)`. Use `var(--font-mono)` only for labels, IDs, source/meta rows, code, and dense numeric UI. Do not use mono for readable facts such as government type, region, capital, population, GDP, or tab labels.

Use `var(--text-*)` tokens for font sizes. Do not add new pixel font sizes in page-level CSS.

## Layout

Use the standard container widths:

- `.editorial-page` — 760px narrow reading column.
- `.editorial-page--wide` — 960px medium editorial/list surface.
- `.editorial-page--full` — 1200px standard product/editorial surface. This is the default target for most pages.
- `.methodology-layout` — 1200px methodology shell with a left `ReaderSidebar` and no country search input.
- `.factbook-body` — 1280px is allowed only for the factbook surface because it carries two sidebars.

Use `var(--space-*)` for new spacing decisions unless an existing component contract requires a fixed dimension.

## Elevation

Use hard offset shadows only. `var(--shadow-hard)` follows the theme ink color. `var(--shadow-dark)` is the always-black variant for overlays that need stable depth.

Do not add blurred decorative shadows unless the component already has that behavior.

## Shapes

Use small, print-like radii: `var(--radius-sm)` and `var(--radius-md)`. Pills are allowed for status chips and badges only.

## Components

Prefer shared primitives for new editorial UI:

- `EditorialPage`
- `SectionHeader`
- `Banner`
- `Pill`
- `DataTable`
- `SourceDot`

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
| Methodology page or methodology subpage | `<EditorialPage className="methodology-layout">` + `<ReaderSidebar>` | 1200px | Yes (left, sticky, section anchors) | `/methodology`, `/methodology/approach`, `/civica-index/methodology`, `/factbook/methodology/reconciliation`, `/civica-index/methodology/peer-grouping`, `/civica-index/methodology/pulse` |
| Filterable list / changelog | `<EditorialPage width="wide">` | 960px | No | `/civica-index/changelog`, `/civica-index/pulse-changelog` |
| Standard product/editorial page | `<EditorialPage width="full">` | 1200px | No | Atlas-scale layouts |
| Short-form editorial / blog | `<EditorialPage>` (default `width="narrow"`) | 760px | No | Single-topic blog posts, short essays |

**Default disambiguation rule**: if the URL is under `/methodology`, `/*/methodology`, or otherwise documents a methodology decision, use `methodology-layout`. Reaching for `width="narrow"` on a methodology page is wrong even if the prose feels short — methodology pages share a sidebar convention readers expect to find.

The `<EditorialPage>` component's prop docstring describes what each width prop *technically* does. This document describes which one to *pick*. When they conflict, this document wins.

Container classes:

- `.editorial-page` — narrow column (760px), default. Applied by `<EditorialPage>` automatically when no className/width override is set.
- `.editorial-page--wide` — 960px column for filterable lists / changelogs. Pass `width="wide"` to `<EditorialPage>`.
- `.editorial-page--full` — 1200px standard product/editorial width. Pass `width="full"` to `<EditorialPage>`.
- `.methodology-layout` — 1200px methodology shell with left sidebar (220px) + content (max 800px). Pass via `className="methodology-layout"` and pair with `<ReaderSidebar items={...} className="methodology-sidebar">` plus `<article className="methodology-content">` wrapping the prose.

Header chrome:

- `.editorial-breadcrumbs` — mono breadcrumb row with separators.
- `.editorial-page-title` (or default `<h1>` inside `.editorial-page`) — display heading at 56px desktop.
- `.editorial-page-subtitle` — serif subtitle / dek.
- `.editorial-page-meta` — mono meta strip.
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

These classes are typed only against role tokens (`var(--color-*)`, `var(--text-*)`, `var(--space-*)`, `var(--radius-*)`, `var(--font-*)`). Read the file for the exact set; extend with new classes when a new pattern is needed.

## Do's & Don'ts

Do use the live `/design-system` page before building UI.

Do use role tokens instead of raw colors and fonts.

Do keep Civica Index and Civica Pulse visually prominent.

Don't create local page themes.

Don't introduce parallel token names for the same semantic role.

Don't hide source, license, or freshness context.
