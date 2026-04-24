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

### Next session starts here
- Phase 3 — IA consolidation (elections/outcomes/by-government-type
  moves). **User flagged this is being reassessed**; don't start
  without confirming scope first.
- Phase 5 — CI/CP v2 methodology rebuild (rescoped from the original
  "academic legitimacy polish" framing).
- Phase 4 follow-ups above (rankings embed button, countries embed
  button, fix `civica.io` → `civicaatlas.org` in the embed footer).
