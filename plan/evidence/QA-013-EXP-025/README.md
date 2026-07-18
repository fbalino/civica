# QA-013 / EXP-025 — visual-regression candidate evidence

## Status

In progress as of 2026-07-18. The checked artifacts are a **review candidate**,
not approved baselines. `e2e/visual-baselines/candidate-manifest.json` records
68 Chromium/macOS image hashes, their route/theme/viewport/state/fixture
metadata, the visual-input-contract hash, and candidate provenance. It has no
approval block.

The matrix covers the canonical modules named by EXP-025 in light and dark
themes at 1280 × 900 and 360 × 740: design system, home and open navigation,
404, country Factbook/Civica Data, Atlas, Compare, Index, Pulse ledger,
methodology, constitution, elections, Record, API docs, advisory board, and a
country embed. The seeded design-token drift check also passes.

## Candidate generation and comparison

An isolated detached checkout at `07db66e4` was built twice with
`npx next build` and served on local port 3103. No deployment, production
write, form submission, or paid model call occurred. The fixture server logged
failed telemetry persistence attempts; no successful write was observed.

| Phase | Production build environment | Candidate capture | Comparison result |
| --- | --- | --- | --- |
| Credential-free | no `.env.local` | `E2E_BASE_URL=http://localhost:3103 npm run update:e2e:visual -- --author=Codex --reason='Capture the credential-free half of the visual review candidate.'` | `E2E_BASE_URL=http://localhost:3103 npm run test:e2e:visual` — 33 passed, 36 skipped |
| Controlled fixture | declared read-only `.env.local` fixture | `E2E_BASE_URL=http://localhost:3103 E2E_PERFORMANCE_FIXTURE_DB=1 npm run update:e2e:visual -- --author=Codex --reason='Capture the fixture-backed half of the visual review candidate.'` | `E2E_BASE_URL=http://localhost:3103 E2E_PERFORMANCE_FIXTURE_DB=1 npm run test:e2e:visual` — 37 passed, 32 skipped |

The two phases intentionally do not compare the same route in different data
states: the home page legitimately has fixture-backed content when the
database is available. Together they produce the exact 68-image matrix. The
candidate hash validator passed:

```sh
npx tsx -e '<candidate manifest + image hash validation>'
# PASS — 68 candidate visual baselines are intact.
```

For deterministic Civica page baselines, the harness fixes viewport, locale,
timezone, theme, reduced motion, font readiness, and animation/caret state. It
masks only third-party map, masthead-preview, and FlagCDN pixels while keeping
their layout; QA-016 separately verifies those providers' failure/fallback
behavior.

## Required review before completion

1. A human must inspect the candidate images and explicitly promote them with
   `VISUAL_BASELINE_APPROVE=1 npm run approve:e2e:visual -- --reviewer=<name>
   --reason=<review rationale>`.
2. `npm run validate:visual-baselines` must then pass against the approved
   manifest and its hashes.
3. Record the approval result here, check QA-013 and EXP-025 in the master and
   their area mirrors, and update `plan/PROGRESS.md`.

Until those steps happen, the approval workflow deliberately treats the
candidate as non-authoritative.
