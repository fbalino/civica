# DAT-025 — Four-clock temporal metadata

Completed 2026-07-11.

## Outcome

Civica now treats these as separate fields:

1. observation/reference year — when the measurement or classification applies;
2. upstream dataset release — the publisher/original dataset edition and distributor release;
3. retrieval time — when Civica acquired the selected input;
4. Civica publication version — the named Civica release or taxonomy version.

Migration `0026_temporal_metadata` adds the four-clock contract to frozen Atlas rows and the corresponding BR/CGV fields to `government_taxonomies`. Snapshot writers populate them at cut time. The Atlas v3 export, codebook, BOM, G2 package, clean-room fixture, peer-grouping API, generated data dictionary, methodology, and BR/CGV reader view expose the distinction.

## BR/CGV correction

The previous ingest assigned `regime_year = 2025`, conflating the original dataset's time-series endpoint with the QoG cross-section. Publisher evidence says:

- QoG Standard Jan26 cross-section generally prioritizes data around 2022;
- its Jan26 codebook identifies Bjørnskov-Rode regime data v6.1;
- `br_dem`, `br_pres`, `br_mon`, and `br_com` each have cross-section min/max year 2022;
- the original time series extends through 2025.

All 187 populated BR/CGV classifications now carry reference year 2022, original release `Bjørnskov-Rode regime data v6.1`, distribution `QoG Standard Jan26`, retrieval `2026-04-22T04:01:13.289Z`, and Civica publication version `2026_v1`.

Primary sources: [QoG Standard Dataset](https://www.gu.se/en/quality-government/qog-data/data-downloads/standard-dataset) and [QoG Standard Jan26 codebook](https://www.qogdata.pol.gu.se/data/codebook_std_jan26.pdf), section 4.7 and variable entries for the four BR regime fields.

## Honest historical coverage

- 17,506/17,506 frozen Atlas rows have a Civica publication version matching their vintage label.
- 14,588 have a defensible observation/reference year.
- 13,287 have upstream-release and retrieval metadata demonstrably present at or before the cut.
- 4,219 source-release/retrieval values remain null because the current selected source row was retrieved after the historical cutoff; DAT-025 does not backfill those from later state.

## Verification

- `npm run validate:temporal-metadata`: pass.
- Database constraints reject mismatched Atlas publication labels and incomplete populated BR/CGV temporal metadata.
- A seeded `2025` BR cross-section fixture fails with `must be 2022, not 2025`.
- Peer-grouping API returns all four temporal fields; the reader page visibly says reference year 2022 rather than 2025/2026.
- `civica-atlas-export/v3` live rebuild matches semantic SHA-256 `60556198b2ee3805f93558db47b1e5620c4f8f5cf372d6f83ebb6265fdcfa9fc`.
- 631/631 tests pass.
- All migration, data, API, claims/documentation, and release gates pass; production build passes.
- Desktop light and 390px dark browser checks pass; the live API returns the expected temporal object.
