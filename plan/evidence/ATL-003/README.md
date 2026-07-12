# ATL-003 — source-native longitudinal indicator history

Completed 2026-07-12.

## Result

Country Civica Data and Compare now expose documented source-native history
for the five production series already retained in `indicator_history`:

| Series | Live rows | Jurisdictions | Years |
|---|---:|---:|---:|
| Freedom House Total Score | 4,452 | 194 | 2003–2025 |
| Transparency International CPI | 2,283 | 179 | 2012–2024 |
| UNDP HDI | 5,906 | 192 | 1990–2023 |
| V-Dem Liberal Democracy Index | 28,545 | 175 | 1789–2025 |
| World Bank WGI Rule of Law | 5,029 | 194 | 1996–2024 |

The chart keeps publisher-native values and scales. Readers can change the
series and time window, compare countries, inspect source and release lineage,
see gaps longer than the expected cadence, and distinguish missing or disputed
states from observed zero. The current-release limitation is explicit: these
are historical observations from the captured release, not reconstructed
historical as-published vintages.

## Rights-safe download

`/api/countries/:slug/indicator-history` publishes JSON or CSV. It filters
observations through `indicator-history-country-export` in the rights manifest.
At completion, World Bank WGI is exportable; Freedom House, Transparency
International, UNDP, and V-Dem observations remain withheld while their source
rights are pending. JSON names withheld series without exposing their values;
CSV fails closed when every requested series is blocked.

## Performance

- Live Japan query: 333 observations.
- PostgreSQL planning time: 0.353 ms.
- PostgreSQL execution time: 0.725 ms.
- Plan used `jurisdictions_slug_unique` and
  `idx_indicator_history_jur_dim`.
- The deterministic grouping test processes 50,000 rows inside a 2,500 ms
  budget; the observed local run completed in 41.3 ms.

## Browser checks

Checked on the local production-shaped app in desktop and 390 px mobile
viewports, light and dark themes:

- `/country/japan/civica-data#longitudinal`;
- `/compare?c=japan&c=germany#longitudinal`;
- all five selectors and the 10/25/50/max ranges;
- WGI-only download visibility under current rights;
- explicit missing-year language;
- no page-level horizontal overflow;
- no Civica console errors.

Screenshots in this directory retain the country and comparison states used in
the review.

## Verification

- TypeScript passed.
- Fifteen targeted history, value-state, and surface-matrix tests passed.
- Design-token, rights-manifest, rights-claims, data-value-state, and Atlas
  surface-matrix gates passed.
- The full claims/documentation gate passed with all 936 tests.
- The complete production build passed and generated all 105 static pages.
- The G2 Atlas and Atlas/Index reviewer packet inventories were regenerated
  after the additive rights-manifest product changed their checked hashes; no
  released observation changed.
