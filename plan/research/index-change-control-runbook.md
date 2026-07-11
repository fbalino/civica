# Civica Index change-control runbook

Any change to a protected Index input, transform, weight/model, missingness rule, uncertainty rule, band/rank policy, or public presentation must append a record. The validator rejects an edited protected file until the record is complete.

1. Make the code and presentation changes under a new methodology/product version.
2. Update the methodology documentation, public claim/state registry, release note, migration plan, golden test, and contract test. Each evidence role must contain a new or changed file relative to the prior record.
3. Create a metadata JSON file with `id`, `toVersion`, `evidence` paths for all six roles, and optionally the expected `categories` and `validations`. Model/transform changes must add their new version-specific package validator; the immutable v1 tournament is verified through the research archive and is never regenerated in place.
4. Run `npm run generate:index-change-control -- --metadata=path/to/change.json`.
5. Run `npm run validate:index-change-control:run`. CI repeats every declared validation command.

The registry at `data/releases/index-change-control-v1/registry.v1.json` is append-only. Never edit an earlier snapshot or turn an archived failure into a pass. A revived candidate requires a new disposition resolution and must still pass the public Index quarantine.
