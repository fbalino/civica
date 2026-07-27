# ATL-024 evidence — Atlas data-error intake preparation

Date: 2026-07-23

Contract: `civica-atlas-data-error-report/v1`

Status: agent preparation complete; production activation pending

## What is complete

- `/report-data-issue` defines a precise Atlas report for one ATL-019 entity,
  field path, affected release, source, observed value, proposed value,
  evidence URL, and explanation.
- The public mutation uses the existing distributed HMAC rate limiter, a hidden
  bot trap, strict HTTPS evidence/source URLs, bounded schemas, and the privacy
  notice `civica-data-error-report-notice/2026-07-23`.
- Successful submissions receive a stable opaque `CA-…` receipt in the browser;
  no email delivery is promised or required.
- `/admin/corrections` and `/admin/corrections/[id]` provide authenticated
  triage. Reviewer identity, status, disposition, internal notes, and optional
  PII redaction are retained through the audited admin-mutation boundary.
- A corrected resolution requires a linked ATL-020
  `atlas_entity_change_history` record. Rejected and no-change dispositions
  require a public reason.
- The privacy registry now declares collection, minimization, retention,
  redaction, provider, and manual-review boundaries for this flow.
- Footer, policy, sitemap, and the existing Index/Pulse correction page route
  readers to the Atlas-specific form.

## Why activation is pending

Authoritative migration `0047_atlas_data_error_reports` is additive, contains
22 statements and no destructive statement, and has SHA-256
`e36e87c298ac19a50e9a65c7438e51e33b1f849b424c796a3e362a893cd86dfc`.
It has not been applied to production because this run has no authority for a
production database mutation.

The public page checks schema readiness. Until all required columns exist it
renders a clear unavailable notice and no form; the API returns the stable
non-cacheable `ATLAS_REPORT_SCHEMA_PENDING` 503 before attempting a write.
This avoids accepting and losing a report.

The 2026-07-23 zero-write audit found one existing correction row, no invalid
status or resolution rows, no Atlas report rows, and `schemaReady: false`.
The migration plan found `correction_log` at one row,
`research_evidence_history` at 83,354 rows, and the ATL-020 history relation
absent. See `live-preflight.json`.

## Browser verification

System Chrome against the real Next.js app passed the current fail-closed state:

- HTTP 200, correct title/H1, schema-pending banner, and zero forms;
- a valid direct POST returned 503 `ATLAS_REPORT_SCHEMA_PENDING`;
- the footer route was present;
- desktop and 360 × 800 dark mode had no document-level horizontal overflow;
  and
- no page errors appeared. The only console error was the expected failed
  resource from the deliberate 503 API probe.

The inspected local image is
`output/playwright/atl-024-mobile-dark.png`.

## Verification

```text
npm run validate:atlas-data-error-reports
npm run audit:atlas-data-error-reports:live
npm run db:plan -- --id=0047_atlas_data_error_reports --live
npm run validate:authoritative-migrations
npm run validate:migrations
npm run validate:route-inventory
npm run validate:route-io-policy
npm run validate:rate-limit-policy
npm run validate:privacy-data-handling
npm run validate:design-tokens
npx tsc --noEmit
```

ATL-024 remains open until migrations 0046 and 0047 are applied through the
authorized production process and the active form, durable receipt, admin
triage, correction linkage, and delivery behavior are verified against the
stored production schema. No production write or external delivery is claimed.
