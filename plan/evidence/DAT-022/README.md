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
- Archive: 1,869,053 bytes; SHA-256
  `bb845c3d6e0b17ceb834399afc84b3f52baaf272e02a993efd2112ebc9de9543`.
- `npm run validate:g2-atlas` passed all 13 G2 checklist components and verified
  every file, archive entry, code artifact, manifest, citation field, and hash.
- `npm run reproduce:g2-atlas -- --strict-clean` rebuilt 253 jurisdictions,
  12,373 frozen canonical facts, and three source-rights rows with semantic
  SHA-256 `60556198b2ee3805f93558db47b1e5620c4f8f5cf372d6f83ebb6265fdcfa9fc`.
- A new checkout with no `.git`, `.env.local`, dependency cache, build cache,
  database, or model credential passed strict reproduction, 622/622 tests, all
  validators, and the production build after `npm ci`.
