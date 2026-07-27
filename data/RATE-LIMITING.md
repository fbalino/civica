# Rate limiting and request protection

**Contract:** `rate-limiting/v1`

**Reviewed:** 2026-07-14

**Owner:** Fernando Baliño

This document explains the production request-protection architecture and the
operator response when one of its layers is unavailable. The machine-readable
route and budget contract remains `src/lib/api/rate-limit-policy.ts`.

> Production must have `RATE_LIMIT_KEY_SECRET` set before deployment. It must
> be at least 32 bytes, must be different from `ADMIN_SESSION_SECRET`, and must
> not be a provider credential. Generate a suitable value with
> `openssl rand -hex 32`. A missing or short production value makes protected
> requests fail closed with `503`; it never enables an in-memory fallback.

## Architecture as of 2026-07-14

Civica has two complementary traffic layers:

1. **The Vercel Firewall is the broad edge layer.** One verified all-path rule
   limits obvious floods, including requests for static release files and the
   retired embed that an application function cannot reliably count after CDN
   caching.
2. **Neon/PostgreSQL is the exact application layer.** Dynamic public reads,
   exports, paid chat, forms, and credential bootstraps use one shared database
   counter. The same budget follows a validated client identity across function
   instances and application regions.

Established admin and Pulse sessions and authenticated cron jobs use their own
authorization, provenance, and concurrency controls. Four bounded public reads
do no request-time database or upstream work and are explicitly exempt from the
application counter.

The layers answer different questions. The WAF asks, “is this source flooding
the site broadly?” The database counter asks, “has this exact protected budget
been spent across all application instances?” Neither layer should be removed
because the other exists.

## Trusted client identity

On Vercel, the resolver checks these headers in order:

1. `x-vercel-forwarded-for`
2. `x-forwarded-for`
3. `x-real-ip`

Vercel documents `x-forwarded-for` as the public client IP and says that it
overwrites an inbound value to prevent spoofing. It documents
`x-vercel-forwarded-for` and `x-real-ip` as equivalent values, with the Vercel
variant preserved when a proxy on top of Vercel rewrites ordinary
`x-forwarded-for`. See Vercel's current
[request-header documentation](https://vercel.com/docs/headers/request-headers).
An external proxy in front of Vercel needs Vercel's Enterprise Trusted Proxy
configuration; without that configuration, do not invent a client address by
parsing the proxy's chain.

The resolver accepts exactly one real IPv4 or IPv6 address. It canonicalizes
equivalent IPv6 text and rejects comma-separated chains, malformed addresses,
zone IDs, brackets, and host/port values. It never selects a client-chosen
leftmost or rightmost hop. A malformed higher-priority header does not fall
through to a weaker value.

Missing or invalid identity resolves to the single literal `unknown`. This is a
fail-closed bucket: all requests without a valid trusted address share one
budget instead of receiving a fresh bucket. Non-Vercel production deployments
also use `unknown` until their proxy trust boundary is explicitly implemented.
Local and test requests may supply one valid `x-forwarded-for` or `x-real-ip`
value for deterministic tests.

## Opaque counter keys

The validated address is transformed before any database call. Civica derives
a domain-separated HMAC-SHA-256 digest from:

```text
civica-rate-limit-subject/v1 + policy scope + canonical client address
```

`RATE_LIMIT_KEY_SECRET` is the independent HMAC key. The database receives only
the lowercase 64-character digest. Counter keys contain the policy scope, that
digest, and the fixed-window start. They never contain the raw address.

Do not reuse `ADMIN_SESSION_SECRET`: rotating the admin session key should sign
out the owner without resetting public traffic budgets, and rotating the
rate-limit key should reset traffic identities without changing authentication.
Do not log the raw address while debugging this system.

## Atomic PostgreSQL counter

Each request executes one SQL statement through the Neon serverless driver:

1. The statement first deletes expired counter rows through the indexed
   `expires_at` column, including legacy rows from the retired raw-IP key
   format.
2. PostgreSQL's `statement_timestamp()` chooses the current fixed window. The
   database clock, not a function instance's clock, is authoritative.
3. One `INSERT ... ON CONFLICT DO UPDATE ... RETURNING` creates or increments
   the row identified by scope, opaque subject, and window start.
4. The counter saturates at `limit + 1`, which is enough to distinguish allowed
   from limited without allowing unbounded integer growth.
5. The same statement returns the committed count and the remaining interval
   calculated from the database clock.

PostgreSQL documents that `ON CONFLICT DO UPDATE` guarantees an atomic insert or
update outcome even under high concurrency; `RETURNING` reports the row that
was actually inserted or updated. See the current PostgreSQL
[`INSERT` reference](https://www.postgresql.org/docs/current/sql-insert.html)
and its explanation of
[transaction atomicity](https://www.postgresql.org/docs/current/tutorial-transactions.html).
This avoids the lost-update race of reading a count and updating it in separate
application operations.

The [Neon serverless-driver documentation](https://neon.com/docs/serverless/serverless-driver)
describes HTTP as a fit for one-shot queries and non-interactive transactions.
Civica's increment is one statement, so it does not need a stateful database
session. The driver documentation does not promise exactly-once delivery after
an ambiguous network timeout. Do not add a blind application retry around the
increment: if the first statement committed before the timeout, a retry could
count the same request twice.

## Durable policy budgets

All budgets below are fixed windows per opaque validated-client identity. A
scope is shared by every route named for that policy, so a caller does not get a
separate allowance merely by switching between sibling endpoints.

| Policy                       |                    Budget | Main coverage                                                                    |
| ---------------------------- | ------------------------: | -------------------------------------------------------------------------------- |
| `public-dynamic-read`        |  60 requests / 60 seconds | Dynamic non-v1 public database reads                                             |
| `public-api-v1`              |  60 requests / 60 seconds | All `/api/v1/*` GET routes; their OPTIONS handlers are not counted               |
| `constitution-search`        |  30 requests / 60 seconds | Constitution full-text search                                                    |
| `public-dynamic-export`      |  30 requests / 60 seconds | Country research export, indicator history, and Governance Evidence export       |
| `chat-burst`                 |  15 requests / 60 seconds | Short Ask Civica paid-model budget                                               |
| `chat-sustained`             | 100 requests / 60 minutes | Sustained Ask Civica paid-model budget; both chat budgets must allow the request |
| `contact-form`               |   5 requests / 10 minutes | Public contact intake                                                            |
| `correction-form`            |   5 requests / 10 minutes | Civica Index correction intake                                                   |
| `advisory-application-form`  |   5 requests / 30 minutes | Advisory application intake                                                      |
| `admin-credential-bootstrap` |   5 requests / 15 minutes | Owner password sign-in before body parsing and password KDF work                 |
| `admin-oauth-bootstrap`      |  10 requests / 15 minutes | Owner Google OAuth start and callback bootstrap                                  |
| `pulse-credential-bootstrap` |   5 requests / 15 minutes | Pulse coding access-code sign-in                                                 |

## Response contract

- **Budget spent — `429`:** the response code is `RATE_LIMITED`. It includes
  `Cache-Control: no-store`, `Retry-After`, `X-RateLimit-Limit`, and
  `X-RateLimit-Remaining: 0`.
- **Counter or identity protection unavailable — `503`:** the response code is
  `RATE_LIMIT_UNAVAILABLE`. This covers a Neon/PostgreSQL failure and a missing,
  invalid, or unusable production HMAC key. It includes `Cache-Control:
no-store`, `Retry-After: 5`, and the same limit/remaining headers.

Routes may add their normal CORS or deprecation headers, but they return the
shared 429/503 body and do not continue to parsing, database reads, writes, or
paid provider work. A protection outage is not reported as 429 because the
client did not necessarily spend its budget. It is not allowed through because
that would silently turn a shared budget into no budget.

## Verified Vercel Firewall layer

The checked live configuration is
`plan/evidence/PLT-011/vercel-firewall-live.json`, captured on 2026-07-14. It
records one active and valid rule:

- name: `global-rate-limit`;
- match: path starts with `/` (all paths);
- algorithm: fixed window;
- key: IP;
- budget: 600 requests per 60 seconds;
- exceeded action: Challenge;
- pending draft changes: zero.

This is broad flood protection for the whole deployment, including static
release downloads and the retired embed. It is not the exact paid-chat,
credential, form, or dynamic-export budget. Vercel's current
[WAF rate-limiting documentation](https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting)
states that counters are regional: the same key reaching multiple regions can
exceed the configured value for any one region. It also documents Challenge as
an available exceeded action. For that reason, the WAF cannot replace the
globally shared Neon counter.

The active rule has no HTTP-method condition, so it may count OPTIONS even
though Civica's application policies do not. Its challenge response is a
platform response; do not promise the application's JSON body or `Retry-After`
contract for a WAF challenge.

## Authenticated, cron, and bounded dispositions

### Established admin and Pulse sessions

Anonymous IP budgets protect credential bootstrap, not every request made after
authentication.

- Owner-admin mutations, including Pulse participant administration, use the
  signed non-revoked admin session, the exact same-origin mutation guard, and
  the common append-only admin audit lifecycle. Authenticated admin reads use
  the owner session; a mutation audit is not applicable to a read.
- Pulse participant writes require an established coding session plus their
  role/study checks. The rate-limit registry deliberately records their common
  admin-audit disposition as `not-declared`; it does not pretend the owner audit
  boundary covers those domain writes. Pulse sign-in uses the exact-origin
  guard and durable credential-bootstrap budget. Sign-out only clears the
  browser cookie, stays available during a counter outage, and is covered by
  the exact-origin guard plus the verified all-path WAF ceiling.

See [`data/ADMIN-AUTHENTICATION.md`](./ADMIN-AUTHENTICATION.md) for the complete
owner boundary.

### Cron

Every `/api/cron/*` GET or POST uses the `CRON_SECRET` bearer plus
`withCronJob()`. That wrapper supplies stable idempotency, a job-wide database
lease, fenced retries, and terminal outcome recording. Cron is not an anonymous
public budget. See [`data/CRON-OPERATIONS.md`](./CRON-OPERATIONS.md).

### Four bounded public-read exemptions

These GET routes do zero request-time database queries and zero upstream calls:

| Route                       | Bound                      |
| --------------------------- | -------------------------- |
| `/api/provenance-coverage`  | Checked static artifact    |
| `/api/reconciliation-audit` | Checked static artifact    |
| `/api/rights-manifest`      | In-process static manifest |
| `/api/source-coverage`      | Checked static artifact    |

They remain under the all-path WAF rule. Every `/api/v1/*` OPTIONS handler and
the contact-form OPTIONS handler return fixed preflight metadata without domain
work and are exempt from the application database counter.

## Cleanup and retention

Each counter row has an `expires_at` equal to its window end. Every increment
statement deletes rows whose expiry is at or before the database clock before
it writes the current window. Cleanup and increment are one database operation:
if either part fails, the protected request receives the fail-closed `503` and
does not continue.

This makes expiry exact for enforcement and removes expired rows
deterministically on the next protected request. The table stores only scope,
HMAC digest, window start, bounded count, and expiry; it stores no raw address.
Normal database backups can retain those opaque rows according to the database
backup policy.

Operators may inspect stale-row volume without reading request identities:

```sql
SELECT
  count(*) AS total_rows,
  count(*) FILTER (WHERE expires_at <= statement_timestamp()) AS expired_rows
FROM rate_limits;
```

If an outage prevented cleanup, this is the same safe operation the application
performs:

```sql
DELETE FROM rate_limits
WHERE expires_at <= statement_timestamp();
```

Do not export the table as analytics, join it to user data, or treat the digest
as a durable person identifier.

## Secret rotation

Rotate `RATE_LIMIT_KEY_SECRET` if it may have leaked, as part of scheduled
secret hygiene, or when changing the key-owning operational boundary:

1. Generate a new independent value with `openssl rand -hex 32`.
2. Set it in the Vercel production environment and every production-like
   environment that exercises shared counters.
3. Redeploy all application instances. Environment changes do not update an
   already-running deployment.
4. Verify protected routes no longer return `RATE_LIMIT_UNAVAILABLE`.
5. Verify old counter rows expire and cleanup removes them. Do not delete live
   rows merely to make the table look empty.

Rotation deliberately creates new opaque subjects, so every client receives a
fresh application budget. Rotate during a quiet window when possible and keep
the WAF active. Do not roll back to a deployment configured with a compromised
old key.

## Counter-outage response

If protected routes begin returning `503` with code
`RATE_LIMIT_UNAVAILABLE`:

1. **Confirm scope.** Check whether all protected routes fail or only one
   deployment/region. Confirm `RATE_LIMIT_KEY_SECRET` is present and at least
   32 bytes without printing it.
2. **Check Neon.** Review Neon availability, connection limits, and the
   `DATABASE_URL` configuration. Do not replace the shared check with the
   process-local legacy limiter and do not bypass it on paid/auth/form routes.
3. **Contain.** Keep the WAF rule active. If the outage is sustained, mark the
   affected dynamic APIs/forms unavailable on the status page rather than
   claiming a client quota was spent.
4. **Correct.** Restore the environment value or database path, redeploy when
   configuration changed, and let the normal request path resume. Avoid blind
   increment retries after ambiguous network timeouts.
5. **Verify.** A normal request succeeds, a controlled exhausted budget returns
   429, and a deliberately unavailable counter in an isolated preview returns 503. Preserve bounded timestamps, deployment IDs, and error categories; do
   not preserve raw IPs or secrets.

## Post-deploy checks

Use an isolated preview with production-like environment variables and a test
database for destructive or high-volume checks. Routine production smoke tests
must not intentionally trigger the 600-request WAF challenge.

### 1. Configuration

- Confirm `RATE_LIMIT_KEY_SECRET` is set before deployment, is at least 32
  bytes, and differs from `ADMIN_SESSION_SECRET`.
- Run `npm run validate:env -- --context=production` and
  `npm run validate:rate-limit-policy`.
- Inspect the Vercel firewall evidence commands and confirm the active rule is
  still valid, all-path, 600/60 seconds/IP, Challenge, with no unpublished
  draft. Update the checked evidence if live state changes.

### 2. Header spoof test

- From one controlled client, make otherwise identical requests while trying
  to supply different ordinary `X-Forwarded-For` values and a comma-separated
  chain. Vercel should overwrite the ordinary header as documented.
- Confirm the requests increment one opaque subject/window row, not one row per
  forged value. Confirm no raw attempted or actual address appears in the key.
- Run the focused resolver tests for malformed, chained, zone-ID, host/port,
  IPv4, and equivalent IPv6 inputs. If a new proxy is added in front of Vercel,
  stop and document its Trusted Proxy configuration before accepting it.

### 3. Multi-instance atomicity test

- In the isolated environment, issue concurrent requests from one client so
  multiple cold/warm function invocations contend on the same budget. Use
  Vercel request/deployment identifiers only as execution evidence; do not use
  them as the budget key.
- Confirm the first `limit` decisions are allowed, the next decision is 429,
  and the PostgreSQL row is capped at `limit + 1`.
- Repeat through two independent application/store clients. This verifies that
  the result is shared rather than process-local and that application clock
  skew does not create a second window.

### 4. Failure and recovery test

- In an isolated preview, temporarily point the rate-limit path at an
  unavailable test database or remove the preview HMAC key. Confirm protected
  work does not run and the response is 503, not 200 or 429.
- Restore the configuration and confirm the next request uses the shared
  counter normally.
- In the Firewall dashboard, confirm challenge events are visible for the
  verified rule. Vercel documents the WAF counter as regional, so do not infer
  a globally exact total from that dashboard.

## Current official references

These external semantics were rechecked on 2026-07-14:

- [Vercel request headers](https://vercel.com/docs/headers/request-headers)
- [Vercel WAF rate limiting](https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting)
- [PostgreSQL `INSERT`](https://www.postgresql.org/docs/current/sql-insert.html)
- [PostgreSQL transactions](https://www.postgresql.org/docs/current/tutorial-transactions.html)
- [Neon serverless driver](https://neon.com/docs/serverless/serverless-driver)
