# Serverless database operations

`civica-serverless-db-http/v1` defines how request-serving Civica code talks
to Neon PostgreSQL. It applies to `src/app` routes and `src/lib` query paths,
not to an operator's local migration or export tooling.

## Transport and connection model

- Civica uses Drizzle's Neon HTTP dialect and `createServerlessSql()` from
  `src/lib/db/index.ts`. The shared factory installs a 10-second timeout on
  every Neon HTTP request, while preserving caller cancellation.
- The application does not create a process-local database pool. A Neon HTTP
  query or non-interactive transaction is a one-shot request, which matches
  request-serving work. Interactive/session transactions require Neon
  WebSockets and are not permitted in Civica server routes.
- The driver transport makes exactly one request. It never automatically
  retries a failed read or an uncertain write. A timeout therefore reaches the
  caller as an unavailable dependency rather than silently expanding work.

## Read, write, and transaction semantics

| Need | Required pattern | Why |
| --- | --- | --- |
| One read or write | One bounded Drizzle/Neon statement | HTTP completion has a clear database result or an honest error. |
| Coupled mutation | One SQL statement, database function, or a non-interactive Neon `transaction([...])` batch | The database owns atomicity; do not split a logical write across independent HTTP requests. |
| Interactive/session work | Do not add it to server routes | It needs the WebSocket driver and an explicit design review. |
| Retry after an uncertain write | Do not retry at transport level | A lost response may follow a committed write. |
| Scheduled replay | Use `withCronJob()` only | Its durable execution key, idempotency key, lease fence, and terminal outcome decide whether a replay is safe. |

There are no `db.transaction()` calls in request-serving Civica source today.
Existing high-consequence writes (cron claims, rate limiting, and pipeline
publication) are already single statements or stored database functions. New
multi-step writers must preserve that property before they are exposed to a
retrying caller.

## Failure and cancellation contract

The shared fetch wrapper forwards an upstream cancellation signal and adds a
fresh 10-second timeout per request. It has no retry loop. This avoids a
client-side retry duplicating a mutation after a transient HTTP failure. Route
and cron code must handle the rejected promise with their existing safe
unavailable/error outcome; they must not inspect or publish raw database
errors.

The focused tests inject a stalled HTTP request, a transient transport error,
and caller cancellation. They prove timeout propagation, one-attempt behavior,
and cancellation forwarding without touching Neon.

## Primary-source verification

Verified 2026-07-18:

- [Neon serverless driver](https://neon.com/docs/serverless/serverless-driver): HTTP is for one-shot/non-interactive transactions; WebSockets are for session or interactive transactions; `fetchOptions` supports cancellation; HTTP request/response limit is 64 MB.
- [Neon serverless driver configuration](https://github.com/neondatabase/serverless/blob/main/CONFIG.md): the driver supports a global `fetchFunction`; its transaction API accepts only a query array or non-async query-builder function.

Run `npm run validate:serverless-db` after changing the shared database
factory, a serverless database client, request timeouts, retry behavior, or
transaction policy.
