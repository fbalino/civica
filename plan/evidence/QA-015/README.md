# QA-015 — link, anchor, canonical, sitemap, asset, redirect integrity

Completed 2026-07-12.

## Coverage (composed with existing validators)
- **Canonical / sitemap / robots / OG:** `npm run validate:metadata` (DB-free
  build guard) and `crawl:metadata` — one canonical per route, no stale-preview
  canonical, stable sitemap dates, valid dataset metadata (CLM-013). Already in
  the build.
- **Internal routes / anchors / content links:** `validate:doc-sources` and
  `validate:doc-references` — registered routes and `## Heading {#anchor}` ids
  resolve; documented commands and file pointers exist.
- **The three remaining gaps** are added here as `src/lib/qa/link-asset-integrity.test.ts`:

## New guards (3 tests, all pass)
1. **Required footer links survive** — asserts `SiteFooter.tsx` still carries the
   AGENTS-invariant links: Blog, API Docs, Design System, Status Page (external),
   Licensing, Contact, GitHub (external). A refactor that drops one fails.
2. **Local asset references resolve with exact case** — scans every literal
   `/engravings|blog|images|flags|assets|fonts|icons/…\.(webp|png|svg|…)`
   reference across `src/app` and `src/components`, and fails if the file is
   missing from `public/` **or** the case differs from the real dirent (a
   case-mismatch that works on macOS but 404s on Linux/Vercel). Currently clean.
3. **Redirects do not chain** — asserts no redirect destination path is itself a
   literal redirect source (no 308→308 multi-hop). Currently clean across the
   34 redirects.

## Verification
- 3/3 tests pass; part of the `npm test` suite (CI unit-tests child); lint clean.
- The asset guard checked a non-zero set of references (it asserts it found some,
  so it cannot false-pass on an empty scan).
