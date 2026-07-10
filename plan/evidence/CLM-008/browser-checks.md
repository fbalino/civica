# CLM-008 browser checks

The final local build was served from the shared Civica checkout and checked in a real in-app browser. The bundled Playwright CLI wrapper was unavailable because the current package no longer exposed its expected binary, so the installed browser-control runtime performed the same DOM, console, responsive, theme, and visual checks without changing project dependencies.

| Surface | Viewport/theme | Result |
|---|---|---|
| Index methodology | 1440×1000, light | Correct WGI Rule of Law source, fixed-bound table, partial re-proportioning, rounded-median disclosure, neutral presentation, and candidate-cross-check label rendered; no horizontal overflow. |
| Index methodology | 1440×1000, dark | Same final disclosures rendered legibly; no overlap or horizontal overflow. |
| Index methodology | 390×844 | Reader navigation and page copy remained responsive with no document-level horizontal overflow. The final repair changed prose/table labels only, not layout or styling. |
| Rankings | 1440×1000 and 390×844 | Page loaded 251 jurisdictions; canonical Beta dimension values were present; the wide data table remained inside its horizontal-scroll container and the document itself did not overflow. |

Additional checks:

- Rendered DOM contains the exact point-estimate disclosure and no `anchored z-score` method.
- The table heading says candidate cross-checks are not currently ingested.
- The Rule of Law primary source renders as World Bank WGI.
- `recompute the CI` is absent; the pseudocode says `recompute the weighted composite`.
- Methodology and rankings reported zero console warnings/errors.
- Final light and dark screenshots were visually inspected during the run; no layout or contrast blocker was found.
