# ATL-020 — Atlas entity change and correction history plan

**Status:** implementation complete; authorized live migration gate pending
**Task:** release-to-release change and correction histories for primary Atlas
entities.

## Current evidence and gap

`research_evidence_history` is an append-only, pre-mutation retention ledger.
It records `entity_table`, `entity_id`, operation, complete `before`/`after`
snapshots, reason, actor, and time. It protects the principal Atlas relations,
and ATL-019 citation resolvers expose a narrow revision count/last-reason
summary for selected entity types.

That is not yet an ATL-020 reader contract. The retained snapshot is not a
public field allowlist, does not name the Civica release containing the change,
does not classify a correction versus a routine source refresh, and does not
offer a reader an old/new source or vintage comparison. A raw history row must
never be published because some protected relations and snapshots can contain
operational or personal fields.

## Target contract

Create `civica-atlas-change-history/v1` for the eight existing stable citation
entity types: fact, institution, office, person, election,
constitution-passage, organization, and indicator.

Each public event must contain only:

- stable entity type and persistent entity ID;
- previous/current public value fields, including an explicit absence marker;
- previous/current source and upstream vintage where the entity supports them;
- reason, method/version, Civica release ID, recorded time, and operation;
- a closed `change_kind`: `routine_refresh`, `substantive_revision`,
  `correction`, `retraction`, or `methodology_change`;
- correction-log reference/status only when one exists and is public; and
- a disclosure when a retained historical row predates this public contract or
  lacks a release mapping.

No actor identifier, internal note, submitter contact detail, raw publisher
payload, or unrestricted JSON snapshot may enter the public API or reader UI.

## Classification policy

The writer, not the diff projector, supplies `change_kind`. The projector must
never infer editorial intent from a changed value.

| Kind | Required evidence |
|---|---|
| `routine_refresh` | A new upstream publication, retrieval, source, or vintage processed under the same public method. Values may change because the publisher refreshed them. |
| `substantive_revision` | An intentional Atlas content or canonical-selection revision that is not merely a new publisher vintage. The reason must name the revision basis. |
| `correction` | A retained `correction_log` row plus its current status. The event fixes an error in a prior Civica release. |
| `retraction` | A retained `correction_log` row plus its current status. The event withdraws a previously published value or record. |
| `methodology_change` | A named method/version change that alters how the public record is derived or selected. |

`correction` and `retraction` fail closed without a correction-log reference.
All other kinds reject a correction-log reference. Every writer must supply a
non-empty reason, a method/version, and a named Atlas release ID matching
`[A-Za-z0-9._-]{1,96}`. A deployment ID or synthesized timestamp is not a data
release.

## Writer adoption ledger

The public relation and helper are not sufficient by themselves. ATL-020 stays
open until each primary entity writer appends through an atomic data-and-history
path.

| Entity | Canonical writer status |
|---|---|
| fact | Implemented: frozen CIA seed, all recurring reconciliation/classification syncs, and editorial dispute demotion use serialized atomic history writes; the recurring WTO legacy mutation was retired |
| institution | Implemented: officeholder, CIA cabinet, IPU Parline, and Wikidata legislature writers preserve the selected UUID and append bounded history atomically |
| office | Implemented: officeholder and CIA cabinet writers use the stable-ID-aware atomic office boundary; ambiguous CIA title renames fail closed |
| person | Implemented: officeholder, CIA cabinet, portrait/birthdate, and QID-backfill mutations use the atomic person boundary; QID-less mutation requires an explicit stable UUID |
| election | Implemented: confirmed IPU/Wikidata contests, IDEA turnout, and estimated insert/update/delete paths append history atomically; non-QID contests bind to the publisher contest URL |
| constitution-passage | Implemented: one serialized statement supersedes old digest IDs, inserts/reactivates current IDs, and appends linked bounded events |
| organization | Implemented in the existing release transaction |
| indicator | Implemented for `writeCountryMetrics`: one PostgreSQL CTE upserts the observation and appends the bounded event atomically; apply runs fail closed without `CIVICA_ATLAS_RELEASE_ID` or `--release-id` |

## Reader design register

- **Layout row:** existing multi-pane country reference surface; the history
  disclosure lives inside the existing source-evidence panel.
- **Hero treatment:** none. History is supporting provenance, not a competing
  page-level destination.
- **Component register:** existing `FactValuePanel`, canonical `Chip`,
  `DataTable`, and `Button`, plus the shared
  `AtlasChangeHistoryDisclosure`. Styling lives in `editorial.css` and uses
  design-system tokens.
- **States:** loading, recorded history, no recorded public history, pagination,
  public correction status, and temporarily unavailable. The unavailable state
  preserves the current value/source rather than implying no history.

## Delivery sequence

1. Add an additive public-history relation plus forward migration. Writers
   append a history event in the same transaction as an eligible Atlas change;
   the existing retention trigger remains immutable source evidence and is not
   repurposed as a public log.
2. Define per-entity public field registries and pure snapshot-diff functions.
   Tests prove sensitive/unknown keys are excluded, source and vintage changes
   are explicit, and the classification cannot silently call a refresh a
   correction.
3. Add a paginated, rate-limited entity history API and bind it to the existing
   stable citation IDs. It must return an honest unavailable/no-history state
   instead of manufacturing historical releases.
4. Add a shared reader history disclosure/module to the country and entity
   surfaces using canonical editorial primitives. It renders old/new values,
   source/vintage, reason, method/release, and correction state; it distinguishes
   ordinary refreshes from substantive revisions.
5. Add fixture-backed DB/API/browser journeys across an ordinary refresh, a
   correction linked to a public correction log, a withheld/non-public detail,
   pagination, no history, and data-unavailable states. Record the migration
   plan and browser evidence under `plan/evidence/ATL-020/`.

## Current implementation checkpoint — 2026-07-23

- Strict public DTO, stable citation binding, explicit coverage state,
  public-only correction join, pagination, rate limiting, and forward migration
  are implemented.
- Writer classification validation and the first atomic production writer
  adoption (`indicator`) are implemented.
- The public field registry now matches the real backing schemas and accepts
  either database snake_case rows or Drizzle camelCase rows through one bounded
  snapshot projector. Retrieval timestamps are intentionally excluded from
  release diffs so an otherwise identical retry does not manufacture a public
  change event.
- The shared country-fact CTE serializes the natural key, captures the prior
  stable UUID, preserves reviewer-demoted status by default, upserts the source
  row, and appends the bounded event in one PostgreSQL statement. The frozen
  CIA seed is the first fact writer routed through it and fails closed without
  a named Atlas release.
- The reusable reader module is mounted on canonical Factbook observations.
  A local browser journey verified the temporarily-unavailable state without
  applying migration `0046` to the connected database. This is implementation
  evidence only, not the final ATL-020 browser gate.
- Every recurring primary-entity mutation now routes through one of six
  registered atomic history boundaries. `npm run
  validate:atlas-change-history-writers` scans the repository and fails on a
  new direct write outside those boundaries; eleven named historical
  repair/seed tools remain explicit non-recurring exceptions.
- Fixture-backed Chromium journeys cover routine refresh, public and withheld
  correction detail, pagination, no recorded history, and unavailable history
  while preserving the current observation. Evidence is recorded under
  `plan/evidence/ATL-020/`.
- The zero-write live migration plan passed with four additive statements and
  no destructive statements. Remaining work is the authorized apply/live
  verification sequence. Migration `0046` has not been applied by this
  implementation pass.

## Non-goals and constraints

- This does not turn the public corrections intake into a general Atlas
  correction endpoint; that is ATL-024 and will consume the history contract.
- No existing event is retroactively assigned a release or correction status
  without evidence. Legacy retained rows may remain visible only as
  `release_not_recorded` with the bounded snapshot fields.
- Apply the forward migration only after `npm run db:plan -- --id=<id> --live`
  and the project's migration/release gates. No direct production writes.
