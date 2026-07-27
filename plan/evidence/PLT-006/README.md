# PLT-006 — environment configuration validation by context

Completed 2026-07-12.

## What shipped
- `src/lib/env/contract.ts` — the single typed contract. Each managed variable
  declares the execution contexts it is **required** in (`build`, `dev`, `test`,
  `scripts`, `cron`, `admin`, `chat`, `production`), whether it is a **secret**
  (its value must never be echoed), and an optional format check. Feature-
  enabling keys that degrade gracefully (model providers, optional syncs, maps)
  are listed separately as `degrades`. This is the machine-readable companion
  to the prose `.env.example` (which now points at it).
- `checkEnv(context, env)` returns `{missing, invalid, degradedOff}` using only
  variable **names** and format reasons — never a value.
- `scripts/validate-env.ts` / `npm run validate:env -- --context=<ctx>` —
  fail-early CLI. Loads `.env.local` for local checks (no-op in CI/prod). Exits
  non-zero with clear, secret-free messages when a required variable is missing
  or malformed; prints optional-off features as a NOTICE.
- Wired to fail early at startup: `prebuild` runs `--context=build` (so a
  missing `DATABASE_URL` fails the deploy build with a clear message before any
  page compiles), and `predev` runs `--context=dev`.

## Verification (2026-07-12)
- `src/lib/env/contract.test.ts` — 7 tests: a full env passes every context;
  a missing required var fails with a clear message; admin requires admin
  secrets while build does not; an invalid format is reported **without echoing
  the value**; secrets never appear in check output; optional model keys
  degrade off rather than fail; every required var declares a context.
- CLI: `--context=build` and `--context=production` PASS against `.env.local`
  and list the optional-off features (OPENAI, PULSE_CODING, CONGRESS,
  BUNDESTAG); with `DATABASE_URL` unset, build fails with
  "missing required DATABASE_URL for context 'build'".
- Full suite 1013/1013; typecheck, lint, and doc-references pass.

## Scope note
The contract is the single source of truth and the CLI covers every context;
`build`/`dev` are wired to fail early. `admin`/`chat`/`cron` routes already fail
closed on their missing secrets today — the contract now documents and can
assert those requirements centrally (`checkEnv`/`validate:env --context=…`),
which a future pass can invoke at each route boundary.
