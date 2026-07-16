# PLT-014 — cache, revalidation, and release consistency

PLT-014 closes the freshness boundary for Civica's routes, database readers,
reader pages, exports, and the three research-publication families. Mutable
database data is request-live and cannot be served from a stale shared cache.
Only checked build artifacts and version-addressed frozen releases may be
shared-cacheable.

## Acceptance mapping

- **Every route declares freshness and invalidation.** The closed
  `civica-cache-consistency/v1` registry covers every repository-owned route
  method. Public mutable responses are `no-store`; authenticated or sensitive
  responses are `private, no-store`; checked build artifacts use
  `must-revalidate`; immutable release downloads use a versioned URL and a
  one-year immutable policy. A new route method without a policy fails the
  validator.
- **Every query and page has a safe runtime boundary.** Exported async
  functions in `src/lib/db/queries*.ts` are discovered automatically and may
  not use persistent Next caches. A cross-file import graph finds every page
  that can reach Neon; the effective page/layout contract must resolve to
  `revalidate = 0`. React's render-pass-only request deduplication remains
  allowed.
- **Every export has an explicit version model.** Live country, indicator,
  election, and private Pulse-coding exports are request-live. The Atlas bulk
  release is rebuilt only from its frozen vintage plus the checked compressed
  regeneration sidecar and is served from immutable versioned routes.
- **Atlas cannot borrow current rows.** Q1 remains an explicitly labeled
  canonical-only legacy release and Q2 remains the complete candidate set. An
  exact live rebuild must match the checked payload, manifest, semantic hash,
  source-rights set, and regeneration-input sidecar byte for byte.
- **Index publication is closed and atomic.** R3, R4, and R5 have exact
  release headers, methodology-content hashes, weights, uncertainty policies,
  source-artifact lineage, derivation envelopes and keys, supersession rules,
  row completeness, and semantic/storage hashes. Publication is an explicit
  stage → reproduce/check → atomic pointer operation; count-only or inferred
  publication is impossible. Public endpoints read one pointer-selected
  release and distinguish frozen score data from live jurisdiction/context
  components.
- **The frozen input manifest remains byte-bound.** Its regenerated
  code-derived adapter hash is recorded in the raw-retention manifest and in
  all three staged Index release headers. The publisher-byte hashes, scores,
  ranks, and semantic row sets are unchanged; a manifest-byte mismatch now
  fails the release gate rather than being silently tolerated.
- **Pulse publication is closed and honest.** One pointer selects one completed
  score run and its immutable five-dimension history panels. Deltas and
  contributing identifiers are frozen. Every dimension exposes its frozen
  derivation envelope as either current-versioned or explicit legacy-input
  lineage; the retained r2.15 publication reports 312 current rows and 13
  legacy-input rows across 13 countries instead of inventing missing versions.
  Article headline/date/severity/confidence and derived qualifiers are
  explicitly labeled live evidence context; linkage fails closed if event
  identity, jurisdiction, dimension, or source basket no longer matches the
  frozen panel.
- **Failure cannot look fresh.** Release inconsistencies return stable
  `RELEASE_INCONSISTENT` failures with noncacheable responses. Reconciliation
  cache replacement commits the refreshed rows and source-freshness stamp
  together; refresh failures retain no falsely advanced freshness marker.
  Shared public profiles never permit `stale-if-error` or
  `stale-while-revalidate`.
- **Adversarial fixtures are durable.** Tests cover incomplete/ambiguous
  releases, wrong methodology or source versions, derivation drift, bounds and
  uncertainty mismatch, pointer mutation/deletion, partial Pulse panels,
  a superseded Pulse pointer followed by a rejected late history insert,
  mutable evidence-link drift, stale cache fallback, empty/failed refreshes,
  unregistered route/query/export/page surfaces, and Atlas current-table
  contamination.

## Deployment boundary

Migration `0036_moaning_toad_men.sql` is generated, hash-pinned, and exercised
through the complete local PostgreSQL migration chain. It stages Index release
headers but deliberately does not publish or move the production pointer.
Production plan/apply/publish/deploy rehearsal and rollback ordering remain the
separate PLT-019 responsibility. See `migration-plan.md`.

## Scope preservation

The owner-controlled Uruguay, Ghana, and Japan color-photo trials and the local
typography tester are preserved exactly as found. They are not inputs to the
route inventory, cache registry, release evidence, stage, or commit. The exact
working-copy hash of the photo trial's shared header edit is mapped to its
checked Index baseline so unrelated Index change control cannot absorb it; any
other byte still fails closed.

## Evidence index

- `source-review.md` — current official framework/database material consulted
- `index-change-control.md` and `index-change-control-metadata.json` — protected
  Index input/transform/model/presentation record
- `release-note.md` — reader/API compatibility statement
- `migration-plan.md` — safe staged rollout and forward-fix boundary
- `verification.json` — machine-readable final command and result ledger
- `browser-check.json` — Chromium reader-journey smoke on the isolated local
  Civica server

The v34 and v35 evidence-only control records preserve verification provenance;
they do not alter the PLT-014 release boundary, migration, or published data.
