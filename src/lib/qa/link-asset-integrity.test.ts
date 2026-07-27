import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { REDIRECTS } from "@/lib/routing/redirects";

/** Recursively list files under `dir` whose name ends with one of `exts`.
 *  Replaces `fs.globSync` (absent from the pinned @types/node). */
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
 * QA-015 — internal link / asset / redirect integrity.
 *
 * Canonical, sitemap, robots, route, and anchor coverage is enforced by
 * `validate:metadata` and `validate:doc-sources`/`doc-references`. This suite
 * adds the three gaps: required footer links survive, local asset references
 * resolve to a real file with exact case, and redirects do not chain.
 */

test("required footer links survive (AGENTS invariant)", () => {
  const footer = readFileSync("src/components/SiteFooter.tsx", "utf8");
  for (const required of [
    "/blog",
    "/api-docs",
    "/design-system",
    "/licensing",
    "/contact",
    "https://statuspage.incident.io/civica-atlas",
    "https://github.com/",
  ]) {
    assert.ok(footer.includes(required), `footer lost required link: ${required}`);
  }
});

test("literal local asset references resolve with exact case", () => {
  const files = [
    ...walkFiles("src/app", [".ts", ".tsx"]),
    ...walkFiles("src/components", [".ts", ".tsx"]),
  ];
  const assetRe =
    /["'`(](\/(?:engravings|blog|images|flags|assets|fonts|icons)\/[A-Za-z0-9._/-]+\.(?:webp|png|svg|jpe?g|gif|ico|woff2?|pmtiles))["'`)]/g;
  const missing: string[] = [];
  const checked = new Set<string>();
  for (const file of files) {
    const src = readFileSync(file, "utf8");
    for (const match of src.matchAll(assetRe)) {
      const ref = match[1];
      // Skip anything that was part of a template expression.
      if (checked.has(ref)) continue;
      checked.add(ref);
      const abs = join("public", ref);
      if (!existsSync(abs)) {
        missing.push(`${ref} (referenced in ${file})`);
        continue;
      }
      // Exact-case check: the real dirent must match the referenced segment.
      const dir = join("public", ref.slice(0, ref.lastIndexOf("/")));
      const base = ref.slice(ref.lastIndexOf("/") + 1);
      if (!readdirSync(dir).includes(base)) {
        missing.push(`${ref} (case mismatch)`);
      }
    }
  }
  assert.ok(checked.size > 0, "expected to find asset references to check");
  assert.deepEqual(missing, []);
});

test("redirects do not chain (no multi-hop)", () => {
  // A destination's path must not itself be a literal redirect source.
  const sourcePaths = new Set(
    REDIRECTS.map((r) => r.source.split("?")[0]).filter((s) => !s.includes("(")),
  );
  const chained: string[] = [];
  for (const r of REDIRECTS) {
    const destPath = r.destination.split("?")[0].split("#")[0];
    if (sourcePaths.has(destPath)) {
      chained.push(`${r.source} → ${r.destination} (destination is another redirect source)`);
    }
  }
  assert.deepEqual(chained, []);
});
