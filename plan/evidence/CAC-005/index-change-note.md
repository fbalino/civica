# CAC-005 — Index presentation pages enter the static prose set

**Date:** 2026-08-17 · **Scope:** cache configuration only · **Plan:** `plan/caching-restoration-scope.md` (Option A)

Two protected Index presentation files changed in this record:

- `src/app/(reader)/civica-index/page.tsx`
- `src/app/(reader)/civica-index/methodology/pca-appendix/page.tsx`

The only change to each is the removal of its `export const revalidate = 0;`
declaration. No prose, markup, data source, score, method, weight, band, or
claim changed. The declarations became removable because CAC-003/CAC-004
replaced the root layout's per-request database reads (header search, footer
country list) with the checked `jurisdiction-directory/v1` artifact, so these
pages no longer reach the database driver through any import path. The
PLT-014 cache-consistency gate (`scripts/validate-cache-consistency.ts`,
unmodified) now classifies both pages as build-only surfaces: they render
checked/static content, are prerendered at deploy, and can be CDN-cached
without any live database value gaining staleness.

What a reader sees is unchanged. The pages' content already came from
checked artifacts and static prose; only the serving path (prerendered and
CDN-cacheable instead of per-request rendered) is different.
