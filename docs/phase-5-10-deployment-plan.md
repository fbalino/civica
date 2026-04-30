# Phase 5.10 — Production cut-over deployment plan

**Status:** awaiting reviewer sign-off · DO NOT DEPLOY until approved
**Author:** Phase 5.10 planning (2026-04-30)
**Predecessor:** v2.0 taxonomy approved + tagged `pulse-taxonomy-v2.0`
**Target deploy window:** to be set by reviewer (a 90-minute block when both reviewer and engineer are available to monitor)

---

## What "production cut-over" actually means here

**The work is methodologically ready and committed locally on `main`.**
29 commits are unpushed; pushing them to `origin/main` triggers an
automatic Vercel deploy. The schema migrations have already been
applied to production Neon (we run against the live `DATABASE_URL`).
The cut-over is therefore a single mechanical action — `git push` —
plus a structured monitoring window.

This plan documents:
1. The pre-flight checks to verify before the push
2. The exact deploy sequence (it is short)
3. What can roll back, what cannot
4. The post-deploy monitoring checklist
5. The publicly-visible state changes the cut-over produces

---

## State of the system on 2026-04-30 (inputs to this plan)

### What's already in production (schema, data, infrastructure)

- **Neon Postgres schema is fully migrated to v2.** All nine v2 tables
  exist (`raw_events`, `pulse_events_v2`, `pulse_sources`,
  `pulse_dimensional_deltas`, `pulse_corrections`,
  `pulse_review_audit_log`, `backtest_cases`, `backtest_events`,
  `backtest_runs`). Drizzle migrations 0008, 0009, and 0010 have been
  applied via `db:push`.
- **8 published events in `pulse_events_v2`** (5 approved, 3 pending
  review). All driven by the live ingest+classify cron pipeline that
  has been running since Phase 5.5.
- **1 active dimensional delta** in `pulse_dimensional_deltas`
  (Bangladesh freedom_rights = -2.05).
- **Daily cron pipeline operational** in `vercel.json`:
  - 02:00 UTC: legacy v1 ingest (still running, will deprecate post-cut-over)
  - 04:00 UTC: legacy v1 classify
  - 06:00 UTC: legacy v1 calculate
  - 07:00 UTC: v2 ingest (4 specialist feeds + GDELT)
  - 07:30 UTC: v2 cluster
  - 08:00 UTC: v2 classify
  - 08:30 UTC: v2 score

- **Live specialist feeds** (with `last_sync_at` populated 2026-04-29):
  - HRW (RSS, attribution)
  - Amnesty (RSS, attribution)
  - CIVICUS Monitor (RSS, CC-BY-SA)
  - IPU Parline (existing client, non-commercial)

- **Dormant feeds** (env-gated; require Phase 5.9 licensing):
  - ACLED (`ACLED_API_KEY`)
  - RSF (no public RSS at standard paths)
  - Reuters / AP wire (RSS endpoints rotated)
  - V-Dem pulse (no real-time feed)
  - Google News (per-country fan-out, not implemented)

### What is NOT yet in production (the cut-over delta)

The 29 commits ahead of `origin/main` add:

| Commit cluster | What it ships to users |
|---|---|
| Phase 5.5 (8 commits) | Backend Pulse v2 pipeline (already running locally; cut-over makes Vercel cron use it instead of v1) |
| Phase 5.6 (6 commits) | Public-facing v2: dimensional-delta panel on country pages, `/civica-index/pulse-changelog`, `/civica-index/methodology/pulse`, v2 API endpoints with legacy deprecation headers, CI/Pulse double-counting prevention |
| Phase 5.7 (3 commits) | Internal `/admin/pulse-review` queue, audit log table |
| Phase 5.8 (5 commits) | Backtesting framework, 10 cases curated, `/civica-index/methodology/pulse/backtest` public report |
| Editorial pass (1 commit) | `editorial.css` global classes; reader pages styled correctly in dark mode |
| Phase 5.9 closure (2 commits) | Coup-taxonomy lock-in, closed-regime caveat surfacing on country pages where RSF score < 30 |
| **Taxonomy v2.0** (1 commit) | 30 → 61 categories with disambiguation rules |
| Documentation (3 commits) | Gap analysis, future proposals, deployment plan |

The cut-over is therefore not "deploying new infrastructure" — it is
**switching the public-facing site from the v1 merged-scalar Pulse
display to the v2 dimensional display**, plus revealing all the
companion surfaces (changelog, methodology, backtest report, admin
queue) that have been built but not yet visible to the public.

---

## Pre-flight checklist (run before the push)

The reviewer or engineer runs this checklist. Every item must pass.

### A. Code state

- [ ] `git status` is clean except for the four pre-existing
      untracked / modified files (HemicycleChart, ThemeProvider,
      .claude/launch.json, .claude/worktrees/ — none of which are
      production-relevant).
- [ ] `git log --oneline origin/main..HEAD` returns exactly the
      29 commits expected (final entry should be `df7cd4e` —
      taxonomy v2.0).
- [ ] `git tag -l pulse-taxonomy-v2.0` lists the tag.
- [ ] `npm run build` exits cleanly. No TypeScript errors. Bundle
      sizes within 5% of the pre-cut-over baseline.

### B. Schema parity

- [ ] All nine v2 tables exist in Neon (verified 2026-04-30).
- [ ] No pending Drizzle migrations: `npm run db:generate` produces
      zero new migration files.

### C. Data sanity

- [ ] `pulse_events_v2` has at least one published event with a
      non-zero `corroboration_confidence` (Bangladesh, verified).
- [ ] `pulse_dimensional_deltas` has at least one row with non-zero
      `delta_value` (Bangladesh -2.05, verified).
- [ ] No events are stuck in `pending` review status with
      `created_at` more than 7 days old. (Currently 3 pending,
      all from 2026-04-29 — within window.)

### D. Backtest validation

- [ ] `npm run backtest:run` exits with **10 pass / 0 partial /
      0 fail** at original thresholds. Last run: 2026-04-30, all
      passing per commit `df7cd4e`.
- [ ] Random spot-check: pick one passing case (e.g. Tunisia 2021)
      and verify the trajectory shape on
      `/civica-index/methodology/pulse/backtest` matches the
      expected magnitude+direction.

### E. Smoke tests (manual, before announcing publicly)

- [ ] Local `npm run dev` renders `/civica-index/pulse-changelog`
      with paginated event list, all filters working.
- [ ] Local `/admin/pulse-review` shows the 3 pending events,
      ordered urgency-first.
- [ ] Local `/countries/bangladesh` renders `<PulseDimensionalDeltas>`
      below CI panel with Bangladesh -2.05 on freedom_rights.
- [ ] Local `/api/v1/pulse/bangladesh/dimensions` returns JSON with
      `meta.methodology.status === "beta"`.
- [ ] Local `/api/v1/pulse/bangladesh` (legacy) returns `Sunset` and
      `Deprecation: true` response headers.

### F. Operational readiness

- [ ] `ADMIN_API_KEY` set in Vercel production env (current local
      value is dev-only and will need a production rotation —
      block on this).
- [ ] `ANTHROPIC_API_KEY` quota is healthy. v2 classify cron uses
      ~150 LLM calls/day (~50 clusters × 3 runs).
- [ ] `CRON_SECRET` set in Vercel production env (already configured
      for the legacy v1 cron, same secret applies).
- [ ] Reviewer (Fernando) has tested the admin queue flow at least
      once (verified in Phase 5.7 — Thailand approval).

---

## Deploy sequence

Total wall-clock from "go" to "publicly visible": ~3 minutes.

### Step 1 — Push tags (T+0)

```
git push origin main
git push origin pulse-taxonomy-v2.0
```

This single push delivers all 29 commits + the v2.0 tag. Vercel sees
the push, starts a deploy.

### Step 2 — Vercel build + deploy (T+1m → T+3m)

Vercel runs `npm run build` and serves the new bundle. The cut-over
is atomic at this layer: the public site flips from v1 Pulse panel
to v2 dimensional panel in a single revalidation cycle.

The reviewer monitors the Vercel deploy log for build errors. If the
build fails, the previous deploy stays live (Vercel doesn't deploy
broken builds).

### Step 3 — Post-deploy smoke (T+3m → T+10m)

Run the public-side smoke tests:

- [ ] Visit `https://civicaatlas.org/countries/bangladesh` —
      `<PulseDimensionalDeltas>` renders below CI score, freedom_rights
      shows -2.1 with the HRW arrests headline as driver.
- [ ] Visit `https://civicaatlas.org/civica-index/pulse-changelog` —
      paginated list of events, filters work, source dots render.
- [ ] Visit `https://civicaatlas.org/civica-index/methodology/pulse`
      — full v2 methodology including the disambiguation section.
- [ ] Visit `https://civicaatlas.org/civica-index/methodology/pulse/backtest`
      — 10/10 pass status banner, all per-case sections render.
- [ ] Visit `https://civicaatlas.org/admin/sign-in` — token-entry form
      renders. (Don't sign in unless prepared with the production
      `ADMIN_API_KEY`.)
- [ ] `curl -s https://civicaatlas.org/api/v1/pulse/bangladesh/dimensions`
      — returns JSON with `meta.methodology.status: "beta"`.
- [ ] `curl -sI https://civicaatlas.org/api/v1/pulse/bangladesh` —
      legacy endpoint returns `Sunset: Thu, 31 Dec 2026` header.

### Step 4 — Verify cron schedule (T+10m → T+24h)

The Vercel cron schedule from `vercel.json` is registered on first
deploy. Within 24 hours, the v2 cron runs at 07:00 / 07:30 / 08:00 /
08:30 UTC will fire automatically. Reviewer checks Vercel cron logs
the next morning to confirm at least one successful run of each
stage.

### Step 5 — 7-day operational window (T+24h → T+7d)

The reviewer (Fernando) is the operational owner during this window.
No automated escalation. Daily checklist:

- Review the `/admin/pulse-review` queue. Approve / reject / edit
  pending events within 48 hours of arrival.
- Check `/civica-index/methodology/pulse/backtest` for any cron-
  driven anomalies. The backtest report is updated only on demand
  (re-run via `npm run backtest:run`); a stable status here means
  the on-disk seed data plus current taxonomy still produce 10/10.
- Spot-check 1–2 country pages per day. Any country with `published`
  v2 events should show populated dimensional rows.
- Watch for spikes in `pulse_events_v2.review_status = pending`.
  More than ~10 stuck pending events for 48+ hours indicates the
  classifier is producing too many severe-tier classifications and
  needs attention.

---

## Rollback procedures

The deployment is structured so that each piece can roll back
independently. Severity in increasing order:

### Tier 1 — Cosmetic / non-data issue (UI bug, broken link)

**Action:** Push a fix commit to `main`. Vercel re-deploys.
**ETA:** 5 minutes from problem identification.
**Data impact:** none.

### Tier 2 — v2 UI is wrong but pipeline is fine (bad layout, wrong CSS)

**Action:** Same as Tier 1. UI fixes are forward-only.
**ETA:** 15 minutes.
**Data impact:** none.

### Tier 3 — v2 classifier produces obviously-wrong classifications

**Action:**
1. Disable the v2 classify cron temporarily by removing its entry
   from `vercel.json` and pushing.
2. Investigate the bad classifications in `pulse_events_v2`.
3. If the bad rows must not affect public scoring, mark them
   `published = false` via SQL:
   ```sql
   UPDATE pulse_events_v2
   SET published = false, review_status = 'rejected',
       review_notes = 'Mass-rejected during T-level rollback YYYY-MM-DD'
   WHERE created_at >= '<incident_start>' AND ...;
   ```
4. Re-run `pulse:v2:score` to refresh dimensional deltas with the
   bad events excluded.

**ETA:** 30–60 minutes.
**Data impact:** classifier output paused. Existing published events
unchanged.

### Tier 4 — Full v2 cut-over revert (worst case)

**Action:**
1. Revert the `df7cd4e` commit (taxonomy v2.0).
2. Push the revert. Vercel re-deploys the previous code with v1
   taxonomy.
3. v2 tables in the database remain populated but are no longer
   read by the public site.

**ETA:** 15 minutes.
**Data impact:** v2 events stay in DB, no longer surfaced. Country
pages re-show v1 merged-scalar Pulse panel.

**Important constraints on rollback:**

- **Schema migrations cannot be reverted cleanly.** The v2 tables
  exist in production Neon. Rolling back the code does not drop
  them. This is intentional — the v2 data is preserved through any
  rollback. If the rollback is permanent, schedule a separate data
  cleanup task.
- **Cron schedule changes require a deploy.** Rolling back the cron
  schedule means rolling back `vercel.json`. The simplest revert
  scenario above handles this.
- **Cited Pulse values cannot be retracted.** If a researcher cites
  a dimensional delta from the public site between cut-over and a
  rollback, that citation persists on the web even if we revert.
  This is why the validation bar (10/10 backtest pass + reviewer
  approval) is set high before cut-over.

---

## Monitoring checklist (post-deploy)

### Within first hour

- [ ] Vercel build completed without errors
- [ ] All five smoke-test URLs return 200 + render expected content
- [ ] No 5xx errors in Vercel logs
- [ ] `civicaatlas.org` and `www.civicaatlas.org` both serve the new build

### Within first 24 hours

- [ ] First v2 cron run completed successfully (logs show ingest
      → cluster → classify → score sequence)
- [ ] No spike in HTTP 4xx errors (deprecation header on legacy
      endpoints sometimes triggers misconfigured client retries)
- [ ] No new entries in `pulse_events_v2` with
      `classifier_agreement = "none"` AND `published = true` (would
      indicate the auto-publish gating is broken)
- [ ] Admin review queue accessible from a different browser /
      machine (verifies cookie session works in production)

### Within first 7 days

- [ ] All 3 pending review-queue events triaged
- [ ] At least one new severe-tier event detected and queued (proves
      the live ingest is finding fresh events, not just running
      against backtest seed data)
- [ ] No HTTP traffic spikes from search engines indexing the new
      pages (mostly observability, not a fail condition)
- [ ] Sources-table `last_sync_at` advancing daily for all four
      working specialist feeds

### Within first quarter

- [ ] First quarterly CI v2 recompute fires (target: 2026-Q3 boundary,
      Sept 30, 2026)
- [ ] CI/Pulse double-counting prevention helper fires correctly
      (`scripts/calculate-ci-v2.ts` final pass; verify
      `pulse_decouple_log` rows produced)
- [ ] Audit `pulse_review_audit_log` for reviewer activity. If queue
      has >20 events untouched after 7 days, recruit second reviewer.
- [ ] First cut at the v2.1 evaluation: which categories actually
      fired in real classification? Compare against the 11 deferred
      candidates in `docs/future-proposals.md`.

---

## What's publicly visible after cut-over

Public users who visit `civicaatlas.org` after the cut-over see:

1. **Country pages** (`/countries/[slug]` and `/civica-index/[slug]`)
   show the new `<PulseDimensionalDeltas>` panel below the CI score.
   - 5 dimension rows (Democratic Quality, Rule of Law, Rights &
     Freedoms, Corruption Control, Stability)
   - Each row: dimension label · delta value · 0–2 driving event
     headlines
   - "See all events →" link to country-filtered changelog
   - "Last computed YYYY-MM-DD" footer
   - Beta pill on the panel header
2. **Closed-regime caveat** appears as an editorial-warning banner
   above the dimensional rows for any country with RSF Press Freedom
   score < 30 (currently 7 such countries: North Korea, Eritrea,
   China, Vietnam, Saudi Arabia, Cuba, Turkmenistan).
3. **Public Pulse changelog** at `/civica-index/pulse-changelog` —
   filterable global event feed. Currently 8 events (5 published, 3
   pending review). Will grow daily as the cron runs.
4. **Pulse methodology page** at `/civica-index/methodology/pulse` —
   full v2 methodology including taxonomy listing, disambiguation
   rules, decay model, asymmetric scoring, press-freedom rule.
5. **Backtest report** at `/civica-index/methodology/pulse/backtest` —
   10/10 pass standing visible to anyone.
6. **API endpoints** at `/api/v1/pulse/[slug]/dimensions`,
   `/api/v1/pulse/[slug]/events`, `/api/v1/pulse/changelog/v2`.
7. **Legacy v1 endpoints** at `/api/v1/pulse/[slug]` and
   `/api/v1/pulse/changelog` return data with deprecation headers
   (`Sunset: Thu, 31 Dec 2026`).

What goes away (legacy v1 surfaces no longer rendered):

- Merged-scalar Pulse pane on country pages (replaced by dimensional
  panel)
- v1 calculation cron continues to run for the deprecation window —
  still writes to legacy `pulse_daily_scores` and `pulse_changelog`
  tables, but those are no longer surfaced in the UI.

---

## Q&A — direct answers to the reviewer's checklist

> **Specialist feed integration: defer unless complete.**

Already deferred — Phase 5.9 (licensing audit + advisory board +
SSRN preprint) is not part of this cut-over. The Pulse will ship on
the four operational specialist feeds (HRW, Amnesty, CIVICUS, IPU)
plus GDELT news fallback. The closed-regime caveat surfaces
automatically on country pages where RSF score < 30. The dormant
specialist connectors are scaffolded with graceful no-op semantics
and will activate when their env vars are set in a future Phase 5.9
session.

> **Confirm the human review queue is operational. Walk me through
> the current state and who is set up to review.**

Operational. State:

- **Surface:** `/admin/pulse-review` (queue list) and
  `/admin/pulse-review/[id]` (decision form).
- **Auth:** cookie-based session set by submitting the operator
  name + `ADMIN_API_KEY` token at `/admin/sign-in`. HttpOnly,
  SameSite=Strict, 7-day TTL.
- **Currently set up reviewer:** Fernando (verified end-to-end in
  Phase 5.7 — approved the Thailand event 2026-04-29).
- **Current queue:** 3 events pending, all severe_neg with full
  classifier agreement. Quick decisions expected on each.
- **Audit trail:** every decision writes a row to
  `pulse_review_audit_log` with before/after JSON snapshots.
- **Multi-reviewer support:** infrastructure ready (the cookie
  carries the reviewer name; multiple operators can sign in
  simultaneously with different names; conflicts resolve last-
  write-wins with full audit). Recruitment of additional reviewers
  is a Phase 5.9 task.

**Pre-cut-over action required:** rotate `ADMIN_API_KEY` in Vercel
production env. The current local value
(`df43687da399968160ce863a14258a78aac8e17b8b4c77d746d503129c6c54b7`)
was generated on dev hardware and should not be re-used in
production. Generate a fresh `openssl rand -hex 32` and set it via
the Vercel dashboard before pushing.

> **Confirm the public Pulse changelog page is built. Every
> dimensional delta needs to link to the events that drove it.**

Built and live in code. Cut-over makes it publicly visible.

- **Page:** `/civica-index/pulse-changelog`
- **Filterable by:** country, dimension, severity tier,
  published-only vs. show-review-queue
- **Per-event detail:** every event card shows headline, country,
  date, dimension chip, severity chip, classifier agreement chip,
  source attribution dots, description excerpt, signed severity
  value, and corroboration confidence.
- **Country panel → changelog link:** `<PulseDimensionalDeltas>`
  has a "See all events →" header link to
  `/civica-index/pulse-changelog?country=[slug]`.
- **Per-driving-event link:** the driving event headlines on the
  country panel are NOT individually clickable. **This is a known
  gap relative to the spec's "every dimensional delta needs to
  link to the events that drove it" standard.** Two options:
  1. Ship as-is. The "See all events" link satisfies the
     transparency commitment (every event is in the changelog,
     filterable to that country). Users who want detail click
     through.
  2. Pre-cut-over enhancement (15 min): make each driving-event
     headline a link to `/civica-index/pulse-changelog?country=[slug]#evt-[id]`
     and add an `id={evt.id}` anchor on each card in the changelog.

  My recommendation: ship with option 1, add option 2 as a fast
  follow within 24h of cut-over. The transparency commitment is met
  either way; option 2 is purely a UX improvement.

> **Bring back a Phase 5.10 deployment plan with specific dates,
> rollback procedures, and monitoring checklist.**

This document. **Specific date is the one outstanding item that
requires reviewer input.** I cannot pick the deploy date — that
depends on when the reviewer is available to monitor in real time.

**Proposed window:** any 90-minute block in the next 7–14 days
during a weekday morning (UTC-5 / UTC+0 / UTC+1, depending on
reviewer availability). Avoid Friday afternoons (deploy then leave
for weekend = bad pattern). Avoid Monday mornings (Vercel
maintenance windows historically more frequent then).

Once the reviewer picks the window, I add it to the top of this
document and we proceed.

---

## Sign-off required

The reviewer signs off on this plan by:

1. Reading and approving the deploy sequence above
2. Picking a deploy window (date + time)
3. Rotating `ADMIN_API_KEY` in Vercel production env
4. Approving option 1 vs option 2 for the per-driving-event linking
   question
5. Confirming the rollback Tier definitions match their tolerance

**Do not push to `origin/main` until all five items are completed.**

After sign-off, the engineer:
1. Runs the pre-flight checklist (Section "Pre-flight checklist")
2. Pushes at the agreed time
3. Walks through the post-deploy smoke tests with reviewer present
4. Owns the monitoring checklist for 7 days

---

## Appendix — what changed since Phase 5.9 deferral

Phase 5.9 (institutional launch readiness — licensing, advisory
board, SSRN) is still deferred per the 2026-04-28 decision. Nothing
in this cut-over changes that. The Pulse Beta launches as a
non-commercial research preview using sources in their
attribution-required mode. Re-activate Phase 5.9 when the product is
preparing for commercial offering or academic citability ahead of
that.
