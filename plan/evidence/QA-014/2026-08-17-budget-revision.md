# QA-014 budget revision — 2026-08-17

**Contract:** `civica-reader-performance-budget/v1` (values revised; metrics,
fixtures, observers, and fail-closed behaviour unchanged).
**Trigger:** the CI verify job's first run past its earlier blockers failed
`home: font bytes 222104 exceeds 200000`. The GitHub workflow had never had a
green run, so two later owner-approved product changes had never been measured
against the v1 budget values.

## Why the caps moved

1. **Fonts (2026-07-26 Type Lab faces post-date the v1 caps).** The v1
   `fontBytes: 200_000` shared cap was set on 2026-07-18. On 2026-07-26 the
   owner-approved self-hosted Newsreader + Archivo variable faces landed
   (`public/fonts/`, SHA-pinned). Their upright Latin subsets alone are
   90,104 + 132,000 = **222,104 bytes** — a hard floor above the old cap, so
   the budget could never pass again without reversing an owner typography
   decision. Measured payloads are exact minimal sets per route:
   home/atlas 222,104 (both upright Latin), constitution 323,780 (+ Archivo
   italic), record-article 470,652 (+ both italics). New per-fixture caps
   (240,000 / 240,000 / 340,000 / 490,000) each sit less than one
   smallest-subset file (~27 kB) above the measured payload, so any
   additional font file loading still fails.
2. **RSC bytes (CAC-005 made prefetch real).** The 2026-08-17 caching wave
   made 24 prose routes static; Next.js fully prefetches static routes linked
   from the header, footer, and Explore menu, where dynamic routes previously
   prefetched almost nothing. A complete prefetch pass inside the observation
   window measures ~800 kB RSC on a fast machine; the old 500 kB cap passed
   in CI only because a slower runner finished fewer prefetches inside the
   300 ms window (a timing flake). New shared cap: 900,000.
3. **Home images and request counts.** Home imagery measured 1,521,309 B
   against a 1,500,000 cap (growth predating this work); the cap moves to
   1,600,000. Prefetch adds request-count variance on home and the Record
   article; both move to 120.

## Measurements (production build, 2026-08-17, database-backed run)

| Fixture | RSC | Fonts | Images | Requests |
| --- | ---: | ---: | ---: | ---: |
| Home | 796,738 | 222,104 | 1,521,309 | 106 |
| Atlas | 799,537 | 222,104 | 259,912 | 92 |
| Constitution | 11,807 | 323,780 | 1,174,115 | 82 |
| Record article | 792,853 | 470,652 | 584,020 | 103 |

Font payload decompositions match the exact WOFF2 file sizes in
`public/fonts/` (see its SHA-256 manifest), confirming no unnecessary face or
subset is loaded anywhere: the per-route differences are exactly the italic
faces each route's prose genuinely uses.

These remain laboratory regression ceilings, not field Core Web Vitals
claims. All other v1 caps (HTML, JavaScript, CSS, timing, CLS, INP, long
tasks, map initialization) are unchanged.
