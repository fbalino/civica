# PLT-012 deployment and rollback plan

## Before deployment

1. Run the closed route-I/O validator, its exact DB-free negative-test manifest, Index change control, the complete unit suite, and the production build against the exact release commit.
2. Confirm the route inventory and route-I/O registry report the same route files and method tuples with no missing, phantom, stale, or duplicate entries.
3. Confirm the clean release diff excludes owner-controlled image trials and typography-lab files.

## Deployment

Deploy the application through the normal release path. PLT-012 adds no relation, migration, environment variable, source capture, or research-data rewrite. Existing clients may continue reading human-readable `error`; new clients can use the additive stable `code` discriminator.

## After deployment

Smoke-test one healthy public JSON endpoint and malformed query/path requests. Confirm healthy responses retain their documented headers, malformed requests return the fixed noncacheable problem shape, and server logs retain diagnostic detail without reflecting it to the caller.

## Rollback

Do not restore raw request readers, response spreads over database rows, unsanitized HTML, arbitrary URL fetching, spreadsheet-active text, or raw exception messages. If an application rollback changes a protected Index route contract, append a new presentation change record that describes the compatibility effect; never edit or delete the v31 record.
