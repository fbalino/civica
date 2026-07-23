# ATL-020 — Atlas entity change and correction history plan

**Status:** implementation plan  
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

## Non-goals and constraints

- This does not turn the public corrections intake into a general Atlas
  correction endpoint; that is ATL-024 and will consume the history contract.
- No existing event is retroactively assigned a release or correction status
  without evidence. Legacy retained rows may remain visible only as
  `release_not_recorded` with the bounded snapshot fields.
- Apply the forward migration only after `npm run db:plan -- --id=<id> --live`
  and the project's migration/release gates. No direct production writes.
