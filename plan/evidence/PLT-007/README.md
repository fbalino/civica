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

## A real historical leak was found and rotated

The history scan caught a genuine exposure: a live Neon `DATABASE_URL` (host
`ep-bitter-night-*.neon.tech`) was committed in commits `9332c4bc` and
`b2bafdd2`. It is **not** in the current tree. The historical bytes remain
recoverable from Git, but the credential itself is now invalid.

- It is recorded by **non-reversible SHA-256** in the allowlist's
  `knownHistoryExposed` registry with status `ROTATED/INERT`, so the history
  scan still fails on any OTHER leak while recognizing this exact invalid
  historical value.
- On 2026-07-29, authenticated Neon control-plane resets rotated
  `neondb_owner` on production main and the retained pre-release recovery
  branch. Fresh attempts with the old production pooled and direct URLs, plus
  the old recovery direct credential, were rejected. Fresh replacement owner
  credentials worked on both branches, preserving future migration authority.
- The deployed application role and Vercel environment were not changed. The
  local owner environment was atomically updated with mode `0600`.
- Rewriting shared Git history remains an explicit owner decision. Until then,
  the non-reversible historical hash must remain registered; it does not make
  the invalid credential safe or reusable.

The redacted rotation record is
`owner-credential-rotation-2026-07-29.v1.json`. It contains no password,
connection URL, or provider response.

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

## Rotation verification (2026-07-29)

- Production main and the retained recovery branch received independent owner
  password resets.
- Fresh old pooled/direct authentication attempts were rejected.
- Fresh new owner connections passed branch, database, migration-head, and
  owner-privilege checks.
- Vercel and the least-privilege application role were untouched.
- `.env.local` retained the new owner URLs at mode `0600`; no secret or URL was
  written to repository evidence.
