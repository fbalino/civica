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

### Phase 2 — Three-pane shell refactor (in progress)
- Architect-designed plan at `~/.claude/plans/phase-2-shell-refactor.md`.
- Save-point tag: `pre-shell-refactor`.
- Step 1 done (`8620b10`): shell CSS extracted from `atlas.css` into `src/app/shell.css`. Class names kept as `.chamber-*` to avoid rename churn.
- Step 2 done (`16b2a2d`): shell components built (`ShellContext`, `ThreePaneShell`, `AskCivicaPanel` extracted from AtlasApp), `(shell)` route group scaffolded with default slots, landing page at `/preview` (CANNOT be at `/` because of `src/app/page.tsx` collision — will move in Phase 2.4).
- Per-route prompt catalogs in `src/lib/shell/suggested-prompts.ts`.
- Remaining for Phase 2.1: decompose `AtlasApp.tsx` (2,353 lines) into `<AtlasWorldMap>` + `<AtlasCountryLeft>` + `<AtlasCountryCenter>` + `useAtlasUrlState`, then create `(shell)/atlas/*` routes.

### Decisions and gotchas captured in `~/.claude/plans/NEXT-SESSION-HANDOFF.md`
Full session handoff prompt for next Claude. Includes: files to read, architectural decisions, gotchas (CSS var circularity, Postgres ROUND cast, nested `<main>`, two-page-at-same-URL collision, GDELT name-matching), recommended team workflow, and testing URLs.
