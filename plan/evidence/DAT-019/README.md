# DAT-019 — Clean-room reproduction fixture

## Outcome

DAT-019 is complete. `civica-clean-room-fixture/v1` provides three legally
shareable jurisdiction rows and three permitted source observations that run
through the production Atlas export builder. The public runbook records the
requirements, exclusions, commands, expected checksums, counts, and exact-byte
tolerance.

The fixture proves the portability of the released export and validation
tooling. It does not claim to reconstruct uncaptured production source inputs.

## Verification

- A new `/tmp/civica-dat019.ScTm5r` checkout copy excluded `.git`, `.env.local`,
  `node_modules`, `.next`, `.turbo`, and `.cache`; it retained the tracked
  `.env.example` documentation contract, as a public clone does.
- `npm ci` installed 631 packages solely from the checked lockfile.
- `npm run reproduce:clean-room -- --strict-clean` used no database or model
  credentials and made no runtime network requests.
- Fixture SHA-256: `6813f95a781776d81b5235cc32b4c96d064fd0ccd9034e4fbe757b0e89125f0f`.
- Canonical export SHA-256: `15a4fa61c5818d87941bc3a13de831548ad1e94c6fe626e4b00b573aae17c622`.
- Exact counts matched: 3 jurisdictions, 3 facts, 3 source-rights rows.
- 619/619 repository tests passed, including blocked-source and missing-join
  failure fixtures.
- Every build validator passed and the Next.js production build completed
  without `DATABASE_URL` or model credentials. Database-backed static content
  followed its documented soft-fail paths.
