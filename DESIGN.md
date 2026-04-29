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

Use Fraunces for display and country/editorial headings through `var(--font-heading)`. Use Inter for body/interface text through `var(--font-body)` or `var(--font-sans)`. Use `var(--font-mono)` for labels, IDs, metadata, and data-dense UI.

Use `var(--text-*)` tokens for font sizes. Do not add new pixel font sizes in page-level CSS.

## Layout

Use the standard container widths:

- `.editorial-container` for narrow reading pages.
- `.wide-container` for medium-width editorial/product surfaces.
- `.full-bleed-container` for atlas-scale layouts.

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

## Do's & Don'ts

Do use the live `/design-system` page before building UI.

Do use role tokens instead of raw colors and fonts.

Do keep Civica Index and Civica Pulse visually prominent.

Don't create local page themes.

Don't introduce parallel token names for the same semantic role.

Don't hide source, license, or freshness context.
