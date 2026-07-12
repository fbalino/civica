# Civica Atlas — Implementation Audit

**Date:** 2026-07-04
**Method:** Verification agents checked every plan document, all 36 mockups, the feature roadmap, and every "deferred" item in project memory against the actual code, the live database, and the running site. Verdicts below are based on what renders and what the data holds — not on what commit messages claim. Section 8 extends the same verification to the 108 older plan documents (April–June); none of their own "done" claims were trusted — every verdict is re-derived from code and data.

---

## 1. Executive summary

The project is in much better shape than it feels from the inside. Nearly everything planned since late June has shipped and was verified working on the live site, not just present in the code. The core product — country pages with three tabs, the Constitution Explorer with full text for 186 countries, the Civica Index leaderboard and per-country detail, the compare tool, the interactive maps with self-hosted tiles, the elections section, the blog, the glossary — is real, live, and consistent with the design system. All fifty findings from the July 1 quality audit are confirmed fixed in the code itself. The two image-generation plans delivered every single promised illustration. What remains falls into three buckets: a handful of features where the shell exists but the substance is thin (election data covers only about 22 countries; the history chart shows one short line instead of decades of trends), a few mocked dashboards that were never started (backsliding tracker, leaders directory, constitution keyword search), and a set of items you personally parked that should stay parked. Several things that look "missing" were in fact consciously replaced with something better and can be crossed off the worry list. The honest launch gap is not breadth — it is depth and credibility in four or five specific places, plus a short polish sweep. A credible launch path exists and is measured in weeks of focused work, not months.

---

## 2. Done — shipped and verified

Each of these was confirmed live on the running site and in the code, not just claimed.

**Product surfaces**
- Country pages with three tabs (Factbook, Civica Data, Constitution), correct titles and search-engine metadata per tab.
- Constitution Explorer: full constitutional text ingested for all 186 available countries (30,537 topic excerpts), side-by-side comparison by topic, the redesigned header-chip layout you asked for, and a simplified country tab that links into it.
- Civica Index: global leaderboard with tier legend and coverage stats; per-country score cards with dimension breakdowns, peer lenses, rank, and event feed; the full 14-section methodology document.
- Compare tool with country picker, Index timeline overlay, and dimension-by-dimension comparison — broader than the original mockup.
- Interactive 2D map on every country page (styled to the house palette), on-demand 3D globe, and the map tiles now self-hosted (verified serving correctly in production).
- Atlas world map with a four-layer switcher (Government, Civica Index, Regime, Income) and shareable links.
- Elections landing page with upcoming elections, recent results, turnout, and filters — plus the electoral-systems explainer covering 219 chambers across 187 countries with diagrams and pros/cons.
- Governance conditions explorer (the outcomes/peer-band tool) — live and working, despite an older roadmap note claiming it was still deferred.
- Advanced country filters on the countries landing page (region, income, regime, Index tier) with shareable filter links.
- Embeddable country score widget with a gallery, size/theme options, and copy-to-clipboard embed code.
- Pulse changelog page: browsable, filterable, sourced event feed with an honest freshness note.
- Glossary, blog index ("The Record"), and the long-form article template — all matching the approved mockups.
- Government hierarchy charts, legislature hemicycles with party browsers, leader profiles with tenure timelines, and organization memberships on every country's data tab.

**Data**
- Leadership data enrichment executed at scale: real constitutional office titles (generic names down from 375 to 50), cabinet coverage grown from 2 to 197 countries, roughly 1,600 leader portraits added, party affiliations expanded.
- All 10 blog hero covers and all 42 inline illustrations generated and in place.

**Quality**
- All 50 findings from the July 1 audit fixed and verified in code: data-accuracy bugs (mislabeled freedom ratings, inconsistent scores between the site and the public API), design-token drift, security hardening (rate limits, sanitized constitution text, timing-safe admin checks), accessibility, and stale documentation claims.
- Both design-drift waves (June 30 and July 2) fully landed: canonical heroes, tokenized forms and filters, entrance motion across 12 reader pages, orphaned code deleted.

---

## 3. Half-done — started but missing core value

| # | What it is | What exactly remains | Size |
|---|-----------|---------------------|------|
| 1 | **Election calendar data.** The elections page is fully built and pleasant, but the database holds election rows for only ~22 countries (26 elections total). A "global" calendar this sparse reads as broken. | Source and wire a broader elections data feed, or visibly frame the page as limited-coverage beta at launch. The mockup's map view and 12-month timeline grid also remain unbuilt, but data is the real gap. | M |
| 2 | **Historical trend charts.** Each country shows a single short line of quarterly Index scores (the Index is young, so only a few points exist). The mockup and roadmap promised decades of multi-series trends (democracy sub-indices, press freedom, corruption) with annotations. | Build the multi-series chart drawing on the long-running external datasets already in the pipeline; add series toggles and a time-range control. This is the single biggest upgrade to academic usefulness. | M |
| 3 | **Democracy dashboard.** The Index leaderboard exists, but the mocked dashboard features — freedom-category summary counts, a "biggest movers" list, trend tabs — do not exist anywhere. | Decide whether the movers/summary view becomes part of the leaderboard page or its own page, then build it. Pairs naturally with item 2. | M |
| 4 | **Embed widget variety.** One embed type ships (the country score card). The mocked hemicycle embed and two-country compare embed were never built. | Two more widget types plus gallery entries. Nice-to-have, not launch-critical. | S |
| 5 | **Legislature deep-dive extras.** Hemicycle, party breakdown, and turnout are live. Committee rosters, multi-election seat history, and gender composition are absent — and mostly blocked on data that is not in the database. | Requires new data acquisition before any UI work. Treat as post-launch. | L |
| 6 | **World leaders directory.** Per-country leader data is now rich (portraits, tenure timelines, transitions), but there is no cross-country browsable directory — leaders are only reachable one country at a time. | A single directory page over data that already exists. High visual payoff for modest effort; a good post-launch shareable. | M |
| 7 | **Finish-line housekeeping.** Four small leftovers: the constitution page ships ~1.3 MB of duplicated inline graphics per view (slow first load); the "Beta" tag is four separate style definitions that merely look identical; two field labels on the conditions explorer still use the wrong font styling; and the internal "active plan" pointer that guides future work sessions points at a file that no longer exists. | One short cleanup pass. None of these are visible to readers except the page weight. | S |

---

## 4. Not started — promised in plans or mockups, absent from the product

| What was promised | Worth building? |
|---|---|
| **Democracy backsliding tracker** — ranked list of countries by multi-year democracy decline, with severity tiers and sparklines. | **Yes, eventually.** The most press-friendly, shareable surface in the whole mockup set, and most of the underlying time-series data already flows through the pipeline. Depends on item 2 above (trend infrastructure) landing first. |
| **Leadership transitions dashboard** — terms ending within 90 days, recent inaugurations, longest-serving leaders. | **Yes, eventually.** The enriched leader data now makes this feasible. Editorially interesting, modest effort, post-launch. |
| **Constitutional keyword search** — type any word, get ranked highlighted passages across all constitutions. | **Yes.** The Explorer compares fixed topics; researchers will also want free-text search. A genuine differentiator for the academic audience, and the corpus is already ingested. |
| **Press freedom page** — map, rankings, and category stats from the press-freedom index. | **Maybe.** The data already exists inside the scoring machinery; exposing it is mostly presentation work. Worthwhile but lower priority than the items above. |
| **Diplomatic recognition / UN alignment map** for disputed states. | **Not now.** Requires sourcing an entirely new bilateral-recognition dataset. Park it. |
| **Cross-country political party browser** with ideology compass. | **No, not as mocked.** The database has no party-ideology data, and the code documents this explicitly. Building it honestly would require a major new data source; the mockup should be retired. |

---

## 5. Deliberately deferred — parked by your decision; do not touch

| Item | Gating condition |
|---|---|
| Pulse daily refresh (paused, no API spend) | Your call on spend and cadence. The pipeline and pages are built; the feed simply is not refreshing daily. See Recommendation 2. |
| Design-system naming reconciliation (the "v2 look" paperwork) | Your call on the canonical look. Note: the substance has largely converged already — the embed and the docs now match the live palette; only a misleading internal token name remains. The memory note describing a live visual fork is stale. |
| Final removal of the retired government-type taxonomy | Calendar-gated to 2027-03-31. Not due. |
| Country-page outcome peer-band panels (component built, unwired) | Awaiting the peer-comparison methodology extension to material outcomes. The site-wide conditions explorer already covers much of this ground. |
| UN vote alignment / co-membership networks | Needs a voting-record data source that was never acquired. |
| Sync-adapter code consolidation (~20 near-identical import scripts) | Internal tidiness only; no reader impact. |
| Reconciliation methodology page templating | Awaiting a specific editorial component. |
| Moving map tiles to Cloudflare | Blocked on a Cloudflare account issue outside the codebase. Current hosting works and is verified. |
| Quarterly map-tile refresh | Manual runbook; next refresh not due (tiles dated 2026-07-02). |
| Entrance motion on utility pages (API docs, licensing, contact) | Explicitly excluded from scope in the plan itself. |

---

## 6. Superseded — planned or mocked, then consciously replaced. Stop worrying about these.

- **"Civica Index as a section inside the country factbook."** Replaced by your locked decision: the three-tab country page, which is live. The old plan is fully retired.
- **Constitution Explorer v1 layout** (four panes with a dedicated country-picker sidebar). Replaced at your request by the v2 header-chip design, which shipped in full.
- **All three-pane "shell" mockups** — including the international-organizations explorer with the side-by-side picker and network graph. Retired wholesale in the June 30 reader-first pivot. Organizations now live as full-width pages; if a network graph is ever wanted, it would be scoped as new work.
- **Government-types scatter plot by in-house structural buckets.** Replaced by the bi-lens explorer built on externally attested classifications (V-Dem, BR/CGV), per the May 2 peer-grouping resolution. A methodology upgrade, not a loss.
- **Countries landing mockups A and B.** Variant C (typeahead + almanac index) was chosen and shipped verbatim; A and B are the deliberately rejected alternatives from your own three-designs rule.
- **Several stale internal claims** that made the project look less finished than it is: the roadmap's note that the outcomes section was still deferred (it shipped), the memory note that the embed widget still uses the old palette (it was reconciled), the "latent" rankings double-count risk (already guarded defensively), and orphan files flagged as open (deleted one commit later). These need doc updates, not code.

---

## 7. Recommendation — the five things to do next, ranked

**1. Run a one-pass launch-polish sweep. (Size: S)**
Fix the constitution page's heavy first load, the handful of country entries that fail to resolve (Vatican City was caught during this audit), the four housekeeping leftovers in section 3 item 7, and update the stale internal notes listed in section 6 so future work sessions stop chasing ghosts. *Why:* these are exactly the things a first-time academic reviewer or journalist trips over in their first ten minutes, and they are all cheap. Highest credibility-per-hour available.

**2. Decide the Pulse launch story. (Size: S)**
Pulse is presented as one of the two pillars of the product, but its daily refresh is paused. Before launch, either resume a cadence you are comfortable paying for, or reframe the copy site-wide as a periodically updated signal. *Why:* the brand promise is provenance and honesty; a "daily" feature that is quietly frozen is the one inconsistency a skeptical reviewer would write about. Either answer is fine — ambiguity is not.

**3. Fill or frame the elections coverage. (Size: M)**
Either source a real global elections feed to grow past 22 countries, or add honest limited-coverage framing and trim the page's global claims until the feed exists. *Why:* this is the most visibly unfinished surface on the site today, and it sits on a top-level navigation item.

**4. Build the multi-series historical trend charts. (Size: M)**
Long-run, multi-indicator trend charts on country pages, drawing on the decades of external data already in the pipeline. *Why:* trend evidence is what governance scholars actually cite. This one feature does more for academic citability than any new breadth, and it unlocks the backsliding tracker and movers dashboard later.

**5. Start the external methodology review and finish the replication package. (Size: M–L, partly calendar-bound)**
The Index carries a Beta label pending external review, and the methodology pages promise a replication package for Q3 2026. Commission the review now and assemble the package. *Why:* this is the true launch gate for the stated mission. Everything else on this list makes the site look ready; this is what makes it citable. Start it early because the slow part (a scholar's time) is outside your control.

A realistic sequencing: items 1 and 2 in the first week, item 3's framing decision immediately (the feed work can run in parallel), item 4 as the one substantial build before launch, and item 5 kicked off now so the review runs while you finish the rest.

*Note from the legacy sweep (section 8): all five recommendations stand in substance and ranking. Three of them absorb new legacy items rather than change: the polish sweep in Recommendation 1 also picks up the small leftovers in section 8 (the dormant comparison endpoint, the license label, the code residue, plus your sign-off on the growth-figure labels); Recommendation 2 gains a precondition — the automated Pulse classifier must be brought up to the published method before any paid-API resume; and Recommendation 5 now has its concrete checklist (section 8, item 5: dataset DOI, citation file, bulk download, uncertainty ranges, named scholars).*

---

## 8. Legacy plans addendum (the ~108 older documents)

The plan folder also holds 108 documents from April through June — the data-pipeline resolutions, the early audits, the design-system specs, the Pulse methodology papers — which predate the roadmap that sections 2–6 were checked against. Twelve verification passes checked every one of them against the current code and, where it mattered, the live database.

**The headline: this corpus is overwhelmingly executed.** Of 106 audited items (a couple of documents travel in pairs), **82 are fully executed and verified** — the entire data-reconciliation program (twenty-plus adopted resolutions, sixteen source-sync adapters, the disputes queue, nightly self-verification, quarterly data-vintage cuts), the fact-provenance system, the Index v2 and Pulse machinery (all tables, the pipeline, the review queue, the ten-case historical backtest), the origin spec of the current design language, the content-templating system, and every illustration set (197 light plus 197 dark country engravings, page heroes, spot pieces). In several places the build went past the plan rather than merely meeting it: twenty data sources feed the fact system where three or four were planned, and the eight worked examples on the methodology page still resolve correctly against today's live database. Another **seven documents are superseded** (listed below), and **three deferred themselves in writing** with the deferral still holding (the German and Nigerian statistics offices, and two large scoped-but-not-commissioned refactors). That leaves **fourteen items with something genuinely outstanding** — and most of those are slivers, a single unbuilt sub-item of an otherwise fully shipped spec. The substantive ones follow.

**Newly discovered gaps the main report misses:**

| # | What it is | What remains | Size | Worth it? |
|---|-----------|--------------|------|-----------|
| 1 | **Growth figures mix measurement styles.** A few countries' economic-growth numbers are computed on a different basis from everyone else's (South Africa's is a quarter-to-quarter figure, Brazil's a rolling-year figure) and sit unlabeled next to annual figures. A written labeling proposal exists but carries seven sign-off questions awaiting your answers. | Answer the sign-off questions, then a labeling pass across the five-to-seven pages that show the number. | S–M | **Yes.** A quiet accuracy issue on live country pages — exactly what an economist reviewer notices first. |
| 2 | **A retired comparison endpoint still answers publicly.** The statistically unsound peer-comparison query that the May methodology decision retired still backs a public API address. No page uses it, but anyone with the URL gets numbers built on the abandoned grouping method. | Delete the route and its query, or return a "gone" response. | S | **Yes** — minutes of work, closes a provenance hole. |
| 3 | **The automated Pulse classifier does not match the published method.** The public methodology page says events are classified by two independent reasoning passes; the automated (paid-API) code still runs the retired repeat-sampling approach, in two separate places. The manual daily routine follows the published method, so nothing is wrong while Pulse is paused. The small version-tracking layer that every planned Pulse improvement depends on is also unbuilt. | Update the classifier code and build the versioning layer as step zero of any paid-API resume. | M | **Only when Pulse resumes** — it becomes the precondition for Recommendation 2. |
| 4 | **The CIA's copies of figures can beat the original publisher.** For roughly 750 data points, the CIA's re-published figure carries a fresher-looking date than the original source's own figure, so the site prefers the copy over the source (the US population figure is one example). A resolution with five options is drafted; none is chosen. | Pick one of the drafted options in a methodology session. | M | **Maybe.** Real but subtle — readers see a plausible number either way. Batch it with the next methodology round. |
| 5 | **The academic-citability checklist is half finished.** From the June research report: the citation widget, structured metadata, rate limiting, and map are shipped; still missing are a permanent identifier (DOI) for the dataset, a machine-readable citation file, a full bulk download, visible uncertainty ranges on charts, and named scholars on the advisory-board page (it currently describes a target roster, not people). | Work the remaining checklist. | M | **Yes** — this is the ready-made task list for Recommendation 5. |
| 6 | **One source-license label is wrong.** The UNESCO source row carries a superseded license name; the adopted correction never landed in the seed script or the live row. | A one-line fix. | S | **Yes.** Licensing accuracy is the brand. |
| 7 | **Minor code residue, invisible to readers.** The README generator keeps its own duplicate copy of the templating engine; a stale comment names homepage variants that no longer exist; classification comments promised for the source registry are absent; Kosovo's stored country code differs from the one its resolution specified. | Fold into the polish sweep, or ignore. | S | Optional. |

Two things that look like gaps but are not: the German and Nigerian statistics-office syncs are deferred by their own resolutions (license and access blockers, documented), and the energy-data source was deliberately scrapped over license terms — though the fallback route for its three indicators through the World Bank was never picked up either (low value, no urgency).

**Newly confirmed supersessions — cross these off:**

- Every fix document targeting the old three-pane shell (the masthead repairs, the mobile-tab removal, the April route map). The surfaces they fixed no longer exist; their successors shipped as the reader-first pages.
- The early four-source Index coverage plan. The current four-dimension Beta composite replaced that model outright.
- The May design-system audit and its 29-step remediation plan. The later full design-language rebuild resolved nearly every finding as a side effect; the extraction spec that produced today's look is verified implemented value-for-value in the stylesheet.
- The two-line Pulse attribution patch. A stronger subject-based classifier superseded it, and the backfill it called for ran (64 of 135 events re-attributed).
- The engraving-style footer design. Replaced the same day by the logo-strip footer that is live.
- One worry from the June 20 blind audit can also close: the published Pulse methodology now describes the same confidence-discount policy the code implements, so "the rules on the page aren't enforced" no longer holds. What still diverges is the classification method — item 3 above.

**Impact on section 7:** the five recommendations stand in substance and order; the note at the end of section 7 records the three riders (small items folded into the polish sweep, the classifier precondition on the Pulse decision, and the citability checklist attached to the external-review workstream). Nothing in the legacy corpus changes the launch math.

---

## Appendix — evidence index

Paths are relative to the repo root unless noted. Commits are on `main`.

| Claim | Key evidence |
|---|---|
| July 1 audit fully fixed (50 findings, waves A–E) | Commits `30db738`, `15e164e`, `0b4d3b1`, `dd7ad6c`, `0d74f13`; spot-checked in `src/lib/db/queries-scores.ts`, `src/app/api/v1/index/compare/route.ts`, `src/lib/admin/session.ts`, etc. |
| Drift waves 1 & 2 landed | Commits `0de5f1e`, `b3ce91e`, `a82625f`, `36e0f77`, `1df32ef`; ledgers `plan/civica-drift-wave-2026-06-30.md`, `plan/civica-drift-wave-2-2026-07-02.md` |
| Three-tab country page live | `src/app/(reader)/country/[slug]/` (+ `civica-data/`, `constitution/`); commits `f172524`–`3ab3fe0`; verified 200s on `/country/united-states/*` |
| Constitution Explorer + ingestion | `src/app/constitution/page.tsx`, `src/components/constitution/*`, `scripts/sync-constitutions.ts`; 186/186 constitutions, 30,537 topic excerpts in DB; commits `22c8b44`, `9fd3975` |
| Electoral systems explainer | `src/app/elections/systems/`; commit `eacb9a8`; 219 chambers verified in DB |
| Elections data sparsity | Live DB: 22 jurisdictions, 26 election rows in `elections` table |
| Maps (2D/3D/self-hosted tiles) | `src/components/factbook/CountryMap.tsx`, `Country3DView.tsx`, `src/lib/data/country-bounds.ts`; commits `bad4e38`, `2e5d8c4`; Blob archive verified byte-exact with HTTP 206 range support |
| Leader/cabinet enrichment | Live DB deltas (offices 389→5291, cabinets 2→197 jurisdictions, portraits 0→1594); `scripts/sync-cia-cabinets.ts`; commit `93d108f` |
| Blog images complete | `public/blog/*/cover.webp` (10/10) + 42/42 inline `.webp` files |
| History chart is single-series | `HistoryChart` in `src/components/country/CivicaIndexPanel.tsx` (quarterly composite only) |
| Backsliding tracker absent | Zero grep hits for the concept across `src/app`; mockup `mockups/06-21-2026-democracy-backsliding-tracker.html` |
| Constitution page weight | Live curl of `/constitution?c=france` returns ~1.33 MB with 3 duplicated inline SVGs |
| Stale active-plan pointer | `AGENTS.md` cites `~/.claude/plans/excellent-findings-thank-you-bubbly-kay.md`, which does not exist; real roadmap is `plan/civica-feature-roadmap-2026-06-30.md` |
| Stale memory claims (embed palette, rankings dedup, outcomes "deferred") | `src/app/embed/[slug]/route.ts` (v2 palette, soft shadows; commits `bba2964`, `a822985`); `src/lib/db/queries.ts` DISTINCT ON guards at both cited call sites; `/civica-conditions` live (commit `7f3f789`) |
| Beta chip = 4 class families | `.ci-beta-pill`, `.editorial-beta-tag`, `.factbook-reconciliation-notice__beta`, `.factbook-drawer-beta__pill` across `civica-index.css`, `editorial.css`, `factbook.css` |
| Conditions explorer residual inline styles | `src/components/outcomes/OutcomesExplorer.tsx` — Year/Lens labels carry inline `font-mono` styling |
| Pulse paused | `vercel.json` crons contain no pulse entries; pipeline code present under `/api/cron/pulse/*`; manual `pulse-daily` skill exists |
| Vatican page 404 | `/country/vatican-city` (and slug variants) 404 on dev server; bounds data (`VAT`) exists, so the map is ready once the page resolves |
| Superseded mockups | `mockups/04-20-2026-international-organizations-civica-v3.html` (three-pane, retired 2026-06-30), `mockups/04-20-2026-civica-index-government-types.html` (taxonomy retired 2026-05-02), `mockups/06-29-2026-factbook-landing-{A,B}.html` (variant C shipped) |
| §8 legacy corpus tally | 108 `.md` docs in `plan/` (Apr–Jun), audited as 106 items across 12 verification slices: 82 done, 10 partial, 4 not started, 7 superseded, 3 self-deferred — every verdict re-derived from code/DB, not the docs' own status headers |
| §8.1 growth-methodology mix unaddressed | `plan/gdp-growth-methodology-mix-resolution-v1.md` (status PROPOSED, never adopted); zero `growthMethodology` hits in `src/` + `scripts/`; `statsSaGrowthMethodology` confined to `sync-stats-sa.ts` |
| §8.2 dormant outcomes endpoint public | `src/app/api/countries/[slug]/outcomes/route.ts` live and unauthenticated; `getCountryOutcomes` (`src/lib/db/queries.ts:765`) peer-bands on raw `government_type`; no UI consumer (see §5 "component built, unwired") |
| §8.3 Pulse classifier vs published method | `content/methodology-pulse.md:178` (two independent passes, no repeat-sampling) vs `TEMPERATURES = [0.0, 0.4, 0.8]` in `src/lib/pulse/v2/classify.ts:54` and `backtest.ts:49`; no `pulse_methodology_versions` table in `schema.ts`; no shared `classifyEvent()`; prerequisite spec `plan/pulse-methodology-versioning-prerequisite-v1.md` unbuilt |
| §8 Pulse corroboration copy = code (closed) | `content/methodology-pulse.md` describes confidence-discount multipliers, matching `src/lib/pulse/v2/corroborate.ts` soft multipliers; policy adopted in `plan/pulse-methodology-v2.1-resolution.md` |
| §8.4 CIA vintage proposal unadopted | `plan/cia-stale-vintage-resolution-v1.md` (PROPOSED, five options, none chosen); `freshness()` in `src/lib/factbook/reconcile/resolver.ts:553-557` unchanged; no `data_vintage_year` column in `schema.ts` |
| §8.5 citability checklist gaps | No `CITATION.cff` at repo root, no Zenodo DOI, no bulk-dump endpoint (per-country `/api/countries/[slug]/export` only); `src/app/about/advisory-board/page.tsx` is a target-roster placeholder; no `cache_control` in `/api/chat`; source `plan/civica-architecture-and-features-research-2026-06-20.md` |
| §8.6 UNESCO license label | `scripts/seed-sources.ts:319-321` seeds `unesco_uis` with `CC-BY-3.0-IGO`; adopted correction is CC-BY-SA-4.0 (`plan/unesco-uis-resolution-v1.md` Q1) |
| §8.7 minor residue | `scripts/regenerate-readme.ts` duplicate `substitute()`/`parseRef()`; `src/app/atlas.css:2154` stale homepage-variant comment; `scripts/seed-sources.ts` lacks the R.1 bucket comments; Kosovo `iso3` stored `XKS` vs specified `XKX` |
| §8 reconciliation corpus holding live | 16 sync adapters under `src/lib/factbook/reconcile/`; nightly verification cron `45 3 * * *` in `vercel.json`; worked-examples test passes 8/8 against the live DB (`RUN_DB_TESTS=1`); `methodology_version` backfill 25,821/25,827 rows |
| §8 legacy supersessions | `src/app/(shell)/` and `/countries/[slug]` absent; commit `e28885d` (footer logo strip) supersedes the engraving-footer spec in `plan/footer-record-image-fixes-2026-06-30.md`; `scripts/reattribute-pulse-country.ts` backfill 64/135 per `plan/pulse-reattribution-2026-06-20.md` |
