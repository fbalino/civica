# CLM-020 verification after the change-control record

This file is not Index change-control evidence, so it can record results that
exist only after `publisher-attribution-2026-09-29`
(`civica-index-publisher-attribution-v64`) was appended, and the controller's
browser checks. Pre-record results are in `README.md`.

| Command (worktree, 2026-09-29, `DATABASE_URL` unset) | Exit | Result |
|---|---|---|
| `npm run generate:index-change-control -- --metadata=plan/evidence/CLM-020/index-change-control-metadata.json` | 0 | Appended `civica-index-pulse-voter-dropout-counter-v63` → `civica-index-publisher-attribution-v64`; categories input and presentation; 10 changed protected files. |
| `npm run validate:index-change-control:run` | 0 | Binds 118 protected files; reran all 9 declared validations, including `validate:claims-docs` (all 17 checks pass across the seven categories; its `npm test` child ran 2,345 tests: 2,342 pass, 0 fail, 3 skipped) and `validate:publisher-attribution`. |
| `npm run build:ci` (credential-free: `.env.local` moved out of the worktree for the run and restored) | 0 | `build:core` ran every validator, including `validate:claims-docs` with the new `publisher-attribution` child (self-proof with 11 seeded mutations, then a pass over 905 source files), and `next build` completed. |
| `npm run validate:ci-workflow` | 0 | CI contract unchanged. |

## Browser checks (controller)

No dev server was run for this change. Screenshots, when added, go in this
directory as separate files and are listed here.
