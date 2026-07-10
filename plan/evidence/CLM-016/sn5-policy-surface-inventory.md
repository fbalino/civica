# CLM-016 — Policy-surface inventory (SN5, read-only)

Scope: current implementation only, no edits besides this file. Repo root
`/Users/fernandobalino/Projects/civica`.

## 1. Current truthful capabilities vs. missing pieces

**Exists today (truthful, working):**
- A public **CI/Pulse corrections intake form** at `/civica-index/corrections`
  (`src/app/(reader)/civica-index/corrections/page.tsx`,
  `CorrectionsForm.tsx`) posting to
  `src/app/api/civica-index/corrections/route.ts`, which validates and
  inserts into `correction_log` (`src/lib/db/schema.ts:1424`). The page
  renders a **public log** of past submissions (category, status, public
  disposition, resolved date) — this is real correction history, not a stub.
- A declared **SLA** — `disputeSla` in `src/lib/content/site-state.ts:355`:
  `initialResponseDays: 7`, `fullDispositionDays: 30`, plus per-group targets
  (A=7d, B_tier1=14d, C=30d, plausibility=1d). Cited in the corrections page
  metadata description.
- A **separate, independent dispute pipeline for factbook data**:
  `data_disputes` table (`schema.ts:712`) with `dispute_kind`
  (`material_error | group_a_override | group_c_override |
  plausibility_envelope | rank_demoted | public_correction | other`),
  `status` (`open | in_review | resolved_a_wins | resolved_b_wins |
  resolved_held | rejected_invalid`), reviewer id/notes, `resolved_at`,
  `resolution_action`. Admin resolution UI at
  `src/app/(admin)/admin/data-disputes/[id]/page.tsx` offers Resolve A /
  Resolve B / Hold / Reject / Reopen and stamps `resolved_at` + reviewer.
  Public-facing read surface: `/country/methodology/reconciliation/disputes`
  (`DisputesFilterClient.tsx`).
- **Immutable historical preservation** already exists structurally:
  `fact_snapshots` (`schema.ts` ~ line 750) stores every raw upstream payload,
  hashed, with `upstream_vintage_label` and `fetched_at` — replayable by
  vintage. `data_facts_audit_log` (below `fact_snapshots`) records every
  reviewer decision and resolver override (e.g., on a methodology version
  bump), mirroring `pulse_review_audit_log`. These are real audit trails, not
  placeholders.
- **Version stamping exists per subsystem**, not as one unified policy:
  CI has `methodology_version` (`ci_dimension_scores`, `ci_composite_scores`,
  `pulse_daily_scores` FK to `ci_methodology_versions`), `site-state.ts` holds
  hand-maintained `version` / `versionHistory` fields for several pages (e.g.
  peer-grouping `versionHistory: [{version:"v1.0", adoptedAt:"2026-05-02", ...}]`
  at `site-state.ts:236`, replication `version: "v2.0"` + `versionHistory` at
  `:146-157`, Pulse `version: "v0.2-beta"` at `:190`).
- **Known-limitations prose exists** in `content/methodology-pulse.md`
  (`## Known limitations {#known-limitations}` at line 262, plus an inline
  "known limitation" admission about double-count prevention at line 252 and
  a coverage-limitations section at line 254). No equivalent heading exists
  yet in `content/methodology-civica-index.md`, `content/about.md`, or
  `content/methodology-overview.md` (checked; no hits).
- A **published dispute-severity model**:
  `src/lib/factbook/reconcile/dispute-severity.ts` (`computeSeverity`,
  `SeverityBucket`, `SeverityScore`) drives admin queue sort — this is a real
  severity concept, but it is internal-only (admin queue), not published as a
  public severity taxonomy tied to response-time tiers.
- A **near-changelog surface**: `/civica-index/pulse-changelog`
  (`src/app/(reader)/civica-index/pulse-changelog/page.tsx`) lists classified
  Pulse events with review state and source links — but this is an events
  ledger, not a corrections/retractions changelog.

**Missing / not truthful to claim exists:**
- No single published **corrections/retractions/versioning policy page**
  (severity definitions, response-time commitments as *policy* prose, how
  retraction differs from correction, how a version increment is decided and
  announced). `disputeSla` today lives only as a code constant surfaced in
  one metadata description string, not as reader-facing policy prose.
- **No site-wide "known limitations" policy or index** — only Pulse has a
  section; CI, reconciliation, and other research artifacts do not.
- **`pulse_changelog` (schema.ts:1307, table `pulse_changelog`) is NOT a
  corrections/retraction changelog** — it stores decay-impact rows
  (`decayedImpact`, `daysSinceEvent`) per jurisdiction/date/event for Pulse
  scoring math. Its name is misleading relative to CLM-016's "changelog"
  requirement; do not reuse it as the corrections changelog without
  renaming/clarifying scope, or build a distinct table.
- **No supersession marker mechanism** for CI scores, Pulse events, or
  reconciled facts (e.g., a `superseded_by_id` / `is_superseded` field). None
  of `ci_composite_scores`, `ci_dimension_scores`, `country_facts`,
  `pulse_events`, or `correction_log` carry a supersession pointer today
  (verified by schema grep — no `superseded`/`supersede` field anywhere in
  `src/lib/db/schema.ts`).
- **No release-notes mechanism at all** — no `release_notes` table, no
  `/changelog` or `/release-notes` route, no footer link to one.
- **`correction_log` has no severity or version-increment field** — only
  `category`, `dimension`, `status`, `disposition`, `resolvedAt`. A
  simulated correction cannot currently produce a machine-readable severity
  tier or a version bump from this table alone.
- **No footer/nav link to a unified policy page.** The footer (`SiteFooter.tsx`)
  links to `/civica-index/corrections` (intake form) and
  `/country/methodology/reconciliation` (dispute methodology), but there is
  no single `/corrections-policy` (or similar) entry point referenced from
  every research artifact.

## 2. Public research artifacts that must link to the policy (bounded list)

Reader-facing pages presenting research/methodology claims, with source paths:

| Artifact | File |
|---|---|
| Civica Index overview | `src/app/(reader)/civica-index/page.tsx` |
| CI methodology | `src/app/(reader)/civica-index/methodology/page.tsx` (+ `content/methodology-civica-index.md`) |
| CI peer-grouping methodology | `src/app/(reader)/civica-index/methodology/peer-grouping/page.tsx` (+ `content/methodology-peer-grouping.md`) |
| CI Pulse methodology | `src/app/(reader)/civica-index/methodology/pulse/page.tsx` (+ `content/methodology-pulse.md`) |
| CI PCA appendix | `src/app/(reader)/civica-index/methodology/pca-appendix/page.tsx` (+ `content/methodology-pca-appendix.md`) |
| CI replication status | `src/app/(reader)/civica-index/replication/page.tsx` |
| CI government-types explorer | `src/app/(reader)/civica-index/government-types/page.tsx` |
| Pulse changelog (events ledger) | `src/app/(reader)/civica-index/pulse-changelog/page.tsx` |
| Site-wide methodology hub | `src/app/(reader)/methodology/page.tsx` (+ `content/methodology-overview.md`) |
| Our Approach | `src/app/(reader)/methodology/approach/page.tsx` (+ `content/data-approach.md`) |
| Data reconciliation methodology | `src/app/(reader)/country/methodology/reconciliation/page.tsx` (+ `content/methodology-reconciliation.md`) |
| Reconciliation disputes log | `src/app/(reader)/country/methodology/reconciliation/disputes/DisputesFilterClient.tsx` |
| About | `src/app/about/page.tsx` (+ `content/about.md`) |
| Rankings (CI-derived) | likely `src/app/(reader)/rankings/...` (not opened — grep-confirmed via `site-state.ts` methodology references; verify route before wiring) |
| Corrections intake + public log | `src/app/(reader)/civica-index/corrections/page.tsx` |
| Blog / The Record articles citing research claims | `content/blog/*.mdx` (spot-checked: `cia-world-factbook-replacement.mdx` references limitations) |

Not in scope for policy links (non-research pages): `/privacy`, `/terms`,
`/licensing`, `/contact`, `/design-system`.

## 3. Existing data/schema/API paths usable for a correction simulation

Usable without new tables:
- **`correction_log`** (`schema.ts:1424`) — insert via existing
  `POST /api/civica-index/corrections` (validated, rate-limited). Status
  transitions (`open → in_review → resolved_corrected`) plus `disposition`
  and `resolvedAt` are already settable server-side (currently only via
  direct DB write / future admin UI — no admin route for `correction_log`
  was found, unlike `data_disputes` which has one).
- **`data_disputes`** + admin resolution flow
  (`src/app/(admin)/admin/data-disputes/[id]/page.tsx`) — the only table with
  a *working* admin resolution UI today. `resolution_action`,
  `resolved_at`, `reviewer_id`, `reviewer_notes` already populate on
  resolution.
- **`data_facts_audit_log`** — the natural home for a "this fact was
  corrected, here is before/after and who/when" record; already wired to
  `dispute_id`.
- **`fact_snapshots`** — already stores historical vintages keyed by
  `(source_id, payload_hash)`; a correction simulation can prove "history
  preserved" by showing the pre-correction snapshot remains queryable after
  a new snapshot is written.

**Minimum safe fixture design (no production DB writes):**
1. Do not touch the live Neon database. Use `vitest` unit tests (repo already
   has a test pattern under `src/lib/**/__tests__/*.test.ts`, e.g.
   `src/lib/factbook/reconcile/__tests__/resolver.test.ts`,
   `src/lib/ci/__tests__/worked-examples.test.ts`) with an in-memory/mock
   Drizzle instance or pure-function extraction, mirroring how CLM-008's
   `worked-examples.test.ts` avoided a live DB (seeded RNG injection, pure
   production seams).
2. Fixture shape: a fake `correction_log` row (`category: "ci_data_error"`,
   `status: "open"`) → simulate resolution → assert (a) a
   `data_facts_audit_log`-shaped record is producible with before/after
   values, (b) a version-increment value changes per whatever version scheme
   CLM-016 defines, (c) a supersession marker (new field, not yet built) is
   set, (d) a release-note string is generated. Since supersession fields and
   release-notes don't exist yet, the fixture will need to target whatever
   new pure function CLM-016's implementation introduces (e.g.
   `simulateCorrection()` in a new `src/lib/corrections/` module) rather than
   the live schema.
3. Never write through `/api/civica-index/corrections` against the real DB
   in a test; that route is rate-limited and DB-backed with no test mode.

## 4. Contradictions / overclaims CLM-016 must repair

- The name **`pulse_changelog`** (table) will read to a future engineer or
  auditor as "the changelog," but it holds scoring decay math, not
  corrections/retractions. Any CLM-016 changelog work must either introduce a
  distinctly-named table/concept or explicitly document why `pulse_changelog`
  is out of scope, to avoid a second false "changelog exists" claim.
- `content/methodology-pulse.md` has a real Known Limitations section but
  **no equivalent section exists for the Civica Index** despite CI carrying
  comparable methodology caveats (per `memory-decisions.md`'s CLM-008 record
  on missingness/uncertainty prose) — a reader following a footer "known
  limitations" link from a CI page today would find nothing.
- The corrections page metadata already **asserts a concrete SLA number**
  ("full disposition within 30 days") sourced from `disputeSla` — CLM-016
  must not silently redefine `fullDispositionDays` without updating that
  copy (`src/app/(reader)/civica-index/corrections/page.tsx:16`), or the page
  and the new policy page will disagree.
- No page currently claims a "correction/retraction/version policy" exists,
  so there is no live overclaim to walk back — but the **absence** is itself
  inconsistent with `AGENTS.md`'s "provenance is load-bearing" and the
  2026-07-09 atlas-first decision's emphasis on transparent process; CLM-016
  closes a real gap rather than fixing false prose.

## 5. Recommended owned implementation files vs. files that should remain untouched

**Likely owned/new (for the eventual CLM-016 implementer, not this task):**
- A new policy content file, e.g. `content/corrections-policy.md` (matching
  the existing `content/*.md` prose-source pattern) + a thin TSX shell under
  `src/app/(reader)/.../corrections-policy/` or as a section appended to the
  existing `/civica-index/corrections` page.
- A new `src/lib/docs/doc-concepts.ts` entry registering the policy as a
  canonical concept (per the 2026-07-10 "one canonical source" decision),
  with `link-only` relations from every artifact in §2.
- Possibly a new schema field/table for supersession markers and release
  notes (e.g. `superseded_by_id` on relevant tables, or a dedicated
  `release_notes` table) — schema changes are consequential and must go
  through Drizzle migration review, not be added ad hoc.
- New pure-function module (e.g. `src/lib/corrections/simulate.ts`) for the
  "simulated correction" acceptance test, decoupled from the live DB per
  §3.2.

**Should remain untouched by CLM-016 (existing, working, out of this task's
scope):**
- `src/lib/factbook/reconcile/*` (resolver, dispute-severity, auto-resolve)
  — the factbook dispute engine is functioning; CLM-016 should reference/link
  it, not rewrite it.
- `src/app/(admin)/admin/data-disputes/*` — working admin resolution UI.
- `pulse_changelog` table/schema — leave as-is (scoring math), just don't
  reuse the name for corrections.
- `src/lib/content/site-state.ts` `disputeSla` — reuse the existing constant
  as the single source for response-time numbers rather than duplicating it
  in new policy prose (per the `{{state.*}}` interpolation convention this
  repo already uses for `content/*.md`).
- `src/lib/claims/claim-tiers.ts` and `public-numeric-claims.ts` — these
  already encode a "correction path" concept per tier (e.g. line 81, 118);
  CLM-016's policy is complementary, not a replacement.

## 6. Objective acceptance checks (for CLM-016's eventual "done when")

1. A single policy page/section exists and is reachable via footer or every
   artifact in §2's link column; `npm run validate:doc-sources` (or an
   extension of it) passes with the new concept registered.
2. The policy page states, in reader-facing prose: severity tiers (can
   reuse/extend `dispute-severity.ts` buckets), response-time commitments
   (must match `disputeSla` values, not restate different numbers),
   historical-preservation guarantee (can cite `fact_snapshots` +
   `data_facts_audit_log` behavior), API/data correction handling, notification
   mechanism, and version-increment rule.
3. A non-DB unit test (per §3.2 fixture design) exercises a simulated
   correction end-to-end and asserts three concrete artifacts: (a) a
   changelog-shaped entry, (b) a supersession marker/pointer, (c) a
   release-note-shaped entry — using the new pure module, not a live insert.
4. Grep-based drift guard: `pulse_changelog` is not referenced from any new
   CLM-016 prose as "the corrections changelog."
5. `npm run validate:doc-references`, `npm run validate:doc-sources`, and any
   new CLM-016-specific validator all pass, mirroring the enforcement
   pattern used by CLM-008/009/010/011 (see `.claude/rules/memory-decisions.md`).
