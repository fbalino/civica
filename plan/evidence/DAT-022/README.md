# DAT-022 — G2 Atlas release candidate

## Outcome

DAT-022 is complete. The stable candidate directory is
`data/releases/atlas-2026-07-11/g2-rc1/`; its deterministic archival deposit
file is `data/releases/atlas-2026-07-11-g2-rc1.zip`.

The 16-file bundle includes versioned export-builder code, frozen export, BOM,
observation-input and rights manifests, codebook, coverage report, environment,
citation draft, changelog, limitations, reproduction instructions, clean-room
evidence, component manifest, G2 checklist, and SHA-256 inventory.

## Scope boundary

The candidate reproduces the normalized released observation package. It does
not claim to replay upstream publisher ingestion from bytes that were never
retained. That boundary appears in the input manifest, limitations, clean-room
result, bundle manifest, reproduction output, and APR-D055.

## Verification

- `npm run package:g2-atlas` produced byte-identical ZIP hashes on two runs.
- Archive: 1,215,326 bytes; SHA-256
  `2ff0f25fa8c69e1d2a7901aa45aa536df62ea7f7d58ed73717b61cdb5fe71372`.
- `npm run validate:g2-atlas` passed all 13 G2 checklist components and verified
  every file, archive entry, code artifact, manifest, citation field, and hash.
- `npm run reproduce:g2-atlas -- --strict-clean` rebuilt 253 jurisdictions,
  16,451 observations, and three source-rights rows with semantic SHA-256
  `cd9937fc74d007af1818cb84dae9250b1816354059c1080ec031d4d829098ce1`.
- A new checkout with no `.git`, `.env.local`, dependency cache, build cache,
  database, or model credential passed strict reproduction, 622/622 tests, all
  validators, and the production build after `npm ci`.
