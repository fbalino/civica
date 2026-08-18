# EXP-017 — Navigation and hero asset budget evidence

> **SUPERSEDED 2026-08-17.** Fernando rejected the image-led Explore
> megamenu direction and replaced it with a standard grouped header dropdown
> (commit `a8f58bcc`, PR #24). This document is retained unchanged as the
> historical record of the superseded direction; it does not describe what
> Civica ships. The current contract is the "Explore dropdown" entry in
> `DESIGN.md`.

Completed 2026-07-18.

## What changed

- `ThemedDecorativeImage` replaces decorative light/dark `<img>` pairs with a
  single CSS-backed active-theme image. It is used by shared parallax heroes,
  homepage country cards/fallback art, desktop/mobile Explore navigation, the
  design-system Explore sample, and the 404 compass.
- The desktop Explore panel mounts its art only after focus, hover, or click
  opens the disclosure. The mobile panel is already conditionally mounted and
  now uses the same active-theme renderer.
- Six 96×96 derived navigation WebPs preserve the original 850×850 source art
  while serving the measured 38px desktop slots. They total 6,856 B in light
  mode and 5,638 B in dark mode.
- The checked home image ceiling in `civica-reader-performance-budget/v1` is
  now 1,500,000 bytes.

## Browser results

Fresh Chromium against an isolated local application on 2026-07-18:

```sh
E2E_BASE_URL=http://localhost:3117 npm run test:e2e:navigation-assets
# 3 passed (12.2s)
```

The three journeys prove:

1. Closed desktop Explore makes zero navigation-art requests; opening it loads
   exactly the compact light set within the 20,000 B cap.
2. A dark reader opens the dark set and loads `hero-dark.webp`, not the light
   hero counterpart.
3. Closed mobile navigation makes zero navigation-art requests; opening it
   loads exactly the compact light set within the same cap.

An independent fresh-context measurement of homepage load, Explore open, and
Escape observed 14 image responses totaling 1,210,655 bytes: the hero,
homepage art, footer art, flags, and six compact menu files. The prior closed
homepage baseline was 22 images / 4,030,095 bytes, including the twelve
full-size Explore variants. This is a local laboratory measurement, not a
field-Web-Vitals claim.

`npm run test:e2e:performance` against the development server reached the
new image cap but reported its pre-existing development JavaScript payload
(4,767,751 B versus the production-oriented 1,200,000 B cap). It is not an
image regression; the CI command runs after a production build. The repository
also continues to have the unrelated `build:ci` Index change-control
documentation blocker recorded in QA-014 evidence.

## Static checks

```sh
npx tsc --noEmit
node --import tsx --test src/lib/qa/reader-performance-budget.test.ts
npm run validate:design-tokens
```

All passed. The implementation commits are `86e048d3`, `028b62a8`,
`6993d673`, `deadee66`, and `7cd8e478`.
