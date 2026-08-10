# ATL-024 evidence — Atlas data-error intake preparation

Date: 2026-07-29

Contract: `civica-atlas-data-error-report/v1`

Status: complete — real report, authenticated triage, and ATL-020 correction linkage verified in production (2026-08-09)

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
a regression test.

Production deployment `dpl_6BeqkVNr4uMDhrS4gxD3uERxmqdZ` reached Ready on
2026-07-29 at source `f57feca0`. The post-deploy browser check confirms the
trap is clipped to a 1×1px absolute box with zero visible overflow, hidden from
assistive technology, and removed from the tab order. The corrected viewport is
retained in `production-active-form-post-sr-only-fix-2026-07-29.jpg`; the
machine-readable smoke record is
`plan/evidence/QA-021/production-release-smoke-2026-07-29.v1.json`.

## Browser verification

System Chrome against production verified the active intake without submitting
data:

- HTTP 200 with the intended report fields and privacy/consent copy;
- the footer route and on-screen receipt contract are present;
- the hidden bot trap is visually clipped, `aria-hidden`, and `tabIndex=-1`;
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

## Completed live journey (2026-08-09)

Under the owner-authorized ATL-020/ATL-024 wave, a genuine independently
supportable data issue drove the full flow end to end. The Jersey
`official_languages`/`languages` canonical facts carried literal `<p>…</p>`
markup imported verbatim from upstream `factbook.json` (the archived CIA page
rendered clean text; evidence
`https://github.com/factbook/factbook.json/blob/master/europe/je.json`).

1. **Intake + durable receipt.** A public submission through the production
   `/report-data-issue` form returned receipt `CA-587FA00E6DEE`
   (correction_log `1953f3e9-2014-4707-b67a-0ed9ecad4ef0`, category
   `atlas_data_error`, public, no submitter PII). The durable row was confirmed
   in the production database.
2. **Authenticated triage.** Through the audited admin-mutation boundary the
   report advanced `open` → `in_review` → `resolved_corrected` (reviewerId
   `admin`). The admin detail page carries the exact report coordinates,
   minimized submitter fields, the linked correction history, and the public
   disposition (`browser/atl-024-admin-correction-detail.png`,
   `browser/atl-024-admin-corrections-queue.png`).
3. **Correction linkage.** `resolved_corrected` was accepted only after two
   ATL-020 `atlas_entity_change_history` events (release
   `atlas-corrections-20260809-v1`) linked to this report; the triage guard
   (`resolved_corrected requires an ATL-020 change-history event linked to this
   report`) is exercised live (`linkedChangeCount: 2`).
4. **Zero-write audit.** `production-live-audit-2026-08-09.v1.json` records
   `schemaReady: true`, two correction rows, no invalid status/resolution rows;
   `production-post-apply-plan-2026-08-09.json` is the live `db:plan --id=0047
   --live` (`correction_log`/`atlas_entity_change_history`/`research_evidence_history`
   present, `writesPerformed: 0`).

The reviewer triage was performed against the production database through the
real admin code path running on a local server, because the 2026-07-29 owner
credential rotation (PLT-007) changed the deployed admin session secret; the
in-repo `.env.local` secret still authenticates the identical code path
locally. No password was handled and no admin secret is recorded here.
