# Project Memory Sessions

## 2026-04-23 / 2026-04-24 — Phased roadmap: Phases 0, 1, 2.1 scaffold

Active plan: `~/.claude/plans/excellent-findings-thank-you-bubbly-kay.md` (roadmap), `~/.claude/plans/phase-2-shell-refactor.md` (current phase), `~/.claude/plans/backlog-post-phase-1.md` (deferred polish).

### Phase 0 — Bug sweep (shipped)
- Provenance: SourceDot handles null/invalid dates; About page reads `sources.last_sync_at` from DB; Wikidata sync stamps the timestamp.
- Elections: stats query was silently failing due to `ROUND(double, int)` not existing in Postgres — fixed with `::numeric` cast. ElectionsClient now uses `??` not `||`.
- Election results backfill: script at `scripts/backfill-election-results.ts` seeded Romania, Philippines, Singapore 2025. Singapore's election_type was wrongly `presidential`; corrected to `legislative`.
- CI filter chips at `/civica-index`: new `getStructuralFamilyDistribution` query returns family options with totalCount + scoredCount. URL param renamed `?governmentType=` → `?family=`. Empty-state copy is now contextual.
- AGENTS.md rewritten: corrected font family (Fraunces/Inter), table count (26), design-system source-of-truth language, env var documentation, footer invariants.
- Pulse cron: `vercel.json` with three daily runs, route handlers at `src/app/api/cron/pulse/{ingest,classify,calculate}/`, gated by `CRON_SECRET`. Shared ingest lib at `src/lib/pulse/ingest.ts`.
- Pulse name-matching: GDELT `sourcecountry` returns country names not ISO codes. Fixed by also indexing the jurisdiction map by name + aliases.

### Phase 1 — Unified /compare (shipped)
- New canonical `/compare?c=A&c=B(&c=C)` page with five scroll sections: Overview, Civica Index (reuses CI timeline + dimension grid + H2H insights), Chambers (HemicycleChart), Elections, International.
- New query `getInternationalMembershipsBySlugs` joins `organization_memberships` → `organizations`.
- CI dimension constants extracted to `src/lib/ci/dimensions.ts` for reuse.
- Shared client components: `CompareCountrySelector`, `CompareSectionNav` (sticky, IntersectionObserver), `CompareTimelineOverlay`.
- Section components in `src/components/compare/`: `CompareOverview`, `CompareCivicaIndex`, `CompareChambers`, `CompareElections`, `CompareInternational`, `CompareColumnHeader`.
- `/civica-index/compare` deleted, 308 redirect to `/compare` added.
- Legacy pretty URLs (`/compare/<a>-vs-<b>`) now redirect to query-param form via `next.config.ts`.
- Atlas in-app "See full comparison" link REMOVED (user correctly flagged that it would be obsolete in the shell).
- Polish pass after visual QA: fixed card top borders (self-referential CSS var bug), sticky nav (nested <main> → <div>), hemicycle seats label wrap, SourceDot tooltip overflow, South America chip, CI filter All Regions click-back, structural taxonomy label instead of raw government_type in selector cards, NZ empty-elections alignment.

### Phase 2.1 — Three-pane shell refactor (shipped)
- Architect-designed plan at `~/.claude/plans/phase-2-shell-refactor.md`.
- Save-point tag: `pre-shell-refactor`.
- 14 commits total (`ce60f9a` … `01ded34`).

Commits in order:
1. `ce60f9a` — `src/lib/atlas/ids.ts` (atlasIdToSlug, slugToCountry, buildAtlasUrl, tabNeedsHouse, ATLAS_TAB_LABELS).
2. `a9c40d7` — `src/lib/shell/events.ts` civica:ask CustomEvent bridge. `listenForExternalAsk` prop on AskCivicaPanel.
3. `20cdcca` — `<AtlasWorldMap>` extracted.
4. `eeea0ba` — `<AtlasCountryLeft>` + `organizations.ts` shared types.
5. `c07c770` — `<ChamberTab>`.
6. `b19f780` — `<BillsTab>` with BillCard + `onAskBill` prop (legacy path uses chatInputRef+sendChat; shell path uses dispatchCivicaAsk).
7. `e1a2dae` — `<ElectionsTab>`.
8. `43e6fec` — `<ConstitutionTab>`.
9. `4468121` — `<InternationalTab>` + ORG_TYPE_LABEL/ORG_TYPE_COLOR shared.
10. `45abba7` — `<AtlasCountryCenter>` (masthead + tab bar + all 8 panes). AtlasApp 2,352 → 1,222 lines.
11. `357c7d6` — `useAtlasUrlState` hook.
12. `b6400bb` — `/atlas` map-root route + AtlasMapShellClient + shared `useMapPaths` hook.
13. `01ded34` — `/atlas/[slug]/[tab]` country view + **house-chip context fix** in `@right/atlas/[slug]/[tab]/page.tsx`.
14. Handoff doc at `~/.claude/plans/NEXT-SESSION-HANDOFF.md` + this memory update.

### House-chip context fix (2026-04-24)
Rule captured in `memory-decisions.md`. `contextChips` + `apiContext` only include house when tab ∈ {chamber, bills}. Verified in browser:
- `/atlas/united-states/chamber` → `[United States] [Lower] [Chamber]`
- `/atlas/france/democracy` → `[France] [Democracy]` (no house)

### Phase 2.1 gotchas discovered
- **Parallel-route slot file placement is INSIDE the slot dir.** Correct: `(shell)/@left/atlas/page.tsx`. WRONG: `(shell)/atlas/@left/page.tsx` — silently shadowed by root default.tsx, no error.
- **Turbopack parser chokes on `useCallback(async function name() {...})`.** `next build` + `tsc` pass; `next dev` errors. Use arrow function instead.
- **`.chamber-center` has no `position: relative`.** Children using `position: absolute; inset: 0` don't work. Use `position: relative; height: 100%` on the child.

### Phase 2.2 — /civica-index in the shell (shipped)
Commits: `a00a41e` (move) + `4a00510` (delete AtlasHeaderContext).

- `/civica-index` now lives under `(shell)/civica-index/` with filter chips in
  the left pane (`(shell)/@left/civica-index/page.tsx`), hero + tier legend +
  leaderboard in the center, and CI_INDEX_PROMPTS Ask Civica in the right.
- Inline `<style>` block from the legacy page (~320 lines) extracted to
  `src/app/civica-index.css`, imported from root layout. New `.ci-left-pane` +
  `.ci-left-chip` styles for the narrow-rail variant.
- Legacy non-shell page at `src/app/civica-index/page.tsx` deleted. Sub-routes
  (`/[slug]`, `/methodology`, `/government-types`, `/changelog`) stay outside
  the shell as reader-style detail pages.
- `AtlasHeaderContext` deleted entirely. With /civica-index no longer injecting
  into the header, AtlasApp was the last user. The mode bar / filter selects
  are gone from the desktop legacy / site header. Mobile / chips bar is
  unchanged because it renders inside AtlasApp directly. The Shift+click
  compare-pin flow still works via the on-map banner.
- `SiteHeader.tsx` dropped its `"use client"` tag since it no longer uses the
  context hook.

### CI/CP beta hedge (2026-04-24, shipped)
Commit `b11aaf6` — `feat(ci): add BETA pill + methodology-rework disclosure`.

- Amber `.ci-beta-pill` class added to `src/app/civica-index.css` (uses
  `--color-warn` per the frozen-data convention).
- Pill appears next to the `/civica-index` hero eyebrow, alongside a
  one-line "Methodology under active revision — v2 in development"
  disclosure linking to `/civica-index/methodology`.
- Same pill overlaid on both score titles in
  `src/components/ci/CIPulseScoreDisplay.tsx`, so every country CI/CP
  detail page carries the hedge.

### Phase 2.3 — (reader) route group (shipped, scope limited)
Commits `a602e40` → `63b0e7f` (pages moved) + `7f94b73` (rollback of the
extra header).

- `/civica-index/methodology`, `/civica-index/government-types`,
  `/civica-index/changelog` now live under `src/app/(reader)/civica-index/…`.
  URLs unchanged; route groups don't affect paths.
- First attempt added a minimal `ReaderHeader` (wordmark + ThemeToggle)
  in `(reader)/layout.tsx`. User saw it live and said the resulting
  double-header (SiteHeader above + ReaderHeader below, both with a
  theme toggle) looked bad. Rolled back in `7f94b73`: deleted both
  `src/components/ReaderHeader.tsx` and `src/app/(reader)/layout.tsx`.
  (reader) is now purely an organizational marker; pages inherit the
  root layout unchanged.
- Phase 2.3b (migrating `/countries` and `/countries/[slug]` into
  (reader)) is still deferred to its own session — bigger, hero-heavy
  surface that deserves its own commit sequence.
- `/design-system`, `/blog`, `/outcomes`, `/rankings` explicitly stay
  where they are for now.

### Polish pass (2026-04-24, shipped)
Commit `53bbe56` — `fix(ci): tune /civica-index hero for narrower shell center pane`.
- `.ci-container` is now a `container-type: inline-size` container.
- Hero title is 32px by default, bumps to 44px only at container
  width ≥ 960px. Tier legend stacks vertically under 800px. Stats
  strip is a CSS grid (min 92px) so all five stats fit one row.
- Rework-note link got `white-space: nowrap` so "v2 in development"
  stays together.
- Fixed undefined text tokens (`--text-36/38/40/15` don't exist)
  that were silently falling back to 16px body size.

### Chat persistence in the shell (2026-04-24, shipped)
Commit `31db65f` — `feat(shell): persist Ask Civica chat across route navigations`.
- `ShellContext` now exposes `getThread(key, greeting)` +
  `setThread(key, updater)`. Threads held in React state so the
  subscribed panel re-renders on its slice change.
- `AskCivicaPanel` takes a `threadKey` prop; a mount-time effect
  seeds the thread with the greeting the first time a key is used.
- Keys:
  - `/atlas` → `atlas:map`
  - `/atlas/[slug]/[tab]` → `atlas:country:[slug]` (country-level —
    tab hops within a country share one conversation)
  - `/civica-index` → `civica-index:home`
  - `/civica-index/[slug]` → `civica-index:country:[slug]`
  - default → `landing`
- In-memory only. No localStorage yet.

### Phase 2.3b — /countries + /countries/[slug] into (reader) (shipped)
Commit `105841b`. Pure file move. URLs unchanged.

### Phase 2.4 — flip / to the shell (shipped)
Commits `21f2fe6` (move preview/page.tsx → `(shell)/page.tsx`, delete
legacy `src/app/page.tsx`), `3d47fbc` (add `/preview` → `/` 308
redirect), `df32da9` (delete unreferenced `AtlasApp.tsx`,
−1,084 lines).

After these commits:
- `/` is the shell landing (three panes: Start Exploring left rail
  + landing hero + CI Top 10 + how-to center + Ask Civica right).
- `/atlas`, `/atlas/[slug]/[tab]`, `/civica-index`, `/civica-index/[slug]`,
  `/compare` — all in `(shell)`.
- `/countries`, `/countries/[slug]/(democracy|leaders|constitution)`,
  `/civica-index/(methodology|government-types|changelog)` — all in
  `(reader)` (classic single-pane reader, no shell chrome).
- `/design-system`, `/blog`, `/elections`, `/outcomes`, `/rankings`,
  `/about`, `/government-types` — untouched top-level routes.

`AtlasApp.tsx` is gone. All 8 atlas tabs plus the map/country-list
left rail + right chat live as their own components under
`src/components/atlas/` and `src/components/shell/`.

### Phase 4 — widget gallery (shipped)
Commits `2a16ce2` (scaffold), `2764401` (3 sizes + copy buttons),
`a6b0586` (theme + dims toggles), `396395c` (Embed subnav link).

- `/civica-index/widget` is a shell route. Left rail = country picker
  (routes to `/civica-index/widget?c=[slug]`). Center = hero + toolbar
  + three size cards (sm/md/lg) each with iframe preview, snippet,
  and copy button. Right = Ask Civica · Widgets with WIDGET_PROMPTS
  and `civica-index:widget` thread key.
- `ShellCountryRail.HrefMode` gained a `"widget"` variant.
- Theme (Auto/Light/Dark) and Dimension Bars (Off/On) are
  server-rendered <Link> toggles that rebuild the gallery URL, so
  selections are shareable and the iframes + snippets stay in sync
  with `?theme` + `?dims`. `?dims=1` is only applied to the large
  iframe.
- New client-only `WidgetCopyButton` handles `navigator.clipboard`
  writes so the page itself stays a server component.
- Deep link from `/civica-index/[slug]` subnav — "Embed" sits between
  Methodology and Cite, goes to `/civica-index/widget?c=[slug]`.

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

### Open polish not yet addressed
- `.country-row.on` selected-country styling in the left rail — user
  chose to leave as-is (2026-04-24). Not a live item.

### Phase H — Bills tab redesign: real DB-backed sync (shipped)

Active plan: `~/.claude/plans/great-questions-1-build-tender-falcon.md`.

Phase H.1 (3 commits, baseline scaffold):
1. `2587ab9` — schema + foundation. New `bills` table (jurisdictionId,
   bodyId, sourceId, externalId, title, longTitle, summary, stage,
   rawStatus, dates, sponsor, votes, raw jsonb). Refactored
   `parliament-feeds.ts` → `src/lib/bills/` with shared `types.ts`,
   `stage.ts` (statusToStage), `summarize.ts` (Claude Haiku batch
   summariser + `bill_summary_cache`), `upsert.ts` (idempotent +
   stamps `sources.last_sync_at`), `sync.ts` (orchestrator).
2. `79a5778` — US sync (`congress_gov`) + DB-backed
   `/api/countries/[slug]/bills` route.
3. `081378d` — UK sync (`uk_parliament`) + per-row `<SourceDot>`.

Phase H.2 (4 commits, country expansion):
4. `153414c` — Canada (`legisinfo_ca`) via the LEGISinfo bulk JSON.
   First source where `bills.body_id` is populated (resolved from
   `OriginatingChamberId` → governmentBodies.chamber_type). Also
   fixed two summariser bugs surfaced when scaling past the legacy
   5-bill live-fetch shape: lazy-init the Anthropic client (so
   dotenv has a chance to populate `ANTHROPIC_API_KEY` before the
   SDK reads it — static-import hoist would otherwise capture the
   shell's empty placeholder), and chunk `generateSummariesBatch`
   into groups of 20 (max_tokens=600 truncated at 100 bills).
5. `4940ca6` — Brazil (`camara_br` + `senado_br`) merged adapter.
   Câmara via dadosabertos.camara.leg.br; Senado via
   legis.senado.leg.br. Resilient to single-chamber outages
   (Câmara was 504-ing during local verification — Senado still
   shipped). Sénat note: API caps `numdias=30` (returns 400 for
   higher values) — pitfall not in the docs.
6. `8999a46` — Germany (`bundestag_dip`) via DIP REST API. Uses the
   public/anonymous key from the bundesAPI repo as fallback when
   `BUNDESTAG_API_KEY` env var is unset. Extended `statusToStage`
   with German keywords (verkündet/verabschiedet/ausschuss/
   zugeleitet etc).
7. `cd627bb` — France (`data_assemblee_fr` + `senat_fr`) merged
   adapter. AN via 9MB zipped JSON dump (8905 dossiers, 2113 are
   `DossierLegislatif_Type` real bills, sorted by latest dateActe).
   Sénat via 3.5MB latin-1 CSV. Added `adm-zip` (+@types) for
   in-memory zip extraction (dynamic import keeps it out of the
   client bundle). Extended `statusToStage` with French keywords
   (promulgué/adoption définitive/commission/première lecture etc).

After all 7 commits: 606 bills in DB across 8 sources (US 106,
UK 100, CA 100, BR 100 [Câmara 50 + Senado 50], DE 100, FR 100
[AN 50 + Sénat 50]). All summarised. Daily Vercel cron runs at
03:00, 03:30, 04:00, 04:30, 05:00, 05:30 UTC.

### Phase H gotchas + decisions

- **Shell-env interferes with dotenv defaults.** Claude Code (and
  some macOS setups) export `ANTHROPIC_API_KEY=` as an empty
  string at the system level. dotenv's default behaviour is to
  *not* override existing env vars. Result: `process.env.ANTHROPIC_
  API_KEY` stays empty even with a valid key in `.env.local`. Fix:
  every sync script uses `config({ path: ".env.local",
  override: true })`. Applied to all 6 H.1+H.2 scripts.
- **Static-import hoist + module-level SDK client = race.**
  TypeScript ESM hoists `import` statements above the script body,
  so `dotenv.config()` runs *after* `summarize.ts` has executed
  `const anthropic = new Anthropic({...})`. Lazy-init via a getter
  fixes this and is now the pattern.
- **EU is deferred.** Skipped in H.2 entirely. Future placement
  question (member-state vs top-level EU page) remains open.
- **Brazil vote tallies** — schema columns exist, left null. Same
  for sponsor party. Future enhancement: per-bill detail call.
- **Câmara API flakiness** is real. The merged adapter degrades
  gracefully — empty-array on fetch failure, only stamps the
  source for chambers that returned rows. Verified live: a 504
  spell during local sync still shipped Senado.
- **No new dimension columns** were added — the existing schema
  carries all 6 sources without alteration. `bodyId` is the only
  field touched after H.1 (CA is the first to populate it; BR/FR
  also do).
- **Summariser is multilingual now.** The prompt explicitly tells
  Haiku that titles may be non-English and to write the summary
  in English regardless. Verified across BR/DE/FR.

### Phase H follow-up + open items

- US/UK have a few bills with null summaries because the H.1
  sync ran with the broken summariser; subsequent
  `npm run sync:bills:{us,uk}` re-summarises them (verified
  locally — 90/95 fresh on the first re-run).
- Phase 3 — IA consolidation (elections/outcomes/by-government-type
  moves). **User flagged this is being reassessed**; don't start
  without confirming scope first.
- Phase 5 — CI/CP v2 methodology rebuild (rescoped from the
  original "academic legitimacy polish" framing).
- Phase 4 follow-ups (rankings embed button, countries embed
  button, fix `civica.io` → `civicaatlas.org` in the embed
  footer).

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
  classifier_runs JSON preserved for audit), `pulse_sources`
  (per-event source attribution join), `pulse_dimensional_deltas`
  (current state per (country, dimension)), `pulse_corrections`
  (Pulse-specific dispute log). All in parallel to the legacy
  pulse_events / pulse_daily_scores / pulse_changelog tables —
  legacy stays running until 5.6 cut-over.

- **Hard-coded taxonomy (29 categories).** spec §3.2 across 5
  dimensions (democratic_quality, rule_of_law, freedom_rights,
  corruption_control, stability) with allowed severity tiers and
  decay half-lives in `src/lib/pulse/v2/taxonomy.ts`. Severity
  ranges per §3.3 (low_pos +1/+2 through catastrophic_neg -8/-10).
  HUMAN_REVIEW_TIERS (severe_neg, catastrophic_neg, high_pos)
  drives auto-publish gating.

- **Eight connectors with graceful no-op semantics.** CIVICUS Monitor
  RSS (working — fixed URL is `/feed/`), HRW news RSS (working,
  20 items/day), Amnesty RSS (working, 12 items/day, fixed URL
  `/en/feed/`), RSF (gated on env override — no public RSS feed
  exists at standard paths), IPU /elections (works but sparse —
  IPU API doesn't expose daily parliamentary actions),
  ACLED (gated on ACLED_API_KEY + ACLED_API_EMAIL), V-Dem pulse
  (pure stub — V-Dem ships annually, not real-time),
  GDELT v2 adapter (wraps existing fetcher),
  Reuters/AP wire (URL paths have rotated; gated on env override).

- **Country resolver.** `src/lib/pulse/v2/country-resolver.ts`
  extracted from v1 ingest with extended aliases (DR Congo,
  eSwatini/Swaziland, Türkiye, Vatican). `extractCountryFromText()`
  with word-boundary regex prevents the "MALI inside FORMALIN"
  class of false positives.

- **Sentence-transformer clustering.** `Xenova/all-MiniLM-L6-v2`
  (384-dim, ~25MB local model) via `@huggingface/transformers`.
  Lazy-init pipeline. Per-country bucket → union-find with
  greedy O(N²) pairwise cosine similarity ≥ 0.75 within ±48h
  date window. Embedding stored back on each raw_events row.

- **Multi-run classifier.** Three Anthropic claude-sonnet-4-6
  calls per cluster at temps [0.0, 0.4, 0.8] in parallel.
  Compares (category, severity_tier) tuples for agreement. All-3
  agree → +0.2 confidence boost; 2-of-3 → neutral; none → -0.3
  + flag for review. Lazy-init Anthropic client (project
  convention; module-level `new Anthropic()` evaluates before
  dotenv populates env vars). max_tokens=800 — the 400 cap from
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
  pulse_dimensional_deltas.

- **Cron schedule.** Four new daily Vercel crons: 07:00 ingest,
  07:30 cluster, 08:00 classify, 08:30 score. All gated by
  requireCronAuth.

- **End-to-end runner.** `npm run pulse:v2:all` does ingest →
  cluster → classify → corroborate → score in one pass. Useful
  for backfill + spot-checking. Individual stages also addressable
  as `pulse:v2:{ingest,cluster,classify,score}`.

End-to-end smoke verified on 42 raw_events: 23 country-resolved
→ clustered into 23 distinct events (zero multi-source dedup at
this scale because RSS volumes are tiny; multi-source clusters
will surface once GDELT runs successfully) → 8 classified (1
none, 7 written to pulse_events_v2). Bangladesh moderate_neg
auto-published with delta -2.05 to freedom_rights; 7 severe_neg
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
  date_from filter; needs syntax investigation. Connector is
  shape-correct.

Up next: Phase 5.6 — Pulse scoring + dimensional delta UI on
country pages + public Pulse changelog page. The whole pipeline
stands up to 5.6's needs without further backend changes.

## 2026-04-29 — Phase 5.6: Dimensional delta UI + changelog shipped

Plan: `~/civica/plan/phase-5-6-dimensional-delta-ui.md`. Seven
commits replace the merged-scalar v1 Pulse pane with the
dimensional-delta architecture wherever the Pulse appears, and
expose the v2 pipeline through public API + changelog + methodology
pages.

What shipped:

- **v2 API endpoints + legacy deprecation** (`03aa2c0`).
  `GET /api/v1/pulse/[slug]/dimensions` returns 5-dimension
  deltas + driving events. `GET /api/v1/pulse/[slug]/events`
  returns the full event list joined with pulse_sources.
  `GET /api/v1/pulse/changelog/v2` is the paginated global feed
  with country / dimension / severity / since / published_only
  filters. The legacy `/api/v1/pulse/[slug]` and
  `/api/v1/pulse/changelog` now serve `Deprecation: true` +
  `Sunset: Thu, 31 Dec 2026` + `Link: rel=successor-version`
  headers pointing at the v2 paths.

- **Query layer** (`03aa2c0`).
  `src/lib/db/queries-pulse-v2.ts`:
  `getPulseV2ForCountry(slug)`,
  `getPulseV2EventsForCountry(slug)`,
  `getPulseV2Changelog({country?, dimension?, severityTier?,
  sinceDate?, publishedOnly?, limit?, offset?})`.
  Driving events sort by ABS(severity_value); zero-fills missing
  dimensions in the per-country response so callers don't need
  null checks.

- **`<PulseDimensionalDeltas>` component** (`d79e0c7`).
  Server component. 5 rows in a grid (label · delta · drivers).
  |δ| ≥ 0.5 threshold to show drivers; below threshold, "Flat —
  no significant signal". Empty-state copy when totalEvents === 0.
  All styling via role tokens per DESIGN.md — no inline hex/rgb.

- **Country page surfaces wired** (`5bd0c79`).
  Both `/countries/[slug]` (reader) and `/civica-index/[slug]`
  (shell) now render `<PulseDimensionalDeltas>` below the CI
  panel. CIPulseScoreDisplay slimmed to a single full-width CI
  pane — the v1 merged-scalar Pulse code is gone. `pulseScore`
  prop kept (deprecated, ignored at render) for backwards-
  compat. Visual smoke on /countries/bangladesh: Rights &
  Freedoms shows -2.1 with the HRW arrests headline as driver,
  other 4 dimensions render flat.

- **Public Pulse changelog** (`b2ab743`).
  `/civica-index/pulse-changelog`. EditorialPage with link-driven
  filters (no client JS). Country select with apply button +
  active-state chip. Dimension chips (5). Severity chips (7).
  Status toggle: published-only ↔ show review queue. Each event
  card: country + date, dimension/severity/agreement/queued
  pills, headline, description excerpt, source dots, confidence
  + signed severity. Pagination at 25 per page.

- **Pulse methodology page** (`260112f`).
  `/civica-index/methodology/pulse`. Sister of the existing CI
  methodology + pca-appendix. 11 sections covering source
  taxonomy, pipeline stages, multi-run classifier, asymmetric
  scoring, press-freedom rule, decay (with half-life table),
  bounds + double-counting prevention, known limitations,
  corrections. Beta warning banner first. Footer nav links back.
  Fixed the broken /civica-index/pulse-methodology link in
  Section 10 of the existing methodology page.

- **CI/Pulse double-counting prevention** (`06da300`).
  `decoupleAbsorbedEvents(db, newQuarter, opts)` compares CI v2
  dimensional scores between two consecutive quarters. For each
  (country, dimension) where the score moved by ≥ 3 points,
  zeros corroboration_confidence on all published
  pulse_events_v2 rows pre-dating the new quarter, with the
  reason logged in review_notes. Wired into
  `scripts/calculate-ci-v2.ts` as the final pass.
  `--decouple-dry-run` flag computes everything without the
  UPDATE. Helper no-ops on first beta quarter (no previous to
  compare against). The hook is ready for the next CI v2
  quarterly recompute (target: 2026-09-30 cut-over).

Plan-level notes:
- Phase 5.5's stability dimension is intentionally excluded from
  the decouple shared-dimension list. No CI v2 dimension absorbs
  it; it stays Pulse-only as a spillover signal per spec §3.2.
- The Phase 5.5 Bangladesh event remains the only published v2
  event in the DB. The 7 severe_neg events from various other
  countries stay queued (`published=false`) until Phase 5.7
  ships the reviewer surface.
- Visual verification: `/countries/bangladesh`,
  `/civica-index/pulse-changelog?review=1`,
  `/civica-index/methodology/pulse` all render correctly via
  the preview MCP.

Up next: Phase 5.7 — internal review queue UI for the severe-tier
events. The pulse_events_v2 rows with `published=false` AND
`review_status='pending'` are the queue. Reviewer UI lives at
admin-gated `/admin/pulse-review`. Backend already has reviewerId
+ reviewNotes + reviewStatus columns; Phase 5.7 just builds the
operator surface.
