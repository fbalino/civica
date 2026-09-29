# DAT-037: CIA World Leaders cabinet-term integrity

Status: open and blocked. The importer, reader, and repair code are
implemented and tested on branch `claude/fix/cabinet-term-integrity`. Nothing
has been written to production. The first isolated rehearsal (2026-09-28,
below) found two rows the repair does not reach, so the production sequence
waits for a repair fix, a second rehearsal, and then the owner's review.

## The defect

The CIA World Leaders directory publishes each country's titles, the people
holding them, and one page-level "Last Updated" date. It publishes no
appointment dates. The former importer:

- stored the page date as every minister's `terms.start_date` and used that
  date as part of the term's identity, so each page update stored unchanged
  ministers again (read-only snapshot, 2026-09-28: about 247 office/person
  pairs with 280 excess rows);
- kept only the last holder of a title the page lists several times (12 Saudi
  Ministers of State shown as 1 current and 11 former);
- never retired titles or holders the page stopped listing (Hungary, Peru,
  Taiwan, Venezuela), and left the dropped title in its list position, so a
  new title landing there tripped the office identity guard (Samoa on 21
  September; Uganda, Ukraine, and the United Kingdom on 25 September);
- imported CIA's "Vacant" placeholder as a person holding 17 current posts;
- rewrote every office, statement, and body on every run (about 3,500 no-op
  history rows in ten days).

DAT-028's statement repair also left about 160 cabinet terms without
provenance and 57 statements naming another title, because the original
writer had keyed one statement per person.

## What the code changes

Importer (`src/lib/factbook/cia-cabinets-sync.ts`, pure rules in
`src/lib/factbook/cabinet-roster.ts`):

- A term is identified by office and person. No start or end date is ever
  written.
- Each listed title's current holders become exactly the listed people,
  including every holder of a multi-seat title. Duplicate stored rows resolve
  to one shared survivor (CIA provenance, then current, then latest CIA
  retrieval, then latest stored date, then lowest id).
- A title the page no longer lists releases its list position and its holders
  become former holders. Nothing is deleted. New titles therefore never
  collide with a stale position.
- "Vacant" and its variants mean no holder. "Chancellor of the Exchequer" and
  "Chancellor of the Duchy of Lancaster" are classified as cabinet posts.
- People match on exact name in a fixed order: someone already holding this
  office, then someone holding another roster office in the country, then
  anyone holding an office in the country, then a QID-backed person, then
  anyone. More than one match at the deciding tier fails that country closed.
- Each country commits in one Neon transaction (offices, people, terms,
  statements, roster statement, and a final assertion that every listed and
  released office ended in its planned position).
- The page date is one `cabinet_roster_last_updated` statement on the
  executive body, with a SHA-256 of the normalized roster in `source_hash`,
  written only when the date or content changes.
- An unchanged roster writes nothing, records no history, and does not stamp
  freshness. The cron outcome treats an unchanged shard as completed. The
  shared executive body is created when missing but never renamed (the
  officeholder sync names it from Wikidata; the old unconditional upsert
  renamed it back and forth).
- New closed skips: head-office title collision and duplicate stored titles
  (`office_identity_conflict`), ambiguous person
  (`person_identity_ambiguous`), implausible contraction and date regression
  (`roster_contraction_guard`, `roster_stamp_regressed`).

Reader:

- Government and Leaders never show a stored date on a roster office
  ("since", "Longest serving", tenure), before or after the repair.
- The Government chart shows every holder of a multi-seat roster title, hides
  titles the latest roster no longer lists, and credits "Cabinet roster
  updated <date>" with a CIA World Leaders source dot. Heads keep one card.
- Leaders credits the roster under "Other offices". Its footnote names
  Wikidata for heads and their dates, and names the CIA roster only where the
  country has roster rows; offices without a cited source are labeled as such.
- `/api/countries/[slug]/leaders`, `/structure`, and `/api/v1/countries/[code]`
  publish no stored date on roster offices, hide released titles, and pick the
  v1 `currentHolder` deterministically.

No Index change-control file was edited.

## One-time repair

`npm run repair:cabinet-terms` (`scripts/repair-cabinet-terms.ts`, logic in
`src/lib/factbook/cabinet-term-repair.ts`, registered as
`data-repair-cabinet-terms`). It needs no inference about older rosters,
because the corrected importer's live refresh owns every current flag, list
position, and term statement. Categories:

| Step | Action |
| --- | --- |
| R1 | Delete terms held by the "Vacant" placeholder person, and their statements |
| R2 | Collapse duplicate office/person rows to the shared survivor; delete loser rows and their CIA statements (a loser with any other publisher's statement stops the plan) |
| R3 | Re-home a misplaced CIA or Wikidata statement to the term it describes, or delete it when that term already has its own; a statement with no single target stops the plan (never relabelled) |
| R4 | Retire unsourced legacy cabinet rows in a country whose executive body has an imported roster (the three UK rows); US legacy rows stay current and are labeled unsourced |
| R5 | Clear stored start and end dates on every surviving roster term |

Plan mode writes nothing. The plan holds IDs, row digests, category counts,
non-target fingerprints, and its own SHA-256; no names or payload text. Apply
runs that exact plan in one transaction: lock the cabinet tables, assert every
target is still in its before-state or already in its after-state, assert no
other cabinet row changed since the plan, apply guarded writes, assert the
after-state and the unchanged non-targets. Any mismatch rolls everything back.
Replaying an applied plan changes nothing. Apply requires an `in_review`
correction record. A non-loopback host requires `--production-host`, the
owner-approval file, and `--confirm=APPLY-<first 12 characters of the plan
SHA-256>`.

Postflight (`--verify`): P1 no dated roster terms; P2 no duplicate pairs; P3
every current roster term has exactly one CIA statement naming its office and
country page (retired terms without provenance are counted and disclosed); P4
no CIA statement on a head term and no Wikidata statement on a roster term;
P5 no placeholder terms; P6 every executive body with current roster terms
has one ISO roster date; P7 no current holder on a released title and no
shared list position; P8 a re-plan proposes nothing; P10 CIA source freshness
unchanged by the repair; P11 history rows recorded at the transaction time
equal the plan's expected count. The transaction's non-target fingerprints
cover terms, statements, offices, and bodies of executive bodies and the
people they reference.

## Isolated rehearsal (before any production change)

Run outside the repository, with PostgreSQL 17 client and server binaries.
`SCRATCH` is a private directory outside the repository; snapshots, restored
clusters, and plan files never enter Git. The worktree's `.env.local` is held
aside for the whole rehearsal so `DATABASE_URL` names only the loopback copy.

1. Read-only snapshot from the direct (non-pooler) production endpoint:
   `PGOPTIONS='-c default_transaction_read_only=on' pg_dump --format=custom
   --no-owner --no-privileges`; record bytes, SHA-256, and completion time.
2. Restore into a new cluster listening only on 127.0.0.1 with
   `timezone=UTC` (`initdb -A trust -E UTF8`, `pg_restore --no-owner
   --no-privileges`); compare table counts and order-independent hashes of
   terms, statements, offices, government bodies, and sources with production
   (read-only).
3. All application commands run through a loopback-only Neon HTTP adapter
   preloaded with `node --import tsx --import <adapter>`. The adapter executes
   Neon HTTP requests over the PostgreSQL wire protocol and refuses any
   non-loopback host; ordinary fetches (cia.gov) pass through. It lives with
   the rehearsal files, not in the repository.
4. `repair:cabinet-terms -- --plan` before the refresh (reference counts).
5. Convergence refresh on the copy: `scripts/sync-cia-cabinets.ts --apply`
   over every CIA page at the 10-second crawl delay, then a repeat pass over
   Saudi Arabia, the UAE, Belgium, Russia, Hungary, Samoa, Uganda, Ukraine,
   the United Kingdom, Uruguay, Sri Lanka, Iraq, and Taiwan (expect zero row
   changes unless a page changed in between).
6. `--plan`, create an `in_review` correction row in the copy, `--apply`,
   `--verify`, `--plan` again (all zeros), and replay `--apply` (no change).
7. Record `plan/evidence/DAT-037/cabinet-term-integrity-rehearsal-<date>.json`:
   hashes, counts, IDs, timings, plan SHA-256, category counts, importer
   summaries, and the four formerly stuck countries' outcomes. No names, SQL
   payloads, or page bytes.
8. Stop the cluster; delete the cluster directory, dump, and plan files; say
   so in the evidence.

## Rehearsal result, 2026-09-28

Record: [`cabinet-term-integrity-rehearsal-2026-09-28.json`](cabinet-term-integrity-rehearsal-2026-09-28.json).
Result: blocked. Two required checks fail.

- The copy matched production exactly: a 226 MB read-only snapshot, restored
  with identical counts and row hashes for terms, statements, offices, bodies,
  people, sources, jurisdictions, corrections, and the evidence history.
- The corrected importer read all 237 candidate pages and updated all 197
  countries that have one, including Samoa, Uganda, Ukraine, and the United
  Kingdom. Bosnia and Herzegovina failed the page schema as before. A repeat
  pass over 18 countries wrote nothing. For those 18 countries, a separate
  parser compared the exact page bytes with the stored roster. Every listed
  minister and official is current and no one else is (heads and diplomats
  stay outside the roster by design): 12 Saudi Ministers of State, the 13
  stale Hungarian holders retired, and 17 multi-holder titles complete.
- The repair applied its plan in one transaction: 5,714 row changes and
  5,714 history rows. Its own postflight passed, a replay changed nothing,
  a new plan proposed nothing, and a later importer pass wrote nothing.
  No duplicate pairs remain. The France and Kosovo head terms are unchanged.
  The three live validators passed against the copy.
- Failure: two retired terms still carry a CIA page date as their start
  date. They are Colombia `0dba8830-fc0c-4173-b08a-d9d7a4867aea`, which is
  also a "Vacant" placeholder, and Fiji
  `9cebaed3-748b-4ad8-ac9d-e3c75681eae1`. The repair plan made before the
  refresh targeted both. The refresh then released their titles' list
  positions, and neither office has a CIA statement. The repair only covers
  offices that are listed or carry CIA provenance, and P1 and P5 check only
  those offices, so neither the repair nor its postflight reaches these rows.
- Fix before production: include offices whose list position the importer
  released in the repair's scope and in P1 and P5. Then rehearse again.
- Observation for decision 4: the importer adopted one United Kingdom legacy
  office with the listed title and a different holder, so R5 clears that
  former holder's hand-entered date. The two legacy rows that R4 retires keep
  theirs.

The copy, snapshot, logs, plan files, and captured pages were deleted after
the run. The record says so.

## Production sequence (only after the owner reviews the rehearsal)

0. Record the owner's written approval in
   `plan/evidence/DAT-037/OWNER-APPROVAL-<date>.md`.
1. Merge through the normal pull request and checks; confirm the production
   deployment is Ready. From then on the daily shard runs the corrected
   importer, and the reader hides stored roster dates.
2. Convergence refresh: 27 sequential authenticated manual deliveries of
   `factbook.cia-cabinets` (`?shard=0` through `?shard=26`, each with its own
   `Idempotency-Key`; shard 27 is empty). About 100 minutes at the measured
   227 seconds per shard. Check each execution, pipeline row, and freshness.
   Samoa, Uganda, Ukraine, and the United Kingdom converged on the restored
   copy in the 2026-09-28 rehearsal.
3. Take a fresh read-only snapshot (DAT-021 procedure) as the recovery point.
4. Disable all project cron jobs in Vercel for the apply window (a single job
   cannot be paused without a redeploy). Confirm no active cabinet lease.
5. Create the public correction record (`in_review`) with the approved text.
6. `repair:cabinet-terms -- --plan` on production; compare its categories with
   the rehearsal; record the SHA-256.
7. `--apply` with the plan file, expected SHA-256, release id, correction id,
   approval file, and confirmation token; then `--verify` with the plan and
   apply report; then `--plan` again (expect all zeros).
8. Re-enable the cron jobs.
9. Spot-check the United Kingdom, Saudi Arabia, Hungary, Samoa, Uganda,
   Ukraine, Uruguay, Taiwan, and Sri Lanka country pages; resolve the
   correction record with final counts; close the two pending Codex monitor
   cabinet incidents; regenerate `src/lib/provenance/domain-coverage.generated.json`.
10. Check DAT-037 with evidence and a `PROGRESS.md` line.

Rollback: runtime changes revert normally, but after step 7 the stored dates
are cleared, and the pre-DAT-037 importer (which identifies terms by page
date) would re-create dated duplicates on its first visit to each country.
Disable the cron jobs before any Instant Rollback past this change, and prefer
a forward fix. Data recovery is the step 3 snapshot or a reviewed forward
compensation (`data-repair-cabinet-terms-compensation`); every changed row's
before-state is also in `research_evidence_history`.

## Owner decisions this branch assumes (recommended options)

1. A renamed or dropped title retires automatically and the new title becomes
   a new position. Implemented. The alternative (stop the country until someone
   maps titles) would restore the office identity conflict for Samoa, Uganda,
   Ukraine, the United Kingdom, and future reorganizations.
2. Duplicate and "Vacant" rows are removed, with every removed row retained in
   the permanent audit log. Implemented (R1, R2).
3. Order changed after review: deploy, refresh every country once, then clean
   up. The refresh sets current holders from live pages instead of July
   evidence, so the repair needs no inference and cannot re-apply a stale
   roster.
4. New: retire the three unsourced UK legacy rows (the live CIA roster names
   different holders), and label the five US legacy rows as unsourced rather
   than retiring them.

Also for approval: applying the repair to production, and the correction text.
Draft, to be finalized after the refresh with the real counts:

> Civica-initiated correction (DAT-037): cabinet lists imported from the CIA
> World Leaders directory used each page's "Last Updated" date as every
> minister's start date. When that date changed, unchanged ministers were
> stored again, positions held by several people showed only one, and
> ministers no longer listed stayed current. Civica now imports the roster
> without dates, shows every listed holder, retires holders the roster no
> longer lists, and shows the roster's last-updated date as the source date.
> A one-time repair removed the stored dates, repeated records, placeholder
> entries, and misplaced source links.

When decisions 1 and 2 are confirmed, record them as APR-D173 in
`plan/DECISIONS.md`: CIA roster rows are undated listings identified by office
and person; titles absent from the latest roster retire automatically; the
roster date is a sourced body-level statement.

## Review points and how they were handled

Adopted from the design critique:

- Refresh before repair; the repair keeps only invariant steps (R1 to R5).
- Apply is one transaction with row-level before/after preconditions,
  non-target fingerprints, table locks, and assertions that raise.
- Mandatory cron pause during apply; rollback caution documented.
- Reader-side date guard ships with the code, independent of repair timing.
- Roster credit and wording appear only where the country has roster rows;
  unsourced offices are labeled.
- UK legacy rows retired by R4; the Chancellor classifier fixed; a legacy
  office with the exact listed title is adopted (tested).
- Deterministic tiered person matching with fail-closed ambiguity; exact
  `lower()` equality instead of `ILIKE`.
- Office, term, and statement writes are atomic per country.
- A size-drop contraction guard that applies whatever the page date says.
- Multi-holder cards limited to roster offices; heads keep one deterministic
  card; deterministic v1 `currentHolder`.
- P3 limited to current terms with retired gaps disclosed; P9 and P11 scoped
  to the repair's own transaction.
- No reconstructed retrieval times: the repair writes no new statements.

Not adopted:

- Updating the roster statement's `retrieved_at` on every successful check.
  It would write and record history on every unchanged run and contradict the
  ingestion contract (`duplicate_noop`, no freshness advance). Per-country
  verification comes from the shard's execution record and the
  `countriesVerified` counter instead; `retrieved_at` means the first
  retrieval that established the current content. The roster content hash and
  content-change update were adopted.
- A saved plan to preserve July listing evidence: no longer needed once the
  repair makes no listing inference.

## Limits

- Identity splits remain: a Wikidata rename creates a second person for the
  same human on the next CIA visit (Sri Lanka), and "(Acting)" prefixes and
  respellings create new people. Matching never merges people.
- Retired roster terms whose statement DAT-028 moved away keep no provenance;
  P3 counts and discloses them.
- `retrieved_at` on existing term statements meant "last checked" before this
  change and means "first seen" after it.
- The Codex data-reliability monitor must use execution records rather than
  statement retrieval times to judge CIA staleness.

## Follow-ups (out of scope)

- Sibling date defects: bills `last_action_date` retrieval-day substitution;
  World Bank classification `asOf`; Wikidata P580 precision.
- CIA title classifier: compound head titles become cabinet offices (UK
  "Prime Minister, First Lord of the Treasury", Taiwan "Premier, Executive
  Yuan", Grenada, Kyrgyzstan); Andorra's co-prince and head of government.
- Person identity: rename-safe matching, "(Acting)" handling, cross-country
  guard, merging known splits (Sri Lanka, Taiwan).
- US legacy rows: source them or retire them (owner decision).
- Leaders "Other offices" omits `central_bank` and `official` types;
  `normalizeCiaName` renders "Charles Iii".
- Protected files needing change control: list CIA World Leaders in the
  Government and Leaders Sources strips (`civica-data/page.tsx`); add
  `cabinet-roster.ts` to the adapter's implementation paths
  (`production-adapter-registry.ts`); set CIA World Leaders `upstreamVintage`
  to the page's Last Updated date (`source-input-manifest.ts`); a
  `currentHolders[]` field on `/api/v1/countries/:code` (API contract).
- Fence off or retire `scripts/cleanup-bad-offices.ts`, which deletes every
  cabinet term and office without statement cleanup.
- Data dictionary `terms` wording should cover undated listings at the next
  regeneration (changes the review-packet hash).
- Bosnia and Herzegovina and Micronesia have no CIA rows although they are in
  the crawl list; Brazil lists Argentina's central banker. Not checked here.
