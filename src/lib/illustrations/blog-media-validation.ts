/**
 * EXP-036 — blog media contract. Pure validation (no fs) so it is unit-testable
 * with fixtures; `scripts/validate-blog-media.ts` supplies the real file data.
 *
 * Every blog illustration must:
 *   - be WebP (the Record art pipeline output),
 *   - have readable intrinsic dimensions (so the inline `next/image` figure can
 *     reserve exact space and avoid layout shift), and
 *   - stay under the source byte ceiling. `next/image` serves optimized,
 *     resized derivatives at render time, so this ceiling guards the ORIGINAL
 *     asset against a pathologically large upload, not the rendered payload.
 */

export interface BlogMediaFile {
  /** Repo-relative path, e.g. `public/blog/<slug>/<file>.webp`. */
  path: string;
  /** Lowercase extension without the dot, e.g. `webp`. */
  format: string;
  width: number | null;
  height: number | null;
  byteSize: number;
  isCover: boolean;
}

export type BlogMediaViolationKind =
  | "format"
  | "unreadable-dimensions"
  | "over-budget";

export interface BlogMediaViolation {
  path: string;
  kind: BlogMediaViolationKind;
  detail: string;
}

/** Source-file byte ceiling (1 MiB). */
export const BLOG_MEDIA_BYTE_BUDGET = 1_048_576;

export function validateBlogMedia(
  files: BlogMediaFile[],
): BlogMediaViolation[] {
  const violations: BlogMediaViolation[] = [];
  for (const f of files) {
    if (f.format !== "webp") {
      violations.push({
        path: f.path,
        kind: "format",
        detail: `expected webp, got ${f.format || "(none)"}`,
      });
    }
    if (
      f.width == null ||
      f.height == null ||
      f.width <= 0 ||
      f.height <= 0
    ) {
      violations.push({
        path: f.path,
        kind: "unreadable-dimensions",
        detail:
          "could not read intrinsic dimensions; the inline figure cannot reserve exact space",
      });
    }
    if (f.byteSize > BLOG_MEDIA_BYTE_BUDGET) {
      violations.push({
        path: f.path,
        kind: "over-budget",
        detail: `${Math.round(f.byteSize / 1024)}KB > ${Math.round(
          BLOG_MEDIA_BYTE_BUDGET / 1024,
        )}KB source ceiling`,
      });
    }
  }
  return violations;
}
