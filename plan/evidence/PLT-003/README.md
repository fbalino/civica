# PLT-003 — resolve the Turbopack full-project tracing warning

Completed 2026-07-12.

## Root cause
`src/components/content/MarkdownContent.tsx` read reader-page prose with
`fs.readFile(path.resolve(process.cwd(), file))` over a caller-supplied path.
Because the read target was not statically scoped, Turbopack's file-tracer
could not bound it and traced the **whole project** into every page that
renders markdown (`/about`, `/policies`, and the methodology pages). The build
emitted:

> A file was traced that indicates that the whole project was traced
> unintentionally … Import trace: MarkdownContent.tsx ← about/page.tsx

## Fix
- The disk read is now inline-scoped to `content/**`:
  `fs.readFile(path.join(process.cwd(), "content", rel))`, matching Turbopack's
  own remediation guidance (static prefix, only the leaf dynamic). The `content`
  literal is kept inline (not hoisted to a variable) so the tracer statically
  bounds it.
- A new exported `contentRelative(file)` normalizes the caller path to its
  segment within `content/` and throws on any `../`, absolute, or empty path —
  fencing the read against directory traversal as well.
- All 9 callers already pass `content/<name>.md`, so behavior is unchanged.

## Guard (regression)
`src/components/content/markdown-content-path.test.ts` — 4 tests: prefix
stripping, bare relative names, parent-directory traversal rejection, and
absolute/empty rejection. This is the documented invariant that keeps the read
scoped.

## Verification (2026-07-12)
- `npm run build`: **no** "whole project was traced" warning and **zero**
  Turbopack warnings (previously 1); 107/107 static pages generated.
- The static generation of `/about` (and other markdown pages) proves the
  scoped read works at build time.
- Browser: `/about` renders its markdown prose intact (82 paragraphs,
  ~15.7K chars).
- 4 path-guard tests pass; `npx tsc --noEmit` clean; `validate:lint` clean.
