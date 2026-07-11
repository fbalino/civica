# DAT-022 — G2 Atlas release candidate

## Outcome

DAT-022 is complete. The stable candidate directory is
`data/releases/atlas-2026-07-11/g2-rc1/`; its deterministic archival deposit
file is `data/releases/atlas-2026-07-11-g2-rc1.zip`.

The 16-file bundle includes versioned export-builder code, frozen export, BOM,
snapshot-input and rights manifests, codebook, coverage report, environment,
citation draft, changelog, limitations, reproduction instructions, clean-room
evidence, component manifest, G2 checklist, and SHA-256 inventory.

## Scope boundary

The candidate reproduces the immutable canonical Q1 snapshot. It excludes
alternate observations and does not claim to replay upstream publisher
ingestion from bytes that were never retained.

## Verification

- `npm run package:g2-atlas` produced byte-identical ZIP hashes on two runs.
- Archive: 1,869,185 bytes; SHA-256
  `203d9a32fde54cb955e4fb0bef00e5fb4b370e7c8e3b2f6e363074de022dd110`.
- `npm run validate:g2-atlas` passed all 13 G2 checklist components and verified
  every file, archive entry, code artifact, manifest, citation field, and hash.
- `npm run reproduce:g2-atlas -- --strict-clean` rebuilt 253 jurisdictions,
  12,373 frozen canonical facts, and three source-rights rows with semantic
  SHA-256 `8be96e97fef153736f98ce56c8ab59a697f6396c3f61d3b07b12ba7823904ba9`.
- A new checkout with no `.git`, `.env.local`, dependency cache, build cache,
  database, or model credential passed strict reproduction, 622/622 tests, all
  validators, and the production build after `npm ci`.
