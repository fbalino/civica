# PLT-007 — secret and sensitive-artifact scanning

Completed 2026-07-12.

## What shipped
- `scripts/secret-patterns.ts` — pure, tested detectors for high-signal
  credential shapes (Anthropic/OpenAI/DeepSeek keys, Google OAuth secrets, AWS
  keys, GitHub/Slack tokens, PEM private keys, connection strings with real
  passwords, secret-named variables assigned long literals) plus sensitive
  artifact filenames (`*.sql.gz/.dump/.pgdump/.bak/.wal`, `*.pem/.key/.p12`,
  `id_rsa`, `auth.json`). Findings are always **redacted** — the full value is
  never printed. A generic placeholder filter clears documentation/test
  fixtures without per-file exceptions.
- `scripts/scan-secrets.ts` / `npm run validate:secrets` — scans the tracked
  working tree (`git ls-files`, which already excludes `node_modules`, `.next`,
  and `.env*`), covering logs/evidence, `.orchestrator`, plan artifacts, and
  source snapshots because all are tracked. `npm run validate:secrets:history`
  scans the full commit history. `scripts/secret-scan-allowlist.json` is the
  narrow, documented allowlist.
- Wired `validate:secrets` (and `validate:lint`, PLT-002) into the CI workflow
  (`.github/workflows/claims-docs.yml`). The `:history` variant is the
  pre-release scan.

## A real historical leak was found (and surfaced, not hidden)
The history scan caught a genuine exposure: a live Neon `DATABASE_URL` (host
`ep-bitter-night-*.neon.tech`) was committed in commits `9332c4bc` and
`b2bafdd2`. It is **not** in the current tree but is recoverable from history.
- It is recorded by **non-reversible SHA-256** in the allowlist's
  `knownHistoryExposed` with status `EXPOSED — rotation queued`, so the history
  scan still fails on any OTHER leak while printing a NOTICE for this one.
- A **CRITICAL** owner action is queued in `plan/MANUAL-CHECKS.md`: rotate the
  Neon credential now, then decide on a history purge. The plaintext credential
  is never written to any committed file or evidence.

## Verification (2026-07-12)
- `validate:secrets` (tree): PASS — 0 findings across 2,867 tracked files.
- Seeded a live-format `sk-ant-…` key in a staged file → **FAIL (exit 1)** with
  redacted preview `sk-a************`; PASS after removal.
- Seeded `backup.sql.gz` → **FAIL** ("sensitive artifact tracked"); PASS after
  removal.
- `validate:secrets:history`: PASS with the known-exposure NOTICE (recognizes
  the tracked leak; would fail on a new one).
- `scripts/secret-patterns.test.ts` — 5 tests (live-format detection, never
  emits the value, placeholder/fixture skipping, hash-based known-exposure
  suppression, sensitive filenames). Full suite 1001/1001. `tsc` and
  `validate:lint` clean.
