# DAT-011 — Raw input retention and reconstruction records

## Outcome

`data/releases/ci-beta-2024-Q4/raw-input-retention-manifest.v1.json`
is the checked retention record for Civica's one named frozen release. Atlas G2
and Pulse v2 remain unreleased and do not receive retrospective capture
metadata.

The manifest records four publisher captures and five released Index value
groups. Each capture includes the exact byte SHA-256, retrieval time, access
URL, upstream version and vintage, format, adapter hash, redistribution
posture, rights state, and reacquisition instructions. Each value group carries
its source, dimension, indicator, expected row count, semantic SHA-256, and raw
capture link. Composite lineage names all five required groups.

Publisher files are not distributed. A reconstruction must reacquire the named
publisher artifact under its access terms and stop if the byte hash differs.
This prevents a mutable current download from silently standing in for the
release input.

## Enforcement

- `src/lib/data/raw-snapshot-manifest.ts` builds, hashes, and validates the
  contract from the source-input manifest, frozen coverage fixture, and rights
  registry.
- `npm run generate:raw-retention` writes the deterministic artifact.
- `npm run validate:raw-retention` compares the entire checked artifact and
  runs in the production build before rights and claims gates.
- The rights manifest lists both release metadata artifacts and confirms that
  all publisher payloads remain excluded.
- Seven fixtures cover release closure, source linkage, byte verification,
  missing captures, hash mutation, semantic/row-count corruption, and mutable
  acquisition metadata.

## Verification

- Raw-retention, rights, derivation-version, and TypeScript gates: pass.
- Targeted ESLint: pass.
- Full tests: 446/446 pass.
- Full production build and route generation: pass.
- Browser verification: not applicable; no rendered UI changed.
