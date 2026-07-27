# BRD-004 — objective brand keep/rename criteria

**Status:** Complete
**Date:** 2026-07-13
**Contract:** `brand-name-decision-criteria/v1`
**Semantic SHA-256:** `9818ed2579dd3f70a4555150b90431eb4ee9ca78f97588ff7fed26fa2800f875`

## What this proves

The adopted rubric compares the current name and any professionally screened
replacement under one evidence standard. Its nine criteria cover:

- trademark and confusion risk;
- domains, public handles, packages/repositories, and search identity;
- pronunciation, spelling, recall, and searchability;
- semantic and atlas-mission fit;
- geographic, linguistic, and cultural neutrality;
- distinctiveness and memorability;
- migration cost and continuity;
- evidence quality, unknowns, and limitations; and
- owner preference, capped at five percent and separated from evidence.

Weights total 100. Unacceptable professional legal/confusion findings and
incomplete evidence are vetoes. A rename without a current-name veto requires
an eligible cleared replacement to lead by at least eight weighted points
across at least three non-preference criteria. Personal dislike cannot clear a
veto, replace evidence, or decide the outcome alone.

The pure decision function contains only abstract fixture identifiers. The
checked policy explicitly records no score, recommendation, trademark finding,
domain/handle finding, or legal conclusion about Civica Atlas or any other
name.

## Files

- `src/lib/brand/decision-criteria.ts` — canonical contract, validator,
  semantic hash, policy renderer, and pure decision rule.
- `src/lib/brand/decision-criteria.test.ts` — eight focused tests, including
  seeded missing-criterion, missing-evidence, owner-dominance,
  personal-dislike, missing-registry/legal-review, and incomplete-clearance
  failures.
- `scripts/validate-brand-decision-criteria.ts` — direct CLI; no `package.json`
  integration required.
- `plan/research/brand-keep-rename-decision-criteria-v1.md` — exact rendered
  human-readable policy.

## Commands run

```text
$ node --import tsx --test src/lib/brand/decision-criteria.test.ts
tests 8; pass 8; fail 0

$ npx tsx scripts/validate-brand-decision-criteria.ts
PASS — brand-name-decision-criteria/v1: 9 criteria, weights=100,
preference<=5, conclusions=none,
9818ed2579dd3f70a4555150b90431eb4ee9ca78f97588ff7fed26fa2800f875.

$ npx eslint src/lib/brand/decision-criteria.ts \
  src/lib/brand/decision-criteria.test.ts \
  scripts/validate-brand-decision-criteria.ts
exit 0; no findings

$ node plan/tools/validate-master-plan.mjs
ok=true; master and area files remain synchronized

$ npx tsc --noEmit --pretty false
exit 0; no diagnostics
```

## Remaining boundaries

- BRD-001 still owns the neutral dated name/confusion landscape.
- BRD-002 still owns official registry searches and their limitations.
- BRD-003 still owns professional legal review and owner disposition.
- BRD-005 is conditional and may generate replacement candidates only if the
  evidence and professional review warrant it.
- The rubric does not reserve names, domains, handles, packages, or accounts.
- No public page, licensing text, design file, or `package.json` was changed.
