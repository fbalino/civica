# EXP-036 — Record/article metadata & image rendering

Completed 2026-07-12. Social images match the resolved page cover, article and
index expose exactly one main landmark, and inline figures declare their real
dimensions (no layout shift) within a byte budget.

## Done-when → what shipped
- **OG/social image = the resolved page cover** — `generateMetadata` in
  `src/app/blog/[slug]/page.tsx` previously used the raw frontmatter
  `coverImage` (usually null), so the og:image was frequently missing even when
  the page rendered a resolved engraving. New `resolveBlogSocialImage(post)`
  (`src/lib/blog.ts`) wraps `resolvePostCover` (dedicated cover → first
  placeholder engraving → frontmatter) and returns an absolute URL + alt. SSR
  now emits `og:image =
  https://civicaatlas.org/blog/backsliding-without-tanks/cover.webp`.
- **One main landmark** — the root layout already provides the page `<main>`.
  Both the blog index (`src/app/blog/page.tsx`) and article
  (`src/app/blog/[slug]/page.tsx`) had a nested second `<main>`; both are now
  `<div>`. SSR shows exactly one `<main>` on each.
- **Inline images: stable dimensions / responsive sizes / alt** — the inline
  figure is now `next/image` with the image's REAL intrinsic dimensions read
  from disk (`readBlogImageDimensions`, a WebP/PNG header parser) — important
  because the engravings are NOT all 16:9 (four are 1600×2400/2000 portrait), so
  a hardcoded ratio would have distorted them and reintroduced CLS. Responsive
  `sizes`, lazy loading, and `alt=""` (the figcaption carries the description).
- **Byte budgets** — `src/lib/illustrations/blog-media-validation.ts` +
  `validate:blog-media` (wired into `build`): every blog image must be WebP with
  readable dimensions under a 1 MiB source ceiling. `next/image` serves
  optimized, resized derivatives at render time, so the ceiling guards the
  original asset, not the rendered payload. 57 files scanned — PASS.

## Verification
- `node --import tsx --test src/lib/blog.test.ts
  src/lib/illustrations/blog-media-validation.test.ts` → 9/9 pass.
- `npm run validate:blog-media` → 57 files, PASS.
- `npm run test:e2e -- e2e/blog-metadata.spec.ts` → 4/4 pass (one main landmark
  on index + article, og:image = resolved cover, inline figures carry
  width/height).
- `npx tsc --noEmit` clean for these files; `npm run validate:design-tokens`
  passes (no new drift).
- SSR spot-check: og:image resolved cover present; exactly one `<main>` on
  `/blog` and `/blog/<slug>`.

## Note
`alt=""` on the inline figure also satisfies EXP-023's blog-figure alt item
(figcaption carries the description). Remaining EXP-023 alt-policy work (flags,
portraits, the ~19 CountryFlag sites, the validator) is separate.
