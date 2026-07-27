/**
 * validate:blog-media (EXP-036) — walk public/blog, read each illustration's
 * format/dimensions/size, and run the pure blog-media contract. Fails on a
 * non-webp file, an unreadable-dimension file, or a source file over the byte
 * ceiling. DB-free, deterministic.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, extname } from "node:path";

import { readBlogImageDimensions } from "@/lib/blog";
import {
  validateBlogMedia,
  type BlogMediaFile,
} from "@/lib/illustrations/blog-media-validation";

const BLOG_DIR = join(process.cwd(), "public", "blog");

function walk(dir: string): string[] {
  const out: string[] = [];
  let entries: import("node:fs").Dirent[] = [];
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (/\.(webp|png|jpe?g|gif)$/i.test(entry.name)) out.push(full);
  }
  return out;
}

function toFile(abs: string): BlogMediaFile {
  const rel = abs.slice(process.cwd().length + 1); // public/blog/...
  const publicRel = "/" + rel.replace(/^public\//, ""); // /blog/...
  const format = extname(abs).slice(1).toLowerCase();
  const dims = readBlogImageDimensions(publicRel);
  return {
    path: rel,
    format,
    width: dims?.width ?? null,
    height: dims?.height ?? null,
    byteSize: statSync(abs).size,
    isCover: /(^|\/)cover\.[a-z0-9]+$/i.test(abs),
  };
}

function main() {
  // Touch readFileSync so the import is used even if the walk is empty.
  void readFileSync;
  const files = walk(BLOG_DIR).map(toFile);
  const violations = validateBlogMedia(files);

  console.log(`Scanned ${files.length} blog media files under public/blog.`);
  if (violations.length === 0) {
    console.log("PASS — all blog media meet the format/dimension/byte contract.");
    return;
  }
  console.error(`\nFAIL — ${violations.length} blog-media violation(s):`);
  for (const v of violations) {
    console.error(`  [${v.kind}] ${v.path} — ${v.detail}`);
  }
  process.exit(1);
}

main();
