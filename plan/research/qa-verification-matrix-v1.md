# QA-001 verification matrix v1

**Status:** implemented coverage registry
**Machine-readable artifact:** `data/verification-matrix.v1.json`
**Schema:** `civica-verification-matrix/v1`
**Semantic hash:** `38cca5eff1cb66e58ac573c82abcd59f716102188dbb0fdaa4f0360ac8e214de`

## Purpose

This is the canonical test and verification matrix for all production routes,
production pipelines, published research-calculation families, Atlas data
domains, and declared failure states. It records the responsible product area,
fixture, command, and current status for unit, integration, database, browser,
and manual verification. It is a coverage map, not a claim that every planned
test already exists.

The checked artifact currently registers 261 critical surfaces:

- 173 Git-tracked Next.js page, route-handler, and error-boundary sources discovered under `src/app`.
- 50 scheduled or manual production adapters from `production-adapter-registry`.
- 8 published calculation families from the QA-007 golden-test registry.
- 14 Atlas source-coverage domains.
- 16 Atlas, pipeline, and request failure states.

## Status meanings

- `covered`: an existing named test or validator is the evidence.
- `partial`: some coverage exists, while the linked gap task must close the rest.
- `planned`: the named gap task owns the required missing coverage.
- `not_applicable`: that verification layer cannot sensibly apply to the surface.

Every `partial` or `planned` cell must name an active checklist task. The
validator rejects an unknown task, a blank owner/fixture/command, a route or
pipeline that is missing from the artifact, a stale artifact, and a stale
semantic hash in this summary. New production pages, handlers, adapters,
published calculation families, domains, or registered failure states therefore
cannot silently fall outside the matrix.

## Operating procedure

When changing a registered production surface, update its canonical source
registry first, stage the route source, then regenerate and validate the matrix:

```sh
npm run generate:verification-matrix
npm run validate:verification-matrix
```

The validation command is in `build:core`. A newly introduced gap belongs in a
stable master-checklist task before the matrix may point to it. Closing a gap
means updating the actual test/fixture, the matrix status, and the owning task's
evidence—not simply relabeling the cell.
