# DAT-009 — Schema data dictionary and field provenance

## Outcome

`data/schema-data-dictionary.v1.json` covers the complete Drizzle schema rather
than a hand-picked public subset. Its release-scope field separates Atlas,
research-Beta, public-support, internal-operational, and private-submission
tables.

The checked artifact contains 49 tables and 558 columns. Every column has a
definition, exact SQL type, unit, null meaning, default status, primary/unique/
index/foreign-key structure, source or derivation, update cadence, vintage
semantics, rights posture, and deprecation state. Composite unique-index
membership is recorded without falsely describing each member as individually
unique.

## Enforcement

- `src/lib/data-dictionary/registry.ts` is the reviewed semantic policy.
- `src/lib/data-dictionary/build.ts` introspects the current Drizzle structure,
  materializes field entries, and computes the structural SHA-256 fingerprint.
- `npm run generate:data-dictionary` writes the deterministic checked artifact.
- `npm run validate:data-dictionary` compares the entire checked artifact with
  the current generated result and runs in `npm run build`.
- Six focused tests cover total closure, required metadata, composite keys,
  legacy markings, temporal distinctions, and seeded artifact drift.
- `data/SCHEMA-DATA-DICTIONARY.md` explains how researchers and maintainers
  should read and update the file.

## Verification

- Data-dictionary validator: pass.
- Focused tests: 6/6 pass.
- TypeScript: pass.
- ESLint on all new TypeScript: pass.
- Full production build: pass, including 425/425 tests and route generation.
- Browser verification: not applicable; DAT-009 adds a repository research
  artifact and CI contract, with no rendered UI change.
