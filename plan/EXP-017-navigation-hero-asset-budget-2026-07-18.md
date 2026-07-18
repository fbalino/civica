# EXP-017 — Navigation and hero asset budget

Status: completed 2026-07-18.

## Decision

Decorative assets with light and dark variants use the shared
`ThemedDecorativeImage` renderer. It exposes the pair as CSS variables and
lets the browser resolve only the active theme background. A system-dark media
query covers the pre-hydration paint; `data-theme` takes over for the explicit
reader preference.

The desktop Explore disclosure does not mount its illustrations until it is
open. The mobile dialog remains conditional and uses the same renderer. The
six reused Explore motifs have 96×96 derived WebPs under
`public/engravings/navigation/`, intended for the measured 38px desktop slot;
the source 850×850 artwork remains unchanged.

## Measured contract

The checked browser suite is `e2e/exp-017-navigation-asset-budget.spec.ts`.
It proves that closed desktop and mobile navigation make zero requests for
`/engravings/navigation/`, opening a menu fetches exactly the active-theme
six-file set, and a dark homepage fetches `hero-dark.webp` rather than
`hero.webp`. The six compact files total 6,856 B light and 5,638 B dark; the
test allows at most 20,000 B per opened menu.

`civica-reader-performance-budget/v1` now sets the homepage image cap to
1,500,000 decoded bytes. In a fresh local Chromium context, home plus the
Explore interaction measured 1,210,655 image bytes, down from the former
closed-home baseline of 4,030,095 bytes that transferred all twelve original
navigation variants.

The CI workflow runs both the existing production reader-performance suite and
the dedicated navigation-assets suite after its built-server setup.
