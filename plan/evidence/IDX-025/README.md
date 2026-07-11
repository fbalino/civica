# IDX-025 evidence

- Machine-readable decision: `data/releases/index-tournament-confirmatory-decision-v1/decision.v1.json`
- Plain-language report: `plan/research/index-tournament-confirmatory-decision-v1.md`
- Decision engine and exploratory-scenario guard: `src/lib/ci/tournament-decision.ts`
- Generator: `scripts/generate-index-tournament-decision.ts`
- Independent rebuild validator: `scripts/validate-index-tournament-decision.ts`

All 24 thresholds from the frozen K0–K5 protocol have a pass, fail, or insufficient-evidence state. The result contains eight passes, two failures, and 14 insufficient states. Every candidate has at least one failure or unresolved threshold, so the noncompensating rule yields no winner. K1's original-measurement claim fails while its bounded derivative utility remains unresolved; the engine does not convert that unresolved question into automatic retirement or approval.

The result records the declared sensitivity and missing-subgroup penalties. No confirmatory p-value family was used for a threshold decision, so Holm adjustment was not triggered. The simplicity rule is applied but cannot break a tie because no candidate qualifies. A threshold override creates a separately hashed `exploratory` release whose contract forbids winner selection.

```sh
npm run generate:index-tournament-decision
npm run validate:index-tournament-decision
npx tsx --test src/lib/ci/tournament-decision.test.ts
npx tsc --noEmit
node plan/tools/validate-master-plan.mjs
```
