# Caching Restoration — Scope and Plan

**Status:** proposal, awaiting owner scope decision
**Owner decision required before CAC-007 and beyond**
**Task ID prefix:** `CAC-`
**Investigation date:** 2026-08-15 · **Next.js version inspected:** 16.2.7 (docs read from `node_modules/next/dist/docs/`, matching the pin in `package.json:520`)

---

## 1. What this is

Every page request to Civica currently starts a small server, reads the database, and builds the page from scratch, even for pages that are pure text and never change between deployments. Restoring caching means letting Vercel's content network keep a finished copy of the pages whose content genuinely does not change per visitor, and serve that copy for free. The prize is a lower hosting bill and faster pages; the price is that any cached page shows slightly older data, which for a provenance-first reference work is the thing that must be controlled rather than assumed away.

---

## 2. The decision Fernando has to make

**The choice is: how much staleness is Civica willing to publish in exchange for how much cost.**

The current configuration answers "none, ever" — 63 files declare `export const revalidate = 0`, which tells the CDN in plain HTTP terms never to store the page. That is a deliberate answer, not an accident (see §3). The question is whether to keep it as the answer for all 75 page surfaces, or to carve out categories where it is not the right answer.

Three scopes. They stack — B includes A, C includes A and B.

### Option A — Cache only surfaces that touch no mutable data

Make the pure-prose, legal, methodology and generated-artifact pages genuinely static, by removing the one database read that currently reaches every page in the app (the header search box and footer country list, mounted in the root layout).

- **What it saves:** ~24 routes stop booting a serverless function entirely. Separately and independently of caching, it removes roughly four database round trips and two unprojected full-table reads from *every* request on *every* one of the 75 page surfaces, including the 49 that stay dynamic. That second effect is probably the larger cost win.
- **What it risks:** the header search list and footer country list become deploy-frozen. A newly added or renamed jurisdiction will not appear in the search box until the next deployment. No rendered fact, no `SourceDot`, no registered numeric claim, and no citation surface is affected — verified: these two components render navigation affordances only, and the search combobox renders zero countries until the reader types.
- **Effort:** 3–4 days.
- **Gate change required:** none. The existing build gate already permits non-database pages to be static.

### Option B — Add bounded cache windows to pages fed by scheduled jobs

Extend Option A by giving database-backed reader pages a cache window no longer than the job that feeds them (see §5).

- **What it saves:** this is where the country profiles live — the routes that carry the actual crawler traffic across ~253 jurisdictions.
- **What it risks:** three things, and they are not small. (i) `export const revalidate = N` in Next.js is *stale-while-revalidate by construction*: after the window expires the first reader still receives the stale page while regeneration happens behind them, and if regeneration throws, the stale page keeps being served. The project's own cache contract forbids exactly this for mutable database data (`src/lib/platform/cache-consistency.ts:262-264`). (ii) Per the Next docs, an on-demand invalidation call (`revalidateTag`) invalidates the Next server cache but **does not purge a CDN** — so a published correction could remain served at the edge for the full window unless a separate Vercel edge purge is wired and proven. (iii) Several pages soft-fail a database outage into a coherent HTTP 200 "no data" render; caching one of those pins it (see §4, R1).
- **Effort:** 6–9 days on top of A, and it requires an owner-signed methodology decision plus a rewrite of the build gate's page rule.

### Option C — Cache Components (`cacheComponents: true`) + `use cache` + tag invalidation

The Next 16 destination architecture: opt individual data functions into caching, tag them by data domain, and fire tag invalidation from the 39 existing cron routes.

- **What it saves:** the most, and it is the only option that is correct by construction rather than by convention — an untagged cached read can be made a build failure.
- **What it risks:** it is a repo-wide migration. All 63 `revalidate` declarations and 45 `dynamic = "force-dynamic"` exports become dead (route-segment config is removed under Cache Components). The gate must be rewritten. Client navigation switches to React `<Activity>`, which stops resetting component state on navigate — a visible behavioural change across the constitution outline, ReaderSidebar, atlas map, tab bar and admin workspaces. And the CDN-purge question from Option B applies here too. One correction to a common assumption: enabling Cache Components blind does **not** silently ship stale data. It makes data fetching *dynamic* by default and fails the build with `Uncached data was accessed outside of <Suspense>`. The failure mode is a broken build, not a provenance violation.
- **Effort:** 15–25 days, and it should not start until B's questions are answered.

### Recommendation

**Do Option A now. Commission the two Stage-2 spikes (CAC-006 measurement, CAC-008 CDN purge proof) immediately after. Do not commit to B or C until both report.**

Reasoning:

1. Option A requires no change to the safety gate, breaks no provenance claim, and is fully revertible task by task.
2. The per-request cost removal in A applies to all 75 surfaces, not just the 24 that go static — so its cost benefit is not limited to the routes it makes cacheable.
3. **Option A will probably not restore a 78% hit rate, and this plan does not claim it will.** The ~24 freed routes are single-URL prose pages; by URL count they are a small fraction of the public surface, and the traffic is ~100% crawler sweeping distinct country URLs. A crawler visiting 253 country pages once produces a MISS on each regardless of window length. Caching optimises repeat requests to the same URL, which is not the traffic shape described.
4. Because of (3), the honest sequence is: land A because it is right on its own merits, then *measure* before spending 6–25 more days on B or C.

---

## 3. Why the current state exists

The `revalidate = 0` declarations are the mechanical output of one rule in a checked build gate, `scripts/validate-cache-consistency.ts` (1,336 lines, introduced 2026-07-15 as PLT-014, wired into `npm run build`). The rule: if a page's import graph reaches the database driver, it must resolve to a literal `revalidate = 0`.

**What that gate protects, in plain language:**

- **A cached page cannot be un-published.** If a fact is corrected or retracted, a page already sitting in a cache keeps showing the old value until its timer expires. The gate's stated rationale is exactly this: with request-live reads "there is no cache entry to invalidate after a write and no stale value to serve when a revalidation attempt fails."
- **It stops private data reaching a shared cache.** The gate's predecessor declared cache policies but never proved a response actually carried them. The 2026-07-14 route audit found eight public API routes emitting no `Cache-Control` at all and eleven private/PII methods (admin advisory-application lists, contact lists, OAuth callbacks, Pulse coding mutations) using the *public* error boundary. That is a real PII-through-shared-cache class of bug, and it is why the gate is written to be maximally suspicious.
- **It fails closed on new work.** Its own test suite includes four negative fixtures proving that a new database-backed page with no declaration, a new API method with no policy, a bare success response, and a cache call hidden in a dead helper each fail the build.

The gate currently **passes**. It reports `Page surfaces: 75; 74 DB-dependent; 1 build-only`. It is not broken and it is not blocking a fix — it is correctly reporting that 74 of 75 surfaces touch the database.

**Do not delete this gate.** Any option beyond A extends its policy; none of them removes it.

---

## 4. Risk register

Ranked by severity. The ranking is deliberate: plain data staleness is *not* first, because within a single cached render the value and its provenance timestamp are read in the same query pass, so a cached page is a coherent older snapshot rather than a lie.

### R1 — BLOCKER — A cached outage render publishes "Civica has no data"

22 non-admin page files catch a database error and render a coherent degraded page at HTTP 200 instead of throwing. 19 of the 22 log nothing. A swallowed exception is a *successful* render, so Next writes the cache entry — and on a revalidation it **replaces a previously good entry**. A 30-second Neon blip becomes hours of published understatement of Civica's coverage, on a fast 200 response no monitor will flag.

Confirmed outputs: `/leaders` renders "Current-officeholder verification in progress" instead of the live people/jurisdiction counts (`src/app/(reader)/leaders/page.tsx:31-37`, ternary at `:51-54`); the home grid degrades its catalog count to an em-dash (`src/components/home/HomeGrid.tsx:80-94`, `:121`); `/about` drops its source-record count (`src/app/about/page.tsx:92`, copy at `:357-359`); `/methodology/approach` degrades three `{{stats.*}}` numbers to "multiple" / "Many" / "many" (`content/data-approach.md:36`, `:100`).

**Sharpest edge:** not all degraded renders are 200. `src/app/(reader)/country/[slug]/civica-data/page.tsx:182-183` does `.catch(() => null)` then `notFound()` — a database blip yields **HTTP 404 with `<meta name="robots" content="noindex">`** for a real country. On ~100% crawler traffic, caching a noindex 404 on a country profile is worse than any understated count. Fix this path first.

**Mitigation:** rethrow at the page boundary so a failed load produces an uncacheable 5xx. `src/lib/atlas/surface-query-state.ts:13-23` already exposes an optional `rethrow?: (error) => boolean` predicate — use that seam. **A per-render "degraded ⇒ no-store" flag is not implementable** under Cache Components: cached scopes cannot read request-time APIs, and `unstable_noStore` is marked legacy and will not opt out of static generation inside a cache scope.

*Corrections to note before anyone acts:* `src/app/rankings/page.tsx` has no catch block (a failure there already 500s safely). `src/app/(reader)/country/[slug]/page.tsx:73` does not catch its primary record either — only five secondary fetches soft-fail, so its worst case is a partial 200.

*Not verified:* whether a throw inside a `use cache` scope suppresses the cache write. Documented for classic ISR; inference for `use cache`. Prove it on a preview deployment before relying on it.

### R2 — BLOCKER — A cached Pulse methodology page asserts a failed feed is "operating"

`/civica-index/methodology/pulse` renders **live** feed operating state, not a checked artifact. `src/lib/pulse/v2/source-coverage.ts:129-151` derives operating/degraded/inactive from the latest retained ingest run. The page also prints two registered runtime claims (retained rows + latest data minute, resolved/unresolved jurisdictions). If the 08:00 UTC ingest fails, the live page correctly flips a connector to degraded — and a cached copy keeps telling an external reviewer the feed is operating. That is a false claim about Civica's own measuring instrument, on the page whose purpose is to disclose instrument health.

**Rule: this feed-state block stays request-live at window 0**, even if the surrounding prose is cached.

### R3 — HIGH — "This page was generated at 14:02" when it was generated at 08:02

Two public research-export routes stamp their own generation time into the payload body: `src/app/api/countries/[slug]/indicator-history/route.ts:113` and `src/app/api/countries/[slug]/export/route.ts:131`, both `generatedAt: new Date().toISOString()`. Unlike a `SourceDot` — where value and timestamp freeze together and stay coherent — this field is a claim *about the response itself*. **This is the explicit provenance-lie class:** a cached copy states a generation time that never happened, and it is the handle a citing academic records. Both routes are already covered by a checked test requiring `public-live` and forbidding stale-while-revalidate; that test must not be relaxed.

Lower severity, same family: `src/app/blog/page.tsx:102` renders `new Date().toLocaleDateString(...)` as the masthead dateline. A cached blog index prints the wrong day to every reader.

### R4 — HIGH — A cached election page republishes a row the live gate has disqualified

Public election qualification is content-bound and fails closed **at request time** (`src/lib/db/queries.ts:994-1019`). Any change to an election, result, statement, jurisdiction status, or referenced source makes the live row fail closed until the checked audit is regenerated. A cached page keeps rendering a source-dated future election after its fingerprint stopped matching. There is no elections cron in `vercel.json` — election rows change only via manual scripts, so no cadence-derived window is safe.

*Mitigating fact:* the upcoming/past split is not now-relative; it filters against a build-time constant (`ELECTION_CORPUS_AUDIT.asOf`). Caching cannot mislabel a past election as upcoming.

**Rule: `/elections` and `/api/v1/elections` stay request-live.**

### R5 — MEDIUM — Cache keyed on pathname alone serves one reader's filters to another

13 public pages read `searchParams`. The sharpest is `/governance-change`, whose registered claim is "{comparable} of {eligible} sovereign-state records" **for the exact selected time window**. Serving one window's coverage figure under another window's URL is a false comparative statistic. Others: atlas, corrections (pagination), pulse-changelog, civica-data, disputes, report-data-issue, civica-conditions, compare, constitution, constitution/search, governance-evidence, admin sign-in.

### R6 — MEDIUM — Citation accordions freeze the half that was meant to be stable

`src/components/cite/CiteAccordion.tsx` pairs a server-supplied `dataVintage` with a client-computed `accessedAt` (`:84`). Most call sites cite immutable handles and are safe. Two cite a live timestamp and would be corrupted: `src/components/constitution/ConstitutionCrossReferencePane.tsx:431` (Constitute `lastSyncAt`) and the Pulse methodology page at `:286`.

### R7 — MEDIUM — The dead `revalidate = 3600` will arm three country tabs at once

`src/app/(reader)/country/[slug]/layout.tsx:37` declares 3600. Next resolves a route's revalidate as the **minimum** across the segment chain, and all three child tabs declare 0, so it has never taken effect. The danger is the shape of the eventual fix: deleting the three zeroes "to let the layout's intent work" would immediately govern the masthead (head of state, head of government, capital, population, GDP-PPP), the Civica Data tab, and the constitution reader simultaneously, at a number chosen before any of this analysis existed. **Delete the 3600 rather than inherit it.**

### R8 — LOW — Frozen `now` extends the 24-hour fail-closed jurisdiction fact bound

`src/lib/factbook/reconcile/api.ts:712` sets a 24h max age; `:887-893` returns `{value: null, state: "stale_timestamp"}` past it. `now` is captured once per render (`src/components/home/HomeGrid.tsx:75`; `src/app/api/v1/countries/route.ts:156`), so a cache window makes the effective contract 24h + window.

Scoped honestly: only **two** production files call the bounded reader, across six call sites. `/country` directory does **not** — it reads `row.capital` raw with no timestamp gate. The home page's `capital` read feeds a prop the search component never renders. Actual reader-visible exposure is two population figures on two featured cards, and the designed fail-closed behaviour is silent omission, not a disclosure. Meanwhile the *unbounded* variant (`readCachedFieldFromRow`, no timestamp check at all) already ships in 4 files / 9 call sites including the site-wide footer, site-wide header search, 404 page, and the Atlas world map. A 24h→25h move on two numbers is a design note; the unbounded reads are the larger inconsistency and are out of this plan's scope.

### R9 — LOW/STRUCTURAL — Divergence between a cached page and an uncached API

A reader comparing a cached country page against `/api/v1/*` gets two different "current" answers with two different timestamps for the same fact. Reputational and consistency risk, not a provenance lie. Fixed by giving the page and its API twin the same window, or by leaving both at zero.

---

## 5. Cadence to maximum cache window

Rule used: window = min(cadence of every feed the page renders, any code-level freshness bound, any request-live gate). **A page takes the minimum across every feed it touches.** Derived from the 39 cron entries in `vercel.json`.

| Job(s) | Schedule (UTC) | Data cadence | Public surfaces fed | Max window |
|---|---|---|---|---|
| bills: us, uk, ca, br, de, fr | 03:00–05:30 daily | daily | civica-data Bills module; `/api/countries/[slug]/bills` | 6h |
| factbook/sync-cia-cabinets | 01:00 daily, 1/28 shard | ~9 countries/day, full pass monthly | country cabinet module; `/leaders` | 6h |
| factbook/refresh-cache | 06:30 daily | daily | home grid, `/api/v1/countries` (denormalised capital, population, GDP-PPP, area, languages, currency, V-Dem) | 1h |
| factbook/auto-resolve-disputes | 02:30 daily | daily | reconciliation disputes | 6h |
| factbook/verify-reconciliation | 03:45 daily | daily | no reader surface | n/a |
| pulse/v2 ingest · cluster · classify | 08:00 / 08:20 / 08:40 daily | feed-failure state is same-day | pulse methodology feed-state block | **0 — never cache** |
| pulse/v2/score | 09:00 daily | daily | pulse-changelog; pulse dimension/event APIs | 6h |
| pulse/v2/review-sla | every 6h | 6h | admin only | never (admin) |
| operations/health-alerts | every 15 min | 15 min | `/api/health`; status page | **0 — never cache** |
| operations/error-alerts, pipeline-alerts | 23:50 / 23:55 daily | daily | internal | 0 |
| factbook/sync-officeholders | 02:00 monthly (8th) | monthly | `/leaders`; country masthead head of state / government | 6h |
| factbook/sync-insee-fr | 04:00 monthly (1st) | monthly | France facts | 24h |
| factbook/sync-wikidata | 06:00 quarterly | quarterly | country identity-spine facts | 24h |
| 14 publisher syncs (WDI, UN Data, WHO GHO, UNESCO UIS, UNDP HDI, OECD, FAO, Eurostat, WTO, US Census, ONS, IBGE, StatCan, Stats SA) | 2nd–11th + 25th, quarterly | quarterly | country factbook facts, `/rankings`, `/compare`, `/civica-conditions`, `/governance-evidence` | 24h |
| factbook/sync-imf-weo | 5 Apr + 5 Oct | semiannual | GDP projections | 24h |
| factbook/sync-ilo-ilostat | 5 Nov | annual | labour facts | 24h |
| factbook/sync-classifications | 15 Jul | annual | government taxonomy | 24h |
| factbook/snapshot-vintage | quarterly (15th) | quarterly | `as_of=<vintage>` reads, frozen exports | immutable (365d) on a version-addressed URL only |
| *(no cron)* elections corpus | manual pipeline | unscheduled | `/elections`, `/elections/systems` | **0** |
| *(no cron)* constitutions corpus | manual pipeline | unscheduled | `/constitution` | **0** |

**Derived page windows (minimum across feeds actually rendered):**

| Route | Window |
|---|---|
| `/` home | 1h |
| `/country` directory | 6h |
| `/country/[slug]`, `/civica-data`, `/constitution` | 6h |
| `/leaders` | 6h |
| `/rankings`, `/compare`, `/civica-conditions`, `/governance-evidence` | 6h |
| `/civica-index/pulse-changelog` | 6h |
| `/civica-index/methodology/pulse` | 0 |
| `/elections`, `/elections/systems`, `/constitution` | 0 |
| `/constitution/search` | 0 (rate limiter runs in the render) |
| all `/api/v1/*` | 0 unless already on `checked-build-artifact` |

### The 24-hour ceiling

Quarterly and annual publishers do not earn quarterly windows. Three reasons:

1. **Ten manual pipelines exist outside `vercel.json`.** Manual Atlas/Index/Conditions runs land on quarterly-source surfaces at unpredictable times.
2. **The dispute resolver runs daily at 02:30** and can flip which source wins a fact key. Every quarterly-source fact is therefore mutable daily at the resolver layer, independent of publisher cadence.
3. **The published correction policy is binding** — 7 days to initial response, 30 to full disposition (`src/lib/content/site-state.ts:370-372`, surfaced on four public pages). A cache window longer than the correction path is a commitment Civica cannot honour.

**24 hours is the absolute ceiling for any reader surface,** and it should be paired with an on-demand purge hook fired by the correction/retraction path and the dispute resolver — not with a longer TTL.

---

## 6. Task breakdown

Sequenced so the lowest-risk highest-leverage work lands first. Each task is independently shippable and revertible. **CAC-001 through CAC-006 are Option A and require no gate change.**

---

### CAC-001 — Baseline the actual cache hit rate by route

**What:** Record current cache-status distribution per route family, so every later stage has a measurable comparison.
**Why:** No later task can be judged without it, and §9 Q1 (what the 78% actually consisted of) may change the entire scope decision.
**Files touched:** none (read-only; record the result under `plan/evidence/CAC-001/`).
**Depends on:** nothing.
**Effort:** 0.5 day.
**Risk:** none.
**Done when:** `plan/evidence/CAC-001/baseline.json` exists containing, for the trailing 7 days, request counts split by cache status (HIT / MISS / STALE / BYPASS) for at least: `/`, `/country/[slug]`, `/governance-evidence`, `/licensing`, `/compare`, `/constitution`, `/civica-index/pulse-changelog`, `/_next/static/*`, and all other paths as one bucket — **with static assets counted separately from HTML document requests**; and a `curl -sI` capture of the `x-vercel-cache` header for one URL from each of those families.

---

### CAC-002 — Remove the unreachable `revalidate = 3600`

**What:** Delete `export const revalidate = 3600` from `src/app/(reader)/country/[slug]/layout.tsx:37`.
**Why:** It resolves to 0 via the minimum-across-segments rule and reads as an intentional 1-hour policy that does not exist. Leaving it in place is the R7 landmine.
**Files touched:** `src/app/(reader)/country/[slug]/layout.tsx`.
**Depends on:** nothing.
**Effort:** 15 minutes.
**Risk:** none — the value has no runtime effect.
**Done when:** `rg 'export const revalidate' src/` returns 63 lines, every one `= 0`, and `npx tsx scripts/validate-cache-consistency.ts` exits 0.

---

### CAC-003 — Generate a checked jurisdiction directory artifact

**What:** Add `scripts/generate-jurisdiction-directory.ts` producing `src/lib/jurisdictions/directory.generated.json`, following the envelope pattern of the 14 existing `*.generated.json` artifacts (`schemaVersion`, `generatedAt`, `rowCount`, `rowsSha256`, `rows`). Rows carry `{slug, name, iso2, capital, statusType, statusLabel}` only. Add `scripts/validate-jurisdiction-directory.ts` — a live diff of the checked artifact against the `jurisdictions` table — wired into CI the way sibling artifacts are.
**Why:** This is the data the root layout currently queries on every request. Freezing it to a checked artifact removes the static import edge to the database driver, which is what the gate keys on. The gate cannot distinguish a cached read from an uncached one — it is import-graph based — so caching the query would not satisfy it; only removing the edge does.
**Files touched:** two new scripts, one new generated JSON, `package.json` (two scripts + CI wiring).
**Depends on:** nothing.
**Effort:** 1 day.
**Risk:** low. The frozen fields are already slow-moving: `capital` is a denormalised nightly cache column whose own schema comment declares up-to-24h staleness acceptable, and identity comes from the closed `jurisdiction-status/v1` catalog (253 entries, reviewed 2026-07-10), where a change is a deliberate evidenced repair.
**Done when:** `npm run generate:jurisdiction-directory` on a clean tree produces a byte-identical file to the checked one; `npm run validate:jurisdiction-directory` passes against the live database; and deliberately editing one row in the checked JSON makes that validator exit nonzero.

---

### CAC-004 — Rewire the header search and footer to the checked directory

**What:** `src/components/GlobalSearchWrapper.tsx` and `src/components/SiteFooter.tsx` import the generated JSON and drop their `@/lib/db/queries` imports. Narrow `CountrySearchCombobox`'s prop from the full `JurisdictionStatusPresentation` to `statusLabel: string`.
**Why:** These two components are mounted in the root layout (`src/app/layout.tsx:118`, `:125`) and are the only database-reaching children of it. Today each issues two round trips (the select, plus `buildGovernmentClassificationMap`), so the layout costs ~4 round trips and two unprojected full-table reads on every request on every route. Separately, the header currently ships a nine-field status object per country — contract version, prose note, review date, sources array — to render one label string, on every page.
**Files touched:** `src/components/GlobalSearchWrapper.tsx`, `src/components/SiteFooter.tsx`, `src/components/CountrySearchCombobox.tsx`.
**Depends on:** CAC-003.
**Effort:** 0.5 day.
**Risk:** low. Note the known footer country-search hydration warning is tree-shape, not data-shape — this change leaves server-rendered markup equivalent and neither fixes nor masks it.
**Done when:** `npx tsx scripts/validate-cache-consistency.ts` reports **50 DB-dependent, 25 build-only** (from 74/1) and still exits 0 with no edit to the gate; and a local browser check confirms the header search returns results for a typed query and the footer country list renders, in light and dark, desktop and mobile.

---

### CAC-005 — Remove the now-redundant `revalidate = 0` declarations

**What:** Delete `export const revalidate = 0` from the pages that CAC-004 makes build-only. **Verify each page individually against the gate's own output before deleting** — do not batch-delete from the list below.

Working list (24 candidates + 1 excluded):

`/accessibility` · `/about/advisory-board/apply` · `/blog` · `/blog/[slug]` · `/civica-conditions/methodology` · `/civica-index` · `/civica-index/government-types` *(redirect stub)* · `/civica-index/methodology/pca-appendix` · `/civica-index/methodology/peer-grouping` · `/civica-index/methodology/power-transfer-ledger` · `/civica-index/replication` · `/civica-index/widget` *(redirect stub)* · `/contact` · `/design-system` **(see conflict below)** · `/glossary` · `/licensing` (declared twice — page and pass-through layout) · `/methodology` · `/methodology/case-studies` · `/methodology/provenance-coverage` · `/methodology/source-coverage` · `/organizations` *(redirect stub)* · `/policies` · `/privacy` · `/terms`.

**Excluded:** `admin/pulse-coding/sign-in` — reads `searchParams` and is an auth page; stays uncached.

**Unresolved conflict, must be checked per-page:** two independent graph runs place `/design-system` in the root-layout-only set; a third found it self-reaching the database. Confirm with the gate's own `dependencyPath` output for that file before touching its declaration.

**Why:** Removing the root-layout edge alone changes nothing at runtime — every page in the list also declares `revalidate = 0` itself. Both must go for any route to become static.
**Files touched:** up to 25 page/layout files, one line each.
**Depends on:** CAC-004.
**Effort:** 0.5 day.
**Risk:** low. Three of the list are bare `redirect()` stubs rendering no content. The two coverage pages already read checked generated JSON, so their "Generated …" lines are deploy-bound already and caching adds literally zero staleness. None of the list can render a live database value — that is the defining property of the set.
**Done when:** after a full `npm run build` (dev server stopped), `.next/prerender-manifest.json` lists at least 20 of the routes above as prerendered; `npx tsx scripts/validate-cache-consistency.ts` exits 0 with no edit to the gate; and `curl -sI` against a preview deployment returns `x-vercel-cache: HIT` on a second request to `/licensing`, `/terms` and `/methodology`.

---

### CAC-006 — Re-measure and decide

**What:** Repeat CAC-001's measurement against the deployed Option A build after a 7-day soak. Write a one-page recommendation on whether Option B is worth its cost.
**Why:** §2 predicts Option A alone will not restore a 78% hit rate. This task turns that prediction into evidence and hands Fernando a real number for the B/C decision.
**Files touched:** `plan/evidence/CAC-006/`.
**Depends on:** CAC-005 deployed + 7 days.
**Effort:** 0.5 day.
**Risk:** none.
**Done when:** `plan/evidence/CAC-006/comparison.md` states the per-route-family cache-status delta against the CAC-001 baseline, separates static-asset requests from document requests, states the measured change in serverless invocations per day, and gives an explicit recommend / do-not-recommend on Option B with reasoning.

---

*Everything below is Option B or C territory and requires the owner decision in §2.*

---

### CAC-007 — Never populate a cache entry from a failed render

**What:** Add a shared "data load failed ⇒ throw" seam at the page boundary, using the existing `rethrow` predicate in `src/lib/atlas/surface-query-state.ts:13-23`. Start with `src/app/(reader)/country/[slug]/civica-data/page.tsx:182-183`, whose `.catch(() => null)` + `notFound()` produces a cacheable noindex 404 for a real country.
**Why:** R1. This is a hard precondition on any Option B or C work — without it the first Neon blip after a window is enabled pins a degraded page.
**Files touched:** `src/lib/atlas/surface-query-state.ts` and up to 22 page files.
**Depends on:** CAC-006 decision to proceed.
**Effort:** 2 days.
**Risk:** medium — changes error behaviour on 22 reader pages; needs browser QA per page.
**Done when:** a seeded test that forces the database client to throw produces a non-2xx response (not a 200 and not a 404) from `/leaders`, `/`, `/about`, and `/country/[slug]/civica-data`; and `src/app/rankings/page.tsx` is confirmed unchanged (it has no catch block and already 500s safely).

---

### CAC-008 — Prove the CDN tag-purge path on Vercel

**What:** A spike, not a feature. Deploy a preview page with a `use cache` + `cacheTag` function, invalidate it from a route handler, and measure whether the CDN copy actually changes.
**Why:** The Next docs state plainly that `revalidateTag()` invalidates the Next server cache but the CDN "will continue serving its cached copy until the `s-maxage` TTL expires", and that CDN purges must be triggered alongside. Vercel separately documents `Vercel-Cache-Tag`, `invalidateByTag()`, `getCache().expireTag()`, `POST /v1/edge-cache/invalidate-by-tags`, and `vercel cache invalidate --tag`. **Whether Vercel's Next adapter wires a Next `revalidateTag()` call through to Edge Network purge is not established by this investigation.** If it does not, the entire tag-invalidation correctness argument for Options B and C needs a second explicit purge call, and a published correction could sit at the edge for the full window.
**Files touched:** preview branch only; result recorded in `plan/evidence/CAC-008/`.
**Depends on:** CAC-006 decision to proceed.
**Effort:** 1 day.
**Risk:** none (spike), but the *finding* may be a blocker.
**Done when:** `plan/evidence/CAC-008/purge-proof.md` records, with captured `x-vercel-cache` headers and timestamps, whether a bare `revalidateTag(tag, { expire: 0 })` from a route handler changes what the CDN serves within 60 seconds — and if not, which explicit Vercel call does.

---

### CAC-009 — Owner methodology decision and ADR for bounded windows

**What:** Write the resolution document and ADR authorising (or declining) time-revalidated caching on database-backed reader pages, with the §5 windows, the R1–R6 carve-outs, and the CAC-008 finding.
**Why:** A bounded window on a governance-fact page is not a tuned version of the current rule — it is a reversal of a shipped P0 gate's acceptance criterion ("cache failures do not serve false freshness") and of the profile invariant forbidding stale-on-error for mutable database data. Under Civica's own operating rules, that is a first-class methodology decision requiring a citable resolution document, not a validator patch.
**Files touched:** `plan/caching-window-resolution-v1.md`, `docs/decisions/`, `plan/DECISIONS.md`.
**Depends on:** CAC-006, CAC-008.
**Effort:** 1 day of writing; owner sign-off is calendar-gated.
**Risk:** n/a.
**Done when:** the resolution exists, names the permitted window per route family, names every never-cache surface, and carries an explicit owner sign-off line.

---

### CAC-010 — Extend the gate with a page freshness policy registry

**What:** Add `PAGE_FRESHNESS_POLICY` to `src/lib/platform/cache-consistency.ts` — one row per database-dependent page, carrying profile, declared window, data dependencies and rationale. Close the inventory exactly as the API arm does (a new database-backed page with no row fails the build). Add a `DATA_CADENCE_REGISTRY` mapping dependency → refresh mechanism and minimum interval, and assert `effectiveRevalidate(page) <= min(cadence of its dependencies)`. Add an error for a *declared but unreachable* revalidate value so a window can never become dead code again.
**Why:** The gate's page rule is a bare binary today — reaches database ⇒ 0 — with no slot to express "this page tolerates N seconds". Extending it preserves fail-closed behaviour while permitting the §5 windows.
**Files touched:** `src/lib/platform/cache-consistency.ts`, `scripts/validate-cache-consistency.ts`, `scripts/validate-cache-consistency.test.ts`.
**Depends on:** CAC-009.
**Effort:** the gate change is ~150 lines and small; **the registry curation is the large piece** — roughly 50 page rows plus a source-to-table map across 103 tables. There is no existing table-to-cadence mapping: `vercel.json` holds schedules, `src/lib/data/production-adapter-registry.ts` maps cron → sources, but nothing links source → table or fact-key → cadence. `AtlasSurfaceMatrixRow` is the closest existing thing and covers only 19 route rows. Budget 4–6 days.
**Risk:** medium — hand-curated metadata drifts.
**Done when:** the four existing negative fixtures still fail closed; three new seeded fixtures fail closed on (a) a database-backed page with no policy row, (b) a policy row with no page on disk, (c) a page whose declared window exceeds its slowest dependency's cadence; and the country layout's deleted 3600 would now produce an "unreachable revalidate" error if reinstated.

---

### CAC-011 — `generateStaticParams` for country and organization routes

**What:** Add `generateStaticParams` to `/country/[slug]`, `/country/[slug]/civica-data`, `/country/[slug]/constitution`, `/organizations/[slug]`.
**Why:** On Vercel serverless, plain `use cache` entries "typically don't persist across requests" — memory is not shared between instances. The saving does not come from runtime caching; it comes from the component being *stable enough to prerender into the static shell*, which then gets a long `s-maxage`. Without `generateStaticParams`, `params` is a runtime API and these routes can never enter the shell, so caching the data functions underneath saves nothing. Only `src/app/blog/[slug]/page.tsx` has this today.
**Files touched:** four page files.
**Depends on:** CAC-009.
**Effort:** 1 day including build-time measurement.
**Risk:** medium — ~759 prerendered routes across 253 jurisdictions × 3 tabs will lengthen an already long build chain. Measure before committing. Under Cache Components the returned array must be non-empty or the build errors, and `dynamicParams = false` is unavailable, so unknown slugs still render at request time.
**Done when:** `npm run build` completes, `.next/prerender-manifest.json` contains at least 250 `/country/*` entries, and the measured build-time increase is recorded in `plan/evidence/CAC-011/`.

---

### CAC-012 — Cache Components migration (Option C only)

**What:** Enable `cacheComponents: true`; convert data functions domain by domain to `use cache` + `cacheTag` + `cacheLife`; delete all `revalidate` and `dynamic` route-segment exports; fire tag invalidation from the cron routes.
**Why:** The Next 16 destination. It is fail-loud at build time rather than silently permissive, which suits a provenance-first product.
**Files touched:** repo-wide.
**Depends on:** CAC-010, CAC-011, and a green CAC-008.
**Effort:** 10–15 days.
**Risk:** high. Known constraints: `revalidateTag` cannot be called from the 22 `scripts/` files that call `markSourcesSynced` (they run outside the Next runtime) — manual syncs must finish with an authenticated HTTP call to a revalidation route, or purge via Vercel's REST endpoint. `updateTag` is Server-Actions-only and unavailable in route handlers. Use the two-argument `revalidateTag(tag, { expire: 0 })` form; `profile: "max"` gives stale-while-revalidate, which is wrong here. Cached function arguments and returns must be serializable. Values stored via `React.cache` outside a `use cache` function are invisible inside it — relevant to `SiteFooter` and `queries.ts`. `cookies()`/`headers()` cannot be read inside a cached scope. Client navigation switches to `<Activity>`, so component state, form inputs and scroll position no longer reset on navigate — QA the constitution outline, ReaderSidebar, atlas map, tab bar, compare resizer and admin workspaces.
**Done when:** the full build passes with `cacheComponents: true`, `rg 'export const revalidate' src/` returns zero lines, every `use cache` function carries a registered `cacheTag`, every registered tag is invalidated by at least one cron route, and a live tag invalidation demonstrably changes what the CDN serves within 60 seconds.

---

## 7. Verification strategy

**Per-stage gate — no stage starts until the previous one is green.**

### Stage gates

| Stage | Proof required to proceed |
|---|---|
| CAC-002 → CAC-003 | `validate:cache-consistency` exits 0; `rg 'export const revalidate'` shows 63 lines, all `= 0` |
| CAC-004 → CAC-005 | Gate reports **50 DB-dependent / 25 build-only** with **no edit to the gate file** — this is the single decisive signal that Option A worked |
| CAC-005 → CAC-006 | `.next/prerender-manifest.json` lists the freed routes; `x-vercel-cache: HIT` on a preview |
| CAC-006 → CAC-007+ | Owner reads the measured delta and decides B/C |
| CAC-008 → CAC-009 | Purge proof, positive or negative, recorded |

### Measuring the actual improvement

**Primary:** Vercel Observability → **Edge Requests**, grouped by **Cache Status**, filtered by **Path**. Split HTML document paths from `/_next/static/*` and image paths — mixing them makes the number meaningless (see §9 Q1). Compare the trailing 7 days against `plan/evidence/CAC-001/baseline.json`.

**Secondary (direct, unambiguous):** `curl -sI https://www.civicaatlas.org/licensing | grep -i x-vercel-cache`. `MISS` on first request then `HIT` on the second is the ground truth. Run it against `/licensing`, `/terms`, `/methodology`, `/country/jpn`, `/governance-evidence`.

**Tertiary:** Vercel Function invocation count per day. Option A's per-request database-round-trip removal shows up here even on routes that stay dynamic.

*Uncertainty flagged:* the exact Vercel console query string was not verified during this investigation. An implementing agent should confirm the current Observability filter syntax against Vercel's own docs rather than trusting a query text reproduced here.

### What a regression looks like

- **`x-vercel-cache: HIT` on any route in §6's never-cache list** — `/api/health`, any `/api/cron/*`, any `/admin/*`, `/constitution/search`, `/api/chat`, `/embed/[slug]`, `/civica-index/methodology/pulse`, `/elections`. Any of these is a stop-and-revert.
- **A cached 200 whose body says data is unavailable.** Fetch `/leaders` twice; if the meta line says "Current-officeholder verification in progress" while the database is healthy, R1 has fired.
- **A cached 404 with `noindex` on a real country.** Fetch `/country/jpn/civica-data`; a 404 there is R1's sharpest form.
- **`stale-while-revalidate` or `stale-if-error` appearing in any `Cache-Control` on a database-backed route.** Every non-build profile sets `allowsStaleOnError: false`; `src/lib/platform/http-cache-policy.test.ts` asserts it.
- **`generatedAt` in a research export differing from the response's actual time.** R3.
- **The gate needing an edit to pass.** If Option A requires modifying `scripts/validate-cache-consistency.ts`, the change is out of Option A's scope by definition and should be stopped and re-scoped.

### Standing build discipline

Run the **full** `npm run build` with `next dev` stopped. Running a build while the dev server is up poisons `.next` on disk, and a dev restart does not clear it — kill dev, `rm -rf .next`, restart. Turbopack filesystem caching is on by default in 16.2, so this matters more than it used to. Adding any dependency also cascades through the frozen reproducibility packets that pin `package-lock.json` — do not add one casually mid-stage.

---

## 8. Explicitly out of scope · Do not do

### Out of scope

- **`src/proxy.ts` (PLT-016).** Its matcher covers every non-static route and is a second, independent CDN consideration. It belongs to the telemetry workstream, not here.
- **The nine unbounded `readCachedFieldFromRow` call sites** (site-wide footer, site-wide header search, 404, Atlas world map) and the raw `row.capital` read in the country directory. Larger freshness inconsistency than R8, but pre-existing and independent of caching.
- **The known footer country-search hydration warning.** Tree-shape, not data-shape; unchanged by every option here.
- **The `--shadow-hard*` token rename.** Owner-gated, unrelated.
- **Any change to the frozen release download routes.** `immutable-release` (`max-age=31536000, immutable`) is already correct; those artifacts are invalidated by a new URL, never overwritten.

### Do not do

- **Do not delete or weaken `scripts/validate-cache-consistency.ts`.** Extend its policy under CAC-010 or leave it alone. It is a completed P0 gate protecting against private data in shared caches.
- **Do not delete the 63 `revalidate = 0` declarations as a batch.** They are load-bearing today — the gate mandates them for every database-reaching page, and deleting one without removing the page's database path fails the build.
- **Do not treat "fix the root layout" as the caching fix on its own.** It frees zero routes by itself; CAC-004 and CAC-005 must ship together to have any runtime effect. *(A claim that the root layout is the operative cause of the regression was investigated and refuted — 24 of the 25 witness pages declare `revalidate = 0` themselves.)*
- **Do not try to cache the jurisdiction query in place** with `use cache`, `unstable_cache`, `cacheTag` or a cached edge route read by the layout. The gate keys on the static import edge and cannot tell a cached read from an uncached one, so all three still fail; the shared-cache route variant fails a second check as well (a non-request-dynamic route handler may not reach the database). Only removing the import edge passes.
- **Do not implement a "degraded ⇒ no-store" per-render flag.** Not supported: cached scopes cannot read request-time APIs, and `unstable_noStore` is legacy and will not opt out of static generation inside a cache scope. Rethrow instead.
- **Do not claim enabling `cacheComponents` would ship stale data.** It is dynamic-by-default; the failure mode is a build error. Argue against Option C on effort and behavioural-change grounds, not on that basis.
- **Do not use `revalidateTag(tag)` single-argument or `profile: "max"`.** The single-argument form is deprecated; `max` gives stale-while-revalidate, which the cache contract forbids for mutable database data.
- **Do not add `revalidateTag` calls to the 22 `scripts/` files** that call `markSourcesSynced`. They run outside the Next runtime and the call will throw or no-op, leaving the CDN serving pre-sync facts indefinitely.
- **Do not relax `src/lib/platform/http-cache-policy.test.ts`.** It is the guard on the two `generatedAt` research-export routes (R3).
- **Do not describe `/methodology/source-coverage` or `/methodology/provenance-coverage` as gaining staleness.** Their bodies already read checked generated JSON and are deploy-frozen today.

---

## 9. Open questions for the owner

**Q1 — What did the 78% actually consist of?** *(Highest priority — may change the whole scope decision.)*
The investigation established the mechanism by which `revalidate = 0` produces `cache=MISS`, and confirmed the configuration landed on 2026-07-27. It did **not** establish which routes made up the 15,697 CDN-served requests on 2026-07-28. Static assets (`/_next/static/*`, images, fonts) cache unconditionally and are unaffected by any `revalidate` setting — so if they were counted in the 78%, the drop to ≤4% is not fully explained by the page configuration and something else changed too. CAC-001 is designed to answer this. **If the answer is "mostly static assets", Options B and C may be solving the wrong problem.**

**Q2 — Is Option A worth doing on its own if it does not move the hit rate?**
It removes ~4 database round trips per request from all 75 surfaces and stops ~24 routes booting a function. That is a real cost and latency win independent of the CDN number. Confirm you want it landed on those merits before CAC-006 reports.

**Q3 — Is any staleness on a governance-fact page acceptable, and at what window?**
This is the Option B decision and it is a methodology decision, not an engineering one. It reverses a shipped P0 gate's acceptance criterion. It needs a resolution document and your explicit sign-off (CAC-009), not a validator patch.

**Q4 — Is deploy-frozen header search acceptable?**
Option A means a newly added or renamed jurisdiction does not appear in the site-wide search box or footer until the next deployment. Given Civica deploys frequently and jurisdiction identity changes are deliberate reviewed events, this looks fine — but it is your call, because it is the only reader-visible consequence of Option A.

**Q5 — Who owns CDN purge on correction and retraction?**
If Option B or C proceeds, the published correction policy (7 days initial / 30 days full disposition) implies that a correction must be able to reach readers. If CAC-008 finds that Next's tag invalidation does not purge Vercel's edge, that purge call becomes a required part of the correction workflow — a process commitment, not just code.

**Q6 — Is a 10–15 day Cache Components migration in budget this quarter?**
Option C is where Next is going and the legacy `unstable_cache` path is explicitly the old road. But it is a repo-wide change with a visible UI-behaviour side effect (`<Activity>` state preservation) that has nothing to do with caching. If it is not in budget, Option A plus a documented decision to revisit is a coherent stopping point.