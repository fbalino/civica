# CLM-007 evidence — Pulse runtime and public-method reconciliation

**Task:** Reconcile Pulse public documentation with the actual production cadence, active source set, classifier ensemble, review behavior, and scoring status.

**Result:** Pass. The checked runtime contract, current code, public pages, APIs, README/AGENTS guidance, and live observed feed set agree. Pulse remains an experimental event ledger with public experimental per-dimension deltas and no public scalar Pulse score or ranking.

## Canonical runtime contract

- Method version: `pulse-v2.1-beta`
- Taxonomy: `v2.0`
- Contract hash: `967f7f5397952524e207a762cf2ccdc2976ee2c36d3c186beae075361bb9236f`
- Generated snapshot: `src/lib/pulse/v2/runtime-method.generated.json`
- Public endpoint: `/api/v1/pulse/methodology`
- Status: `experimental`; numeric deltas: `public_experimental`; scalar: `none`
- Scheduled UTC stages: ingest 08:00, cluster 08:20, classify/verify/subject attribution 08:40, corroborate/score 09:00
- Default classifier voters: DeepSeek `deepseek-v4-flash`, GLM `glm-4.7`, Anthropic `claude-haiku-4-5`
- Verifier: Anthropic `claude-haiku-4-5`; subject attribution: Anthropic `claude-sonnet-4-6`
- Production-observed source IDs through 2026-07-09: `amnesty`, `civicus_monitor`, `gdelt`, `hrw`

`npm run validate:pulse-runtime` compares this snapshot with executable provider defaults, taxonomy/scoring constants, cron routes, connector status, API/public surfaces, review gates, no-event semantics, and scalar-removal invariants. `--live` additionally checks the observed feed set and evidence date against Neon.

## Live read-only audit (2026-07-10)

- 376 classified Pulse v2 rows: 205 published, 170 queued, 1 rejected.
- 25 unresolved `category="none"` rows; public API output nulls dimension, severity tier, and severity value for all 25.
- 0 published rows fail the taxonomy/dimension/tier/value validator.
- Latest event date: 2026-07-08.
- Latest dimensional recomputation: 2026-07-09 09:00:29 UTC.
- 315 clustered records remain without a persisted classification outcome.

No ingestion, classification, scoring, review, or database write was performed for this evidence pass.

## Behavior delivered

- Removed public scalar CP from country headers, rankings, country API, embeds, and public documentation; `sort=cp` now returns HTTP 400 with an explicit dimensional-only explanation.
- Replaced no-event zero/flat output with nullable dimension rows and an explicit “not evidence that governance was stable” state.
- Added Pulse-specific API metadata and generated API documentation, including the runtime-method endpoint.
- Exposed publication origin without calling automatic publication human approval; queued/rejected rows do not score.
- Normalized deadlock/invalid categories to unresolved public output; reviewers cannot approve `category="none"` as-is.
- Hardened classifier and verifier parsing so malformed numeric fields, missing axes, revised/rejected verdicts, and negative verifier axes cannot bypass the documented review gate.
- Restricted scoring and country evidence to valid published approved/edited classifications in the actual 365-day window, including a future-date upper bound.
- Recomputes existing delta jurisdictions so aged-out rows clear rather than persisting stale values.
- Replaced overclaims about independent models/sources, complete press-freedom context, durable absorption, and the old historical backtest with exact limitations.

## Verification

- `npm test` — 94/94 tests passed.
- `npx tsc --noEmit` — passed.
- `npm run validate:content-templates` — 7 migrated files clean; 0 unresolved references/fallbacks.
- `npm run validate:pulse-runtime` — 544 checks passed.
- `npm run validate:pulse-runtime:live` — 546 checks passed against Neon.
- `npm run validate:public-claims` — 28 claims; 14/14 required surfaces; 0 unregistered headline claims.
- `npm run validate:numeric-claims` — passed across 238 public source files.
- `npm run validate:design-tokens` — no new drift; 412 legacy baseline findings remain.
- `npm run validate:sync-freshness` — 0 offending writes.
- Targeted ESLint across every changed/new TS/TSX file — 0 errors; 3 pre-existing warnings (`<img>` in `FactbookHeaderStrip`, unused `_id` in `queries.ts`).
- `npm run build` — passed; 85/85 static pages generated. Known broad NFT trace warning remains in `next.config.ts` → `MarkdownContent.tsx`.
- `git diff --check` — passed.

## API verification

- Runtime endpoint returned the version/hash/status/feed set above.
- Brazil dimensions returned all five named dimensions, six eligible events, provisional press context, and no scalar field.
- Brazil events exposed explicit `publicationOrigin` values.
- All 25 unresolved changelog rows returned `dimension=null`, `severityTier=null`, and `severityValue=null`.
- `/api/v1/index/rankings?sort=cp` returned HTTP 400.
- Country API contained no `civicaPulse`; Brazil embed contained no CP/pulse-score field.

## Independent review

The subscription-authenticated `SN5 CLM-007 final review` used `claude-sonnet-5` as the primary reviewer and made no repository edits. It found no CLM-007 acceptance blocker. See [review result](sonnet-final-review.json) and [bounded prompt](sonnet-final-review-prompt.md).

## Browser evidence

See [browser-checks.md](browser-checks.md). Final evidence covers desktop methodology/API/changelog/backtest, mobile populated and empty country states, keyboard focus, reduced motion, horizontal overflow, and console errors.

## Explicit nonblocking follow-ups

CLM-007 documents these limitations rather than claiming to solve them:

- `PUL-004`: immutable row-level method/provider/source-basket versioning for the mixed legacy ledger.
- `PUL-006`–`PUL-008`: clustering after attribution, source-family/republication independence, and operational feed observability.
- `PUL-010`, `PUL-037`, `PUL-038`: complete/versioned press context and durable, auditable structural-overlap handling.
- `PUL-014`–`PUL-026`: representative human-labelled evaluation, calibration, subgroup analysis, method-matched retrospective testing, and prospective shadow validation.
- `PUL-027`: align long half-lives with the 365-day inclusion window.
- `PUL-032`: persist terminal/retry state so majority-`none` clusters do not consume repeated model calls and backlog ordering is observable.
- `PUL-033`: review-queue service levels and completeness signaling.
- `PUL-036`: derive every stored agreement/publication decision from independently stored versioned runs.

The archived ten-case backtest remains a regression diagnostic for an earlier architecture and is not evidence that the current ensemble is accurate.
