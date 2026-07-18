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
version-specific Index/Pulse cron-recovery suite. QA-017 remains open until
the clean worktree test command is rerun successfully at the final commit.
