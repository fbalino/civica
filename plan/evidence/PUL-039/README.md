# PUL-039 evidence

## Outcome

`pulse-independent-coder-recruitment/v1` prepares a contact-free recruitment package for four independent coders, two separately assigned adjudicators, and one status-only administrator. It defines qualification paths, language scope, blindness, conflicts and recusals, paid training, held-out qualification, a paid timing pilot, sourcing pools, draft public-call copy, owner approval, and lead time. No individual was identified or contacted.

The executable workload reads all three frames from `pulse-evaluation-sampling-frame/v1`: 384 retained event candidates, 536 system-negative initial units, and 536 country-days. That is 1,456 initial units, 1,348 valid targets, and 2,912 blind coder assignments. Low, base, and high scenarios expose frame-specific minutes, disagreement, adjudication, training, administration, role-specific rates, and a ten-percent financial contingency. Their current planning totals are $16,751, $45,615, and $104,801. They are estimates, not approved offers.

The package records a current readiness gap rather than hiding it: the country-day packets are materialized, while the event census and system-negative draw still need rights-safe unlabeled packet releases. PUL-041 now owns that prerequisite before contact or PUL-018.

## Independent audit

A read-only GPT-5.3 Codex Spark worker independently checked the counts, cost variables, role separation, sourcing categories, and feasibility risks. It confirmed the frozen frame totals and flagged the difference between protocol counts and coder-ready packet artifacts. Its alternative cost assumptions were intentionally more conservative. The final package keeps frame-specific planning ranges and requires a 30-packet qualified-human timing pilot to replace assumed minutes before full assignment.

## Current external anchors

Sources were checked on 2026-07-11. The US Bureau of Labor Statistics provides a master's-level professional-market anchor, while Prolific's participant floor is retained only to show that specialist coding should not be priced as general crowd work. APSA, ECPR, IAPSS, and the MPSA association directory provide contact-free sourcing-pool categories. These sources do not name or endorse any candidate.

## Verification

```sh
npm run validate:pulse-coder-recruitment
npx eslint src/lib/pulse/v2/coder-recruitment.ts src/lib/pulse/v2/coder-recruitment.test.ts scripts/validate-pulse-coder-recruitment.ts
npx tsc --noEmit
node plan/tools/validate-master-plan.mjs
npm run build
```

The owner check in `plan/MANUAL-CHECKS.md` retains a six-to-eight-week panel-formation lead time after contact authorization. External solicitation remains blocked until G4.
