# QA-018 attempt 06 — isolated Preview smoke

Status: technical run passed; owner sign-off pending.

The exact clean-worktree candidate
`fb7376f3ee7990c89b9da57716b3e563924af028` was built once and deployed as
Vercel Preview `dpl_DuymaVKNXCiyc34cC7q9SuRW6pMw`. Its checked Build Output
static tree contains 742 files and 245,543,382 bytes; the complete deterministic
manifest SHA-256 is
`92260d47f5554356d4b37bd5854d1850cf92f7b3db31a58d26c6b7147678cd6d`.

The guarded deployment input targeted Neon project `ancient-art-58836757`,
disposable branch `br-bitter-fire-amcx8asi`, and endpoint
`ep-sparkling-pine-amdbr4ke`. The child hostname SHA-256 is
`a5fb8fbdb1d9d993f39c19dc0e8e7a41c53fdf32f7fc1948b137db8f6aa71761`;
the forbidden production branch is `br-dawn-frog-amrf0h6a`, whose distinct
hostname SHA-256 is
`c0ca2046b194c5a2a9db23679062055eb075b8183500889dde1968466be2425b`.
No database URL is retained.

Vercel's deployment-scoped environment pull accepts only an
`INITIALIZING` deployment. The CLI rejected sanitized attempts after the
prebuilt deployment had reached `BUILDING` and `READY`. The checked fallback
therefore binds that same deployment, candidate, and guarded child identity to
runtime evidence from the exact Preview host. That host exposed the child-only
Conditions release `conditions-qa018-20260726-v2`, methodology
`conditions-components/v1`, and manifest
`d2248097a98111753ef69916a83d4e19f86861d7cd0b739fbd6bb35cabbcb53b`.
Independent read-only child queries proved migration head
`0050_index_release_header_contract`, 50 repository-matching ledger rows, and
public-schema fingerprint
`5b4e4b180158b583e4db879b4ecfcaae6c3ca81caaeea28118cd0f83b3c6bd3b`.

The Preview API run passed the selected Conditions, Index, and Pulse pointers;
mutable, checked, and frozen cache policies; an unauthenticated protected-route
401; and a non-model Factbook dispute auto-resolution dry run. Reusing its
stable idempotency key returned `duplicate_suppressed`. The 57-row source
freshness snapshot remained
`374de987d2cc72b21a7fe34ac0c1b436f602b3b3309df7e34f8215df633942dc`
before and after, and active cron leases remained zero.

The responsive browser run covered an Atlas country page plus the Conditions
explorer, country panel, and three-country comparison at desktop and 390px
mobile widths. Aligned, mixed-year-refused, and missing-component rows were
all visible; no Conditions composite or ranking appeared; horizontal overflow
and console errors were both zero.

An earlier diagnostic dry run of the reconciliation-verification cron route
returned its intentional `completed_with_findings` failure because the report
contained one non-gating warning. It was not used as the passing QA check. The
accepted dry run is the successful non-model auto-resolution route recorded in
`run-06-preview-smoke.v1.json`.

This run did not promote a deployment, alter the persistent Vercel Preview
environment, invoke a production cron, mutate the production database, or
record Fernando's approval. QA-018 remains open until his dated post-run
decision.
