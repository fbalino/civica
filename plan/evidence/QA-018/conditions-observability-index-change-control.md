# QA-018 Conditions observability — Index change-control record

This record binds the non-method operational correction made to the shared
production-adapter registry. The Conditions production pipeline now names its
unified orchestrator instead of three obsolete single-dimension entrypoints.
The protected file is classified as an Index `input` surface because it is
shared release-governance infrastructure, although this exact change does not
alter any Index input, source, calculation, transformation, weight, model,
missingness rule, uncertainty rule, rank, publication rule, public result, or
claim.

The protected snapshot advances only to authenticate the shared-file edit:

- protected Index snapshot: `b82ba4c1404cfb72c999002dc9e8874d5e6889bd8dc1e57533e0280e86c4680e`
  → `fa94b473a5797972c5298bd89580adb34debb7c8233a535dd3a5c926b22d678c`;
- protected hash for `src/lib/data/production-adapter-registry.ts`:
  `12bfe4f1786bd66b233af54cf8d0f809ffb4775d4cf4cf814ad576065503ccdd`
  → `15bcf17f65d9f4c6bdc68f31d482e17c96322c1b581e683ee60d620ceaded057`;
- raw SHA-256 for that file:
  `63b77573d7761035639d6b3075ab7356b5122bd97952a3fa6cad6c2edc0c7546`
  → `02735c89bc2a7343309978d4c8585cc677efd83f2349c70a0f27edbff324a7e2`.

The current Index release remains `ci-beta-r5-2024-Q4` and its method remains
`beta-r5`. The new change-control version label is administrative snapshot
identity, not a new Index method or release. No owner approval, external
review, deployment, or QA-018 sign-off is claimed by this record.
