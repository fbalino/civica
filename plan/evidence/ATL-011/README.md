# ATL-011 — party identity, seats, coalition, and ideology coverage audit

Audit-first, per the task brief: investigate the current state, fix genuine
honesty gaps that don't require a schema migration or DB write, and document
what does require more than that. **Bottom line: no Civica-inferred or
unsourced ideology is displayed anywhere on the site.** The sharpest ATL-011
risk the task brief calls out simply isn't present — the party-ideology
sourcing resolution (`plan/party-ideology-sourcing-resolution-v1.md`, dated
2026-07-06) was already implemented end-to-end with real honesty discipline.
The genuine gap this task found and fixed is narrower but still real: the
`/parties` browser was **misattributing seat/coalition provenance** for
roughly 48% of party rows, and silently fabricating a source for a small set
of legacy chambers that have none. A second, deeper gap — the composition
writer cannot safely re-sync a body once V-Party has matched it — is
documented but deferred (requires a migration).

## System map

- **Schema** (`src/lib/db/schema.ts`):
  - `legislature_parties` (:186) — one row per party per chamber: `id` (uuid
    pk), `body_id`, `party_name`, `party_color`, `seat_count`,
    `is_ruling_coalition`, `wikidata_qid` (empty for every row, per the
    resolution doc — not a usable identity key).
  - `party_positions` (:223) — the V-Party v2 ideology match, **1:1** on
    `legislature_party_id` (unique index at :263). Carries `source_id`
    (always `vparty`), `vparty_id`, `economic_left_right`, `anti_pluralism`,
    `coded_year`, `match_method`, `match_confidence` (`'high' | 'review'`).
  - `statements` (:1059) — the generic provenance ledger. Every composition
    sync writes ONE row here per `(subject_table='government_bodies',
    subject_id=body_id, predicate='seats_per_parties', source_id)` — this is
    where the REAL per-chamber seats source lives, not on
    `legislature_parties` itself (which has no `source_id` column).
- **Writers**: `src/lib/legislatures/composition-writer.ts`
  (`writeLegislatureComposition`) is the single sanctioned writer, called by
  `scripts/sync-ipu-parline.ts` (source `ipu_parline`, CC-BY-NC-SA-4.0) and
  `scripts/sync-wikidata-parties.ts` (source `wikidata`, CC0, a **fallback**
  restricted to chambers IPU hasn't already populated). It does a hard
  `DELETE FROM legislature_parties WHERE body_id = X` then re-inserts, plus an
  upsert of one `statements` row for its own `source_id`.
  `scripts/ingest-vparty-positions.ts` is the separate ideology matcher
  (`npm run ingest:vparty`), writing `party_positions` via
  `writePartyPositions` in `src/lib/research/manual-writers.ts`.
- **Reader surface**: `/parties` (`src/app/parties/page.tsx` →
  `src/components/parties/PartyExplorer.tsx` + `IdeologyCompass.tsx`), backed
  by `src/lib/db/queries-parties.ts`. This is the ONLY place ideology is
  displayed. The per-country legislature panel
  (`FactbookLegislatureChart.tsx` / `PartyBrowser.tsx`, both index-adjacent —
  see Scope note below) shows seats/coalition only; `PartyBrowser.tsx` line 17
  explicitly documents "There is NO leader, founding year, or ideology in the
  DB" and was left untouched.

## Per-dimension findings

### 1. Ideology provenance — already honest, verified, and now locked by a test

**Already correct, no fix needed.** `plan/party-ideology-sourcing-resolution-v1.md`
adopted V-Dem's **V-Party v2** (CC-BY-SA, commercial use allowed, a named
`sources` row `vparty`) as the sole ideology source, and the implementation
holds the line the resolution set:

- `scripts/ingest-vparty-positions.ts` matches Civica party rows to V-Party
  parties by name/abbreviation/token-overlap **only within the same
  country**; a party with no match gets **no `party_positions` row at all** —
  never a fabricated or interpolated position.
- Match confidence is stamped per row (`'high'` for exact/abbrev matches,
  `'review'` for fuzzy token matches AND every party in a one-party /
  non-competitive legislature — `NON_COMPETITIVE_ISO3` at :259, covering
  China, Cuba, Laos, North Korea, Vietnam, Eritrea, Turkmenistan, Syria).
- The read layer (`resolvePartyPosition` in `queries-parties.ts`, extracted
  from inline logic during this task — see Fix #3) gates on
  `match_confidence === 'high'` **before** a position is ever returned to the
  UI. A `'review'` row — even one carrying fully-formed numeric axis values —
  resolves to `null`. `PartyExplorer.tsx`'s `IdeologyCell` renders that as an
  explicit `<Chip variant="neutral">Ideology not recorded</Chip>`, never a
  guessed bucket.
- No other Civica-derived or heuristic ideology signal exists anywhere in the
  codebase (`grep -rn "ideology"` finds exactly the `/parties` feature files
  and the schema/registry entries that document it).
- Measured live on 2026-07-12: 1,548 `legislature_parties` rows, 656
  `party_positions` rows (620 `high` / 36 `review`), 620 parties actually
  plotted on the compass (≈64% of seats per the page's own honest caption).

**Locked by test**: `src/lib/db/__tests__/atl-011-party-honesty.test.ts`
re-runs `resolvePartyPosition` against all 36 live `'review'`-confidence rows
(`RUN_DB_TESTS=1`) and asserts every one resolves to `null` — including rows
built from fully-formed synthetic axis values in the pure fixture tests, the
sharpest form of the "never infer" requirement.

### 2. Seats/coalition attribute source/vintage — GENUINE GAP, fixed

**This was the real finding.** `PartyExplorer.tsx`'s "Source" column
previously **hardcoded** `<SourceDot source="ipu_parline" .../>` for every
row, regardless of which sync actually wrote that chamber. Measured live
before the fix:

Resolving each body's REAL source, using the same "most-recently-written-wins"
logic the fix applies (9 bodies carry statements rows from both syncs — see
below), the actual split is:

| Actual source (latest `statements.source_id` for `predicate='seats_per_parties'`) | Bodies | Party rows | Seats |
|---|---|---|---|
| `ipu_parline` (CC-BY-NC-SA-4.0) | 112 | 801 | 19,423 |
| `wikidata` (CC0) | 66 | 684 | 17,314 |
| **none recorded** (legacy pre-provenance seed data) | 16 | 63 | 6,826 |
| **Total** | 194 | 1,548 | 43,563 |

So **~48% of party rows (747 of 1,548) were mislabeled "IPU Parline"** — they
were actually Wikidata-sourced or had no recorded source at all — and 16
real chambers — UK House of Lords, China's National People's Congress, both
Egyptian chambers, both South African chambers, France's Senate, India's
Council of States, Thailand's Senate, both Colombian chambers, Russia's
Federation Council, Saudi Arabia's Shura Council, Canada's Senate, Pakistan's
Senate, and Germany's Bundesrat — have **no recorded seats source at all**
yet were shown with a fabricated "IPU Parline" attribution. 29 of the 63
unsourced rows also carry a matched V-Party ideology position (26
high-confidence/displayed, 3 review-confidence/hidden), compounding the
problem for the displayed ones (e.g. Egypt's Nation's Future Party showed a
"Centre" ideology chip next to a source claim that didn't exist).

**Fix** (`src/lib/db/queries-parties.ts`, `src/components/parties/PartyExplorer.tsx`,
`src/app/parties/page.tsx`): `getPartiesForBrowser()` now LEFT JOINs a
`DISTINCT ON (statements.subject_id) ... ORDER BY retrieved_at DESC` subquery
over `statements` (scoped to `subject_table='government_bodies',
predicate='seats_per_parties'`) to resolve each chamber's REAL, most-recent
source and timestamp. New `BrowserParty.seatsSource: { id, retrievedAt } |
null` field. `PartyExplorer.tsx`'s new `SeatsSourceCell` renders the correct
`<SourceDot>` per row, or an honest `<Chip variant="neutral">Source not
recorded</Chip>` for the 16 unsourced chambers — never a default. The
now-inaccurate global `seatsSyncedAt` prop (one timestamp for a two-source
attribute) was removed from `PartyExplorerProps` and `PartySourceFreshness`;
ideology's `positionsSyncedAt` (a genuine single-source timestamp) is
unchanged.

The `DISTINCT ON` tie-break matters: 9 bodies carry **both** an `ipu_parline`
and a `wikidata` `statements` row (one sync ran, then the other ran later for
the same chamber — the writer only manages its own source's row, never
retires a superseded one). Ordering by `retrieved_at DESC` picks whichever
source most recently actually rewrote `legislature_parties` for that body —
the row that's actually still live.

Browser-verified live on `localhost:3000/parties`: China's National People's
Congress and Egypt's House of Representatives now show "Source not recorded"
instead of a fabricated IPU dot; correctly-sourced chambers are unaffected.
`src/lib/db/__tests__/atl-011-party-honesty.test.ts` locks this with a live
check against the real UK House of Lords chamber.

### 3. Party identity as a stable key — correct in the read layer, deferred at the write layer

**Read layer: correct, now proven.** `BrowserParty.id` is
`legislature_parties.id` (a real UUID primary key), never derived from
`party_name`. The new `resolvePartyPosition`/`resolveSeatsSource` pure
functions structurally cannot reference the display name — their input types
(`RawPositionRow`, `RawSeatsSourceRow`) don't carry a `partyName` field at
all — so two rows sharing a display name (e.g. multiple "Austrian People's
Party" rows across Federal Council delegations, visible in the live browser
screenshot) are guaranteed independent by construction, not by convention.
Locked by test (`atl-011-party-honesty.test.ts`, "the position/source
resolver contracts never reference partyName" and the live
`legislature_parties.id` stability check).

**Write layer: GENUINE GAP, deferred (requires a migration).**
`writeLegislatureComposition` (`src/lib/legislatures/composition-writer.ts`
:11) re-syncs a chamber by **hard delete-then-reinsert** of
`legislature_parties` rows — every party in that chamber gets a **brand-new
UUID** on every re-sync. There is no rename/split/merge tracking: a party
that changes name between syncs is invisible as "the same party," it just
disappears and a different row appears.

This collides with `party_positions.legislature_party_id`, whose foreign key
has **no `onDelete` behavior** (`NO ACTION`, verified live via
`information_schema.referential_constraints`). Measured live: **157 of 194**
distinct legislative bodies now have at least one matched `party_positions`
row. The next time `sync:ipu` or `sync:wikidata-parties` re-runs for any of
those 157 bodies, the writer's `DELETE FROM legislature_parties WHERE
body_id = X` will throw a foreign-key violation. `scripts/sync-ipu-parline.ts`
catches this in a bare `catch { electionsFailed++ }` (:329) with no
diagnostic beyond an aggregate count, and its single end-of-run
`markSourcesSynced` call is gated on `electionsFailed === 0` (:341-344) — so
the freshness dial stays honest (a partial run never fakes `last_sync_at`),
but the practical effect is that **seat/coalition data for any V-Party-matched
chamber can no longer be refreshed** without first breaking the ideology
link. (Neither composition sync is on a Vercel cron — both are manual/`npm
run` scripts — so this hasn't yet surfaced as a production incident, but it
is a real, load-bearing, currently-live constraint on the architecture, not a
hypothetical.)

Fixing this needs one of: (a) `onDelete: 'cascade'` on the FK plus a
re-matching pass after every reseat, (b) redesigning
`writeLegislatureComposition` to diff-and-preserve row identity
(update-in-place for unchanged parties, insert/delete only for real
adds/removals) instead of delete-all-reinsert, or (c) an explicit
party-identity/rename-tracking table. All three are schema changes, out of
this task's scope. **Not fixed here — documented as the primary deferred
finding.**

### 4. Seats/coalition — attribute completeness

- Every displayed party carries `seatCount` (not null, DB `NOT NULL`) and a
  computed `seatShare` (own-chamber percentage).
- `isRulingCoalition` (`Chip`: "In government" / "Opposition") is a real
  column, sourced the same way seats are (part of the same
  `writeLegislatureComposition` write) — no separate coalition-specific
  provenance gap beyond the seats-source misattribution fixed in #2.
- `wikidata_qid` on `legislature_parties` remains empty for every row (as the
  2026-07-06 resolution measured) — not a party-level identity spine, just an
  unused column. Not a regression; pre-existing and out of scope to populate.

## Files created/modified

- `src/lib/db/queries-parties.ts` — added `SeatsSource` type, exported pure
  `resolvePartyPosition`/`resolveSeatsSource` (+ their `Raw*Row` input
  types), joined `statements` for real per-body seat provenance, narrowed
  `getPartySourceFreshness()`/`PartySourceFreshness` to the single genuine
  single-source case (`vparty`).
- `src/components/parties/PartyExplorer.tsx` — new `SeatsSourceCell`,
  provenance column reads `party.seatsSource` instead of a hardcoded
  `"ipu_parline"`; removed the now-inaccurate `seatsSyncedAt` prop.
- `src/app/parties/page.tsx` — stopped passing the removed prop; updated the
  local `freshness` initial-state shape.
- `src/lib/db/__tests__/atl-011-party-honesty.test.ts` — new fixture +
  live-gated contract test (see below).

No `package.json` line, no schema migration, no DB write, no new dependency.
No Index-change-control-protected file was touched — `FactbookLegislatureChart.tsx`
is not actually listed in `src/lib/ci/index-change-control.ts`
(`INDEX_PROTECTED_FILES`), but it was left untouched anyway per the "canonical
hemicycle, don't revive/redesign" DESIGN.md mandate; `civica-data/page.tsx` (which
IS protected) was not touched — the country legislature panel never displays
ideology and was out of scope for this fix.

## Verification

- `npx tsc --noEmit` — clean.
- `npm test` (full suite, no `RUN_DB_TESTS`) — **1317 tests, 1314 pass, 0
  fail, 3 skipped** (the new live-gated tests skip cleanly without a DB
  flag).
- `RUN_DB_TESTS=1 node --import tsx --test src/lib/db/__tests__/atl-011-party-honesty.test.ts`
  — **14/14 pass**, including the 3 live checks against the real production
  database (read-only via `getLiveReadOnlyDb()`).
- `npm run validate:design-tokens` — clean, "No new design-token drift (209
  baselined legacy violations remain)."
- Browser, `localhost:3000/parties` (dev server already running, not
  restarted): page renders, no console errors, no server errors. Confirmed
  via `get_page_text` + targeted DOM queries (a persistent Preview-pane
  screenshot-after-scroll rendering artifact — matching this repo's
  documented hidden/stale-compositor-tab class of issues — blocked a clean
  full-page screenshot of the scrolled table; DOM/accessibility-tree and text
  extraction were used instead and are conclusive): China's Chinese Communist
  Party and United Front parties (National People's Congress) now show
  "Ideology not recorded" + "Source not recorded"; Egypt's Nation's Future
  Party shows a "Centre" ideology chip next to "Source not recorded" (its
  seats are unsourced but its ideology position is a genuine high-confidence
  V-Party match — both facts are independently honest); correctly-sourced
  rows are unaffected.
- Browser, `localhost:3000/country/germany/civica-data` (Index-protected
  page, not modified): renders correctly, no console errors, Legislature
  section shows party name/seats/share/coalition and "SOURCES: IPU Parline
  2026-07-05" — no ideology field anywhere, confirming `PartyBrowser.tsx`'s
  documented scope.

## Answering the report's critical question

**Is any Civica-inferred or unsourced ideology currently displayed as fact
anywhere on the site?** No. This was verified, not assumed: the ingestion
script never infers a position (unmatched → no row), the read layer gates on
`match_confidence='high'` before ever returning a position, and both are now
covered by a fixture + live contract test. The genuine finding in this audit
was seat/coalition source **misattribution** (fixed) and a deferred
identity-versioning gap in the composition writer (documented, needs a
migration).
