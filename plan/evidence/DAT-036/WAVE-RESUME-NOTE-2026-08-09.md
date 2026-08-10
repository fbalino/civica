# Wikidata refresh wave — paused mid-preparation (2026-08-09)

**SUPERSEDED 2026-08-10:** the wave completed. Authoritative records are
`production-repair-2026-08-09.md` (DAT-036),
`../ATL-010/production-refresh-2026-08-09.md` (ATL-010),
`../EXP-029/production-activation-2026-08-09.md` (EXP-029), and
`plan/current-handoff.md`. This note is retained only as the pause record.

Owner paused the session before any production apply step ran. This note lets
the next session resume without re-deriving state.

## Where this wave runs

- Worktree `/Users/fernandobalino/Projects/civica/.claude/worktrees/serene-wilbur-375a03`,
  branch `claude/serene-wilbur-375a03` — this is the production lineage
  (35 commits ahead of `codex/civica-academic-readiness`; production deploy
  evidence and the 2026-07-29 wave records live here). `.env.local` and
  `node_modules` were copied from the main checkout; production DB verified at
  migration head `0051_eminent_jocasta` with `entity_name_forms` present and
  empty and `conditions-production-20260729-v1` live.
- Named release for this wave: `atlas-wikidata-refresh-20260809-v1`.
- Authority: `plan/evidence/QA-018/OWNER-SIGNOFF-2026-08-09.md` (copied into
  this worktree).

## Completed so far (safe, mostly read-only)

1. **Correction-log record created (production write, intentional):**
   `correction_log` id `4ffdc3a2-012a-4256-ba0c-c4395aab7a4b`, category
   `other`, status `in_review`, public. Covers the DAT-036 date-precision
   defect; internal notes name the authority record and the named release.
2. **Fresh DAT-036 zero-write plan** regenerated into
   `plan/evidence/DAT-036/live-repair-plan.json` (1,270 publisher-refresh
   rows, 0 repairable, mode zero_write) — matches the runbook expectation.
3. **DAT-036 facts dry run** (read-only) was still running in the scratchpad
   when paused: log at
   `<scratchpad>/dat036-dryrun.log` (~630 admissions, 2 transient SPARQL
   failures: liberia population_total, spain unemployment_rate_pct). A delta
   report script exists at `<scratchpad>/dat036-delta-report.cjs`
   (args: logPath outPath) to compare dry-run values vs stored rows before
   apply. The scratchpad is session-specific; if gone, rerun
   `npx tsx scripts/sync-factbook-wikidata.ts --dry-run` and regenerate.
4. **ATL-010 officeholder enrichment dry run** completed (read-only, retained
   in the session scratchpad; roster reconciliation itself happens on apply).
5. **EXP-029 adapter built and validated (uncommitted working-tree changes):**
   - `src/lib/i18n/name-form-sync.ts` + `scripts/sync-entity-name-forms.ts`
     (+ `sync:entity-name-forms` npm script) — captures P1448/P1705/P1559
     monolingual forms; parties are an explicit zero scope (no publisher
     identity anywhere in DB); ambiguity/non-language tags fail closed.
   - Dry run against production: 197 jurisdictions / 329 persons / 8 offices,
     1,344 claims → 1,021 proposed forms, 151 ambiguous skipped, 0 errors.
   - `writeEntityNameForms` reworked to single-statement CTE supersede+insert
     (interactive `db.transaction` fails on Neon HTTP — verified by probe).
   - Bulk read helper `getCurrentEntityNameFormsForEntities` added.
   - Registered manual adapter `atlas.entity-name-forms` in
     `production-adapter-registry.ts` + ingestion-contract witness +
     regenerated `data/ingestion-contract-fixtures.v1.json`.
   - Reader surfaces wired: country masthead official-names row
     (`FactbookHeaderStrip` + `factbook.css`), leaders directory person/office
     name-form lines (`WorldLeadersDirectoryClient`, `query.ts`,
     `directory.ts`), `publicLanguageName` helper in `presentation.ts`.
   - Green: tsc, eslint (2 pre-existing img warnings), name-form/leaders
     tests, validate:design-tokens, validate:internationalization,
     validate:production-adapters, validate:source-input-manifest,
     validate:sync-freshness.

## Remaining execution sequence (needs no new owner input — authority already granted)

1. Finish/redo facts dry run → generate + review delta report → retain in
   `plan/evidence/DAT-036/refresh-dry-run-deltas.json`.
2. Apply facts refresh: `CIVICA_ATLAS_RELEASE_ID=atlas-wikidata-refresh-20260809-v1
   npx tsx scripts/sync-factbook-wikidata.ts` (rerun targeted
   `--jurisdiction/--fact` for transient SPARQL failures until clean).
3. Re-run `npm run plan:wikidata-date-precision -- --write`; if any repairable
   rows remain, `--apply --release-id=atlas-wikidata-refresh-20260809-v1
   --correction-log-id=4ffdc3a2-012a-4256-ba0c-c4395aab7a4b`. Verify
   Malaysia population / Rwanda life expectancy (year precision, as_of NULL)
   and Sweden population (month precision, as_of NULL); confirm history events;
   then set the correction record to `resolved_corrected` with a public
   disposition and `resolved_at`.
4. Apply officeholder refresh: `npx tsx scripts/sync-wikidata-officeholders.ts
   --release-id=atlas-wikidata-refresh-20260809-v1`.
5. Re-run `npm run audit:leaders-directory:live` (capture) → expect
   releaseReady true, 0 discrepancies; then
   `npm run generate:leaders-directory-release -- --write --ready`;
   `npm run validate:leaders-directory:live`.
6. Apply `npm run sync:entity-name-forms` (after officeholders so the person
   scope is current).
7. Activate `/leaders`: add footer Explore-column link + sitemap static route
   (`{ path: "/leaders", … }`). Explore megamenu deliberately unchanged — the
   owner-approved EXP-015 composition has exactly eight art-backed items; a
   ninth needs owner-approved art.
8. Browser QA per `plan/evidence/ATL-010/browser-verification.md` + EXP-029
   stored-form reader verification (+ masthead official-names row).
9. Append ONE index-change-control record (protected files changed:
   `src/lib/data/production-adapter-registry.ts`,
   `src/components/factbook/FactbookHeaderStrip.tsx`) via
   `npm run generate:index-change-control -- --metadata=<file>`.
10. Evidence folders (row counts, adapter versions, discrepancy report,
    representative stored forms, browser review), checkboxes in
    `plan/MASTER-CHECKLIST.md` AND `plan/03-…`/`plan/06-…`/`plan/07-…`,
    PROGRESS entries, `node plan/tools/validate-master-plan.mjs`, full
    claims/docs + build gates, rewrite `plan/current-handoff.md`, commit on
    this branch.

Never rewrite the immutable G2 release. One wave only; the Pulse wave stays
unauthorized.
