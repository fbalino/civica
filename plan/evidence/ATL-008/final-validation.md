# ATL-008 final integrated validation

```text
npm test
  977 passed, 0 failed

npm run validate:index-change-control
  civica-index-atlas-election-research-v28
  snapshot: 1dbc6e7e0702ef4006794d7b81a3bcaeab390357286bad3072f7b44f10e7bc1d

npm run validate:g2-atlas
npm run reproduce:g2-atlas
npm run validate:atlas-review-packet
npm run validate:governance-evidence-review-packet
  passed after the rights-manifest refresh

npm run build
  977 tests passed inside the aggregate claims/documentation gate
  106/106 static pages generated
```

The final live corpus fingerprint is
`a9d59a25bdc1451f22c97e3fc7c968fbf6bd0cc7a8961ffcae32790b9a432e89`.
The build retains the pre-existing Turbopack whole-project tracing warning from
`next.config.ts`; ATL-008 introduced no additional build warning.
