# DAT-002 evidence — versioned source-input manifests

Status: implementation complete on 2026-07-10.

## Outcome

`source-input-manifest/v1` now separates two things that previously had no
enforceable boundary:

1. a stable specification for every source used by every deployed production
   pipeline; and
2. an exact captured input admitted to a named release.

The closed inventory contains 45 production pipelines: 35 scheduled routes
from `vercel.json` plus ten manual Atlas, Index, and Conditions families. Those
pipelines resolve to 43 external source specifications. Seven internal stages
name their database-derived input instead of pretending to fetch a publisher.

Every specification records canonical publisher URL, access method, upstream
version/vintage policy, format, expected coverage, and redistribution posture.
Every captured release input additionally requires an exact access URL,
retrieval timestamp, SHA-256 content hash, and SHA-256 adapter version derived
from its implementation files.

## Frozen release proof

`data/releases/ci-beta-2024-Q4/source-input-manifest.v1.json` contains four
captured publisher artifacts:

- V-Dem Country-Year Core v15
- World Bank WGI 2025 revision containing 2024 observations
- Freedom in the World workbook through 2024
- Transparency International CPI 2024 workbook

The files were retrieved in a read-only audit ending at
`2026-07-10T20:56:16.125Z`. Their byte hashes equal the DAT-001 frozen-release
hashes, and the manifest's adapter-version hash is regenerated from the exact
Index implementation files. Editing an adapter or any manifest field causes
the checked release file to drift and fail validation.

## Fail-closed behavior

- Removing one Index capture makes generation fail with the exact missing
  `pipeline:source` key.
- Invalid hashes, adapter versions, timestamps, access URLs, or source/pipeline
  relationships fail focused fixtures.
- Attempting to generate the future full G2 Atlas manifest from current
  captures fails. The validator currently reports 57 missing pipeline/source
  captures.
- Missing legacy captures are not backfilled from `sources.last_sync_at`,
  output-table hashes, estimates, or invented timestamps.

This does not claim the Atlas replication package is published. The public
replication surface remains `unpublished-pre-g2`; DAT-011 owns compliant raw
snapshot/hash retention, DAT-019 owns the shareable clean room, and DAT-022
packages the eventual G2 release candidate.

## Executable contract

- `src/lib/data/source-input-manifest.ts` — source specifications, pipeline
  contracts, capture schema, adapter hashing, completeness checks, and builder
- `src/lib/data/production-adapter-registry.ts` — source ownership for all 35
  scheduled routes plus ten manual families
- `scripts/validate-source-input-manifest.ts` — DB/network/clock-free build gate
- `scripts/generate-source-input-manifest.ts` — fail-closed release generator
- `src/lib/data/__tests__/source-input-manifest.test.ts` — four focused positive
  and adversarial fixtures
- `data/releases/ci-beta-2024-Q4/source-input-manifest.v1.json` — first checked
  versioned release artifact

## Verification

- 45 production pipelines
- 43 external source specifications
- 35/35 scheduled routes closed against `vercel.json`
- four exact frozen Index captures
- 57 absent future G2 captures detected
- four focused fixtures passed
- TypeScript, formatting, diff checks, master-plan validation, full claims/docs
  tests, and production build passed

## Browser scope

DAT-002 changes release metadata, validators, and operational documentation; it
does not change a rendered route. Browser QA was therefore not applicable.
