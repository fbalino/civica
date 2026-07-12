# PLT-027 — admin hardening (PARTIAL — task remains OPEN)

Status 2026-07-12: **2 of 4 gaps closed** (two real vulnerabilities fixed).
PLT-027 is **not** checked; the remaining two gaps are listed below.

## Fixed (this commit)
1. **Open redirect closed.** Admin `?redirect=` targets were validated with
   `raw.startsWith("/")`, which accepts scheme-relative `//evil.com` and
   backslash `/\evil.com` (browsers resolve both to an external origin). Added
   a single central validator `src/lib/admin/safe-redirect.ts`
   (`safeInternalPath` / `safeInternalPathOr`) that decodes once and rejects
   scheme-relative, backslash, encoded-authority, absolute-URL, scheme, and
   control-character targets. Applied to all five redirect sites: google
   start/callback, session POST, sign-in page, pulse-review exception.
   Covered by `safe-redirect.test.ts` (accepts real paths; rejects every
   vector).
2. **Audit-actor spoofing closed.** `getAdminSession()` derived the audit
   `reviewerId` from the **unsigned** `civica_admin_reviewer` cookie, which a
   client could edit to forge audit-row identity. It now derives the actor
   server-side from `adminReviewerName()` (env) for this single-owner account,
   ignoring the cookie.

Verification: `safe-redirect.test.ts` 3/3, `password.test.ts` 5/5, typecheck,
lint, and full production build all pass.

## Remaining (PLT-027 stays open)
3. **Signed session issued/expiry/sessionID verified server-side.** The session
   cookie is `<nonce>.<hmac>` — possession of a valid nonce+MAC proves auth, but
   there is no server-side expiry, issued-at, or session ID in the signed
   payload (expiry currently relies on client-controlled cookie Max-Age). The
   mint site (`buildAdminCookieHeaders`) and verify site (`getAdminSession`) are
   each single, so this is a contained but auth-critical format change
   (invalidates the current session → owner re-login) deferred to a focused pass.
4. **Durable login throttling.** The password login has no throttling; durable
   (cross-instance) throttling needs a durable store and overlaps PLT-011
   (replace process-local rate limiting). Do it with PLT-011's mechanism.
