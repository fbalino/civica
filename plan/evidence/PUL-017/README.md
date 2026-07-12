# PUL-017 evidence

## Outcome

The independent Pulse coding application now has a dedicated role-gated workspace at `/admin/pulse-coding`. Coder A, coder B, adjudicator, and study administrator are separate roles. Coders receive only their frozen packet, codebook, evidence-assessment controls, and their own draft or locked submission. They never receive peer labels. An adjudicator receives both immutable raw submissions only after both have locked. Study administrators receive status while a study is active and may export label content only after closure and terminal treatment of every disagreement.

The database stores studies, frozen packets, participants, assignments, comparisons, adjudications, and an append-only audit log in seven dedicated tables. Authoritative migrations enforce role/slot separation, forbidden-field rejection, immutable locked submissions, append-only comparisons, separate adjudicator assignment, and immutable terminal adjudications. Participant access uses random one-time-issued codes whose hashes alone are retained and a separate narrow HttpOnly session cookie. A concurrent revocation or study closure wins over an in-flight login.

Exports contain frozen packets, both raw submissions, comparison axes, adjudications, versions, hashes, and substantive audit entries without credential hashes. Repeated exports of unchanged state have the same semantic hash; export-download audit entries and the request-time export timestamp do not alter it. Agent pilot records remain visibly `dry_run_not_gold` and cannot become gold data.

## Pilot and access checks

The live synthetic tool pilot contains 12 frozen answer-free packets, 24 locked dry-run coder submissions, 12 comparisons, and three preserved disagreement packets. Three synthetic disagreements remain unresolved for later qualified human adjudication. All temporary participant credentials were revoked after the run.

Browser checks exercised:

- coder sign-in, assignment queue, two-pane frozen-evidence/editor layout, evidence assessments, event creation, and category boundary disclosure;
- responsive single-column rendering at 390 by 844 pixels;
- adjudicator sign-in, comparison visibility only after both locks, side-by-side immutable raw submissions, terminal unresolved treatment, and audit-export access;
- revocation of every temporary browser-QA credential after the checks.

The pilot is a tooling and instruction diagnostic. It is not human reliability, accuracy, construct validity, or gold-label evidence.

## Verification

```sh
npm run validate:pulse-coding-workspace
npm run validate:pulse-coding-workspace:live
npm run validate:authoritative-migrations:live
npm run validate:design-tokens
npm run validate:data-dictionary
npm run build
```

The live authoritative ledger reports 23 of 23 migrations with schema fingerprint `ddd2543e3165a9e68a2289d43235796ec93bf537b7de6b82bd28f5cde3f69527`. The data dictionary covers 66 tables and 871 columns. All 823 unit tests, the claims/documentation gate, TypeScript, and the Next.js production build pass. The build retains the repository's pre-existing Turbopack file-tracing warning from `next.config.ts`; it does not affect PUL-017 routes or build success.
