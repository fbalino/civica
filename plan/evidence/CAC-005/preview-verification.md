# CAC-005 — Preview-deployment verification

**Date:** 2026-08-17 · **Deployment:** `civica-git-feat-cac-option-a-fbalinos-projects.vercel.app` (commit 2e20e0e, state Ready) · Captures used a deployment-protection share cookie.

## Freed routes now CDN-cache

| Route | Request 1 | Request 2 |
|---|---|---|
| /licensing | `x-vercel-cache: PRERENDER` | `x-vercel-cache: HIT` |
| /terms | `PRERENDER` | `HIT` |
| /methodology | `PRERENDER` | `HIT` |

All 200 with `cache-control: public, max-age=0, must-revalidate` (the CDN
serves the prerendered copy; browsers still revalidate).

## Regression checks (must stay dynamic) — all pass

| Route | Result |
|---|---|
| /elections | 200 · `private, no-store` · MISS |
| /civica-index/methodology/pulse | 200 · `private, no-store` · MISS |
| /country/japan | 200 · `private, no-store` · MISS |
| /country/japan/civica-data | 200 (not a 404) · MISS |
| /leaders | 200 · MISS · body renders live counts, no "verification in progress" degraded copy |

## Build facts

- Full `npm run build` green with dev server stopped; PLT-014 gate: 75
  surfaces / 49 DB-dependent / 26 build-only, zero edits to
  `scripts/validate-cache-consistency.ts`.
- `.next/prerender-manifest.json`: 41 prerendered routes (24 freed prose
  routes, 15 blog posts, robots/favicon/global-error).
- `/design-system` resolved the plan's open conflict: the gate's own
  dependencyPath classifies it root-layout-only, so it is freed.
- The plan's example slug `/country/jpn` 404s because country slugs are full
  names (`/country/japan`); not an incident.
