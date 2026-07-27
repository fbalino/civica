# PLT-011 — distributed production rate limiting

PLT-011 replaces production protection that depended on one application process with a closed, testable policy. The exact clean implementation commit is `92d7ea26`; its credential-free `npm run build:ci` completed successfully from a separate `npm ci` worktree.

## Acceptance mapping

- **Expensive public APIs and exports:** all versioned reads, country/reference reads, constitution search, citations, metrics, governance evidence, indicator/export routes, and other dynamic public reads use reviewed durable policies. The per-country export has its own distributed budget; static release downloads remain covered by the verified all-path Vercel firewall.
- **Chat, forms, credentials, and mutations:** chat has separate burst and sustained budgets. Contact, corrections, advisory applications, admin password login, Google OAuth start/callback, admin session creation, and Pulse coding credential creation are checked before expensive or mutating work. Authenticated owner/session operations and cron delivery retain their stronger existing controls and explicit exemptions.
- **Embeds and sign-out:** the retired embed and static responses use the broad platform rule. Pulse coding sign-out deliberately remains exact-origin plus platform-limited so a counter outage cannot prevent cookie clearing.
- **Closed inventory:** `rate-limit-policy/v1` maps all 100 canonical route files and 159 route-methods to 15 definitions: 12 durable application policies and three platform policies. Validation reports 154 source-confirmed and five externally verified route-methods, with zero planned, partial, or externally unverified entries.
- **Cross-instance enforcement:** one atomic PostgreSQL statement uses database time, bounds the stored count, returns the retry interval, and removes every expired row before writing. PGlite fixtures use independent clients against one database and prove exact shared limits, scope isolation, rollover, overflow handling, and deterministic legacy cleanup. No production path falls back to process memory.
- **Trusted identity:** production accepts only singular edge-overwritten Vercel client-address headers, rejects proxy chains and malformed/ambiguous addresses into one unknown bucket, canonicalizes IPv4/IPv6, and refuses arbitrary forwarded headers outside the trusted deployment. A separate `RATE_LIMIT_KEY_SECRET` HMACs the canonical subject and scope before storage; raw client addresses never cross the durable-store boundary.
- **Failure contract:** exhausted budgets return stable `429` responses with `Retry-After` and rate-limit headers. Missing/weak identity configuration or a shared-store outage returns a distinct noncacheable `503`; it never creates a local allowance.

## Live platform and data evidence

- `vercel-firewall-live.json` records the active, valid, no-draft all-path Vercel fixed-window rule: 600 requests per 60 seconds per IP, with a challenge on exceed. It is a broad flood-control layer, not the exact application budget.
- `vercel-rate-limit-environment-live.json` records that encrypted `RATE_LIMIT_KEY_SECRET` is present in Production. Its value was never printed or retained. Preview remains a post-branch/post-deployment owner check because no remote branch existed; no Preview deployment was created.
- `rate-limit-legacy-cleanup-live.json` records an aggregate-only inspection and cleanup: all 194 existing rows were expired, 191 used the legacy raw-identity format, exactly 194 expired rows were removed, and the post-check found zero rows. No key, address, or secret was selected or retained.
- The application was **not deployed** and no public limit was intentionally exhausted during this task. The remaining safe post-deployment verification is listed in `plan/MANUAL-CHECKS.md`.

## Public contract and change control

`data/RATE-LIMITING.md` is the operator and architecture runbook. API Docs and Terms now describe distributed budgets, `429`, counter-unavailable `503`, exemptions, identity handling, platform scope, privacy, rotation, cleanup, and response headers.

The protected Index API change is bound by append-only product-contract record `distributed-rate-limit-presentation-contract`, advancing only the presentation label to `civica-index-distributed-rate-limit-v30`. Its snapshot is `ba6d4cc786a26eee91bc3915cd02bd89a63908decb63803641fe964d933b9b4f` and contains exactly the eight PLT-011 protected files. No Index input, transform, model, score, band, rank, or research row changed. The governance-evidence and Atlas review packets were deterministically refreshed only for changed source/dictionary hashes.

## Browser verification

The in-Codex browser was attempted twice first, but its installed client failed during runtime initialization before a tab could attach. The permitted Playwright Chromium fallback checked `/api-docs` and `/terms` at desktop and mobile widths in light and dark mode: eight variants, HTTP 200, one H1 each, zero horizontal overflow, and zero console, page, or request failures. The intentional local typography tester overlay was excluded and left untouched. Machine evidence is in `browser-check.json`; temporary screenshots were not committed.

## Verification

Clean worktree at `92d7ea26`:

```text
npm ci
npm test
# 1,638 tests: 1,635 passed, 3 skipped, 0 failed

npm run validate:route-inventory
# 100 files / 100 entries; 0 phantom, stale, method-drift, or blocking-control errors

npm run validate:rate-limit-policy
# 100 routes / 159 methods; all durable and platform controls verified

npm run validate:index-change-control:run
# claims/docs, review packet, Index disposition/quarantine, and rate-limit policy all passed

npm run build:ci
# passed, including TypeScript, migrations, data/release/research validators,
# claims/docs, the full unit gate, and the Next.js production build
```

Focused verification also passed for environment contracts, API Docs, Terms, advisory applications, data dictionary, design tokens, documentation references/sources, formatting, diff integrity, trusted address parsing, HMAC subjects, request adapters, PostgreSQL multi-client behavior, constitution-search responses, and admin login behavior.

## Scope preservation

The owner-controlled Uruguay/Ghana/Japan color-photo trials, typography tester, and all associated local files remained unstaged and are not part of any PLT-011 snapshot, packet, test checkout, or commit.
