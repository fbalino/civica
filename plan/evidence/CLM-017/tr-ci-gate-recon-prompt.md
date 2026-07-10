# TR CLM-017 CI-gate reconnaissance

Project root: `/Users/fernandobalino/Projects/civica`

You are the Terra-model read-only reconnaissance lane for CLM-017:

> Add a claims-and-documentation CI gate. Done when: one documented command validates registry coverage, numeric templates, internal routes/anchors, API examples, methodology fixtures, experimental labels, and prohibited claim language; the command fails on seeded stale-copy fixtures and runs in CI.

Inspect only `package.json`, existing `scripts/validate-*`, their focused tests, README/AGENTS documentation, and any current CI/workflow files. Use at most 25 shell/tool calls. Do not edit files, run a browser/server/database, or broaden into unrelated CI/security work.

Return a concise implementation brief containing:

1. Exact existing validators that cover each Done-when category and any real gap.
2. The smallest single command/runner architecture without duplicating validator logic.
3. A deterministic seeded-stale-copy fixture strategy that proves the aggregator fails for each category without mutating the worktree.
4. The minimal GitHub Actions workflow for this repo (none currently exists if confirmed), including Node/npm cache and commands.
5. Exact files to add/edit and objective acceptance commands.
6. Any risk of recursion, live-DB dependence, or excessive CI runtime.

Clearly state the actual model name/runtime you can verify from your environment. If the requested Terra model is not actually in use, stop and say so without repository inspection.
