/**
 * Fallback for the (shell) group's implicit `children` slot.
 *
 * Option B (Phase 2) moved every (shell) route out — the Civica Index to
 * (reader)/civica-index (Phase 1) and the Atlas + organizations to
 * (reader)/atlas + (reader)/organizations (Phase 2). The group now has no
 * `page.tsx`, only `layout.tsx` + the @left/@right parallel-slot defaults.
 *
 * Per the Next.js parallel-routes docs, a layout with parallel slots needs a
 * `default.tsx` for the implicit `children` slot too; without it, Next.js
 * can't resolve the unmatched `children` slot on a hard load and reports a
 * "two parallel pages resolve to the same path" conflict against the new
 * (reader) routes. This file supplies that fallback.
 *
 * The whole (shell) group (this file, layout.tsx, @left, @right, and the
 * shell components) is slated for deletion in Phase 3.
 */
export default function ShellDefault() {
  return null;
}
