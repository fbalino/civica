# ATL-024 evidence — Atlas data-error intake preparation

Date: 2026-07-29

Contract: `civica-atlas-data-error-report/v1`

Status: production intake active; real report, triage, and correction-link proof pending

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

## Production state

Authoritative migration `0047_atlas_data_error_reports` is additive, contains
22 statements and no destructive statement, and has SHA-256
`e36e87c298ac19a50e9a65c7438e51e33b1f849b424c796a3e362a893cd86dfc`.
It is now applied in production as part of the complete checked migration
history through `0051_eminent_jocasta`.

The guarded zero-write production audit in
`production-live-audit-2026-07-29.v1.json` confirms the schema is ready, the
migration head remained `0051` before and after, no invalid status or resolution
rows exist, and no Atlas report has been submitted. The one pre-existing
correction row is not an Atlas data-error report.

The public page returns HTTP 200 with the active form, exact fields, privacy and
consent boundaries, receipt wording, and the required footer route. A
read-only browser pass found that the shared `.sr-only` utility was missing, so
the bot-trap field was visibly rendered. The pre-fix production state is
retained in `production-active-form-pre-sr-only-fix-2026-07-29.jpg`. The fix
adds one canonical design-system utility, its design-system documentation, and
a regression test; it must be rechecked after the final production deployment.

## Browser verification

System Chrome against production verified the active intake without submitting
data:

- HTTP 200 with the intended report fields and privacy/consent copy;
- the footer route and on-screen receipt contract are present;
- no console error appeared; and
- no POST, admin mutation, report, receipt, or correction was fabricated.

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

ATL-024 remains open until a genuine independently supportable data issue
produces a real durable receipt, authenticated reviewer triage, and, if
confirmed, an ATL-020-linked correction. Even an invalid POST would mutate the
production rate-limit ledger, and a synthetic valid report would pollute the
retained correction ledger without proving a real correction. No production
submission, triage, correction, or external delivery is claimed.
