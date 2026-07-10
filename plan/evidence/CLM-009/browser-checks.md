# CLM-009 browser checks

Status: **PASS**

- Production build: `http://127.0.0.1:3109`
- Viewports: desktop `1440 × 1000`; mobile `390 × 844`
- Routes: `/civica-index/methodology`, `/civica-index/methodology/pca-appendix`, `/civica-index/methodology/peer-grouping`
- Browser: headless Chromium via Playwright 1.59.1

## Acceptance results

- All six route/viewport combinations returned HTTP 200.
- The rendered pages contained no `GEN:START` / `GEN:END`, `NaN`, `undefined`, or unresolved `{{...}}` text.
- The methodology page rendered three populated tables; the PCA appendix rendered four; peer grouping rendered one.
- Every table is inside the shared `.editorial-table-scroll` primitive with `overflow-x: auto`.
- All three mobile documents measured `390px` scroll width against `390px` client width: no document-level horizontal overflow.
- The actual `Switch to dark mode` control was found and clicked on every route at both viewport sizes. In every case, `data-theme` and `localStorage.theme` changed to `dark`, and a second click restored both to `light`.
- No console errors and no HTTP 4xx/5xx responses occurred. Chromium reported cancelled speculative Next.js RSC prefetches (`net::ERR_ABORTED`) during theme rerenders/context teardown; these were not failed page/data requests.

## Mobile table measurements

| Route | Table | Scroll width | Client width | Programmatic scroll |
|---|---:|---:|---:|---:|
| Methodology | Dimensions | 884 | 350 | 0 → 534 |
| Methodology | Normalization | 814 | 350 | 0 → 464 |
| Methodology | Monte Carlo summary | 619 | 350 | 0 → 269 |
| PCA appendix | Adopted weights | 484 | 350 | 0 → 134 |
| PCA appendix | Correlations | 700 | 350 | 0 → 350 |
| PCA appendix | Eigenvalues | 457 | 350 | 0 → 107 |
| PCA appendix | Loadings | 432 | 350 | 0 → 82 |
| Peer grouping | Worked examples | 1375 | 350 | 0 → 1025 |

Every wide table changed `scrollLeft`; right-hand columns are reachable without moving the document.

## Visual inspection

The final light mobile and dark desktop screenshots were inspected. No marker text, overlapping content, or clipped page chrome was visible. Tables remain deliberately viewport-contained and horizontally scrollable on narrow screens.

## Final screenshots

- `clm009-methodology-desktop-light.png`
- `clm009-methodology-desktop-dark.png`
- `clm009-methodology-mobile-light.png`
- `clm009-pca-appendix-desktop-light.png`
- `clm009-pca-appendix-mobile-light.png`
- `clm009-peer-grouping-desktop-light.png`
- `clm009-peer-grouping-mobile-light.png`

An earlier Spark pass was discarded because it passed viewport options to `browserContext.newPage()`, which Playwright ignores; its purported mobile measurements were therefore 1280px desktop measurements. The final figures above come from isolated contexts created with the requested viewport and a selector matching the control's real accessible name.
