# PUL-010 evidence

## Outcome

`pulse-information-environment-context/v1` replaces the incomplete static country mapping and midpoint fallback. Production responses preserve a true missing state: score, tier, source, vintage, hash, and coverage are all null, and the corroboration multiplier is one. The public changelog exposes only whether a historical unversioned context exists; it does not publish that scalar as current country context.

Runtime method `pulse-v2.6-beta` records `pulse-information-environment-uncertainty/v1`. The declared thresholds and multipliers can run only through an explicit sensitivity mode. Tests show their effect while proving that the same observed fixture has no production effect. The methodology calls the scenario uncalibrated and does not present it as a correction for reporting bias.

## Candidate source and rights boundary

- Publisher: Reporters Without Borders (RSF)
- Release: World Press Freedom Index 2026
- Exact file: `https://rsf.org/sites/default/files/import_classement/2026.csv`
- Methodology: `https://rsf.org/en/methodology-used-compiling-world-press-freedom-index-2026`
- Terms: `https://rsf.org/en/cgu`
- Retrieval: `2026-07-11T17:17:00.000Z`
- Publisher coverage: 180 country and territory rows
- Primary observation vintage: calendar year 2025, with later events included where RSF determined they materially changed the assessed situation
- SHA-256: `65ec7bd9b9740e0f51e9b4eea585030b2226c1a96938ec06a4cbbdbd2639aae2`
- Posture: restricted, no redistribution; matching and production use disabled pending rights review and validation

The downloaded publisher file stayed in ignored local research storage and is not committed or redistributed. The checked runtime contract publishes only release-level metadata.

## Sensitivity evidence

For a positive, news-only fixture with restricted context, baseline corroboration after the existing positive-event rule is `0.384`. Production remains `0.384`; the explicitly selected legacy sensitivity scenario produces `0.0576`. Missing context produces multiplier `1` even in sensitivity mode. These values are deterministic regression fixtures, not validation results.

## Live API and browser checks

- `/api/v1/pulse/japan/dimensions` returns method `pulse-v2.6-beta`, an all-null `missing` context, and no `pressFreedomContext` field.
- `/api/v1/pulse/changelog/v2` returns `legacyInformationContextPresent` and no raw `pressFreedomScoreAtClassification` field.
- `/civica-index/methodology/pulse` renders the Information context section and matching sidebar label in light and dark modes with no horizontal overflow.
- `/civica-index/pulse-changelog` renders without a server error, raw RSF score label, or browser console error.
- Browser QA found and fixed internal `PUBLIC_CLAIM` HTML comments appearing as reader prose; a shared renderer test now prevents recurrence.

## Boundaries

No country-level RSF values were ingested, matched, published, or used in production. The current database column holding historical unversioned scalars remains for private audit compatibility. PUL-038 owns a future immutable per-event context record if rights clearance and validation ever permit adoption. PUL-021 owns calibration of confidence and hand-set penalties.

## Verification

```sh
npx tsc --noEmit
npm run validate:design-tokens
npm run validate:index-change-control
npm run validate:pulse-runtime
npm run validate:source-input-manifest
npm run validate:rights-manifest
npm run validate:content-templates
npm run validate:claims-docs
node plan/tools/validate-master-plan.mjs
npm run build
```

The full suite contains 794 passing tests. The production build renders 98 static pages and retains the pre-existing non-fatal Next.js NFT trace warning from `next.config.ts`.
