# CLM-006 — Self-verifying public coverage counts

Status: complete on 2026-07-10.

## Outcome

Public claims about Civica's current coverage no longer depend on convenient
hardcoded numbers. A current count now comes from runtime/database state and
has a nonnumeric outage fallback; a historical count must visibly identify its
release or date. API samples and endpoint limits identify themselves as
illustrative or bounded rather than looking like measured coverage.

The Index remains active. Its replication page reports the 190 jurisdictions
that actually have a score in the latest Beta quarter, while the home page
separately reports the full 253-row country-and-territory catalog. The rankings
page reports its own returned row count and calls the rows jurisdictions rather
than incorrectly declaring all of them sovereign states.

## Implementation evidence

- `src/lib/claims/public-numeric-claims.ts` discovers mutable count/coverage
  copy in public markdown, MDX, app routes, and components; its explicit
  registry binds every candidate to runtime, frozen, or narrowly exempt
  evidence.
- `scripts/validate-public-numeric-claims.ts` scans the public source set and is
  exposed as `npm run validate:numeric-claims`. The production build runs it.
- `src/lib/claims/public-numeric-claims.test.ts` proves that an undated `250+`
  claim fails; JSX expressions retain count-noun word boundaries; a dynamic
  value cannot disguise a stale literal; neighboring dates and unrelated limits
  cannot bless another claim; illustrative API payloads remain explicit; and
  orphaned registry rows fail.
- `src/lib/content/readme-outage.test.ts` runs the README generator in explicit
  offline mode and proves its source/fact totals become nonnumeric rather than
  silently reverting to old live values.
- About, Countries, Constitutions, and Elections now distinguish a data outage
  from a genuine zero-row result. The constitution query has a tested
  `throwOnError` path so its landing page can preserve that distinction.
- `getSiteStats()` now distinguishes the 197 ISO3 identity rows from the 190
  jurisdictions with a current Civica Index Beta score.
- README counters are generated from `README.template.md`; stale catalog,
  score-coverage, source, fact, and fact-key literals were removed.
- The reconciliation methodology separates today's live database totals from
  its visibly frozen v0.2-beta / 2026-Q1 examples. The 1,716-row and 1,396-pair
  correction facts are tied to 4 May 2026; the 31/33 dispute snapshot is tied
  to its 5 May cut.
- Public API, rankings, conditions, about, not-found, replication, home, and
  affected blog copy were reconciled with current scope and routes. The API
  page describes only the present interface, without prelaunch migration
  theater.
- `AGENTS.md` records the permanent authoring rule and APR-D021 records the
  epistemic decision.

## Automated verification

- `npm test`: 65 tests passed.
- `npm run validate:numeric-claims`: 237 public source files scanned, 60
  mutable coverage/count candidates, 52 explicit registry rows, zero errors.
- `npm run validate:content-templates`: seven rendered reader files clean;
  every `stats.*` marker has a quoted fallback even when the database is live.
- `npm run validate:public-claims`: 27 claims, 14/14 required surfaces, 33
  markers, zero authority/grade/headline-claim errors.
- `npx tsx scripts/validate-site-stats.ts`: 18 invariants passed against the
  live database (253 catalog rows, 197 ISO3 identities, 190 current Beta
  scores, 20 active sources, 25,827 facts, and 88 fact keys).
- `npm run validate:design-tokens`: no new drift; the existing 412 legacy
  violations remain baselined.
- `npm run validate:sync-freshness`: 592 files clean.
- `npx tsc --noEmit`: passed.
- Targeted ESLint over every modified TypeScript/TSX/JavaScript file: passed.
- `npm run build`: production build passed with 84 pages. It retains the known
  broad Turbopack trace warning from `MarkdownContent`/`next.config.ts`.
- `git diff --check`: passed.

## Browser matrix

The rebuilt production app was audited at 1280×720 and 390×844. Home,
rankings, API docs, Conditions, reconciliation methodology, Index replication,
and the repaired Factbook-replacement article had no horizontal overflow and
no visible `250+`, `195 countries`, `190+`, `Live rows`, or stale-vintage copy.
The subsequent independent source audit removed the remaining API deprecation
sections and added count-free outage states to About, Countries, Constitutions,
and Elections; those changes introduced no layout styling and the final
production build passed.

Verified rendered distinctions include:

- Home: `253` / “Countries & territories”.
- Rankings: `251 jurisdictions`, derived from the current returned matrix.
- Replication: `190 jurisdictions with a current Beta score`.
- Reconciliation: `25,827` rows, `88` fact keys, and `20` active sources in the
  current live paragraph; worked examples are visibly frozen to v0.2-beta,
  vintage 2026-Q1.

The in-app production browser logged two minified React hydration warnings on
home navigations. The rendered copy/layout stayed correct, and the CLM-006 diff
does not change client hydration logic; this is preserved as pre-existing QA
evidence for the canonical browser-harness task (QA-009), not hidden as a clean
console result.

Evidence captures:

- `home-desktop.png`
- `home-mobile.png`
- `rankings-desktop.png`
- `rankings-mobile.png`
- `api-docs-desktop.png`
- `replication-desktop.png`
- `reconciliation-live-desktop.png`
