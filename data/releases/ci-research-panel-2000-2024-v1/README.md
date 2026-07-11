# Civica Index research panel, 2000–2024 (v1)

This release freezes the data foundation for the Index candidate tournament. It contains one cell for each of 194 current sovereign-state jurisdictions, 25 calendar years, and five source indicators. The private database holds 24,250 cells: 19,866 observations and 4,384 explicit missing values.

The panel keeps each indicator on its source scale. It does not carry values forward, choose a jurisdiction's freshest observation, fill gaps, or substitute one publisher for another. A missing cell has one of four reasons:

- `outside_comparable_series`: the publisher's comparable series had not begun;
- `outside_captured_release`: the retained source capture ends before that year;
- `source_not_published_for_period`: the source did not issue an observation for that period, such as WGI in 2001;
- `source_no_observation_for_jurisdiction_period`: the period belongs to the series but the retained data contain no value for that jurisdiction.

## Included indicators

| Owner | Indicator | Native scale | Observed | Missing | Retrieval path |
|---|---|---:|---:|---:|---|
| V-Dem Institute | Liberal Democracy Index (`v2x_libdem`) | 0–1 | 4,298 | 552 | Our World in Data republisher |
| World Bank WGI | Rule of Law estimate (`rl.est`) | approximately −2.5–2.5 | 4,622 | 228 | World Bank API |
| Freedom House | Freedom in the World total score | 0–100 | 4,236 | 614 | Our World in Data republisher |
| Transparency International | Corruption Perceptions Index | 0–100 | 2,270 | 2,580 | Our World in Data republisher |
| UNDP | Human Development Index | 0–1 | 4,440 | 410 | Our World in Data republisher |

HDI is included as a tournament baseline and context series, not as a current Civica Index dimension.

## Vintage and revision limits

The retained `indicator_history` rows predate Civica's complete source-vintage contract. Their labels identify a retained historical series, not a publisher release number. Every panel row therefore carries `source_vintage_status=legacy_retained_label_not_publisher_version` and `series_type=current_harmonized_backcast_not_as_published`.

This distinction matters. V-Dem reviews and sometimes changes its measurement model. WGI's 2025 methodology revision recalculated its historical estimates to 1996; WGI was biennial through 2000 and annual from 2002. Freedom House has made incremental changes, including a documented 2018 change. CPI scores become comparable on the current scale in 2012. UNDP warns that values printed in different report editions are not comparable and publishes a revised historical series for within-series comparison. The machine-readable break register is in `temporal-breaks.v1.json`.

No source-specific uncertainty value survives in the retained observations. The rows say whether uncertainty exists upstream and was not retained, or whether no per-country distribution is published. They do not invent bounds.

## Freeze and rights

Exact values live in the private `ci_research_panel_rows` table. Completed release rows are protected by database triggers against insertion, update, or deletion. The repository publishes counts and semantic hashes but no bulk values because included source terms are mixed and some remain unresolved or restrictive.

- Row SHA-256: `ed6b5c358b08d2e9e5e13890a93337b585cbbfb5234f5dbd24c125332cc6a79f`
- Coverage SHA-256: `ebb6fbab9b2246578aa551cab85902ca0f9c4ddaeb2ef49e45e0f5c333868d26`
- Temporal-break SHA-256: `1dd19a9576b6dda9bf45f5058d2059ca88bd8080be48aab199949abaf99362f7`

`npm run validate:ci-research-panel` checks the public metadata without database access. `npm run validate:ci-research-panel:live` rehashes every private row and proves that the immutability trigger rejects a mutation.

## Official methodology references

- [V-Dem methodology](https://www.v-dem.net/about/v-dem-project/methodology/)
- [World Bank WGI 2025 methodology revision](https://www.worldbank.org/content/dam/sites/govindicators/doc/The%20Worldwide%20Governance%20Indicators%202025%20Methodology%20Revision.pdf)
- [Freedom in the World methodology](https://freedomhouse.org/reports/freedom-world/freedom-world-research-methodology)
- [Transparency International CPI calculation and comparability](https://www.transparency.org/en/news/how-cpi-scores-are-calculated)
- [UNDP data reader's guide](https://hdr.undp.org/reports-and-publications/2020-human-development-report/data-readers-guide)
