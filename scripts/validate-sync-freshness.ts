/**
 * validate-sync-freshness — enforce the single sanctioned path for
 * stamping `sources.last_sync_at`.
 *
 *   Run with:  npm run validate:sync-freshness
 *   Companion: src/lib/db/source-freshness.ts (the helper)
 *   Mirrors:   scripts/validate-content-templates.ts (style/CLI shape)
 *
 * Provenance is load-bearing in Civica: a failed or empty sync must
 * never look fresh (AGENTS.md provenance invariant). The ONLY allowed
 * way to write `sources.last_sync_at` is `markSourcesSynced()` in
 * `src/lib/db/source-freshness.ts`, which stamps exclusively when a run
 * actually wrote rows.
 *
 * This script scans every `.ts`/`.tsx` file under `src/` and `scripts/`
 * and flags any WRITE to `last_sync_at` that lives outside the helper
 * (plus a tiny allowlist of files owned by other workstreams). A write
 * is any of:
 *
 *   1. A Drizzle `.set({ ... lastSyncAt ... })` update-stamp.
 *   2. A Drizzle `onConflictDoUpdate({ set: { ... lastSyncAt ... } })`
 *      upsert-stamp.
 *   3. A raw SQL `... SET last_sync_at ...` / `last_sync_at = NOW()`.
 *
 * `lastSyncAt: null` (insert guards / seed nulls) and plain reads /
 * SELECT projections (`lastSyncAt: sources.lastSyncAt`) are NOT writes
 * and are ignored. Seed-time `.values(...)` inserts are out of scope —
 * the anti-pattern this guard exists for is advancing freshness on an
 * existing source row when nothing was written.
 *
 * Comments and string contents are masked before token detection so a
 * `.set(` or `lastSyncAt` mentioned in prose never trips the scan, while
 * raw SQL inside template literals is preserved so pattern (3) is caught.
 *
 * Exit 0 + OK summary when every write routes through the helper.
 * Exit 1 + a `file:line` list when any non-allowlisted write is found.
 *
 * NOTE: until the in-flight migration to `markSourcesSynced()` finishes,
 * this WILL list the not-yet-migrated sync files as offenders. That is
 * expected — the green state is reached once every sync routes through
 * the helper.
 */

import { promises as fs } from "node:fs";
import path from "node:path";

// ─────────────────────────────────────────────────────────────────────
// Allowlist — files permitted to write `last_sync_at` directly because
// they are the sanctioned helper itself or are owned by another
// workstream. Keep this list TINY and intentional.
// ─────────────────────────────────────────────────────────────────────

const ALLOWLIST = new Set<string>([
  "src/lib/db/source-freshness.ts",
]);

/** Directories scanned for sync code. */
const SCAN_ROOTS = ["src", "scripts"];

/** File extensions considered. */
const EXTENSIONS = new Set([".ts", ".tsx"]);

// ─────────────────────────────────────────────────────────────────────
// CLI args
// ─────────────────────────────────────────────────────────────────────

function parseArgs(argv: string[]): void {
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") {
      console.log(
        [
          "validate-sync-freshness — Civica sources.last_sync_at write guard",
          "",
          "Usage:",
          "  npm run validate:sync-freshness",
          "",
          "Fails (exit 1) if any file outside the sanctioned helper",
          "(src/lib/db/source-freshness.ts) writes sources.last_sync_at.",
        ].join("\n"),
      );
      process.exit(0);
    } else {
      console.error(`Unknown arg: ${arg}`);
      process.exit(2);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────
// Lightweight source masking + scanning
// ─────────────────────────────────────────────────────────────────────

/**
 * Replace comments with spaces (preserving newlines + length so line
 * numbers stay accurate) while keeping string / template contents
 * intact. String contents are preserved because raw-SQL `last_sync_at`
 * writes live inside template literals and must still be detectable.
 */
function maskComments(src: string): string {
  let out = "";
  let i = 0;
  const n = src.length;
  type Mode = "code" | "line" | "block" | "sq" | "dq" | "tpl";
  let mode: Mode = "code";

  while (i < n) {
    const c = src[i];
    const c2 = src[i + 1];

    if (mode === "code") {
      if (c === "/" && c2 === "/") {
        mode = "line";
        out += "  ";
        i += 2;
        continue;
      }
      if (c === "/" && c2 === "*") {
        mode = "block";
        out += "  ";
        i += 2;
        continue;
      }
      if (c === "'") {
        mode = "sq";
        out += c;
        i++;
        continue;
      }
      if (c === '"') {
        mode = "dq";
        out += c;
        i++;
        continue;
      }
      if (c === "`") {
        mode = "tpl";
        out += c;
        i++;
        continue;
      }
      out += c;
      i++;
      continue;
    }

    if (mode === "line") {
      if (c === "\n") {
        mode = "code";
        out += c;
      } else {
        out += c === "\t" ? "\t" : " ";
      }
      i++;
      continue;
    }

    if (mode === "block") {
      if (c === "*" && c2 === "/") {
        mode = "code";
        out += "  ";
        i += 2;
        continue;
      }
      out += c === "\n" ? "\n" : c === "\t" ? "\t" : " ";
      i++;
      continue;
    }

    // String / template modes: preserve content; honour escapes.
    out += c;
    if (c === "\\") {
      out += src[i + 1] ?? "";
      i += 2;
      continue;
    }
    if (mode === "sq" && c === "'") mode = "code";
    else if (mode === "dq" && c === '"') mode = "code";
    else if (mode === "tpl" && c === "`") mode = "code";
    i++;
  }

  return out;
}

/** 1-based line number for a character index. */
function lineOf(content: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index && i < content.length; i++) {
    if (content[i] === "\n") line++;
  }
  return line;
}

/**
 * From the index of an opening `(` or `{`, return the body between it
 * and its balanced close, plus the absolute index of the body start.
 */
function enclosedBody(
  src: string,
  openIdx: number,
): { body: string; bodyStart: number } {
  let depth = 0;
  for (let i = openIdx; i < src.length; i++) {
    const ch = src[i];
    if (ch === "(" || ch === "{" || ch === "[") depth++;
    else if (ch === ")" || ch === "}" || ch === "]") {
      depth--;
      if (depth === 0) {
        return { body: src.slice(openIdx + 1, i), bodyStart: openIdx + 1 };
      }
    }
  }
  return { body: src.slice(openIdx + 1), bodyStart: openIdx + 1 };
}

/**
 * Locate a non-null `lastSyncAt:` assignment inside an object-literal
 * body. Returns the absolute index of the `lastSyncAt` token, or -1 if
 * the body only assigns `lastSyncAt: null` (or has none).
 */
function findNonNullLastSyncAtKey(body: string, bodyStart: number): number {
  const re = /\blastSyncAt\s*:/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    const after = body.slice(m.index + m[0].length).trimStart();
    if (after.startsWith("null")) continue; // insert guard / cleared
    return bodyStart + m.index;
  }
  return -1;
}

interface Offender {
  line: number;
  kind: string;
}

function scanFile(content: string): Offender[] {
  const masked = maskComments(content);
  const offenders: Offender[] = [];
  const seenLines = new Set<number>();

  const record = (absIdx: number, kind: string) => {
    if (absIdx < 0) return;
    const line = lineOf(content, absIdx);
    if (seenLines.has(line)) return;
    seenLines.add(line);
    offenders.push({ line, kind });
  };

  // Pattern 1 — Drizzle `.set( ... )` update-stamp.
  {
    const re = /\.set\s*\(/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(masked)) !== null) {
      const openIdx = masked.indexOf("(", m.index + m[0].length - 1);
      if (openIdx < 0) continue;
      const { body, bodyStart } = enclosedBody(masked, openIdx);
      record(
        findNonNullLastSyncAtKey(body, bodyStart),
        ".set({ lastSyncAt }) update-stamp",
      );
    }
  }

  // Pattern 2 — Drizzle `onConflictDoUpdate({ set: { ... } })` upsert-stamp.
  {
    const re = /onConflictDoUpdate\s*\(/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(masked)) !== null) {
      const openIdx = masked.indexOf("(", m.index + m[0].length - 1);
      if (openIdx < 0) continue;
      const { body, bodyStart } = enclosedBody(masked, openIdx);
      record(
        findNonNullLastSyncAtKey(body, bodyStart),
        "onConflictDoUpdate set: { lastSyncAt } upsert-stamp",
      );
    }
  }

  // Pattern 3 — raw SQL `SET last_sync_at` / `last_sync_at = NOW()`.
  {
    const re = /(\bset\s+last_sync_at\b|\blast_sync_at\s*=\s*now\s*\()/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(masked)) !== null) {
      const tokenIdx = masked.indexOf("last_sync_at", m.index);
      record(tokenIdx, "raw SQL last_sync_at write");
    }
  }

  return offenders.sort((a, b) => a.line - b.line);
}

// ─────────────────────────────────────────────────────────────────────
// File discovery
// ─────────────────────────────────────────────────────────────────────

async function walk(dir: string, acc: string[]): Promise<void> {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return; // missing root — skip silently
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".next") continue;
      await walk(full, acc);
    } else if (entry.isFile() && EXTENSIONS.has(path.extname(entry.name))) {
      acc.push(full);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  parseArgs(process.argv);

  console.log("=== Civica sources.last_sync_at write-path validation ===\n");

  const cwd = process.cwd();
  const files: string[] = [];
  for (const root of SCAN_ROOTS) {
    await walk(path.resolve(cwd, root), files);
  }
  files.sort();

  let scanned = 0;
  let allowlisted = 0;
  const offendingFiles: Array<{ rel: string; offenders: Offender[] }> = [];

  for (const abs of files) {
    const rel = path.relative(cwd, abs).split(path.sep).join("/");
    if (ALLOWLIST.has(rel)) {
      allowlisted++;
      continue;
    }
    scanned++;
    const content = await fs.readFile(abs, "utf8");
    // Cheap pre-filter: only parse files that mention the column at all.
    if (!content.includes("lastSyncAt") && !content.includes("last_sync_at")) {
      continue;
    }
    const offenders = scanFile(content);
    if (offenders.length > 0) {
      offendingFiles.push({ rel, offenders });
    }
  }

  let totalOffenders = 0;
  for (const { rel, offenders } of offendingFiles) {
    for (const o of offenders) {
      totalOffenders++;
      console.error(`✗ ${rel}:${o.line}  (${o.kind})`);
    }
  }

  console.log("");
  console.log(
    `Summary: ${scanned} file(s) scanned, ${allowlisted} allowlisted, ` +
      `${offendingFiles.length} offending file(s), ${totalOffenders} offending write(s).`,
  );

  if (totalOffenders > 0) {
    console.error(
      "\n✗ Validation failed: every write to sources.last_sync_at must go\n" +
        "  through markSourcesSynced() in src/lib/db/source-freshness.ts.\n" +
        "  Migrate the offenders above (or, if a file is legitimately owned\n" +
        "  elsewhere, add it to the ALLOWLIST in this script).",
    );
    process.exit(1);
  }

  console.log(
    "\n✓ All sources.last_sync_at writes route through the sanctioned helper.",
  );
  process.exit(0);
}

main().catch((err) => {
  console.error("validate-sync-freshness threw:", err);
  process.exit(1);
});
