# EXP-002 — live UI pattern → canonical design-system map

Completed 2026-07-12. Every live UI pattern family maps to a canonical
design-system token, primitive, composition, class, or approved exception, in a
machine-checkable artifact — not just DESIGN.md prose.

## Deliverable
- `src/lib/design/ui-pattern-map.ts` — the typed `UI_PATTERN_MAP`: 14 families,
  38 patterns, each bound to a real token / primitive file / composition /
  editorial class, or flagged as an approved exception with an owning task.
- `validateUiPatternMap()` — pure validator (fs injectable) that fails closed
  when the map: drops or duplicates a required family, references a token not
  defined in the token sources, names a primitive file that does not exist,
  names a class not declared in any stylesheet, leaves a pattern with no
  binding, or leaves an unmatched/approved-exception pattern without a
  follow-up task id.
- `scripts/validate-ui-pattern-map.ts` + `npm run validate:ui-pattern-map`.

## How the Done-when is met
- **Covers all fourteen families** — typography, spacing, colors, elevation,
  forms, tabs, tables, charts, maps, disclosures, data states, navigation,
  overlays, editorial layouts. The validator asserts each appears exactly once.
- **Each pattern binds to a real canonical anchor** — verified live: every
  referenced token (`--font-heading`, `--radius-search`, `--z-modal`,
  `--map-label-fg`, …) is defined in `globals.css`/`atlas.css`; every primitive
  (`PageHero`, `Button`, `DataValueState`, `SourceDot`, `FactbookLegislatureChart`,
  `AtlasWorldMap`, `SingleSelectMenu`, `ReaderSidebar`, …) exists; every class
  (`editorial-page`, `methodology-layout`, `explore-menu`, `editorial-chip`, …)
  is declared in a stylesheet.
- **Unmatched patterns become explicit design-system tasks** — 0 patterns are
  unmatched; the 2 approved exceptions each name their owning task (legacy
  numeric text-alpha tokens → EXP-003; `--shadow-hard*` rename → owner-gated).
  Legacy raw-value cleanup (EXP-003), page-local styling (EXP-004), data-state
  standardization (ATL-018), and reduced-motion (EXP-022) are referenced as the
  owning follow-ups rather than re-invented.

This artifact is the canonical reference the EXP-028 blind visual audit checks
live surfaces against.

## Verification
- `ui-pattern-map.test.ts` — 10 tests: the real map validates clean, covers
  exactly the 14 families, every non-unmatched pattern has a binding, every
  unmatched names a follow-up; plus 6 seeded negative controls (missing family,
  phantom token, phantom primitive, phantom class, exception-without-followup,
  binding-less pattern) each fail as required.
- `npm run validate:ui-pattern-map` → 14/14 families, 38 patterns, OK.
- Full suite 1063/1063; `tsc --noEmit` clean.

## Note
EXP-002 is the pattern inventory; EXP-001 (route-by-route rendered-module
ledger with screenshots) remains its companion and is still open.
