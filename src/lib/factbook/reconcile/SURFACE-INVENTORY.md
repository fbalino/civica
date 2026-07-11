# Phase F surface inventory

> Living document. Tracks every place in the codebase that reads
> in-scope facts, classifies each by F.4 disposition, and tracks
> migration progress.
>
> Last contract review: 2026-07-11 (DAT-031).

## Contract reminder

Per methodology §1.0 + schema §11:

- Surfaces displaying provenance (a `<SourceDot>`, alternates panel,
  or API `provenance` block) **must** call the resolver via
  `getCanonicalFact()` / `getCanonicalFactsForJurisdiction()` /
  `getCanonicalFactsForJurisdictions()`.
- Surfaces displaying value-only AND tolerating up-to-24h staleness
  **may** read the cached `jurisdictions` columns via
  `readCachedField()`.
- New code is forbidden from reading `jurisdictions.population` /
  `.gdpBillions` / `.areaSqKm` / `.capital` / `.languages` /
  `.currency` / `.democracyIndex` directly outside
  `src/lib/factbook/reconcile/cache.ts`. The lint rule lands in
  F.4 as a `no-restricted-syntax` ESLint config; until then,
  rely on this inventory + code review.

## Migration disposition by surface

`R` = resolver-direct (must show provenance / alternates)
`C` = cache-read (value-only, 24h staleness OK)
`?` = needs human triage during F.4
`✓` = migrated as of last grep

| Surface | File(s) | Disposition | Status | Notes |
|---|---|---|---|---|
| Atlas masthead | `src/components/atlas/CountryMasthead.tsx`, `src/app/(shell)/atlas/[slug]/[tab]/page.tsx`, `src/components/atlas/AtlasCountryShellClient.tsx`, `src/components/atlas/AtlasCountryCenter.tsx` | R | ✓ migrated 2026-05-02 | Population + GDP rows render `<FactValueDot>` (clickable alternates panel) when resolver data is present; falls back to plain `<SourceDot>` otherwise. `headerFacts` prop threads through page → ShellClient → Center → Masthead. |
| Atlas world-map hover | `src/components/atlas/AtlasWorldMap.tsx`, `src/lib/atlas/load-atlas-data.ts` | C | ✓ migrated 2026-05-02 | `load-atlas-data.ts` reads cached fields via `readCachedFieldFromRow(j, factKey)` for capital/languages/currency/population/gdp/area; `AtlasWorldMap.tsx` itself only consumes the typed `AtlasCountry` shape and required no changes. |
| Atlas compare picker | `src/app/(shell)/atlas/compare/page.tsx` | C | ✓ migrated 2026-05-02 | Page consumes `loadAtlasData()` output (already migrated above); no direct cached-column reads at this surface. |
| Civica-index landing leaderboard | `src/app/(reader)/civica-index/page.tsx` | C | ✓ migrated 2026-05-02 | Leaderboard row population read swapped to `readCachedFieldFromRow(r, "population_total")`. |
| Civica-index country detail | `src/app/(reader)/civica-index/[slug]/page.tsx` | R | ✓ migrated 2026-05-02 | Hero meta strip (capital + population) and right-panel meta-grid (Capital + Population rows) render `<FactValueDot>` inline when resolver returns canonical data; degrade to plain text otherwise. Resolver canonical takes precedence over `jurisdictions` cache (consistent with public API contract). Capital currently has no canonical rows across countries — graceful degradation verified. |
| Factbook header strip | `src/components/factbook/FactbookHeaderStrip.tsx` | R | ✓ migrated 2026-05-02 | Pop + GDP pills render `<FactValueDot>` (clickable alternates panel) when `populationResolver` / `gdpResolver` props are present; falls back to plain `<MetaPill>` otherwise. |
| Factbook structured sections | `src/components/FactbookSection.tsx`, `src/app/(reader)/factbook/[slug]/page.tsx` | R | ✓ migrated 2026-05-03 | `LeafRow` introduces a small `LABEL_TO_FACT_KEY` map (Capital, Population, Languages, Currency, GDP (PPP)). For leaves whose humanized label matches AND the resolver returned a canonical row, the generic CIA-Factbook `<SourceDot>` is replaced by `<FactValueDot>`. Page batch-fetches the in-scope fact-keys once and threads them through. Non-matching leaves (most factbook prose: Coastline, Climate, Industries, etc.) keep the legacy SourceDot — they ARE CIA prose. |
| Legacy `/countries/[slug]` | `src/app/(reader)/countries/[slug]/page.tsx` | R | ✓ migrated 2026-05-03 | `StatRow` extended with optional `factKey` + `resolverFact` props; when canonical row exists, renders `<FactValueDot>` instead of `<SourceDot>`. Profile rows for Capital, Population, GDP, Area, Languages, Currency now read resolver canonical with `jurisdictions` cache as fallback (mirrors the public-API contract). Same `reconciledFacts` map also threaded through to `<FactbookSection>` so the structured-section migration applies here too. |
| Compare page overview | `src/components/compare/CompareOverview.tsx`, `src/app/compare/page.tsx` | R | ✓ migrated 2026-05-02 | Page batch-fetches resolver outputs for all selected countries via `getCanonicalFactsForJurisdictions()` and threads them as `facts` prop into the overview grid. Capital, Population, GDP, Area, Languages, Currency rows render `<FactValueDot>` inline when canonical data is present; numeric column-max highlight preserved. Falls back to plain text when resolver lacks the fact-key. |
| Embed widget | `src/app/embed/[slug]/route.ts` | R | ✓ migrated 2026-05-02 | Custom widget surfaces (capital, population, GDP, area) now read from `getCanonicalFactsForJurisdiction()` with `jurisdictions` cache as fallback. Footer renders a static read-only `Source: <sources> · Civica Atlas reconciled v0.1` attribution line built from the canonical source IDs (interactive `<FactValueDot>` panel is unsuitable inside an iframe). Stale `civica.io/countries/X` URL bug fixed to `civicaatlas.org/countries/X` in the medium and large widget footers. |
| Government-types listing | `src/app/government-types/page.tsx`, `src/app/government-types/[type]/page.tsx` | C | n/a — surface archived 2026-05-02 | Pages deleted in `structural_family` removal Phase 3d; `next.config.ts` now 308-redirects `/government-types` and `/government-types/:type` to `/civica-index/methodology/peer-grouping`. No live traffic to migrate. |
| Public API `/api/v1/countries/[code]` | `src/app/api/v1/countries/[code]/route.ts` | R | ✓ DAT-031 contract hardened 2026-07-11 | Requires `as_of=live` or a complete immutable vintage label. Live reads the resolver and may use the live cache only when a resolver fact is absent. Vintage reads only `country_fact_vintages`; missing frozen facts remain null. `meta.reconciliation` reports the selected mode, label, cut, retrieval horizon, and methodology versions derived from those rows. |
| Public API `/api/v1/countries/` | `src/app/api/v1/countries/route.ts` | R | ✓ DAT-031 contract hardened 2026-07-11 | Requires the same explicit selection. Live list facts come from the resolver with cache fallback. Vintage list facts and peer-lens fact filters come only from `country_fact_vintages`; absent frozen values remain null. Selection metadata is returned in `meta.selection`. |
| Country export route | `src/app/api/countries/[slug]/export/route.ts` | R | ✓ DAT-031 contract hardened 2026-07-11 | JSON and CSV require the same explicit selection and record it in the export. Live exports are private/no-cache. Named vintage exports load only frozen rows and may be cached as immutable. Unsupported full labels and shorthand labels fail closed. |
| Global search snippet | `src/components/GlobalSearch.tsx`, `GlobalSearchWrapper.tsx` | C | ✓ migrated 2026-05-02 | `GlobalSearchWrapper` reads `capital` via `readCachedFieldFromRow(c, "capital")` when projecting jurisdictions into the snippet shape. The client component itself only consumes typed snippet props and required no changes. |
| `/about` stat callouts | `src/app/about/page.tsx` | C | n/a — no in-scope reads | The current `/about` page reads only the `sources` table for source-card listings; it does not surface population/GDP/capital/etc. No migration required at this revision. |

## Pre-existing data quality issues to fix in F.4

Discovered during F.3.5 cache refresh:

1. **Languages prose stored as `[object Object]`**.
   `scripts/seed-from-factbook.ts` did `String(someJsonObject)` somewhere
   in its CIA prose extraction. Affects `fact_value` for `languages`
   and (after F.3 bridge) `official_languages` rows. Need to re-parse
   from the underlying CIA prose blob in F.4 or before, picking the
   canonical English-language string.
2. **Currency stored as exchange-rate text** (e.g.
   `"nairas (NGN) per US dollar - "`). The CIA `currency` field
   is the exchange-rate description, not an ISO code. Phase F's
   canonical `currency_code` should hold the ISO 4217 code.
   Bridge does NOT cover this — `currency_code` is intentionally
   unbridged; F.6 ingests from World Bank.

## Reads forbidden after F.4 lint rule lands

These exact column reads on `jurisdictions` will trigger an
ESLint error outside `src/lib/factbook/reconcile/`:

- `jurisdictions.population` / `j.population`
- `jurisdictions.gdpBillions` / `j.gdpBillions`
- `jurisdictions.areaSqKm` / `j.areaSqKm`
- `jurisdictions.capital` / `j.capital`
- `jurisdictions.languages` / `j.languages`
- `jurisdictions.currency` / `j.currency`
- `jurisdictions.democracyIndex` / `j.democracyIndex`

Identity-only reads (slug, name, iso2, iso3, wikidataQid,
continent, governmentType, governmentTypeDetail, flagUrl) remain
free.

## Migration order (recommended)

1. **Public API first** (R). Two routes, well-tested. Touchstone
   for the resolver's JSON shape.
2. **Atlas masthead** (R). High-traffic surface; biggest UX
   visibility for the "atlas and factbook show same numbers" goal.
3. **Factbook header + sections** (R). Pair with atlas masthead
   to verify same-source-same-numbers.
4. **Civica-index country detail** (R). Heavy use of SourceDots.
5. **Compare overview** (R). Multi-country fact comparison.
6. **Embed widget** (R). Citation surface.
7. **Cache-read surfaces in bulk**: world map, leaderboard, search,
   government-types, /about, /api/v1/countries. These can migrate
   in one PR — the read pattern is `readCachedField()` everywhere.
