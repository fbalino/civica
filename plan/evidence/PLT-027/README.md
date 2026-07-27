# PLT-027 — admin redirect, login, session, and audit-identity hardening

**Status:** Complete
**Completed:** 2026-07-13

## Done-when evidence

1. **Central redirect validation.** `src/lib/admin/safe-redirect.ts` remains the
   single validator used by the password and Google login flows, sign-in page,
   and admin exception redirect. Its tests reject scheme-relative, backslash,
   encoded-authority, absolute-URL, scheme, and control-character inputs.
2. **Durable login throttling.** `src/lib/admin/login-rate-limit.ts` delegates
   to the existing `checkDurableRateLimit()` Postgres primitive. The password
   route checks a SHA-256 domain-separated IP bucket before body parsing or the
   password KDF, allows five attempts per fixed 15-minute window, and returns
   `429`, `Retry-After`, and `X-RateLimit-Remaining: 0` when denied. Injected
   tests verify the exact durable-limiter options without touching Neon. Admin
   login opts into the primitive's fail-closed store-error policy, so a Neon
   failure denies the attempt instead of silently resetting durability to a
   per-instance counter. Existing callers retain their default memory fallback.
3. **Versioned, signed, server-verified session state.** The admin cookie is
   now `v1.<base64url-json>.<hmac>`. The authenticated payload contains the
   contract version, server-configured reviewer identity, Unix issued-at,
   Unix expiry, and a fresh 144-bit random session ID. Verification checks the
   envelope, constant-time HMAC comparison, exact payload schema, configured
   identity, fixed lifetime, server-side expiry, future-issued clock bound,
   and session-ID shape. Browser `Max-Age` is no longer the expiry authority.
   Legacy two-part nonce cookies fail closed and require one owner re-login.
4. **Audit identity cannot come from an unsigned cookie.** New sessions clear
   the legacy `civica_admin_reviewer` cookie. It is never read. The audit actor
   comes from the signed payload only after it matches the current server
   identity. `ADMIN_DISPLAY_NAME` falls back to the configured
   `ADMIN_USERNAME`; if neither yields a valid identity, session minting and
   login configuration fail closed. There is no hardcoded `admin` identity.

The password login still performs the scrypt verification even when the
username is wrong, and the existing timing-safe password regression suite is
included in the focused admin test command. The Google callback now also fails
closed unless the shared admin session identity/signing configuration is
complete before minting the same v1 cookie.

## Changed implementation and tests

- `src/lib/admin/session.ts`
- `src/lib/admin/session.test.ts`
- `src/lib/admin/login-rate-limit.ts`
- `src/lib/admin/login-rate-limit.test.ts`
- `src/lib/api/rate-limit.ts`
- `src/lib/api/rate-limit.test.ts`
- `src/app/api/admin/session/route.ts`
- `src/app/api/admin/google/callback/route.ts`

## Credential-free verification

- `node --import tsx --test src/lib/admin/*.test.ts` — **31/31 pass**,
  including the five existing password-hash/timing-safe checks, redirect
  vectors, signed-session tampering/schema/identity/time boundaries, unique
  session IDs, durable-limiter delegation, proxy/IP bucketing, and route order.
- `node --import tsx --test src/lib/api/rate-limit.test.ts` — **2/2 pass**,
  including an injected durable-store outage that deterministically denies the
  admin policy and a regression proving the existing default fallback remains.
- `node --import tsx --test src/lib/api/__tests__/route-authorization.test.ts`
  — **12/12 pass**.
- `npm run validate:module-coverage` — **pass**, all eight registered modules;
  `admin-session` is 89.56% lines, 89.41% branches, and 87.10% functions against
  thresholds of 85%, 80%, and 70%.
- `npx tsc --noEmit` — **pass**.
- focused `npx eslint` over the eight changed TypeScript route/module/test files
  — **pass**.
- focused `npx prettier --check` and `git diff --check` — **pass**.

No login route was invoked and no database or external service was mutated.
No UI or URL changed, so browser validation was not necessary for this module
pass. If a release gate wants a credentialed end-to-end exercise, it remains a
manual staging check because both a real login attempt and its durable throttle
counter intentionally write state.

One broader route-inventory diagnostic is currently red for an unrelated
concurrent workspace addition: the filesystem has 101 routes rather than the
registry's expected 100, with `api/type-lab-font/[font]/route.ts` reported as a
phantom. The focused route-authorization suite above passes; PLT-027 did not
create or modify that route or the registry.
