# EXP-001 — rendered-module ledger plan

**Status:** active implementation plan  
**Scope:** the P0 rendered-module audit only; it does not approve, replace, or
alter the separate QA-013 / EXP-025 visual-baseline workflow.

## Objective

Create a route-by-route ledger for every source-reachable reader, utility,
error, admin-review, API-documentation, embed, and shared-navigation module.
Every module/route association will carry one explicit disposition for desktop
and small-mobile in light and dark themes:

- `clean` — named browser evidence was inspected and no finding remains;
- `finding` — browser evidence identifies a concrete defect or contract gap;
- `not_observed` — no valid evidence exists yet; this is an open finding, not
  a neutral or passing state.

Routes that have no rendered reader module (for example JSON-only handlers)
will be retained in the discovery provenance but are not presented as visual
modules. This avoids pretending that an API response has a screenshot while
still making the boundary auditable.

## Implementation sequence

1. Derive the checked source set from Git-tracked App Router page, layout, and
   error-boundary sources. Walk static and dynamic imports only through local
   `src/app` and `src/components` render modules; preserve the route-to-module
   relation instead of flattening it into a component inventory.
2. Generate a checked `rendered-module-ledger/v1` artifact with source paths,
   route, module role, four viewport/theme dispositions, browser-evidence
   location, and an explicit finding identifier where evidence is absent.
   The generator must fail when a discovered source module is omitted or a
   disposition has no required evidence/finding metadata.
3. Seed existing *approved* task evidence only where it names an exact route,
   viewport, theme, and module/surface. Unapproved QA-013 / EXP-025 candidate
   baselines may be recorded as candidate context but never as `clean` proof.
4. Run targeted browser captures against an isolated local server. Record
   route, viewport, theme, keyboard/result state, console/request outcome, and
   named screenshot location. Triage each module as clean/finding rather than
   silently treating a successful page load as visual approval.
5. Keep every unobserved module visible as an open ledger finding. Complete
   EXP-001 only after the ledger covers the discovered source graph and its
   evidence policy, then leave its concrete defects to the owning follow-up
   tasks; EXP-028 remains the final blind visual audit and requires zero open
   P0/P1 confirmed findings before G4.

## Boundaries

- Do not modify the user-owned type-lab/typography work currently present in
  the working tree.
- Do not promote a screenshot baseline without the explicit QA-013 approval
  command and reviewer identity.
- Do not capture credentials, private admin/reviewer content, production data,
  or external-source payloads in checked evidence.
- The ledger is a discovery and evidence contract, not a visual-design change;
  it must not introduce page-local styling or change the reader UI.
