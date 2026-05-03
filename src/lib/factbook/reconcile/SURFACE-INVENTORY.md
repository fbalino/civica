# Phase F surface inventory

> Living document. Tracks every place in the codebase that reads
> in-scope facts, classifies each by F.4 disposition, and tracks
> migration progress.
>
> Last grep: 2026-05-02 (F.3.5 build).

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
| Atlas world-map hover | `src/components/atlas/AtlasWorldMap.tsx`, `src/lib/atlas/load-atlas-data.ts` | C | pending F.4 | Hover tooltip; no provenance UI |
| Atlas compare picker | `src/app/(shell)/atlas/compare/page.tsx` | C | pending F.4 | List-shaped; per-row SourceDots can fetch lazily |
| Civica-index landing leaderboard | `src/app/(shell)/civica-index/page.tsx` | C | pending F.4 | List rows; main scoring surface |
| Civica-index country detail | `src/app/(shell)/civica-index/[slug]/page.tsx` | R | ✓ migrated 2026-05-02 | Hero meta strip (capital + population) and right-panel meta-grid (Capital + Population rows) render `<FactValueDot>` inline when resolver returns canonical data; degrade to plain text otherwise. Resolver canonical takes precedence over `jurisdictions` cache (consistent with public API contract). Capital currently has no canonical rows across countries — graceful degradation verified. |
| Factbook header strip | `src/components/factbook/FactbookHeaderStrip.tsx` (verify name) | R | pending F.4 | Carries SourceDots |
| Factbook structured sections | `src/components/FactbookSection.tsx`, `src/components/factbook/*` | R | pending F.4 | Per-field SourceDots |
| Legacy `/countries/[slug]` | `src/app/(reader)/countries/[slug]/page.tsx` and subroutes | R | pending F.4 | Still live; gets the same upgrade |
| Compare page overview | `src/components/compare/CompareOverview.tsx` | R | pending F.4 | Per-country fact comparisons |
| Embed widget | `src/app/embed/[slug]/route.ts` | R | ✓ migrated 2026-05-02 | Custom widget surfaces (capital, population, GDP, area) now read from `getCanonicalFactsForJurisdiction()` with `jurisdictions` cache as fallback. Footer renders a static read-only `Source: <sources> · Civica Atlas reconciled v0.1` attribution line built from the canonical source IDs (interactive `<FactValueDot>` panel is unsuitable inside an iframe). Stale `civica.io/countries/X` URL bug fixed to `civicaatlas.org/countries/X` in the medium and large widget footers. |
| Government-types listing | `src/app/government-types/page.tsx`, `src/app/government-types/[type]/page.tsx` | C | pending F.4 | Aggregate listing; no per-row SourceDots |
| Public API `/api/v1/countries/[code]` | `src/app/api/v1/countries/[code]/route.ts` | R | ✓ migrated 2026-05-02 | Response gains 5 new top-level classification fields (`worldBankRegion`, `worldBankIncomeGroup`, `vdemRow`, `monarchyStatus`, `governmentFormDescription`), a `provenance` block keyed by flat field name with `factKey` cross-reference + `alternates[]`, and a `meta.reconciliation` envelope (`{status, version, reference, vintage}`). Existing flat fields preserved for back-compat; resolver canonical takes precedence over `jurisdictions` cache when present. |
| Public API `/api/v1/countries/` | `src/app/api/v1/countries/route.ts` | C | pending F.4 | List endpoint; provenance available via per-country detail call |
| Country export route | `src/app/api/countries/[slug]/export/route.ts` | R | ✓ migrated 2026-05-02 | JSON export gains a `provenance` block (keyed by flat field name, mirrors the `/api/v1/countries/[code]` shape) plus a `meta.reconciliation` envelope. Existing flat fields preserved at the top level for back-compat (consumers reading `data.population` etc. continue to work — `provenance` and `meta` are additive siblings). 5 new top-level classification fields (`worldBankRegion`, `worldBankIncomeGroup`, `vdemRow`, `monarchyStatus`, `governmentFormDescription`). CSV export gains a leading `#`-comment citation header (CSV can't carry the structured provenance block). |
| Global search snippet | `src/components/GlobalSearch.tsx`, `GlobalSearchWrapper.tsx` | C | pending F.4 | Snippets only; no SourceDots |
| `/about` stat callouts | `src/app/about/page.tsx` | C | pending F.4 | Static-feel stats; staleness fine |

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
