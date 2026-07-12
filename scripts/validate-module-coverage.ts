/**
 * QA-002 — module-scoped test-coverage gate.
 *
 * `npm test` (node's native test runner) has no coverage tool wired in, so
 * the only coverage number Civica could report was "however much of the
 * repo happens to be exercised" — a single global percentage that hides
 * whether the modules that actually matter (admin auth, resolver logic,
 * the Index math) are well-tested, and lets a real regression in one of
 * them hide behind a healthy-looking aggregate.
 *
 * This script instead declares coverage thresholds PER MODULE, in
 * `scripts/module-coverage-config.json`: a name, the test file(s) that
 * exercise it, the source file(s) it measures, and a lines/branch/
 * functions floor. Node's built-in `--experimental-test-coverage` already
 * supports per-invocation thresholds
 * (`--test-coverage-lines/branches/functions`) plus scoping which files
 * count toward coverage (`--test-coverage-include`) — this script just
 * runs one such invocation per registered module, in a fresh child
 * process so each module's threshold is evaluated independently, and
 * aggregates the pass/fail table.
 *
 * A module fails the gate when its measured coverage is below its
 * declared threshold — Node itself decides this (via the child process's
 * exit code); this script does not re-implement the pass/fail math.
 *
 * Run directly: `npx tsx scripts/validate-module-coverage.ts`
 * (there is no `npm run` entry yet — see the QA-002 handoff note in
 * `plan/evidence/QA-002/README.md` for the exact `package.json` line to
 * add).
 */
import { readFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

// ─────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────

export interface ModuleCoverageThresholds {
  lines: number;
  branch: number;
  functions: number;
}

export interface ModuleCoverageConfig {
  name: string;
  testGlobs: string[];
  includeGlobs: string[];
  thresholds: ModuleCoverageThresholds;
  note?: string;
}

export interface ModuleCoverageConfigFile {
  schemaVersion: string;
  modules: ModuleCoverageConfig[];
}

export interface MeasuredCoverage {
  lines: number | null;
  branch: number | null;
  functions: number | null;
}

export interface ModuleCoverageResult {
  name: string;
  passed: boolean;
  exitCode: number;
  measured: MeasuredCoverage;
  thresholds: ModuleCoverageThresholds;
  note?: string;
  /** Raw combined stdout+stderr, kept only for diagnostics on failure. */
  output: string;
  /** Set when the child process itself could not be evaluated (e.g. no
   *  test files matched, or node exited on a crash unrelated to coverage
   *  thresholds). `passed` is always false in this case. */
  runError?: string;
}

// ─────────────────────────────────────────────────────────────────────
// Config loading
// ─────────────────────────────────────────────────────────────────────

const DEFAULT_CONFIG_PATH = resolve(__dirname, "module-coverage-config.json");

export function loadModuleCoverageConfig(
  path: string = DEFAULT_CONFIG_PATH,
): ModuleCoverageConfigFile {
  const raw = readFileSync(path, "utf8");
  const parsed = JSON.parse(raw) as ModuleCoverageConfigFile;
  if (!Array.isArray(parsed.modules) || parsed.modules.length === 0) {
    throw new Error(`${path}: expected a non-empty "modules" array`);
  }
  for (const entry of parsed.modules) {
    if (!entry.name) throw new Error(`${path}: a module entry is missing "name"`);
    if (!Array.isArray(entry.testGlobs) || entry.testGlobs.length === 0) {
      throw new Error(`${path}: module "${entry.name}" has no testGlobs`);
    }
    if (!Array.isArray(entry.includeGlobs) || entry.includeGlobs.length === 0) {
      throw new Error(`${path}: module "${entry.name}" has no includeGlobs`);
    }
    const { lines, branch, functions } = entry.thresholds ?? ({} as ModuleCoverageThresholds);
    if (
      typeof lines !== "number" ||
      typeof branch !== "number" ||
      typeof functions !== "number"
    ) {
      throw new Error(
        `${path}: module "${entry.name}" thresholds must declare numeric lines/branch/functions`,
      );
    }
  }
  return parsed;
}

// ─────────────────────────────────────────────────────────────────────
// Coverage-report parsing
// ─────────────────────────────────────────────────────────────────────

/**
 * Node's `--experimental-test-coverage` reporter prints a text table
 * ending in an "all files" row, e.g.:
 *
 *   ℹ all files       |  92.89 |    90.48 |   79.17 |
 *
 * Extract the three aggregate percentages. Returns nulls (not zeros) when
 * the row can't be found, so callers can distinguish "measured 0%" from
 * "coverage report never printed" (e.g. a crash before any test ran).
 */
export function parseAllFilesRow(output: string): MeasuredCoverage {
  const match = output.match(
    /all files\s*\|\s*([\d.]+)\s*\|\s*([\d.]+)\s*\|\s*([\d.]+)\s*\|/,
  );
  if (!match) return { lines: null, branch: null, functions: null };
  return {
    lines: Number(match[1]),
    branch: Number(match[2]),
    functions: Number(match[3]),
  };
}

// ─────────────────────────────────────────────────────────────────────
// Running one module's coverage check
// ─────────────────────────────────────────────────────────────────────

export interface RunModuleCoverageOptions {
  /** Working directory the child `node` process runs in. Defaults to the
   *  repo root (two levels up from this script). Tests pass a scratch
   *  directory so fixture modules don't need repo-relative paths. */
  cwd?: string;
  /** Override the node executable (tests never need this; present for
   *  completeness / future sandboxing). */
  execPath?: string;
}

/**
 * Run ONE module's declared test files under `--experimental-test-coverage`,
 * scoped to its declared source files, gated by its declared thresholds.
 * The pass/fail verdict comes from node's own exit code — this function
 * only parses the printed report for the human-readable table, it does
 * not recompute the threshold comparison itself.
 */
export function runModuleCoverage(
  entry: ModuleCoverageConfig,
  options: RunModuleCoverageOptions = {},
): ModuleCoverageResult {
  const cwd = options.cwd ?? resolve(__dirname, "..");
  const execPath = options.execPath ?? process.execPath;

  const args = [
    "--import",
    "tsx",
    "--test",
    "--experimental-test-coverage",
    ...entry.includeGlobs.map((glob) => `--test-coverage-include=${glob}`),
    `--test-coverage-lines=${entry.thresholds.lines}`,
    `--test-coverage-branches=${entry.thresholds.branch}`,
    `--test-coverage-functions=${entry.thresholds.functions}`,
    ...entry.testGlobs,
  ];

  // Strip node:test's own internal env markers before spawning. When
  // `runModuleCoverage()` is itself called from inside a test running
  // under `node --test` (as validate-module-coverage.test.ts does), the
  // parent process carries `NODE_TEST_CONTEXT=child-v8`. Inheriting that
  // into the child makes node's test runner think this is a RECURSIVE
  // `node --test` invocation and silently skip running any files
  // (printing a "being called recursively" warning, no coverage report,
  // but still exiting 0) — a real bug caught by this script's own
  // seeded-regression test.
  const { NODE_TEST_CONTEXT: _omit1, NODE_V8_COVERAGE: _omit2, ...cleanEnv } = process.env;
  void _omit1;
  void _omit2;

  const result = spawnSync(execPath, args, {
    cwd,
    encoding: "utf8",
    env: cleanEnv,
    // 60s per module is generous for these DB-free unit suites; guards
    // against a hang blocking the whole gate.
    timeout: 60_000,
  });

  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  const measured = parseAllFilesRow(output);

  if (result.error) {
    return {
      name: entry.name,
      passed: false,
      exitCode: result.status ?? -1,
      measured,
      thresholds: entry.thresholds,
      note: entry.note,
      output,
      runError: result.error.message,
    };
  }

  const exitCode = result.status ?? 1;
  return {
    name: entry.name,
    passed: exitCode === 0 && measured.lines !== null,
    exitCode,
    measured,
    thresholds: entry.thresholds,
    note: entry.note,
    output,
  };
}

// ─────────────────────────────────────────────────────────────────────
// Table formatting
// ─────────────────────────────────────────────────────────────────────

function fmtPct(v: number | null): string {
  return v === null ? "  n/a" : v.toFixed(2).padStart(6);
}

export function formatResultsTable(results: ModuleCoverageResult[]): string {
  const nameWidth = Math.max(6, ...results.map((r) => r.name.length));
  const lines: string[] = [];
  lines.push(
    `${"module".padEnd(nameWidth)} | lines (thr) | branch (thr) | funcs (thr) | status`,
  );
  lines.push("-".repeat(nameWidth + 58));
  for (const r of results) {
    const status = r.passed ? "PASS" : "FAIL";
    lines.push(
      `${r.name.padEnd(nameWidth)} | ` +
        `${fmtPct(r.measured.lines)} (${String(r.thresholds.lines).padStart(3)}) | ` +
        `${fmtPct(r.measured.branch)} (${String(r.thresholds.branch).padStart(3)}) | ` +
        `${fmtPct(r.measured.functions)} (${String(r.thresholds.functions).padStart(3)}) | ` +
        status,
    );
  }
  return lines.join("\n");
}

// ─────────────────────────────────────────────────────────────────────
// CLI entrypoint
// ─────────────────────────────────────────────────────────────────────

function main(): void {
  const config = loadModuleCoverageConfig();

  // Fail closed if a registered test or include file has gone missing —
  // catches config drift before it produces a confusing node error.
  const repoRoot = resolve(__dirname, "..");
  const missing: string[] = [];
  for (const entry of config.modules) {
    for (const glob of [...entry.testGlobs, ...entry.includeGlobs]) {
      if (glob.includes("*")) continue; // glob patterns aren't checked here
      if (!existsSync(resolve(repoRoot, glob))) missing.push(`${entry.name}: ${glob}`);
    }
  }
  if (missing.length > 0) {
    console.error("FAIL — module-coverage config references missing files:");
    for (const m of missing) console.error(`  - ${m}`);
    process.exit(1);
  }

  console.log(
    `Running module-scoped coverage for ${config.modules.length} registered modules ` +
      `(schema ${config.schemaVersion})...\n`,
  );

  const results: ModuleCoverageResult[] = [];
  for (const entry of config.modules) {
    const result = runModuleCoverage(entry, { cwd: repoRoot });
    results.push(result);
    const status = result.passed ? "PASS" : "FAIL";
    console.log(
      `[${status}] ${result.name} — lines ${fmtPct(result.measured.lines).trim()}% ` +
        `(>=${result.thresholds.lines}), branch ${fmtPct(result.measured.branch).trim()}% ` +
        `(>=${result.thresholds.branch}), functions ${fmtPct(result.measured.functions).trim()}% ` +
        `(>=${result.thresholds.functions})`,
    );
    if (!result.passed) {
      if (result.runError) console.error(`  run error: ${result.runError}`);
      const errorLines = result.output
        .split("\n")
        .filter((line) => /does not meet threshold|Error:/.test(line));
      for (const line of errorLines) console.error(`  ${line.trim()}`);
    }
  }

  console.log("\n" + formatResultsTable(results) + "\n");

  const failed = results.filter((r) => !r.passed);
  if (failed.length > 0) {
    console.error(
      `FAIL — ${failed.length}/${results.length} module(s) below their declared coverage threshold: ` +
        failed.map((r) => r.name).join(", "),
    );
    process.exit(1);
  }

  console.log(`PASS — all ${results.length} registered modules meet their declared thresholds.`);
}

if (require.main === module) {
  main();
}
