# IDX-027 evidence

## Outcome

The public site now implements `source_native_dashboard_only` without deleting the Civica Index research record.

- Governance Evidence leads the homepage, desktop/mobile navigation, footer, sitemap, and legacy `/index` shortcut.
- Country data and `/compare` render the shared source-native evidence table. They do not query or render the Civica composite.
- `/rankings` contains only source-reported reference measures. The Atlas has no Civica Index layer or score query.
- `/api/v1/countries/[code]` no longer bundles `civicaIndex`. The six dedicated `/api/v1/index/*` families carry deprecation, 2026-07-31 sunset, and successor headers, then return `410 Gone` without values.
- Legacy `/embed/[slug]` returns a rights-linked `410` replacement notice. The old widget and government-type explorer resolve to the selected public product or research status.
- The methodology, README, citation metadata, replication surface, public claims, numeric-claim registry, rights registry, and compact-provenance audit now describe the adopted disposition.
- Composite tables, calculation code, frozen releases, tournament evidence, internal research components, minority arguments, and reconsideration criteria remain preserved.

## Fail-closed contracts

- `src/lib/ci/quarantine-contract.ts` and `scripts/validate-index-quarantine.ts` scan navigation, homepage, country data, compare, rankings, embeds, general-country API, all Index endpoint summaries, API sunset behavior, Atlas loader/layers, sitemap, release exclusions, rights, and claims.
- `src/lib/api/deprecation.test.ts` proves pre-sunset availability and post-sunset `410` behavior with no score field.
- `scripts/validate-ci-current-release.ts` keeps the frozen release pinned across research consumers while requiring the public Atlas to remain composite-free.
- `scripts/validate-ci-ranking.ts` preserves the archived competition-ranking contract while requiring public ranking UI to remain composite-free.
- `data/releases/index-disposition-2026-07-v1/resolution.v1.json` records `adopted_public_surface_migration_complete`.

## Verification

```sh
npm run validate:index-disposition
npm run validate:index-quarantine
npm run validate:api-docs
npm run validate:content-templates
npm run validate:design-tokens
npm run validate:claims-docs
npx tsc --noEmit
npm run build
node plan/tools/validate-master-plan.mjs
```

The production build passed its complete data, release, rights, documentation, 723-test, and Next.js build chain. Browser verification against the local server covered:

- `/governance-evidence?country=japan`: five native rows, publisher uncertainty/absence, vintage, publisher links, and rights-safe download.
- `/compare?c=japan&c=france`: source-native evidence for both countries and no composite comparison.
- `/country/japan/civica-data`: Governance Evidence is section 01; no Index breakdown or rank remains.
- `/civica-index`: research disposition and reconsideration record, with no leaderboard.
- `/`: Governance Evidence replaces the Index leaderboard teaser.
- `/rankings`: material/reference columns only.

The browser console contained no errors; only the standard React development-tools informational message appeared.
