# CLM-008 evidence — Civica Index method reconciliation

**Task:** Reconcile public Civica Index documentation with the canonical ingestion, normalization, missingness, weighting, uncertainty, panel-analysis, neutral-presentation, and release contracts.

**Result:** Pass. The public methodology now describes the actual Beta/v2 pipeline, the public rankings matrix uses the same fixed-bound dimension transform as the headline composite, and a DB-free executable fixture recomputes the published rules through production exports.

## Canonical Beta contract

- Headline dimensions: Democratic Quality, Rule of Law, Freedoms & Rights, and Corruption Control.
- Production sources: V-Dem Liberal Democracy Index, World Bank WGI Rule of Law, Freedom House Political Rights + Civil Liberties, and Transparency International CPI.
- Normalization: fixed theoretical bounds through `normalizeV2`; there is no anchored-z-score fallback.
- Missingness: Democratic Quality and Rule of Law are mandatory. A partial estimate re-proportions the available weights to the full composite weight and widens the input-variation assumptions.
- Point estimate: rounded median of the Monte Carlo composites.
- Range: central input-variation range from the lower and upper simulated percentiles; it is not a confidence interval for a latent true score.
- Presentation: neutral numeric position, no country letter grade or qualitative score verdict.
- Release status: research Beta. The legacy v1 calculation remains archived for reproducibility and is not the public default.

## Behavior delivered

- Corrected the public Rule of Law source from V-Dem to World Bank WGI.
- Removed the nonexistent anchored-z-score method and the unused RSF headline normalization row.
- Reconciled missing-data prose with the actual re-proportioning behavior and disclosed its upward-bias risk.
- Documented that the published integer is the rounded simulation median.
- Marked secondary indicators as candidate cross-checks that are not currently ingested into the headline Index.
- Replaced stale confidence-interval and pre-cutover comments with the current Beta contract.
- Added optional seeded-RNG injection without changing production's `Math.random` default.
- Exported the pure completeness, adjusted-weight, composite, and Monte Carlo seams used by production and the fixture.
- Corrected `/rankings` Beta dimension cells to normalize `raw_value` with `displayDimensionScore` rather than reading the archived v1 `normalized_score` column.

## Executable fixture

`src/lib/ci/__tests__/worked-examples.test.ts` is DB-free and runs in the default test suite. It verifies:

- all four headline source transforms, direction, bounds, clamping, and unknown-source behavior;
- production weights and rendered site-state coherence;
- full, partial, and insufficient composites;
- mandatory-dimension exclusion, partial re-proportioning, and widening;
- deterministic Monte Carlo median/lower/upper behavior through the injectable RNG seam;
- Beta/release and neutral API-presentation metadata;
- the rankings-matrix v2 normalization regression;
- the published peer-group minimum against the production constant.

The fixture imports production functions and constants; it does not carry an independent scoring implementation.

## Verification

- `npm run test -- src/lib/ci/__tests__/worked-examples.test.ts` — 104/104 repository tests passed, including the new fixture.
- `npm run validate:content-templates` — seven migrated reader documents clean; zero unresolved paths or fallbacks.
- `npm run validate:public-claims` — 28 claims, all 14 required surfaces covered, zero grade/verdict leaks or unregistered headline claims.
- `npm run validate:numeric-claims` — all discovered public mutable counts classified correctly.
- `npm run validate:design-tokens` — no new drift; the 412 legacy baseline findings are unchanged.
- Targeted ESLint — zero errors; one pre-existing unused `_id` warning in `src/lib/db/queries.ts` remains.
- `npm run build` — passed TypeScript, runtime validators, compilation, and 85/85 static pages. The known broad Turbopack/NFT trace warning remains unchanged.
- `git diff --check` — passed.

No ingestion, calculation, database mutation, deploy, or paid API call was performed.

## Independent review

- `SP53 CLM-008 reconnaissance` ran explicitly as `gpt-5.3-codex-spark` through subscription-authenticated Codex CLI and produced the initial file inventory.
- `OP48 CLM-008 contract adjudication` resolved to `claude-opus-4-8`, independently verified the canonical pipeline, and returned **GO WITH CONDITIONS**.
- `SN5 CLM-008 fixture architecture` and `SN5 CLM-008 implementation` resolved to `claude-sonnet-5` through subscription authentication.
- The resumed Opus 4.8 acceptance review returned **PASS**. Its one medium disclosure recommendation—the rounded Monte Carlo median—and two low wording clarifications were applied in the bounded repair loop and reverified.

## Browser evidence

See [browser-checks.md](browser-checks.md). The final methodology disclosures rendered correctly in light and dark modes with no console warnings/errors or horizontal overflow. The rankings page loaded 251 jurisdictions and exposed corrected v2 dimension values without runtime errors.

## Explicit follow-ups

- `CLM-009`: single-source the methodology registry and PCA appendix results instead of retaining TSX literals and parallel metadata copies.
- G3 Index tournament tasks: test the deterministic weighted mean against the Monte Carlo-median headline, re-evaluate missing-data policy, and rerun PCA/construct/redundancy validation on the full panel.
