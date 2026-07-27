# GOV-007 — advisory-board application operations and privacy

Completed 2026-07-12.

## Outcome

The advisory-board application is now a complete private recruitment flow governed by `civica-advisory-application-privacy/v1`.

- Copy matches the five expertise lanes and nonendorsement boundary in GOV-006.
- Shared client/server validation covers required fields, lengths, email, safe CV URLs, and versioned consent.
- The public endpoint caps request size, uses a durable hashed rate-limit bucket, silently accepts honeypot submissions, returns explicit validation/storage errors, and stores no applicant IP.
- The successful screen is the only automatic receipt. It promises no reply, appointment, assignment, or response date.
- The form and `/privacy#applications` publish the collected fields, purpose, access, Vercel/Neon processing, security, 18-month retention, early-deletion route, and response expectations.
- The protected admin detail page shows the deletion deadline and offers confirmed permanent deletion. Appointment and review records remain separate.
- The public roster continues to state that no members have been appointed.

## Verification

- `npm run validate:advisory-applications`
- `npm run validate:advisory-board-charter`
- `npm run validate:design-tokens`
- `npm run validate:data-dictionary`
- `npm run validate:claims-docs` (851 tests)
- `npx eslint ...`
- `npx tsc --noEmit`
- `node plan/tools/validate-master-plan.mjs`
- `npm run build`
- Live database: zero applications and zero application rows with stored IP addresses before and after API tests
- Local API: invalid submission `422`; honeypot `201` with no row; unauthenticated admin read `401`
- Local browser: required-field summary, one-error consent state, linked error descriptions, `/privacy#applications`, desktop light/dark, no horizontal overflow, zero console warnings/errors
