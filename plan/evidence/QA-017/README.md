# QA-017 — clean checkout proof

**Task:** QA-017
**Final candidate:** `6dc1ff20` (2026-07-18)
**Scope:** clean non-secret install, full production build, and full fixture-only test suite.

## Isolated environment

A detached worktree was created at `/tmp/civica-qa017-6dc1ff20`. Before
installation it had no `.env.local`, `.next`, or `.turbo` directory; the only
environment file was the tracked `.env.example`. It did not reuse the active
user worktree, a private branch, a dependency tree, or build output.

`npm ci --ignore-scripts` installed 652 lockfile-pinned packages. The package
audit displayed 14 advisory findings; no dependencies or lockfile entries were
changed.

## Commands and results

```sh
env -i PATH="$PATH" CI=1 NODE_ENV=production \
  npm_config_production=true npm_config_omit=dev \
  NPM_CONFIG_PRODUCTION=true NPM_CONFIG_OMIT=dev \
  DATABASE_URL='postgresql://fixture@127.0.0.1:1/civica_qa_fixture?connect_timeout=1' \
  npm run build
```

Exit 0. The production build compiled, type-checked, generated 50 static
pages, and kept `/api/constitution/search` edge-compatible. Its clean-room
check reported `credentialsUsed: []` and `networkRequests: 0`.

```sh
env -i PATH="$PATH" CI=1 NODE_ENV=test npm test
```

Exit 0: 1,910 tests total, 1,907 passed, zero failed, and three skipped;
duration 34.1 seconds. Tests use the invented, legally shareable PGlite
fixture and do not use a production credential or database.

## Limits and follow-up

The build validates the checked historical release-quality report but does not
perform its credentialed live data audit. That report retains its existing
`unexpected_row_delta:1` status; QA-017 does not reinterpret it as a green
release-quality result. Live release staging and smoke testing remain QA-018.

The broader remediation and control record is in
`plan/QA-017-clean-checkout-2026-07-18.md` and the existing
`index-change-control-*.{md,json}` files in this directory.
