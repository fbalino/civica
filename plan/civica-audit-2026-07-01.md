# Civica Blind-Audit Ledger — 2026-07-01

**Method:** 9 blind surface-class finders (Sonnet 5, read-only, given NO known
examples) → adversarial per-finding verification (Opus 4.8, live-curl against a
running dev server) → sealed recall/precision check against a held-back
known-examples set the finders never saw.

**Raw totals:** 79 raw findings → **60 confirmed / 19 refuted**.
**After dedupe/cluster (this ledger):** 60 confirmed collapse into **48 distinct
issues** (12 merged as duplicate root causes) across 8 themes.
**Severity (adversarially-adjusted):** 3 high · 4 medium · 41 low.

> Severity below uses the *verifier's* adjusted severity, not the finder's
> optimistic one. Several finders flagged "high"; the adversary downgraded most
> to medium/low after confirming they're unreachable dead code, gated behind an
> admin key, or cosmetic. The three genuine highs are all CI data-accuracy bugs
> that render wrong numbers/labels on live, citable country pages.

---

## HIGH (3) — live data-accuracy bugs on citable surfaces

| # | Sev | File:line | Claim | Fix direction |
|---|-----|-----------|-------|---------------|
| 1 | HIGH | `src/components/ci/CIPulseScoreDisplay.tsx:56` | No-CI-data jurisdictions (Vatican, Jersey, Bouvet I., Anguilla) render score "—" but the band label falls back to the **last band row = "Failed / authoritarian"**. Slanders no-data states. | Make `bandRow(null)` return an explicit "no data" band, not `BAND_RANGES[last]`; render a neutral "No score yet" label when `bandLetter` is null. |
| 2 | HIGH | `src/lib/db/queries-scores.ts:323` | `freedomHouseLabel()` applies **retired 1–7 average thresholds** (≤2.5 Free / ≤5.0 Partly Free) to a value stored on the **2–14 sum scale**, so USA/France (genuinely "Free") show "Partly Free" beside their 83/92 scores. | Either double the thresholds to the 2–14 sum scale or divide the stored sum back to the 1–7 average before labeling; align with `normalize-v2`. |
| 3 | HIGH | `src/lib/db/queries.ts:1046` (`compareCICountries`) → `/api/v1/index/compare` | Endpoint returns **legacy-v1 raw `normalizedScore`** per dimension while `/compare` page and every other v1/embed surface use `displayDimensionScore` (v2). France 2024-Q4 diverges up to 10.5 pts for the same quarter. | Route dimension `rawValue`/`sourceId` through `displayDimensionScore()` in the API layer (mirror `CompareCivicaIndex.tsx:24-27`). |

---

## MEDIUM (4)

| # | Sev | File:line | Claim | Fix direction |
|---|-----|-----------|-------|---------------|
| 4 | MED | `src/app/(reader)/country/[slug]/civica-data/page.tsx:237` | Composite-source provenance strip prints the literal word **"Beta"** in the *date* column when `calculatedAt` is missing — contradicts the same row's SourceDot `data-date="Not yet synced"`. | Render "Not yet synced" (or blank) in the date cell when `calculatedAt` is null; "Beta" is a maturity chip, not a date. |
| 5 | MED | `src/components/country/CivicaIndexPanel.tsx:685` | Breakdown copy always says **"Composite of 4 governance dimensions"** even for partial countries (Nauru, Tonga) that render only 3 dimension rows. | Derive the count from actually-rendered dimensions (`dimensionsAvailable`), not the hardcoded `civicaIndex.dimensionCount`. |
| 6 | MED | **CI methodology-version pinning** — `src/lib/db/queries.ts:985` + `src/lib/db/queries-scores.ts:105` *(2 findings, same root cause)* | Neither the `getCICountryDetail` dimensions query nor `buildCivicaIndexRow`'s trend-fallback pins `methodology_version='beta'`; 47 jurisdictions have both v1.0 and beta rows at 2023-Q4, so Postgres row-order decides which leaks into a beta-labeled response / trend arrow. | Add `AND methodology_version = 'beta'` to both queries (siblings `compareCICountries`/`getCIByGovernmentTypeDots` already do). |
| 7 | MED | `src/app/(reader)/country/[slug]/layout.tsx:46` | Shared `generateMetadata` hardcodes the **Factbook title + `/country/[slug]` canonical for all 3 tabs**, so civica-data & constitution self-canonicalize to the wrong URL/title. | Move title/canonical into each tab's own `generateMetadata`, or parametrize by segment. |

---

## LOW (41) — grouped by theme

### A. Design-token / per-page-style drift (11)
| # | File:line | Claim | Fix direction |
|---|-----------|-------|---------------|
| 8 | `src/components/ci/GovernmentTypesAccordionExplorer.tsx:842` | Reachable `/civica-index/government-types` explorer is styled by a ~490-line per-component `<style>{CSS}</style>` with ~33 px font-sizes, hardcoded radii, legacy `--font-serif`. | Migrate to `editorial.css` classes + `--text-*/--space-*/--font-heading`. |
| 9 | `src/app/compare/page.tsx:361` | ~600-line per-page `<style>` block with px magic numbers on a reader `EditorialPage`. | Lift shared patterns into `editorial.css`; tokenize spacing. |
| 10 | `src/app/(reader)/civica-index/widget/page.tsx:229` | ~430-line inline `<style>` with raw px paddings/gaps. | Tokenize spacing; move reusable rules to `editorial.css`. |
| 11 | `src/components/atlas/**` (~86 literals, e.g. `AtlasCountryCenter.tsx:265`) | Systemic raw inline `style={{fontSize/padding/margin}}` — **but dead code** (orphaned three-pane shell, no `src/app` importer). | Delete the orphaned atlas shell subtree (see #24); no live impact. |
| 12 | `src/components/factbook/FactbookLightbox.tsx:23` | Component-level `#000`/`#fff` hex constants outside `:root`/swatch. | Define overlay colors as tokens (`--color-overlay-*`) in `:root`. |
| 13 | `src/app/globals.css:3516` | `.ghc-canvas` hardcodes `border-radius:12px` (should be `--radius-lg`); `.ghc-branch` uses untokenized `10px`. | Replace with `var(--radius-lg)` / nearest radius token. |
| 14 | `src/app/shell.css:104` | `.pane-handle--left/--right` use raw `4px` radii where `--radius-sm` exists. | Use `var(--radius-sm)`. |
| 15 | `src/components/outcomes/CountryOutcomeBars.module.css:110` | 7 rules use `1px`/`2px` radius literals (sub-pixel hairlines; scale bottoms out at 4px). | Minor nit; add `--radius-xs` if a token is wanted, else leave. |
| 16 | `src/components/factbook/FactbookHeaderStrip.tsx:410` | Live masthead silently omits missing Pop/GDP pills instead of the documented "No source" placeholder (canonical `CountryMasthead.tsx` is dead code). | Render "No source" placeholder to honor the 2026-05-01 provenance-display convention. |
| 17 | `src/app/api/v1/index/rankings/route.ts:202` | Legacy taxonomy sort filters/paginates in-memory (bounded to ~230 rows; deprecated path to 2027-03-31). | Latent only; push limit/offset into SQL if the path survives past sunset. |
| 18 | `src/app/api/v1/index/rankings/route.ts:159` | Rows omit `iso2` while `/api/v1/countries[/*]` return both `iso2` + `iso3`. | Add `iso2` to `baseSelect` for shape consistency. |

### B. Routing / redirect drift (7)
| # | File:line | Claim | Fix direction |
|---|-----------|-------|---------------|
| 19 | **Stale `/atlas/:slug/structure` links** — `src/components/atlas/AtlasWorldMap.tsx:695` + `src/components/atlas/OrgDetailPanel.tsx:326` *(2 findings, same root cause)* | Live hover-card CTA and org member rows link to the pre-refactor `/atlas/:slug/structure`, forcing a 308 hop to `/country/:slug`. | Point both directly at `/country/${slug}`. |
| 20 | `next.config.ts:103` | `/atlas/organizations` is a 3-hop chain (308→307→200) because `(reader)/organizations/page.tsx` is an in-app `redirect()` to `/organizations/un`; sitemap lists the never-rendering `/organizations` at prio 0.5. | Redirect `/atlas/organizations` straight to `/organizations/un`; drop `/organizations` from sitemap or give it real content. |
| 21 | `next.config.ts:60` | `/index/:path*` for a country slug is a double-308 (`→/civica-index/:path*→/country/:slug/civica-data`). | Add a direct `/index/:slug → /country/:slug/civica-data` rule. |
| 22 | `src/components/MobileNav.tsx:554` | Status-page link uses `next/link` `<Link>` (no `target`/`rel`) for an external URL vs footer's `<a target="_blank" rel="noopener noreferrer">`. | Use a plain `<a target="_blank" rel="noopener noreferrer">`. |
| 23 | `src/app/constitution/page.tsx:17` | Hardcodes `MAX_SLUGS = 4` instead of importing shared `DEFAULT_MAX_SLUGS` from `slugs.ts:13`. | Import the shared constant. |
| 24 | `src/components/atlas/AtlasCountryShellClient.tsx` (+ `AtlasMapShellClient`, `AtlasCountryCenter`, `CountryMasthead`, tabs) | Orphaned pre-refactor three-pane shell subtree, zero `src/app` importers, tree-shaken but stale routing baked in. | Delete the subtree (also resolves #11, #16). |

### C. Constitution feature edges (5)
| # | File:line | Claim | Fix direction |
|---|-----------|-------|---------------|
| 25 | **Unsanitized Constitute HTML** — `src/components/constitution/ConstitutionReadingColumn.tsx:165` + `ConstitutionCrossReferencePane.tsx:267` *(2 findings, same root cause)* | Full body + excerpt HTML rendered via `dangerouslySetInnerHTML` with no sanitizer anywhere in ingest/render; single trusted academic source, so low-likelihood stored-XSS. | Add a sanitizer (e.g. sanitize-html/DOMPurify) at ingest in `sync-constitutions.ts`. |
| 26 | `src/components/constitution/ConstitutionLanding.tsx:112` | Featured-topic chips emit `#topic-<key>` hash anchors no code reads → clicking silently fails to preselect the topic. | Read the hash on load and preselect the topic, or drop the anchor and pass topic via a query param. |
| 27 | `src/components/constitution/ConstitutionCrossReferencePane.tsx:45` | `fetchExcerpts` has no AbortController/generation guard → rapid topic switching can overwrite the pane with stale-topic excerpts. | Add an AbortController or request-id guard in the effect. |
| 28 | `src/app/api/constitution/excerpts/route.ts:27` | `topic` param never validated against `isKnownTopic()` → bogus topic returns 200 + empty set instead of 400. | Call `isKnownTopic()` and 400 early. |
| 29 | `src/components/factbook/FactbookAlmanac.tsx` | Countries landing has no URL-param support for region/advanced filters → filtered views aren't shareable and reset on reload. | Sync `region`/`filters` to URL search params (as `/compare`, `/constitution` do). |

### D. A11y / interactive-element gaps (6)
| # | File:line | Claim | Fix direction |
|---|-----------|-------|---------------|
| 30 | `src/components/outcomes/OutcomesExplorer.tsx:367` | DetailPanel drawer lacks `role="dialog"`/`aria-modal`, Escape handler, focus management (siblings implement all). | Add dialog role/aria-modal + Escape + focus trap/restore (copy `MapExplorerModal` pattern). |
| 31 | `src/components/atlas/tabs/InternationalTab.tsx:183` | Two picker rows are `<div onClick>` with no role/tabIndex/keydown — keyboard/SR-unreachable. *(Note: atlas shell is dead code per #24.)* | If kept, convert to `<button>`/`<a>`; otherwise deleted with #24. |
| 32 | `src/app/elections/ElectionsClient.tsx:258` | Expandable TimelineCard is a clickable `<div>` with no role/tabIndex/keydown. | Make it a `<button>` or add role/tabIndex/onKeyDown (Enter/Space). |
| 33 | `src/components/atlas/AtlasWorldMap.tsx:622` | Compare-banner "×" unpin is a bare `<span onClick>` — no name/role/keyboard. | Convert to `<button aria-label="Remove … from comparison">`. |
| 34 | **Filter chips missing fieldset/legend + aria-pressed** — `src/app/(reader)/civica-index/pulse-changelog/PulseChangelogFilterClient.tsx:18` + `.../country/methodology/reconciliation/disputes/DisputesFilterClient.tsx:76` *(2 findings, same root cause)* | `FilterChip` lacks `aria-pressed`; groups use plain `<span>` labels not `<fieldset>/<legend>/role="group"` (unlike canonical `AlmanacFilters`). | Adopt the `AlmanacFilters` fieldset/legend/aria-pressed pattern. |
| 35 | `src/components/dev/DevDesignPanel.tsx:182` | Clickable `<span onClick>` nested inside a `<button>` (invalid interactive nesting; dev-only). | Move reset control outside the button, or make it a real sibling button. |

### E. API-embed shape / docs / throttling (7)
| # | File:line | Claim | Fix direction |
|---|-----------|-------|---------------|
| 36 | `src/app/api/countries/[slug]/export/route.ts:16` | Rate limiter imported + documented ("30/min/IP") but **never invoked** — endpoint fully unthrottled (35 reqs, no 429). | Actually call `checkInMemoryRateLimit(getRequestIp(req))` in the GET handler. |
| 37 | `src/app/api/v1/index/compare/route.ts:21` | Endpoint spreads the **full `jurisdictions` row** (internal id, `factCacheRefreshedAt`, timestamps) + raw `ciDimensionScores` rows (ingestionId, sourceId) — every other v1 route curates fields. | Map to a curated public shape (mirror `index/[slug]`). |
| 38 | `src/app/api/v1/index/[country_slug]/route.ts:90` | Serves deprecated `structuralFamily/structuralSubtype` but omits the `withStructuralFamilyDeprecation` headers/meta every sibling attaches; `.../history` has the same gap. | Wrap responses with `withStructuralFamilyDeprecation()`. |
| 39 | `src/app/api-docs/page.tsx:502` | index-country example omits always-present fields (`governmentClassification`, `vintageLabel`, `completenessFlag`, `totalRanked`, `isPartial`, `missingDimensions`, `dimensionsAvailable`, `methodologyVersion`). | Update the docs example to the real response shape. |
| 40 | `src/app/api-docs/page.tsx:94` | Embed docs omit the working `size=custom` mode (`w`,`h`,`include`) that the route implements (Phase G). | Document `size=custom` + its params. |
| 41 | `src/app/embed/[slug]/route.ts:48` | Non-standard `X-Frame-Options: ALLOWALL` (browser-ignored no-op); CSP `frame-ancestors *` is what actually works. | Drop the ALLOWALL header (vestigial). |
| 42 | `src/app/embed/[slug]/route.ts:57` | Embed route has **zero rate limiting** (real DB + resolver fetch per request); only CDN `s-maxage` mitigation. | Add `withRateLimit`, or accept CDN caching as the documented mitigation. |

### F. Security / auth hardening consistency (4)
| # | File:line | Claim | Fix direction |
|---|-----------|-------|---------------|
| 43 | **Admin bearer `===` non-constant-time** — `src/app/api/admin/contact/route.ts:8` + `pulse-review/[id]/route.ts:91` + `data-disputes/[id]/route.ts:96` + `session/route.ts:46` *(2 findings, same root cause)* | Bearer compared with plain `===` while `cron-auth.ts`/`session.ts` cookie path use documented `crypto.timingSafeEqual` `safeEqual()`. | Route all bearer compares through `safeEqual()`. |
| 44 | `src/app/api/countries/[slug]/bills/route.ts` (+ scores/constitution/outcomes/leaders/structure/democracy/international, constitution/excerpts[/notable], metrics strip-data) | Public per-country DB sub-routes have **no rate limiting**, unlike the hardened `/export` sibling. | Apply the same per-IP limiter across public GET routes. |
| 45 | `src/app/api/admin/pulse-review/[id]/route.ts:90` + `data-disputes/[id]/route.ts:99` | `x-civica-reviewer` header trusted verbatim (`.trim()` only) as audit-log actor — no length cap / char sanitize (session path caps 80ch, strips to `[a-zA-Z0-9 _.\-]`). | Sanitize + cap the header (mirror the session path); ADMIN_API_KEY-gated so low. |
| 46 | `src/lib/api/cron-auth.ts:26` | Returns **500 (not 401)** when `CRON_SECRET` unset — intentional fail-closed but inconsistent with admin's 401. | Cosmetic/observability nit; align to 401 or document the difference. |
| 47 | `src/app/api/admin/contact/route.ts:22` | `offset` param parsed with no `Math.max(0,…)`/NaN guard while `limit` is clamped (ADMIN_API_KEY-gated, self-affecting). | Clamp `offset` like `limit`. |

### G. Content / doc URL & number drift (2 distinct + 1 deferred)
| # | File:line | Claim | Fix direction |
|---|-----------|-------|---------------|
| 48 | `content/methodology-civica-index.md:82,137,174` | Methodology asserts docs are "published in the replication package" and links to `/civica-index/replication`, which is a "Coming soon / Q3 2026" stub. | Soften the claims to future-tense, or hide the links until the package ships. |
| 49 | **Stale `/factbook/…/reconciliation` URL + "Factbook" label drift** — `content/about.md:37` + `content/about.md:7` (comment) + `AGENTS.md:105` + `DESIGN.md:126` *(4 findings, same Wave-1b root cause; the 5th, `content/methodology-reconciliation.md:354/366/372`, is the deferred file — see Deferred)* | Live prose/docs link to `/factbook/methodology/reconciliation` (now 308→`/country/…`) and call the first card "Factbook" not "Country Profiles". | Update all live URLs to `/country/methodology/reconciliation`; fix AGENTS.md/DESIGN.md paths and the about.md comment label. |
| — | `src/app/(reader)/country/methodology/reconciliation/page.tsx:169` | Live page hardcodes per-fact-key source counts (unemployment 12, population 11, …) one line after a correct `{stats.*}` interpolation → silent DB drift. *(Verifier downgraded to low; TODO comment is a JSX comment, not visible prose.)* | Replace hardcoded counts with `{stats.*}` soft-fail interpolation. **(Track as #50.)** |

*(#50 = the reconciliation hardcoded-counts finding above; counted in the 48.)*

---

## Recall check — sealed §Known-open positives

| Sealed item | Verdict | Matching finding / note |
|-------------|---------|-------------------------|
| 1. `compare/page.tsx` ~600-line inline `<style>` | **FOUND** | Finding #9 (verified, low). |
| 2. Constitution multi-country SSR payload heavy (~1.6MB/3) | **MISSED** | No finder measured SSR payload size. The **feature-edges** finder covered constitution logic (race, hash anchor, HTML sanitize) but never weighed the response. → **Re-run feature-edges deeper with an explicit payload-size / bundle-weight probe.** |
| 3. Photo galleries small/uneven (~8 Wikimedia photos) | **MISSED (tolerable)** | Content/data-gap, not a code bug; sealed note pre-authorizes this as a tolerable miss. No re-run needed. |
| 4. Mapbox pk token not URL-restricted (external) | **N/A** | Excluded from recall (dashboard-only, not code-discoverable). |

**Recall result:** 1 of 2 code-discoverable positives found (#1). One real miss (#2, SSR payload weight) — feature-edges under-covered performance/size; recommend a deeper re-run. Miss #3 is the pre-authorized tolerable content gap.

## Precision check — sealed §Negative controls (already fixed)

Scanned all 60 confirmed findings against sealed items 9–15 (hollow constitution
excerpts, `intrght` dup-key, 4:3 flag crop, 16:9 blog-engraving crop,
OFFICE_RANK `judicial` key, mobile sticky-search, pulse missing-confidence
normalization). **Zero confirmed findings re-report any of them as currently
broken.** ✅ **Precision failures: 0 — as expected.** (The adversarial verify
phase correctly refuted 19 raw findings, none of which resurrected a fixed item.)

## Deferred-item handling — sealed §Owner-deferred

| Sealed deferred item | Did a finder flag it? | Ledger treatment |
|----------------------|----------------------|------------------|
| 5. Design-system v2 palette fork (embed v1 palette/shadows) | **No** finder re-raised it | Correctly left alone. **KNOWN-DEFERRED — do not fix unasked** (memory-decisions 2026-06-20). |
| 6. `structural_family` removal Phase 6 (2027-03-31) | Partly touched via #38 (deprecation headers) & #17 (legacy taxonomy path) | Those are *header/pagination hygiene on the still-live deprecated surface*, NOT the Phase-6 column drop. Phase 6 itself is **KNOWN-DEFERRED (calendar-gated 2027-03-31)** — do not do the column drop now; #17/#38 are safe pre-sunset fixes. |
| 7. ~18 near-identical factbook sync adapters (DRY) | **No** | **KNOWN-DEFERRED** — not surfaced, correctly. |
| 8. Outcomes/peer-band section (postponed pending methodology) | **No** (Outcomes findings are a11y #30, not the peer-band slot) | The postponed peer-band slot is **KNOWN-DEFERRED**; #30 is an unrelated a11y fix on the *existing* OutcomesExplorer and is fair game. |

No confirmed finding is *itself* one of the four deferred items, so none are
miscounted as "new." Items adjacent to deferred work (#17, #38, #30) are
genuinely separate, safe-to-fix issues and remain in the ledger.

---

## Suggested fix waves

**Wave A — CI data-accuracy (highest priority, citable-surface correctness).** Size **M**.
Findings #1, #2, #3, #5, #6 (both methodology-pin queries), #50.
All live-visible wrong numbers/labels on country pages, the compare API, and the
CI breakdown. Touches `CIPulseScoreDisplay.tsx`, `queries-scores.ts`,
`queries.ts`, `CivicaIndexPanel.tsx`, `civica-data/page.tsx`, reconciliation page.
*(#4 "Beta" date-cell rides along here — same civica-data provenance strip.)*

**Wave B — Design-token / per-page-style cleanup.** Size **L** (mostly mechanical).
Findings #8 (government-types explorer — the big one), #9 (compare page), #10
(widget page), #12–#16 (lightbox hex, ghc radii, shell/outcomes radii, masthead
"No source"). Kill inline `<style>` blocks, tokenize spacing/radii. Do **not**
touch the deferred v2-palette fork.

**Wave C — Dead-code deletion + routing hygiene.** Size **S–M**.
Findings #24 (delete orphaned atlas three-pane shell — auto-resolves #11 and the
a11y #31 living in it), #19 (stale `/atlas/structure` links), #20/#21 (redirect
chains), #22 (mobile status link), #23 (shared slug constant). One coherent
"align routes to the post-refactor IA" pass.

**Wave D — API surface consistency + throttling + auth hardening.** Size **M**.
Findings #36 (wire up the dead export limiter), #37 (compare row leak), #38
(deprecation headers), #39/#40 (api-docs shape/embed params), #41/#42 (embed
header + rate limit), #43 (constant-time bearer compare ×4 routes), #44 (rate-limit
public sub-routes), #45/#46/#47 (reviewer-header sanitize, cron 401, offset clamp),
#18 (iso2 shape). Security + public-API polish; all low but cheap and thematically one pass.

**Wave E — Content/URL drift + constitution & a11y edges.** Size **M**.
Findings #48 (replication-package claims), #49 (Wave-1b `/factbook→/country` URL
+ label drift across about.md/AGENTS.md/DESIGN.md), #25 (sanitize Constitute HTML),
#26 (topic-hash anchor), #27 (fetch race), #28 (topic validation), #29 (Almanac
URL filters), #30/#32/#33/#34/#35 (a11y: dialog/keyboard/aria-pressed/nested-button).
Docs truth + feature-edge + a11y correctness; independent files, parallelizable.

**Not in any wave (deferred — do not fix unasked):** v2 palette fork,
`structural_family` Phase-6 column drop, factbook sync-adapter DRY refactor,
Outcomes peer-band slot. See Deferred-item handling above.

---

## RESOLUTION (2026-07-01, same day)

All five waves shipped to production the same day, each independently
verified before commit:

| Wave | Commit | Scope |
|---|---|---|
| A — CI data accuracy | 30db738 | #1-6, #50 (3 HIGH incl. the "Failed / authoritarian" no-data label, Freedom House scale fix, API/page score divergence) |
| B — token cleanup | 15e164e | #8-10, #12-14, #16 (#15 left per ledger) |
| D — API hardening | 0b4d3b1 | #18, #36-47 (limiters live, timing-safe auth, leak closed, deprecation headers; history route deliberately un-wrapped — serves no deprecated fields) |
| C — dead code + routing | dd7ad6c | #19-24 + #33 (9 orphaned atlas files deleted; single-hop redirects) |
| E — content/edges/a11y | 0d74f13 | #7, #25-32, #34-35, #48-49 (sanitizer, ?topic=, fetch race, dialog a11y, canonical-per-tab, URL drift) |

Open leftovers (deliberate): #15 (ledger: leave); CompareInAtlasClient +
Hemicycle orphan candidates (flagged in dd7ad6c, out of ledger scope);
inline-logo-SVG dedup on /constitution (~729KB×3, new perf note from Wave E);
the four owner-deferred items (untouched by design).

Post-gate fix worth remembering: Wave E's first URL-filter cut
(useSearchParams + Suspense-with-same-component-fallback) broke `next build`
AND would have demoted the static /country index to a fallback shell —
reworked to client-side window.location seeding; /country remains statically
exported with the full HTML index.
