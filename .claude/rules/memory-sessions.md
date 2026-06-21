# Project Memory Sessions

## 2026-06-20 — Blind audit + architecture sweep + feature research (read-only; no code changed)

Ran a blind multi-agent audit (124 agents across 2 workflows: 6 architecture
maps + 15 blind finders + adversarial skeptic per finding; then a 3-piece
gap-fill re-run for the CI map, Pulse map, and Pulse-calc finder that died
mid-response). In parallel, a research track (OWID/V-Dem/World Bank/etc.)
produced a cited architecture+features report. Two deliverables in
`~/civica/plan/`:
- `civica-blind-audit-2026-06-20.md` — architecture explainer (6 subsystems),
  86 verified findings (~15 high / ~26 med / ~45 low), 13 refuted, root-cause
  rollup, sequencing.
- `civica-architecture-and-features-research-2026-06-20.md` — peer benchmarking
  + citability gaps + top-10 feature roadmap (111 cited URLs).

Headline confirmed bugs (NOT yet fixed — read-only audit):
- CI Freedom & Rights dimension computed on wrong scale (ingest feeds FH 1-7
  avg; normalize-v2 expects 2-14 sum) → autocracies flattered (SAU 58 not 0).
  Verified by hand: scripts/ingest-ci-freedom-house.ts:42 vs normalize-v2.ts:83.
- ~4 CI query helpers omit `methodology_version` → v1.0/beta mix (zig-zag
  history, double-counted gov-type avgs). queries.ts:936-1014.
- Rankings double-count countries (no active/canonical dedup). queries.ts:251.
- Pulse upsert.ts:98 + classify.ts:478 fake last_sync_at on zero-insert/non-fetch
  passes (validator allowlists them → false green).
- SourceDot.tsx:42 treats only cia_factbook as frozen → green "live" dot over
  all frozen quarterly sources incl. CI itself (contradicts /about legend).
- Pulse published methodology advertises anti-gaming rules (announcement-30%,
  state-media-50%, press-freedom hold-for-review) not enforced in code
  (corroborate.ts is a multiplier, not a gate).
- Undocumented "v2" visual migration: live site = Bronze/Parchment + SOFT
  shadows; DESIGN.md/CLAUDE.md still say cinnabar/paper + HARD; embed = 3rd
  divergent look; `--shadow-hard` token is now soft.
Root causes (fix once → many findings): methodology_version filter, SourceDot
frozen-map, read-path fact dedup, corroboration-as-gate, the v2 visual-migration
doc reconciliation, and the 18x copy-pasted factbook sync adapters.
Next.js 16 compliance verified clean. Owner can supply a private known-examples
list for a recall check (blind-audit step 3) — not done this session.

### Remediation applied same session (code changes uncommitted in working tree)
- **CI methodology_version filters**: getCICountryHistory, compareCICountries
  (composites+dimensions), getCIByGovernmentTypeDots, getGovTypeTrajectory now
  pin `methodology_version='beta'` (queries.ts). Fixes zig-zag history +
  double-counted gov-type aggregates.
- **SourceDot frozen set** expanded from just cia_factbook to all frozen
  academic/quarterly vintages incl. civica_curated (SourceDot.tsx) → green now
  reserved for genuinely live feeds.
- **Bills tab**: stopped stamping today's date (retrievedAt={null}); replaced
  false "Data refreshes hourly" with "fetched live from the official feed".
- **Freedom House scale**: ingest-ci-freedom-house.ts now emits the 2–14 SUM
  (avg×2) matching normalize-v2 + methodology. IMPORTANT: the live displayed
  beta data (2024-Q4) was ALREADY on the correct 2–14 scale (SAU raw 14→0,
  USA 4→83.3), so this was a latent re-run landmine — NO prod recompute was
  needed. The buggy 1–7 values only ever existed under 2023-Q4 v1.0 (retired).
- **Pulse freshness faking** fixed: upsert.ts now stamps via markSourcesSynced
  gated on inserted>0; classify.ts no longer stamps during the non-fetch
  classifier pass. Removed both from validate-sync-freshness ALLOWLIST → now
  only source-freshness.ts is allowlisted (validator passes: 1 allowlisted, 0
  offenders).
- **Honesty copy**: /about Pulse "daily" → paused-caveat wording; /elections
  "200+ countries" → "a growing set of countries" (DB had 22); data-approach.md
  CI "published and stable" → "published but still in active development".
- Verified: `tsc --noEmit` exit 0, validate:sync-freshness + content-templates
  green, browser-checked /civica-index/burma (CI breakdown reconciles, FH 8/100
  for the junta, frozen "Quarterly cadence" dot).

### Pulse country re-attribution (DATA FIX applied to prod)
Owner reported events attributed to wrong country (source-language/outlet, not
subject — e.g. a Portuguese story about US politics → Brazil). Built
`scripts/reattribute-pulse-country.ts`: an LLM pass (claude-sonnet-4-6,
ANTHROPIC_API_KEY_PULSE_CLASSIFIER) that classifies each pulse_events_v2 row by
its SUBJECT country, ignoring text language/outlet. Dry-run then --apply.
Result: of 135 v2 events, **64 (47%) were misattributed and corrected**, 70
already correct, 1 flagged. Then cleared pulse_dimensional_deltas and recomputed
(calculateDimensionalDeltas): 103 published events, 49 countries, 45 significant
deltas. E.g. Myanmar/Burma went from scattered (Suu Kyi events tagged
DNK/MYS/IND/CAN/DEU/IT) to 27 events, rule_of_law delta −15; Ukraine, Hungary,
Antigua, Cuba all corrected. Report: ~/civica/plan/pulse-reattribution-2026-06-20.md.
NOT done (deferred / needs owner call): the DURABLE fix — wiring this LLM
subject-attribution step into the v2 ingest/classify pipeline before un-pausing
Pulse (owner said "for now" just fix existing). v1 pulse_events (462, deprecated,
not displayed) left unchanged. Did NOT touch: rankings dedup (latent),
design-system v2-fork reconciliation (needs owner decision), Pulse
corroboration-as-gate + announcement/state-media rules (part of owner's planned
Pulse methodology rework), admin-cookie-raw-key / XFF security.

### Follow-up same session — pipeline wiring + subscription daily routine (committed + deployed)
Owner asked to wire the attribution fix into the pipeline (but keep it paused —
no more API spend) and to run the daily re-classification on his $200 Claude Max
SUBSCRIPTION (not API credits) via a Claude Code routine. Done:
- DURABLE pipeline fix: src/lib/pulse/v2/country-attribution.ts (shared subject-
  attribution brain) wired into classify.ts so the live pipeline self-corrects
  attribution. reattribute-pulse-country.ts refactored to share it (DRY).
- SUBSCRIPTION daily routine: the only API-billed pipeline stage is classify, so
  the routine moves that work to the AGENT (subscription). New scripts:
  pulse-export-clusters.ts (ingest+cluster+export unclassified clusters → JSON,
  no paid API) and pulse-apply-classifications.ts (apply agent decisions via the
  EXISTING validated writeEvent + corroborate + score, no paid API). Skill
  `.claude/skills/pulse-daily` orchestrates: export → agent classifies by
  category/severity/SUBJECT-country → apply. classify.ts now exports
  loadUnclassifiedClusters/writeEvent/types for reuse.
- Scheduled task `civica-pulse-daily` created via scheduled-tasks MCP: daily
  07:09 local, notifyOnCompletion. It's a DESKTOP scheduled task (runs while the
  Claude app is open; catches up on next launch if closed) → bills the Max
  subscription (verified no bare ANTHROPIC_API_KEY in env/rc files; the suffixed
  ANTHROPIC_API_KEY_* keys only feed project scripts, not Claude Code auth).
  Backlog: export found 186 unclassified clusters (ingested-but-never-classified
  from the mid-run pause) — first routine run clears them. Owner advised to click
  "Run now" once to pre-approve Bash/tsx tools for unattended runs.
- Research (cited) saved via the routines-research agent: subscription billing
  requires NO bare ANTHROPIC_API_KEY in env, and the LLM work must be the agent's
  (a script calling the SDK still bills API). Cloud Routines (claude.ai/code,
  laptop-closed) are the more-reliable alternative if the desktop-app-open
  caveat becomes a problem; would need Neon host on the routine env network
  allowlist + DATABASE_URL env var.
- Everything pushed to main (commits 63fe0ab fixes, 1023756 routine) → Vercel
  auto-deploy. The Pulse country re-attribution data fix is already live in the DB.
DEFERRED still: design-system v2 fork (memory-decisions 2026-06-20, owner will
review later), rankings dedup (latent).

## 2026-06-07 — Deep-audit remediation + domain fix (shipped to prod)

Implemented the deep-audit high/medium fixes across many delegated agents,
verified, and deployed to production (commits `b195e6c` then a tests/OG
follow-up). Highlights:
- CI per-dimension breakdown now reconciles with the headline via
  `displayDimensionScore` (v2 fixed-bound normalize), applied consistently to
  the country page, `/api/v1/index`, `/api/v1/countries`, embed, and compare.
- Citations stamp the real data vintage (not today); removed false
  "real-time/daily" Pulse claims + false "available as JSON" claims; CI hero
  dot live→frozen.
- Security: Next.js 16.2.3→16.2.7 (clears high-sev advisories); `/api/chat`
  rate-limited + input caps + generic errors; conservative security headers
  in next.config (embed stays framable).
- 404 for unknown country slugs (removed the `loading.tsx` boundaries that
  streamed 200 before notFound); site OG image + apex canonical.
- Dark-mode atlas hover card fixed (CountryHoverCard/v2.css → theme tokens +
  hard-offset shadow). Browser-verified (CI frozen dot + dark hover card).
- Wired the 13 previously-never-run test files to `npm test`
  (`node --import tsx --test`); added regression tests (CI normalize, cite
  date, V-Dem RoW tier) → 30 tests pass. OG `og:image` now on every page via
  `src/lib/og.ts` `withOg()`.
- DOMAIN FIX (via Vercel API, CLI auth): flipped primary so apex
  `civicaatlas.org` serves production and `www`→apex (308). Now matches the
  code's apex canonical/sitemap/robots. Reversible; done apex-first to avoid a
  loop. Note: the Vercel MCP was erroring; used the REST API with the CLI's
  stored token.

Open follow-ons (NOT done; need scoping/owner input): Pulse data-quality
rebuild (methodology-sensitive — should get a resolution doc, not vibe-coded),
cacheComponents→`use cache` migration, full design-token/CSS consolidation,
durable cross-instance rate-limit store (needs KV provisioning), and exporting
`mapVdemRowToOrdinal` for direct test coverage.

## 2026-06-07 — Deep audit (live app, data, security, styling, code)

Ran a 40-agent workflow auditing the DEPLOYED site (civicaatlas.org) + API
+ repo across 5 lenses. Report: `~/civica/plan/deep-audit-live-data-security-styling-code-2026-06-07.md`.
81 findings (12 high / 37 medium / 32 low), 0 refuted. Headline themes:
flagship over-promise (Pulse advertised "real-time/daily" but cron paused
+ data ~5 weeks stale + scores from misattributed/duplicated/opinion-source
events; CI per-dimension breakdown doesn't sum to headline or match
methodology); credibility cuts (cite stamps today's date not data vintage;
green "live" dot over frozen quarterly data; cross-surface value drift;
missing OG image; apex/www canonical mismatch; junk country URLs 200 not
404); security quick-wins (unauthenticated unthrottled /api/chat LLM
endpoint = cost-abuse risk; Next.js 16.2.3 has high-sev advisories ->
16.2.7); 13 test files exist but no runner/CI ever executes them; plus
large styling-token drift + sync-layer duplication (mechanical, later).

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

## 2026-06-06 — Codebase health audit (multi-agent workflow)

Ran a 23-agent discovery + independent-verification + synthesis workflow
auditing the whole repo for dead code, DRY violations (code + styling),
deprecated patterns, complexity, and broken/mis-wired features. 53 total
agents. Report saved to `~/civica/plan/codebase-health-audit-2026-06-06.md`.
132 findings (10 high / 63 medium / 59 low); 4 refuted in verification.
Headline themes: provenance/credibility bugs (syncs stamping last_sync_at
on total failure, citation snapshot republishing rejected facts, fabricated
sources on rankings/embed/factbook-leaders/CI hero, public HomeWiki variant
rendering fake data), missing footer Licensing/GitHub links + no /licensing
page, Pulse "daily" signal lacking a cron schedule, ~18 near-identical
factbook sync adapters (largest DRY surface), and per-page style blocks +
shipped v2/v3 prototype CSS violating the design system.