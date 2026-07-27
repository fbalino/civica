# QA-017 — Clean-checkout verification and Index control reconciliation

Date: 2026-07-18

## Scope

QA-017 ran the complete non-secret test suite from a fresh detached worktree
at `9fefc1abe2c36b32537223fd259b27f26a6400d5`, with a newly installed
dependency tree and no copied `.env.local`, build output, or cache directory.

The first run found stale test contracts and one governance control gap. The
test contracts counted current route and data-dictionary inventories, the
build-core integrity hash, the editorial banner selector, the retained Pulse
publication serialization, and the Pulse drift retention migration. Those
contracts are corrected by this QA remediation.

The governance gap was not suppressed: after the latest Index control entry,
the repository accumulated protected changes to Conditions input reads, Pulse
score lifecycle/model behavior, and public Index/Pulse contract and
methodology surfaces. Two restricted-input modules were also not classified.
The new append-only control record binds that exact current snapshot and
classifies both input modules. It does not claim a production deployment,
change published country scores, or close the separately production-gated
Conditions and Pulse checklist items.

## Affected controlled scope

- Input: Conditions component reads and immutable restricted analysis-input
  contracts.
- Model: the versioned Pulse score/event-lifecycle contract used by the
  Index-adjacent research surface.
- Presentation: public API shapes, reader pages, and methodology copy that
  disclose the current governed behavior.

## Verification

The append-only record declares the complete required validation set plus the
version-specific Index/Pulse cron-recovery suite. QA-017 was held open until
the clean-worktree test command was rerun successfully at the final commit.

## Final clean-checkout run

The final candidate was detached commit `6dc1ff20` on 2026-07-18. A new
worktree was created outside the repository; before installation it contained
only the tracked `.env.example` environment template and no `.env.local`,
`.next`, or `.turbo` directory. It used no copied dependency tree, build
output, private branch, or user worktree state.

1. `npm ci --ignore-scripts` installed the lockfile-defined dependency tree
   (652 packages). The package-manager audit reported 14 advisory findings;
   it did not alter the lockfile or source tree.
2. The complete production build passed with a non-secret unreachable fixture
   `DATABASE_URL`, preventing a live database connection:
   ```sh
   env -i PATH="$PATH" CI=1 NODE_ENV=production \
     npm_config_production=true npm_config_omit=dev \
     NPM_CONFIG_PRODUCTION=true NPM_CONFIG_OMIT=dev \
     DATABASE_URL='postgresql://fixture@127.0.0.1:1/civica_qa_fixture?connect_timeout=1' \
     npm run build
   ```
   Next.js compiled, type-checked, generated 50 static pages, and retained
   the edge constitution-search route. The clean-room verification emitted
   `credentialsUsed: []` and `networkRequests: 0`.
3. A separate fixture-only suite passed in the same isolated worktree:
   ```sh
   env -i PATH="$PATH" CI=1 NODE_ENV=test npm test
   ```
   It completed 1,910 tests: 1,907 passed, zero failed, and three skipped in
   34.1 seconds. The suite uses the legally shareable PGlite fixture rather
   than production credentials or a live database.

The build's `validate:release-quality-report` step reported the checked
historical release report's stored `unexpected_row_delta:1` status while
successfully validating that report's structure and integrity. This was not a
live release-quality run and is retained as an existing release-report state,
not represented as a green live data audit.

The command transcript and final limits are summarized in
`plan/evidence/QA-017/README.md`.
