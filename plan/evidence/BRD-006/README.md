# BRD-006 — reversible brand/domain migration plan

**Status:** Complete as a dormant implementation plan
**Date:** 2026-07-23

## Deliverables

- `plan/BRD-006-reversible-brand-domain-migration-plan-2026-07-23.md`
  inventories code, database, email, domains, redirects, canonicals,
  DOI/citations, package/repository, social identity, assets, legal pages,
  search, status, API/embed compatibility, deprecation, rollback, and the
  equally explicit zero-change path.
- `brand-migration-inventory.v1.json` records the dated string/surface
  snapshot, the five identity classes, current anchors, and external-authority
  boundaries.

## Key safety decisions

- The plan contains placeholders only. It does not generate a candidate name
  or authorize acquisition, filing, contact, deployment, or account changes.
- Frozen releases, citations, DOI deposits, filenames, schema versions,
  checksums, and historical publisher strings remain immutable.
- Database functions/tables, cookies/storage keys, API schemas, and other
  stable technical namespaces do not change during a public-brand cutover.
- Old HTML routes preserve path/query; APIs remain served during a declared
  compatibility window; frozen downloads keep resolving to exact bytes.
- The old domain and email are retained for at least 36 months, with a target
  of indefinite resolution where citations/releases depend on them.
- Rollback restores the old deployment/canonical without a database restore.

## Verification

```text
node -e "JSON.parse(require('fs').readFileSync(
  'plan/evidence/BRD-006/brand-migration-inventory.v1.json','utf8'))"
exit 0

node plan/tools/validate-master-plan.mjs
ok=true

git diff --check
exit 0
```

## Remaining authority

- BRD-003: counsel review and owner disposition.
- BRD-005: candidate generation/screening only if that disposition warrants
  it.
- Platform/owner authority: domains, DNS, email, OAuth, Vercel, status,
  repository, social, DOI, and production changes.
- BRD-016: final G6 memo after the name decision and all other legal gates.
