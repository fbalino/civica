# DAT-019 — Clean-room reproduction fixture

## Outcome

DAT-019 is complete. `civica-clean-room-fixture/v2` provides three legally
shareable jurisdiction rows and three permitted frozen canonical rows that run
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
- Fixture SHA-256: `78d1bf5d5fa335aa98f8424f9387cb45b1d5bbc1158dff9d8686a3bd4a6f8113`.
- Canonical export SHA-256: `8ff633f5447f59b6771c7ae10b63b407df9af99aab632889967a073c6386e639`.
- Exact counts matched: 3 jurisdictions, 3 facts, 3 source-rights rows.
- 619/619 repository tests passed, including blocked-source and missing-join
  failure fixtures.
- Every build validator passed and the Next.js production build completed
  without `DATABASE_URL` or model credentials. Database-backed static content
  followed its documented soft-fail paths.
