# IDX-006 evidence — frozen longitudinal research panel

## Frozen release

`ci-research-panel-2000-2024-v1` contains a complete rectangular research grid:

- 194 current sovereign jurisdictions
- 25 years, from 2000 through 2024
- 5 source-native indicators: V-Dem Liberal Democracy Index, WGI Rule of Law, Freedom House total score, Transparency International CPI, and UNDP HDI
- 24,250 total cells: 19,866 observed and 4,384 explicitly missing

Each database row records source and owner, retrieval path, upstream vintage, native unit and orientation, transform, observed or missing state and reason, uncertainty availability and bounds, revision posture, series type, and a deterministic content hash. No gap is filled from another year or from the freshest available value.

## Integrity and coverage

- Row-set SHA-256: `ed6b5c358b08d2e9e5e13890a93337b585cbbfb5234f5dbd24c125332cc6a79f`
- Coverage SHA-256: `ebb6fbab9b2246578aa551cab85902ca0f9c4ddaeb2ef49e45e0f5c333868d26`
- Temporal-break SHA-256: `1dd19a9576b6dda9bf45f5058d2059ca88bd8080be48aab199949abaf99362f7`
- Observed/missing by source: V-Dem 4,298/552; WGI 4,622/228; Freedom House 4,236/614; CPI 2,270/2,580; HDI 4,440/410.
- Checked metadata artifacts live in `data/releases/ci-research-panel-2000-2024-v1/`. Exact source values remain in the private database because redistribution rights are mixed or pending.

The temporal-break registry and data note document the captured series' comparability boundaries. This is a harmonized historical panel from captured releases, not a claim that each row reproduces the value as originally published in that year.

## Immutability and verification

- Authoritative migrations `0010`–`0012` add the release and row tables plus database triggers that reject mutation of completed evidence.
- The live authoritative ledger contains all 13 migrations and the post-migration schema fingerprint is `3f1f49b235aee99b1861c589fe6cc2a760b1776f7544c53c079abf81eb1d8125`.
- `npm run validate:ci-research-panel` validates checked artifacts, counts, reasons, and hashes without a database.
- `npm run validate:ci-research-panel:live` rehashes all 24,250 rows and proves that a mutation attempt is rejected.
- The generator is resumable and insert-only. It never deletes staged or completed research evidence.
- All 672 repository tests and the full production build pass.
- `agent-browser` verified the rendered Index methodology page and its panel limitations.

## Publisher methodology references

- [V-Dem methodology](https://www.v-dem.net/about/v-dem-project/methodology/)
- [World Bank WGI methodology](https://www.worldbank.org/en/publication/worldwide-governance-indicators/documentation)
- [Freedom in the World methodology](https://freedomhouse.org/reports/freedom-world/freedom-world-research-methodology)
- [Corruption Perceptions Index methodology](https://www.transparency.org/en/cpi)
- [UNDP Human Development Report reader guide](https://hdr.undp.org/reports-and-publications/2023-24-human-development-report/readers-guide)
