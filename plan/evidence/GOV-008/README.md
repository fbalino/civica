# GOV-008 — Reviewer roles and selection criteria

Completed 2026-07-11.

## Outcome

`civica-reviewer-selection/v1` adopts a names-free pre-contact policy for five separate lanes:

- governance measurement and comparative indices;
- political event data;
- research-data curation and open science;
- accessibility;
- legal and source rights.

Each lane has a versioned packet/scope, bounded question, minimum expertise, acceptable public evidence, independence and conflict rules, geographic/method diversity requirements, deliverable, and exclusions. The first three are the core scholarly lanes for GOV-009's eight-candidate minimum. Accessibility requires knowledgeable human/WCAG-EM evaluation plus direct assistive-technology or disability-user perspective. Legal scholarship can identify issues, while release clearance requires counsel professionally qualified for the applicable jurisdiction.

The contract uses three conflict outcomes: manage and disclose, recuse from the overlapping judgment, or exclude. Source-project affiliation is not an automatic exclusion, but nobody can be the sole judge of their own source, method, or institutional product. Current Civica authorship/decision authority, contingent payment, unmanageable conflicts, refusal to disclose, prestige-only selection, and missing task competence exclude a candidate.

The policy draws on current public guidance from COPE, W3C WAI, CoreTrustSeal, Creative Commons, and the ABA competence rule. Sources were checked on 2026-07-11. Claude's draft longlist informed the initial design, but no named candidate appears in the adopted criteria contract.

## Verification

- `npm run validate:reviewer-selection-criteria`
- `npx eslint src/lib/research/reviewer-selection.ts src/lib/research/reviewer-selection.test.ts scripts/generate-reviewer-selection-criteria.ts scripts/validate-reviewer-selection-criteria.ts`
- `npx tsc --noEmit`
- `node plan/tools/validate-master-plan.mjs`
- `npm run build`

Semantic hash: `7dc0df47ce2d0bdd28888edcecd2173e9e19fb7672b48f369ffd5ea020e6f663`.

No candidate was contacted, no availability was inferred, and no private contact data was collected.
