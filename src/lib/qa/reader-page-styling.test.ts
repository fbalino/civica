/**
 * EXP-004 — reader-style pages compose the shared editorial/methodology
 * primitives and never ship a per-page `<style>` block for layout, typography,
 * filters, or cards. This guard locks the owner mandate (restated after
 * repeated drift): no local page themes; a missing pattern is added to
 * `editorial.css` once and reused, never re-declared per page.
 *
 * Pure: no DB, no network. Runs under `npm test`.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/** Recursively list files under `dir` whose name ends with one of `exts`. */
function walkFiles(dir: string, exts: string[]): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkFiles(full, exts));
    else if (exts.some((e) => entry.name.endsWith(e))) out.push(full);
  }
  return out;
}

test("no page/layout component ships an inline <style> block", () => {
  // The embed iframe generator is a route handler (route.ts) that emits a full
  // standalone HTML document with inline CSS by necessity — it is not a page
  // component and is intentionally excluded (only .tsx is scanned).
  const offenders: string[] = [];
  for (const file of walkFiles("src/app", [".tsx"])) {
    if (file.endsWith(".test.tsx")) continue;
    const src = readFileSync(file, "utf8");
    // styled-jsx `<style jsx>` or any inline `<style>` JSX element.
    if (/<style[\s>]/.test(src)) offenders.push(file);
  }
  assert.deepEqual(
    offenders,
    [],
    `page-local <style> blocks are forbidden; found in:\n${offenders.join("\n")}`,
  );
});

test("reader-style document pages compose the shared editorial shell", () => {
  // Each sectioned reader/legal/policy document page must build on the shared
  // container + section primitives, never hand-rolled layout markup.
  const pages = [
    "src/app/privacy/page.tsx",
    "src/app/terms/page.tsx",
    "src/app/licensing/page.tsx",
    "src/app/accessibility/page.tsx",
    "src/app/(reader)/policies/page.tsx",
    "src/app/(reader)/methodology/page.tsx",
  ];
  for (const page of pages) {
    const src = readFileSync(page, "utf8");
    const hasContainer =
      src.includes("EditorialPage") ||
      src.includes("methodology-layout") ||
      /editorial-page/.test(src);
    assert.ok(hasContainer, `${page}: missing a canonical editorial container`);
    assert.ok(
      src.includes("editorial-section") || src.includes("MarkdownContent"),
      `${page}: content not composed from editorial-section / MarkdownContent`,
    );
  }
});

test("legal/policy document pages use the methodology sidebar shell", () => {
  // DESIGN.md: legal / policy / ANY multi-section document page uses
  // methodology-layout + ReaderSidebar (1200px, left sidebar) — not a bare
  // narrow column.
  for (const page of ["src/app/privacy/page.tsx", "src/app/terms/page.tsx"]) {
    const src = readFileSync(page, "utf8");
    assert.ok(
      src.includes("methodology-layout") && src.includes("ReaderSidebar"),
      `${page}: multi-section document must use methodology-layout + ReaderSidebar`,
    );
  }
});
