# GOV-001 — research and publication governance charter

Completed 2026-07-11.

## Outcome

`civica-research-publication-governance/v1` names Fernando Balino as Civica Atlas's current accountable human. It assigns all ten required decision domains directly to him:

- data;
- methodology;
- editorial copy;
- corrections;
- releases;
- security;
- source rights;
- reviewer independence;
- conflicts; and
- emergency action.

Every domain records the decision right, required evidence, and blocking condition. The charter discloses that a one-person project has no internal separation of duties. It prohibits anonymous-group responsibility and gives agents and models no authorship, approval, publication, spending, conflict-waiver, reviewer-contact, risk-acceptance, or restoration authority. Independent reviewers retain their conclusions and original reports. Unmanageable owner conflicts block the affected claim until a qualified independent decision-maker is named.

## Artifacts

- `plan/research/research-publication-governance-charter-v1.md`
- `data/research/publication-governance-charter-v1.json`
- `src/lib/research/publication-governance.ts`
- `src/lib/research/publication-governance.test.ts`
- `scripts/generate-publication-governance.ts`
- `scripts/validate-publication-governance.ts`

## Verification

- `npm run validate:publication-governance`
- `npx tsc --noEmit`
- `node plan/tools/validate-master-plan.mjs`
- `npm run build`

The charter is an operative internal policy. GOV-002 through GOV-005 own its public authorship, disclosure, AI-use, correction, retraction, and version-policy surfaces.
