/**
 * validate-content-templates — verify every {{path}} marker in
 * content/*.md resolves against the project's variable schema.
 *
 *   Run with:  npm run validate:content-templates
 *              npm run validate:content-templates -- --strict
 *   Adopted via: ~/civica/plan/content-templating-audit-v1.md (Phase 1)
 *   Companions:
 *     - src/lib/content/markdown/substitute.ts — substitution engine
 *     - src/components/content/MarkdownContent.tsx — runtime renderer
 *     - scripts/regenerate-readme.ts — sister build-time consumer
 *
 * For each `content/*.md` file the script:
 *
 *   1. Reads the file and strips the leading authoring banner
 *      (mirrors `<MarkdownContent>` behaviour).
 *   2. Builds a substitution context using the union of all
 *      `site-state.ts` exports (state.*), a soft-fail
 *      `getSiteStats()` call (stats.*), and a per-file allowlist of
 *      `ctx.*` keys the consumer page is known to materialise.
 *   3. Runs the substitution engine and reports any unresolved or
 *      fallback paths.
 *   4. Exits 0 if no file has unresolved paths AND `--strict` is unset
 *      OR no fallbacks were used; otherwise exits 1.
 *
 * Soft-fail discipline: when `getSiteStats()` fails (e.g., DATABASE_URL
 * unset), `stats === null` and every `{{stats.*}}` reference falls
 * back to its `| "fallback"` arg. This is the same posture the runtime
 * pages take. The validator runs cleanly without a database.
 *
 * **Per-file `ctx.*` allowlist**: each migrated content file declares
 * the helper-string keys its consumer page passes via the `ctx` prop.
 * The validator uses the union of these as a placeholder ctx
 * (each value is the string `"<ctx.KEY>"` so the substitution engine
 * resolves it to a non-empty placeholder rather than falling through).
 * If a markdown file references a `{{ctx.foo}}` not in its allowlist,
 * the validator flags it — caught at validation time rather than at
 * page render.
 *
 * As new content files migrate (Phases 2+), extend `CTX_ALLOWLIST`
 * with the new files' helper keys.
 */

import { config as dotenvConfig } from "dotenv";
dotenvConfig({ path: ".env.local", override: true });

import { promises as fs } from "node:fs";
import path from "node:path";
import { substitute, type SubstitutionContext } from "../src/lib/content/markdown/substitute";

// ─────────────────────────────────────────────────────────────────────
// CLI args
// ─────────────────────────────────────────────────────────────────────

interface CliArgs {
  strict: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = { strict: false };
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--strict") args.strict = true;
    else if (arg === "--help" || arg === "-h") {
      console.log(
        [
          "validate-content-templates — Civica markdown templating validator",
          "",
          "Usage:",
          "  npm run validate:content-templates",
          "  npm run validate:content-templates -- --strict",
          "",
          "Flags:",
          "  --strict   exit 1 on fallbacks-used in addition to unresolved paths",
        ].join("\n"),
      );
      process.exit(0);
    } else {
      console.error(`Unknown arg: ${arg}`);
      process.exit(2);
    }
  }
  return args;
}

// ─────────────────────────────────────────────────────────────────────
// Per-file ctx.* allowlist
// ─────────────────────────────────────────────────────────────────────

/**
 * Each migrated content file declares the `ctx.*` helper keys its
 * consumer page passes. When a markdown file references
 * `{{ctx.foo}}` and `foo` is in the file's allowlist, the validator
 * resolves it to a placeholder string (so the substitution engine
 * doesn't flag it as unresolved). Helpers not in the allowlist
 * surface as unresolved-path errors — catching typos at validation
 * time.
 *
 * Files not yet migrated to runtime templating are excluded; the
 * validator skips them entirely (their hand-edited prose is not yet
 * machine-readable as templated content).
 *
 * Update this map every time a new content file's TSX shell is
 * authored.
 */
const CTX_ALLOWLIST: Record<string, readonly string[]> = {
  "content/about.md": [],
  "content/data-approach.md": [
    "tier1ShippedCount",
    "tier1ShippedShortNamesProse",
    "nsoActiveCount",
    "nsoActiveCountWord",
    "nsoActiveNamesProse",
  ],
  "content/methodology-overview.md": [],
  "content/methodology-pulse.md": [
    "graduationPct",
    "graduationCount",
    "v1Version",
    "v1CategoryCount",
    "currentVersion",
    "currentCategoryCount",
  ],
  "content/methodology-peer-grouping.md": [
    "reviewStatusLabel",
  ],
  "content/methodology-civica-index.md": [
    "lastRevision",
    "pc1VariancePct",
    "corrLow",
    "corrHigh",
  ],
  "content/methodology-pca-appendix.md": [
    "pc1VariancePct",
    "loadLow",
    "loadHigh",
    "loadRange",
    "corrLow",
    "corrHigh",
  ],
};

/** Files in `content/` that haven't yet been migrated to runtime
 *  templating. The validator skips them — their inline prose is
 *  hand-edited and not (yet) using `{{path}}` markers. As each one
 *  migrates, remove from this list and add an entry to
 *  `CTX_ALLOWLIST`.
 *
 *  `content/methodology-reconciliation.md` is DEFERRED for a
 *  different reason — it gates on the `<WorkedExample>` editorial
 *  primitive landing first (per audit §6.B / Phase 5 §9.2). The
 *  page's 8 worked examples are normatively load-bearing prose; the
 *  primitive replaces them, and migrating to flat markdown then
 *  re-migrating to the component means doing the work twice. The
 *  deferral is documented in
 *  `~/civica/plan/content-templating-implementation-v1.md`. */
const SKIP_UNMIGRATED = new Set<string>([
  "content/methodology-reconciliation.md",
]);

// ─────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────

function stripAuthoringBanner(text: string): string {
  return text.replace(/^<!--[\s\S]*?-->\n+/, "");
}

async function listContentFiles(): Promise<string[]> {
  const dir = path.resolve(process.cwd(), "content");
  const entries = await fs.readdir(dir, { withFileTypes: true });
  return entries
    .filter((e) => e.isFile() && e.name.endsWith(".md"))
    .map((e) => `content/${e.name}`)
    .sort();
}

// ─────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = parseArgs(process.argv);

  console.log("=== Civica content-templates validation ===\n");

  // Load site-state. Synchronous, never fails — if it does we exit hard.
  const state = await import("../src/lib/content/site-state");
  const stateRecord = { ...state } as unknown as Record<string, unknown>;

  // Load site-stats with soft-fail (matches the runtime renderer
  // and the regenerate-readme script).
  let stats: Record<string, unknown> | null = null;
  try {
    const statsModule = await import("../src/lib/content/site-stats");
    stats = (await statsModule.getSiteStats()) as unknown as Record<
      string,
      unknown
    >;
    console.log("✓ getSiteStats() returned live data");
  } catch (err) {
    console.warn(
      "⚠ getSiteStats() failed; running validation in soft-fail mode (stats === null).",
    );
    console.warn(`  ${(err as Error).message}`);
    stats = null;
  }
  console.log("");

  const files = await listContentFiles();
  let totalUnresolved = 0;
  let totalFallbacks = 0;
  let totalSkipped = 0;
  let totalChecked = 0;

  for (const file of files) {
    if (SKIP_UNMIGRATED.has(file)) {
      console.log(`◦ ${file} (not yet migrated, skipped)`);
      totalSkipped++;
      continue;
    }

    const allowlist = CTX_ALLOWLIST[file] ?? [];
    const ctx: Record<string, unknown> = {};
    for (const key of allowlist) {
      ctx[key] = `<ctx.${key}>`;
    }

    const abs = path.resolve(process.cwd(), file);
    let raw: string;
    try {
      raw = await fs.readFile(abs, "utf8");
    } catch (err) {
      console.error(`✗ ${file}: failed to read — ${(err as Error).message}`);
      process.exit(1);
    }

    const body = stripAuthoringBanner(raw);
    const context: SubstitutionContext = {
      state: stateRecord,
      stats,
      ctx,
    };
    const result = substitute(body, context);

    totalChecked++;

    // Count fallbacks-used and unresolved.
    if (
      result.unresolvedPaths.length === 0 &&
      result.fallbacksUsed.length === 0
    ) {
      console.log(`✓ ${file} (clean)`);
      continue;
    }

    if (result.unresolvedPaths.length > 0) {
      totalUnresolved += result.unresolvedPaths.length;
      console.log(
        `✗ ${file}: ${result.unresolvedPaths.length} unresolved reference(s)`,
      );
      for (const u of result.unresolvedPaths) {
        console.log(`    L${u.line}: {{${u.path}}}`);
      }
    }

    if (result.fallbacksUsed.length > 0) {
      totalFallbacks += result.fallbacksUsed.length;
      console.log(
        `⚠ ${file}: ${result.fallbacksUsed.length} fallback(s) used (stats was null or path missing)`,
      );
      for (const f of result.fallbacksUsed) {
        console.log(`    L${f.line}: {{${f.path} | "${f.fallback}"}}`);
      }
    }
  }

  console.log("");
  console.log(
    `Summary: ${totalChecked} file(s) checked, ${totalSkipped} skipped (not yet migrated)`,
  );
  console.log(`         ${totalUnresolved} unresolved path(s)`);
  console.log(`         ${totalFallbacks} fallback(s) used`);

  if (totalUnresolved > 0) {
    console.error(
      `\n✗ Validation failed: ${totalUnresolved} unresolved {{path}} reference(s).`,
    );
    process.exit(1);
  }
  if (args.strict && totalFallbacks > 0) {
    console.error(
      `\n✗ --strict: ${totalFallbacks} fallback(s) used. Either DATABASE_URL is unset or a markdown reference used a fallback that should be addressed.`,
    );
    process.exit(1);
  }

  console.log("\n✓ All migrated content templates resolve cleanly.");
  process.exit(0);
}

main().catch((err) => {
  console.error("validate-content-templates threw:", err);
  process.exit(1);
});
