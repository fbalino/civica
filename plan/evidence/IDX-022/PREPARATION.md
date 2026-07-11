# IDX-022 preparation evidence

IDX-022 remains open. The machine-readable preregistration, thresholds, sample rules, task constructs, exclusions, analysis, and agent-simulation limits are frozen in `src/lib/ci/reader-task-protocol.ts`. The reader summary is `plan/research/index-reader-task-preregistration-v1.md`.

Remaining acceptance evidence:

- final IDX-031 K0 dashboard fixture;
- matched frozen K1 fixture and answer key;
- instrumentation dry run;
- at least 30 qualified human participants at G5;
- paired results and disposition under the frozen rule.

```sh
npm run validate:index-reader-tasks
npx tsx --test src/lib/ci/reader-task-protocol.test.ts
```
