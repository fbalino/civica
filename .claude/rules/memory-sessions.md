# Project Memory Sessions

## 2026-05-09 — V3 visual-language prototype

Added an isolated `/v3` design-system prototype based only on the user's
attached mockups, not on existing Civica visual assets. New files:
`src/app/v3/page.tsx`, `src/app/v3/V3ShowcaseClient.tsx`, and
`src/app/v3/v3.css`.

The route hides the existing site header/footer for a clean V3 preview, defines
V3-only light/dark prototype tokens, and renders code-native atlas motifs,
color systems, typography, buttons, search, cards, map/data examples, tables,
bars, ramps, soft shadows, and responsive layouts. Verified with
`npx eslint src/app/v3`, `npm run build`, Browser on `http://localhost:3000/v3`,
and `agent-browser` desktop/mobile screenshots plus a short walkthrough video
under `/tmp/civica-v3-qa/`.

## 2026-05-07 — Global scrollbar defaults

Atlas-style scrollbar treatment moved into global CSS so long sidebars
and other overflow containers inherit it by default. `src/app/globals.css`
now defines shared `--scrollbar-*` tokens plus Firefox/WebKit global
rules; `src/app/atlas.css` no longer owns the broad `.atlas-root *`
scrollbar rule; `src/app/civica-chat.css` points chat scroll containers
at the shared tokens. Verified with `npm run build` and `agent-browser`
on `/factbook/united-states` and `/atlas`; screenshots/video live under
`~/civica/plan/`.

## 2026-05-03 — `structural_family` removal — Phase 4 public API deprecation contract shipped

Phase 4 of the structural-family removal landed. Sunset date locked
at **2027-03-31** (calendar-anchored, not vintage-anchored — gives
external API consumers \~10 months of overlap regardless of small
shifts in Phase 4 ship date). Successor endpoint locked as a single
`/api/v1/peer-groupings` returning all four lenses + monarchy\_status
in one response (matches Phase F's `meta.reconciliation` envelope
conventions; consumers almost always want all lenses for
orientation, sub-paths would force multiple round-trips for the
common case).

### What shipped

- **`src/lib/api/deprecation.ts`** — shared constants module:
  `STRUCTURAL_FAMILY_SUNSET_DATE` ("Wed, 31 Mar 2027 23:59:59 GMT"),
  `STRUCTURAL_FAMILY_DEPRECATION_HEADERS`,
  `STRUCTURAL_FAMILY_DEPRECATION_META` (the `meta.deprecations`
  block to merge into JSON envelopes), and
  `withStructuralFamilyDeprecation(res)` helper that mirrors the
  existing Pulse v1 → v2 deprecation pattern.

- **`src/app/api/v1/peer-groupings/route.ts`** — successor endpoint.
  Single response with all four peer-grouping lenses (World Bank
  region, World Bank income, V-Dem RoW, BR/CGV regime) plus
  monarchy\_status as descriptive metadata. Each lens block carries
  the canonical `factKey`, the `filterParam` consumers pass to the
  legacy filter endpoints, source attribution matching Phase F's
  `provenance.source` shape, and a sorted list of values with cohort
  sizes.

- **`src/app/api/v1/peer-groupings/migration/route.ts`** — per-country
  migration table as JSON. Replication-script maintainers consume
  this to bulk-rewrite `structural_family` joins. One row per
  sovereign state with both deprecated values and the peer-lens
  replacements.

- **`src/app/(reader)/civica-index/methodology/peer-grouping/migration/page.tsx`**
  — reader-facing version of the same data. Wide table inside
  `.editorial-table-scroll` for mobile compatibility. Linked from
  the methodology page Section 12.

- **All four legacy endpoints** now serve `Deprecation: true` +
  `Sunset: Wed, 31 Mar 2027 23:59:59 GMT` +
  `Link: </api/v1/peer-groupings>; rel="successor-version"` headers
  AND a `meta.deprecations` block in the response body:
  - `/api/v1/government-types`
  - `/api/v1/countries/[code]` (Phase F shipped the additive
	migration; my work added the deprecation contract on top)
  - `/api/v1/countries` (list)
  - `/api/v1/index/rankings`

  The list + rankings endpoints also accept the new typed
  `?taxonomy=` values: `region`, `income`, `vdem`, `cgv`, `monarchy`.
  Each filters via an EXISTS subquery against `country_facts` (or
  `government_taxonomies.regime_type_cgv` for CGV) — paginated, no
  in-memory filter step. Legacy `?taxonomy=structural` and
  `?taxonomy=regime` keep working through 2027-03-31.

- **`src/app/api-docs/page.tsx`** updated:
  - `/api/v1/government-types` marked DEPRECATED with a clear sunset
	note in its description
  - New `EndpointSection` for `/api/v1/peer-groupings` and
	`/api/v1/peer-groupings/migration`
  - `/api/v1/countries` description + parameters extended to document
	the new typed `taxonomy` values
  - curl examples updated to highlight the successor

- **Replication-script discovery (Resolution §6 Q9) closed.** Sweep
  found NO external academic-replication scripts referencing
  `structural_family`. The three internal scripts that touch the
  field (`derive-government-taxonomy.ts`,
  `check-taxonomy-state.ts`, `ingest-government-taxonomy-br.ts`)
  are diagnostic/preservation tooling that gets deleted in Phase 6
  alongside the column drops. The
  `/civica-index/replication` reader page describes the Civica Index
  replication package as future work and contains no `structural_family`
  references.

### Coordination move that paid off

Following the user's "extend Phase F's `meta.reconciliation` envelope
rather than parallel-author" guidance: every legacy endpoint's
response merges `STRUCTURAL_FAMILY_DEPRECATION_META` INTO the
existing `meta` object alongside `meta.reconciliation` (and
`meta.methodology` on the rankings endpoint). Single `meta` object,
multiple discipline-specific keys. No parallel envelopes.

### Verification

- `npm run build` clean.
- `curl -I` confirms all four legacy endpoints return the three
  deprecation headers.
- `curl /api/v1/peer-groupings` returns all four lenses + monarchy
  with proper cohort counts (29/52/33/20/2/6/47 across the WB
  regions, etc.).
- New typed taxonomy filters confirmed: `?taxonomy=vdem&government_type=Liberal+Democracy`
  → 33 countries; `?taxonomy=region&government_type=North+America`
  → 2 countries (USA + Canada).
- `/civica-index/methodology/peer-grouping/migration` reader page
  renders the full per-country table with horizontal scroll on
  mobile.

### Outstanding

Only Phase 6 (T+2 hard cut on 2027-03-31) remains. That's
calendar-gated, not effort-gated — at that date drop the
`structural_family` and `structural_subtype` columns from the
`government_taxonomies` schema, delete `STRUCTURAL_FAMILY_META` /
`STRUCTURAL_GOVERNMENT_TYPES` constants, return 410 Gone (or 301
to `/api/v1/peer-groupings`) from `/api/v1/government-types`, and
remove the `structuralFamily*` fields from the other endpoints'
response bodies + the `?taxonomy=structural|regime` query-param
handling.

## 2026-05-02 — `structural_family` removal — Phase 3 consumer refactor shipped

Phase 3 of the structural-family removal landed end-to-end after
Phase F greenlit at F.2.1 cut-over (full coverage on
`world_bank_region`, `world_bank_income_group`, `vdem_row`,
`monarchy_status`, `government_form_description`). Five sub-phases
shipped, each verified against the live preview:

- **3a — country detail rank panels.** `(shell)/civica-index/[slug]`
  drops the `familyRank` block and renders two `<PeerLensPanel>`
  components (material peer = World Bank region+income, governance
  peer = V-Dem RoW). `getMaterialPeerSet()` and
  `getGovernancePeerSet()` from `src/lib/peer-grouping/` call
  Phase F's `getCanonicalFactsForJurisdictions()`. Verified on
  Germany (region+income n=35), USA (region+income n\<8 → income-only
  fallback fires correctly), and mobile (393px no-overflow).

- **3b — civica-index left rail + page filter.**
  `(shell)/@left/civica-index` now fetches
  `getVDemRowDistribution()`, `getWorldBankRegionDistribution()`,
  `getWorldBankIncomeGroupDistribution()`, and
  `getCgvRegimeDistribution()` (CGV is in an expandable advanced
  panel). New typed URL params: `?vdem=`, `?region=`, `?income=`,
  `?cgv=`. Legacy `?family=*` 308-redirects to bare `/civica-index`.
  `getCIRankings()` extended with the four new filter options;
  multi-filter intersections work (e.g.
  `?vdem=Liberal+Democracy&income=High+income` → 31 countries).

- **3c — bi-lens explorer.**
  `(reader)/civica-index/government-types` is now a V-Dem RoW
  (default) + BR/CGV (toggle) explorer. Old `?lens=structural`
  silently falls through to V-Dem RoW. The "How to read this page"
  panel was rewritten to cite Lührmann et al. 2018 + the new
  peer-grouping methodology page rather than the old structural-form
  framing. `GovernmentTypesAccordionExplorer.lensTabs.id` type
  changed from `"structural" | "regime"` to `"vdem_row" | "regime"`.

- **3d — archive `/government-types` URLs.** The top-level page +
  the 9 dynamic `[type]/page.tsx` files were deleted; `next.config.ts`
  308-redirects both `/government-types` and `/government-types/:type`
  to `/civica-index/methodology/peer-grouping`. Verified via
  `curl -I` — both return `308 Permanent Redirect` with the right
  `location` header.

- **3e — compare + taxonomy block label swap.** Compare card's
  `prettyGov` now reads `classification.regimeTypeLabel` instead of
  the retired `structuralFamilyLabel`. `<GovernmentTaxonomyBlock>`
  drops the "Structure" row entirely; the descriptive constitutional
  form will move to a `getConstitutionalForm()`-backed surface in a
  follow-up. `/api-docs` example JSON marks both `structuralFamily`
  and `structuralSubtype` fields as \`(DEPRECATED — sunset T+2
  vintages)\` to set external-consumer expectations.

### Phase F vocabulary alignment

Phase F's canonical-fact-layer values are human-readable strings, NOT
snake\_case slugs:
- V-Dem RoW: `"Closed Autocracy"`, `"Electoral Autocracy"`,
  `"Electoral Democracy"`, `"Liberal Democracy"`
- World Bank region: `"East Asia & Pacific"`,
  `"Europe & Central Asia"`, `"Latin America & Caribbean"`,
  `"Middle East, North Africa, Afghanistan & Pakistan"` (note: the
  non-standard MENA-AP regional grouping is the World Bank's lending-
  group label preserved verbatim), `"North America"`, `"South Asia"`,
  `"Sub-Saharan Africa"`
- World Bank income: `"Low income"`, `"Lower middle income"`,
  `"Upper middle income"`, `"High income"`
- CGV regime: snake\_case (matches existing `REGIME_TYPE_META`)
- monarchy\_status: lowercase enum (matches the §C-Q2 spec)

`src/lib/peer-grouping/lens-metadata.ts` keys updated to match
canonical strings. `getPeerLensValueMeta()` is tolerant — unknown
values return `null` rather than crash, so future Phase F vocabulary
drift won't break the UI.

### Open follow-ups (Phase 4)

- Phase 4 — public API deprecation contract (Deprecation +
  Sunset headers on `/api/v1/government-types`,
  `/api/v1/countries`, `/api/v1/index/rankings`; `/api/v1/peer-groupings`
  successor endpoint; migration table; replication-script discovery).
- Phase 4 will also need to rewire `<GovernmentTaxonomyBlock>` (or a
  successor surface) to surface the descriptive constitutional-form
  text via `getConstitutionalForm()`.
- Phase 6 — T+2 vintage hard cut. `structural_family` /
  `structural_subtype` columns and the `STRUCTURAL_FAMILY_META`
  / `STRUCTURAL_GOVERNMENT_TYPES` constants get deleted at that
  point.

## 2026-05-02 — `structural_family` removal — Phase 2 + Phase 5 kickoff

- Audit completed: 19 files reference `structural_family` (vs. \~17 estimate).
  80% of code-level complexity in 3 files (`government-taxonomy/index.ts`,
  `db/queries.ts`, the two `government-types` page suites). The other 16
  files are mechanical follow-ups.
- Implementation plan v1.1 at
  `~/civica/plan/structural-family-removal-implementation-plan.md`. User
  approved 2026-05-02 with three locked decisions: (Q1) archive
  `/government-types*` with 308 redirects, (Q2) wait for Phase F sync —
  no throwaway local ingestion, (Q3) ship methodology page with
  "Pending external review" footer, no BETA pill, v1.1 changelog if
  revisions return.
- **Phase F coordination point.** Phase F shipped F.3 (resolver layer
  flipped for first three flipped fact-keys) on 2026-05-02. The four
  peer-grouping fact-keys (`world_bank_region`, `world_bank_income_group`,
  `vdem_row`, `monarchy_status`) are next in their sync queue (\~2–4 weeks).
  Phase 2 of this work writes against the actual `resolveFact()` API.
  Phase F should coordinate on the `monarchy_status` enum vocabulary
  (this plan §C-Q2 lists 6 values: none/constitutional/absolute/
  ceremonial/elective/theocratic — if Phase F's regex picks different
  values, this plan adopts theirs per the canonical-fact-layer authority).
- Phase 2 + Phase 5 running in parallel during the Phase F sync wait.
  Phase 3 (consumer refactor) gates on the four sync scripts firing
  with ≥200 jurisdiction coverage — pause point before starting.
- Memory-decisions.md updated with the cross-session decision record.

## 2026-04-30 — Phase 5.10 cut-over verified live

The Pulse v2 / taxonomy-v2.0 cut-over had effectively been deploying
across the previous session's pushes (every push to `origin/main`
triggers a Vercel auto-deploy). This session verified the production
state and shipped one bug fix that was uncovered during smoke-testing.

### Phase 5.10 verification (production smoke tests)

All public-facing v2 surfaces verified live on civicaatlas.org:

- `/civica-index/russia` — 200, dimensional panel renders Rights
  & Freedoms -4.2 with "extremist" driver text
- `/civica-index/bangladesh` — 200, dimensional panel renders
- `/civica-index/pulse-changelog` — 200
- `/civica-index/methodology/pulse` — 200
- `/civica-index/methodology/pulse/backtest` — 200
- `/admin/sign-in` — 200
- `/api/v1/pulse/russia/dimensions` — returns the LGBT event
  as freedom\_rights driver with delta -4.15 (matches local)
- `/api/v1/pulse/changelog/v2` — 200
- Legacy `/api/v1/pulse/[slug]` and `/api/v1/pulse/changelog`
  return `Deprecation: true` + \`Sunset: Thu, 31 Dec 2026 00:00:00
  GMT`+`Link: rel="successor-version"\` headers

`npm run build` clean locally.

### State of system at end of session

- `origin/main` at `469e73d` (the review-route fix)
- `pulse-taxonomy-v2.0` tag on origin at `df7cd4e`
- Production serving deployment `dpl_95X4XiaKMCZAXBacYKBSjGMDSME3`
  (the post-fix build will replace this within a few minutes; not
  a behavioral concern since all v2 surfaces shipped earlier)
- 6 published v2 events visible publicly with correct deltas
- 3 still pending in `/admin/pulse-review` queue (no SLA breach yet)
- Daily v2 cron schedule (07:00 / 07:30 / 08:00 / 08:30 UTC)
  remains active

### Known gaps + parked

- **Per-driving-event linking from country panel to changelog** —
  per the deployment plan Q&A, the country panel's driving-event
  headlines are not yet individually clickable. "See all events →"
  link satisfies the transparency floor. Pre-cut-over plan flagged
  this as a 15-min fast-follow; not done. Reviewer may pick up.
- **`ADMIN_API_KEY` rotation in Vercel production env** — flagged
  in the deployment plan as a sign-off item. Not verified this
  session; reviewer should confirm the Vercel dashboard value
  doesn't match the local dev token.
- **Phase 5.9** (licensing audit, advisory board, SSRN preprint)
  remains deferred per 2026-04-28 decision.
- **Vercel deploy of `469e73d`** kicked off by the push during this
  session. Verification was done against the previous deployment
  (`dpl_95X4...`) which already had every visible v2 surface; the
  only behavioral change in `469e73d` is in the admin review POST
  handler, which doesn't affect public-facing surfaces.

## 2026-04-30 — Route audit and visual sitemap

- Created route audit + Mermaid sitemap at `/Users/fernandobalino/civica/plan/site-route-audit-sitemap.md`.
- Audit covered 41 user-facing page routes, 13 shell parallel slot page files, 52 route handlers, 4 layouts, 6 loading states, and 2 parallel default slot files.
- Noted follow-up risks: `/` redirects to `/atlas` before fallback landing content, `/outcomes` has both page file and permanent redirect to `/civica-conditions`, mobile nav references missing `/privacy` and `/terms`, footer invariant is missing visible Licensing/GitHub links, and `src/app/sitemap.ts` omits many newer pages.

## 2026-04-23 / 2026-04-24 — Phased roadmap: Phases 0, 1, 2.1 scaffold
### Phase 4 not done
- Embed button on the rankings leaderboard rows (small hover icon) —
  handoff suggested it but didn't ship in this phase. Cheap
  follow-up.
- Embed button on `/countries/[slug]` reader page — same.
- The embed's med/large footer still reads `civica.io/countries/X`
  instead of `civicaatlas.org/countries/X`. Flagged in the original
  roadmap as "replace the placeholder civica.io URL text in the
  embed's medium/large footer with the real civicaatlas.org domain".
  Fix lives in `src/app/embed/[slug]/route.ts`.

## 2026-04-29 — Design-system unification execution

- Executed the design-system unification plan from
  `/Users/fernandobalino/.claude/plans/i-want-the-design-system-lazy-hickey.md`.
- Added `DESIGN.md`, strengthened the top-level AGENTS design-system
  directive, migrated runtime theme handling to `data-theme`, and
  kept `/design-system` tied to the live site theme.
- `/design-system` now renders the shared `HemicycleChart` with
  deterministic SVG coordinates to prevent React hydration drift.
- Added editorial primitives under `src/components/editorial/` and
  wrapped Civica Index reader pages through the shared shell where
  the existing page structure allowed a low-risk swap.
- Verification: `npx @google/design.md lint DESIGN.md`, targeted
  ESLint on touched files, `npm run build`, and agent-browser passes
  on `/design-system`, `/atlas/usa/chamber` (redirected to structure),
  `/civica-index/methodology`, `/civica-index/changelog`, and
  `/compare?c=usa&c=france`.

## 2026-04-29 — Phase 5.5: Pulse Beta foundation shipped

Plan: `~/civica/plan/phase-5-5-pulse-beta-foundation.md`. Eight
commits (`4a7af06` → final commit) replace the v1 merged-scalar
Pulse pipeline with the dimensional-delta architecture from spec
v0.9. **Backend only — no public UI changes in this phase**, the
legacy Pulse panel still renders unchanged on country pages until
Phase 5.6 swaps the UI.

What shipped:

- **Five new tables.** `raw_events` (staging, drained by clustering),
  `pulse_events_v2` (one row per clustered governance event,
  classifier\_runs JSON preserved for audit), `pulse_sources`
  (per-event source attribution join), `pulse_dimensional_deltas`
  (current state per (country, dimension)), `pulse_corrections`
  (Pulse-specific dispute log). All in parallel to the legacy
  pulse\_events / pulse\_daily\_scores / pulse\_changelog tables —
  legacy stays running until 5.6 cut-over.

- **Hard-coded taxonomy (29 categories).** spec §3.2 across 5
  dimensions (democratic\_quality, rule\_of\_law, freedom\_rights,
  corruption\_control, stability) with allowed severity tiers and
  decay half-lives in `src/lib/pulse/v2/taxonomy.ts`. Severity
  ranges per §3.3 (low\_pos +1/+2 through catastrophic\_neg -8/-10).
  HUMAN\_REVIEW\_TIERS (severe\_neg, catastrophic\_neg, high\_pos)
  drives auto-publish gating.

- **Eight connectors with graceful no-op semantics.** CIVICUS Monitor
  RSS (working — fixed URL is `/feed/`), HRW news RSS (working,
  20 items/day), Amnesty RSS (working, 12 items/day, fixed URL
  `/en/feed/`), RSF (gated on env override — no public RSS feed
  exists at standard paths), IPU /elections (works but sparse —
  IPU API doesn't expose daily parliamentary actions),
  ACLED (gated on ACLED\_API\_KEY + ACLED\_API\_EMAIL), V-Dem pulse
  (pure stub — V-Dem ships annually, not real-time),
  GDELT v2 adapter (wraps existing fetcher),
  Reuters/AP wire (URL paths have rotated; gated on env override).

- **Country resolver.** `src/lib/pulse/v2/country-resolver.ts`
  extracted from v1 ingest with extended aliases (DR Congo,
  eSwatini/Swaziland, Türkiye, Vatican). `extractCountryFromText()`
  with word-boundary regex prevents the "MALI inside FORMALIN"
  class of false positives.

- **Sentence-transformer clustering.** `Xenova/all-MiniLM-L6-v2`
  (384-dim, \~25MB local model) via `@huggingface/transformers`.
  Lazy-init pipeline. Per-country bucket → union-find with
  greedy O(N²) pairwise cosine similarity ≥ 0.75 within ±48h
  date window. Embedding stored back on each raw\_events row.

- **Multi-run classifier.** Three Anthropic claude-sonnet-4-6
  calls per cluster at temps [0.0, 0.4, 0.8] in parallel.
  Compares (category, severity\_tier) tuples for agreement. All-3
  agree → +0.2 confidence boost; 2-of-3 → neutral; none → -0.3
  + flag for review. Lazy-init Anthropic client (project
  convention; module-level `new Anthropic()` evaluates before
  dotenv populates env vars). max\_tokens=800 — the 400 cap from
  the bills summariser truncates the longer JSON shape.

- **Asymmetric corroboration + scoring.** spec §3.4 (positive
  events require ≥1 specialist source; in restricted-press
  countries require ≥2 non-state sources) + §3.5 (RSF press-
  freedom tier modulates news-only signal weight; restricted-press
  + news-only → severely discount). RSF scores hardcoded in
  `press-freedom.ts` from 2024 World Press Freedom Index, refresh
  annually.

- **Decay + dimensional deltas.** Exponential decay
  `severity × confidence × exp(-ln2 × days / half_life)`.
  Half-life from taxonomy (coup 365d, journalist arrest 60d,
  state collapse 730d). Sum decayed impacts per (country,
  dimension) across published=true events in trailing 365 days,
  clamp to [-15, +10] per spec §4.3, upsert
  pulse\_dimensional\_deltas.

- **Cron schedule.** Four new daily Vercel crons: 07:00 ingest,
  07:30 cluster, 08:00 classify, 08:30 score. All gated by
  requireCronAuth.

- **End-to-end runner.** `npm run pulse:v2:all` does ingest →
  cluster → classify → corroborate → score in one pass. Useful
  for backfill + spot-checking. Individual stages also addressable
  as `pulse:v2:{ingest,cluster,classify,score}`.

End-to-end smoke verified on 42 raw\_events: 23 country-resolved
→ clustered into 23 distinct events (zero multi-source dedup at
this scale because RSS volumes are tiny; multi-source clusters
will surface once GDELT runs successfully) → 8 classified (1
none, 7 written to pulse\_events\_v2). Bangladesh moderate\_neg
auto-published with delta -2.05 to freedom\_rights; 7 severe\_neg
events queued for human review (review queue UI ships in 5.7).

Known issues parked:
- **GDELT timeout under Node 25 + undici.** Connect-timeout
  failure on api.gdeltproject.org from Node fetch even though
  curl works fine. Likely IPv6/IPv4 resolver behavior. Bumped
  fetch timeout to 60s + retry-once wrapper. Followup: switch
  to undici Agent with family:4.
- **RSF / Reuters / AP feed URLs.** Public RSS endpoints have
  rotated. Connectors gated on env-var URL overrides; gracefully
  no-op until we identify the right paths (or — for RSF —
  obtain API access).
- **IPU /elections endpoint.** Returns 0 results for our
  date\_from filter; needs syntax investigation. Connector is
  shape-correct.

Up next: Phase 5.6 — Pulse scoring + dimensional delta UI on
country pages + public Pulse changelog page. The whole pipeline
stands up to 5.6's needs without further backend changes.