# DAT-014 — Release data-quality gate

`npm run validate:release-quality` now collects the live release snapshot,
writes `data/release-quality-report.v1.json`, runs all nine required invariant
families, prints a repair instruction for every grouped anomaly, and exits
nonzero while any release blocker remains. The production build uses the
separate DB-free `npm run validate:release-quality-report` integrity check so a
checked failing report cannot be edited into a false pass.

The live audit corrected two validator assumptions before acceptance. Unit
aliases such as `persons`/`people` and `$`/`USD` are semantically equivalent,
and explicit fact-key bounds take precedence over generic percentage
fallbacks. Plausibility minima now cover the Atlas's real scope, including
Pitcairn, Cocos, Vatican City, Niue, and Tokelau.

## Final acceptance

- Nine of nine invariant families run from one strict live command.
- Twelve focused fixtures pass: a clean release, one actionable seeded failure
  per required family, source-age exemptions, and missing-category rejection.
- The checked live report passes identifier uniqueness, jurisdiction coverage,
  unit/vintage consistency, canonical uniqueness, required fields, row deltas,
  and source age.
- The strict live command correctly blocks release on one corrupted North Korea
  military-spending numeric parse and three grouped statement-subject orphan
  classes (29 jurisdiction statements, 351 legislature-party statements, and
  5,014 term statements). DAT-029 and DAT-028 already own those repairs.
- The report integrity gate, TypeScript, targeted ESLint, full unit suite,
  claims/documentation checks, and production build pass.
- No rendered UI changed; browser review is not applicable.
