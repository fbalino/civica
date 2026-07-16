# PLT-014 current-source review

Reviewed on 2026-07-14 before choosing the cache, transaction, and publication
contracts.

## Next.js 16.2

- [Caching and revalidation](https://nextjs.org/docs/app/getting-started/caching-and-revalidating)
- [Route Handlers](https://nextjs.org/docs/app/getting-started/route-handlers)
- Bundled installed documentation under `node_modules/next/dist/docs/`

The selected rule is intentionally conservative. Mutable database-backed
reader pages use an effective literal `revalidate = 0`; mutable route responses
use explicit `no-store` policies. Checked build artifacts can be cached only
with mandatory revalidation, and frozen releases only at immutable,
version-addressed URLs. No mutable surface opts into stale-on-error behavior.

## Drizzle ORM

- [Transactions](https://orm.drizzle.team/docs/transactions)

Index pointer publication and Pulse scoring are one database transaction: all
release rows and invariants are checked before the pointer can move. The
application never writes a success pointer in a later independent statement.

## Neon serverless driver

- [Neon serverless driver](https://neon.com/docs/serverless/serverless-driver)

The HTTP driver supports a non-interactive transaction containing a fixed set
of statements. Pulse scoring therefore constructs one bounded atomic batch.
Database-side publication functions and triggers enforce the same invariants
at the final write boundary rather than relying on application ordering alone.

## PostgreSQL

- [CREATE TRIGGER](https://www.postgresql.org/docs/current/sql-createtrigger.html)
- [Transaction isolation](https://www.postgresql.org/docs/current/transaction-iso.html)

Migration `0036` uses constraints, validation functions, locks, and triggers to
prevent published header/row mutation, invalid pointer movement, partial Pulse
panels, and pointer deletion. The full authoritative chain is tested on a clean
local PostgreSQL 17 database before the checked fingerprint is accepted.
