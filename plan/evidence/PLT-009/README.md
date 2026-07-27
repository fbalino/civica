# PLT-009 — consolidated admin authentication, authorization, and audit

**Status:** Complete

**Completed:** 2026-07-14

**Security contract:** `data/ADMIN-AUTHENTICATION.md`

## Done-when evidence

1. **One reviewed unsafe-mutation boundary.** Every owner-admin data mutation
   calls `withAdminMutation()`. It authorizes the existing timing-safe signed
   session, checks the durable revocation store, applies the exact-origin
   Fetch-Metadata/Origin/Referer policy, writes an audit attempt before parsing
   or business work, and normally records the terminal result. A failed final
   audit insert leaves the durable `attempted` result as an explicit
   interrupted-lifecycle signal without inducing an unsafe duplicate retry.
   The two owner logout methods call `withAdminLogout()`. Static method-body
   tests fail if a declared unsafe handler omits the common session, origin, or
   audit boundary.
2. **Documented cookie/CSRF/bearer policy.** The checked security contract
   documents cookie flags, fixed server expiry, Google state bootstrap,
   same-origin policy and legacy-client fallback, the explicit rejection of
   sibling/cross-site/opaque/missing provenance, and the fact that bearer
   headers never authorize owner-admin routes. It cites current OWASP/MDN
   primary guidance reviewed on the completion date.
3. **Bounded trusted reviewer identity.** The PLT-027 signed-session contract
   remains unchanged: identity comes only from sanitized server configuration,
   permits a narrow character set, and is capped at 80 characters. The common
   audit validator and database constraint re-check the same bound.
4. **Brute force, expiry, and durable logout.** Password login remains
   durably limited to five attempts per 15 minutes before parsing/KDF; username,
   password, and HMAC comparisons remain timing-safe. Server expiry tests remain
   green. `admin_session_revocations` stores only a domain-separated session-ID
   hash. Tests prove a copied cookie works before logout, fails after logout,
   independent sessions remain independent, repeated logout is idempotent,
   invalid/expired cookies never query the store, and a store outage fails
   authorization/logout closed without a clear-cookie header.
5. **Actor/action/target/time/result audit.** The append-only
   `admin_mutation_audit_log` records correlated attempt/outcome events with
   route, method, actor/source, hashed session key, action, target type/ID,
   result, status, reason code, and database event time. Row updates, deletes,
   and truncation are rejected. Tests assert the exact actor/action/target/result
   values for success, validation rejection, CSRF rejection, handler failure,
   interrupted terminal-audit insertion, login, and logout. Existing richer
   domain audit logs are preserved.
6. **Redirect repair.** All five residual raw admin redirects found during the
   PLT-009 inventory now use `safeInternalPathOr()`, including the authenticated
   sign-in shortcut. Scheme-relative, encoded-authority, backslash, and absolute
   targets retain the PLT-027 rejection contract.

## Schema and migration evidence

- Drizzle schema: 82 tables, including `admin_session_revocations` and
  `admin_mutation_audit_log`.
- Authoritative migration: `0033_flat_hardball`, hash-pinned in the manifest,
  journaled/registered, documented in the migration changelog, and protected
  by append-only database triggers.
- `npm run db:plan -- --all --live` refreshed DAT-013 with 52 zero-write plans;
  both new relations were correctly reported missing before deployment.
- A fresh local PostgreSQL 17 database applied authoritative migrations
  `0000` through `0033` successfully. The checked post-migration public-schema
  fingerprint is `70f1f2e50aaf74a6b7b126a11fe93b5481d39cd1eafff9de60ea2ccad88a7df4`.
  Direct `TRUNCATE` attempts against both security tables failed with their
  append-only exception, matching the checked no-truncate trigger contract.
- The field-level dictionary was regenerated for 82 tables and 1,173 columns.

No production migration or real login/logout was performed. Vercel's existing
`db:migrate`-before-build path will apply `0033` at deployment. The manual queue
retains one post-deploy copied-cookie/audit-row smoke check; no live outcome is
claimed here.

## Verification

The final focused pass completed with:

- `node --import tsx --test 'src/lib/admin/*.test.ts'`
  `src/lib/api/admin-mutation-request-guard.test.ts`
  `src/lib/api/__tests__/route-authorization.test.ts`: **73/73 passed**;
- `npm run validate:module-coverage`: all eight registered modules passed;
  the expanded admin-security module measured **90.52% lines, 83.86% branches,
  and 88.04% functions** against its unchanged 85/80/70 thresholds;
- `npm run typecheck` and focused ESLint: passed;
- `npm run validate:authoritative-migrations`: 50-table baseline and 34 ordered
  migrations passed;
- `npm run validate:migrations`: all 52 forward artifacts passed;
- `npm run validate:migration-preflight`: 52/52 plans passed;
- `npm run validate:data-dictionary`: 82 tables and 1,173 columns passed;
- `npm run validate:design-tokens`: no new drift; and
- `node plan/tools/validate-master-plan.mjs`: exact 305/197/108/64.6 ledger
  passed.

The intentional untracked typography tester adds a local 101st `route.ts`; it
is not part of PLT-009 and remains untouched. Canonical verification therefore
ran from an isolated clean checkout of the task commit using Node 22:

- `npm run validate:route-inventory`: **100/100 routes registered**, with only
  the already documented non-blocking Pulse-coding sign-out warning;
- `npm test`: **1,442 tests, 1,439 passed, 0 failed, 3 skipped**;
- `npm run validate:claims-docs`: all 15 subchecks across all seven categories
  passed;
- `npm run validate:atlas-review-packet`: passed with semantic SHA-256
  `75226bafcf4cba259f0b4cdd00525f8af39fefc8aaf36d86b2f3d63a2ddd2eab`;
  and
- `npm run build:ci`: all prerequisite/production validators, TypeScript, the
  108-page static generation pass, and the final Next.js 16.2.7 production
  build passed without credentials.
