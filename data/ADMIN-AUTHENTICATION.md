# Owner-admin authentication and mutation security

**Contract:** `admin-authentication/v1`

**Reviewed:** 2026-07-14

**Scope:** the single-owner `/admin` session and owner-authorized mutation
routes. Pulse-coding participant credentials have a separate lifecycle.

## Authentication and identity

Password sign-in requires both the exact configured `ADMIN_USERNAME` and the
scrypt `ADMIN_PASSWORD_HASH`. Username comparison, cookie HMAC comparison, and
password verification use timing-safe primitives. The password KDF still runs
when the username is wrong, and the durable five-attempt/15-minute IP-bucket
limit runs before body parsing or the KDF.

Google sign-in is a second bootstrap path for the same owner identity. It
requires the short-lived state cookie, a valid provider response, a verified
email, and an exact `ADMIN_GOOGLE_EMAIL` match. It does not create a second role
or take reviewer identity from Google profile text.

The audit actor is the sanitized server-configured `ADMIN_DISPLAY_NAME`,
falling back to `ADMIN_USERNAME`. Only ASCII letters, digits, spaces, `_`, `.`,
and `-` survive; the value is trimmed and capped at 80 characters. Missing
identity or signing configuration fails closed.

## Cookie, expiry, and logout

The `civica_admin_session` cookie is `HttpOnly`, `SameSite=Lax`, `Path=/`, and
`Secure` in production. It contains a versioned signed envelope with reviewer
identity, issued-at, expiry, and a fresh 144-bit random session ID. The server
verifies the HMAC, exact payload shape, configured identity, fixed seven-day
lifetime, clock boundary, and expiry on every read. Browser `Max-Age` is not
the expiry authority.

Every otherwise-valid request also checks `admin_session_revocations`. Logout
stores a domain-separated SHA-256 digest of the random session ID before it
clears the browser cookie. The raw session ID and complete cookie are never
stored. A copied cookie is therefore denied after logout. Tombstones are
append-only, and a revocation-store failure returns `503` without clearing the
cookie or claiming success, so the operator can retry. Signing-secret rotation
is the global invalidation mechanism.

## CSRF and request provenance

Every unsafe owner-admin request (`POST`, `PUT`, `PATCH`, or `DELETE`) uses one
shared boundary before request-body parsing or business writes:

1. authorize the signed, unexpired, non-revoked cookie;
2. require `Sec-Fetch-Site: same-origin` when Fetch Metadata is present;
3. otherwise require an exact same-origin `Origin`, or an exact-origin
   `Referer` only when `Origin` is absent;
4. reject `same-site`, `cross-site`, `none`, opaque `null`, missing provenance,
   scheme/host/port mismatches, credentials in provenance URLs, contradictory
   headers, and malformed or unknown values with generic non-cacheable `403`.

The password and pulse-coding login forms use the same origin guard. The Google
callback is a top-level `GET` bootstrap protected by its one-time state cookie
and account allowlist. `SameSite=Lax` is defense in depth, not the CSRF control.
This policy follows the current
[OWASP CSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html),
[OWASP Session Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html),
and the [`Sec-Fetch-Site` contract](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Sec-Fetch-Site).

## Bearer behavior

Owner-admin routes have no bearer-token or API-key path. An `Authorization`
header is ignored and cannot substitute for the signed cookie. Cron bearer
authentication and pulse-coding participant sessions are separate controls and
must never be accepted by the owner-admin boundary.

## Common mutation audit

`admin_mutation_audit_log` is append-only and rejects truncation. Shared routes
write a bounded `attempt` before business work and normally a terminal
`outcome` afterwards. If that final insert is unavailable after the mutation
has already completed, the durable `attempted` result marks an interrupted
audit lifecycle; the route returns the real completed response instead of a
misleading retryable failure that could duplicate the action. Successful
password/Google issuance and logout require their terminal outcome before a
cookie is exposed or cleared. Each event records:

- request correlation ID, route template, and HTTP method;
- sanitized actor, actor source, and the same hashed session key used for
  revocation correlation;
- bounded action, target type, and target ID;
- event/result, HTTP status when terminal, optional closed reason code, and
  database event time.

Credentials, access/OAuth tokens, raw session IDs, cookies, request bodies, IP
addresses, and unbounded exception text are prohibited. Existing domain logs
for disputes, Pulse review/SLA, and coding decisions remain authoritative for
their richer before/after evidence; the common ledger supplies consistent
security correlation and failure/denial visibility.

The historical boundary starts at authoritative migration
`0033_flat_hardball`. No prior login, logout, denial, or mutation event is
backfilled. Rolling application code back to a version that does not consult
revocation tombstones requires rotating `ADMIN_SESSION_SECRET`, or copied
logged-out cookies could become valid again.
