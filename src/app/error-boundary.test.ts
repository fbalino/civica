import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/** Recursively list files under `dir` whose name ends with one of `exts`.
 *  Replaces `fs.globSync` (absent from the pinned @types/node). Paths are
 *  returned cwd-relative with `/` separators, matching the old glob output. */
function walkFiles(dir: string, exts: string[]): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkFiles(full, exts));
    else if (exts.some((e) => entry.name.endsWith(e))) out.push(full);
  }
  return out;
}

/**
 * PLT-026 regression guard. A database/query failure during identity
 * resolution must bubble to the error boundary (500, non-indexable), never be
 * swallowed into a `notFound()` (404, indexable — it would de-index a real
 * entity). This guard fails if an identity resolver is wrapped in a
 * `.catch(() => null)` / `.catch(() => notFound())` that collapses errors into
 * a 404.
 */
const IDENTITY_RESOLVERS = [
  "getJurisdictionBySlug",
  "getOrganizationBySlug",
  "getPostBySlug",
];

/**
 * `civica-data/page.tsx` is an Index-change-control-protected presentation
 * file, so its identity resolver is not edited here; its route is backstopped
 * by the shared `country/[slug]/layout.tsx`, which resolves the same identity
 * first and (post-PLT-026) bubbles a DB failure to the error boundary before
 * the page body runs. If it is ever de-protected, remove this exception.
 */
const EXCEPTED = new Set(["src/app/(reader)/country/[slug]/civica-data/page.tsx"]);

test("identity resolvers do not swallow DB errors into a 404", () => {
  const files = walkFiles("src/app", [".tsx"]).filter(
    (file) => !EXCEPTED.has(file),
  );
  const offenders: string[] = [];
  for (const file of files) {
    const src = readFileSync(file, "utf8");
    for (const resolver of IDENTITY_RESOLVERS) {
      // <resolver>(...).catch(() => null | notFound()) — the false-404 shape.
      const re = new RegExp(
        `${resolver}\\([^)]*\\)\\s*\\.catch\\(\\(\\)\\s*=>\\s*(null|notFound)`,
      );
      if (re.test(src)) offenders.push(`${file}: ${resolver}(...).catch swallows errors`);
    }
  }
  assert.deepEqual(offenders, []);
});

test("route and global error boundaries exist", () => {
  assert.ok(existsSync("src/app/error.tsx"), "src/app/error.tsx missing");
  assert.ok(
    existsSync("src/app/global-error.tsx"),
    "src/app/global-error.tsx missing",
  );
  // global-error must own <html> and be noindex (transient failure, not gone).
  const globalError = readFileSync("src/app/global-error.tsx", "utf8");
  assert.match(globalError, /<html/);
  assert.match(globalError, /noindex/);
});
