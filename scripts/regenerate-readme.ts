/**
 * Civica README templating regenerator (Phase 5, mini-resolution v1.0).
 *
 *   Run with:  npm run regenerate:readme
 *              npm run regenerate:readme -- --strict   (fail on unresolved paths)
 *              npm run regenerate:readme -- --output README.regenerated.md
 *   Adopted via: ~/civica/plan/readme-templating-implementation-v1.md
 *
 * Reads `README.template.md` from the project root, resolves
 * `{{state.*}}`, `{{stats.*}}`, and `{{ctx.*}}` substitution markers
 * against `site-state.ts` (typed config) + a soft-fail call to
 * `getSiteStats()` (live DB-driven counters) + a small set of
 * pre-computed helpers, and writes the result to `README.md`
 * (or `--output <path>`).
 *
 * Substitution syntax (locked in Phase 5 design v1.0 §3):
 *
 *   {{path.to.field}}              dot-path traversal, including .length
 *   {{path.to.field | "fallback"}} fallback string when path is null/undef
 *
 * Soft-fail discipline (engagement requirement):
 *
 *   - DB unreachable → stats === null → every {{stats.*}} reference
 *     falls through to its `| "fallback"` arg if present, else to
 *     a `(unknown)` placeholder with a console warning.
 *   - The script ALWAYS exits 0 on substitution errors (warnings only).
 *     `--strict` flips this: exit 1 on any unresolved path.
 *   - The script exits 1 on file-system errors or template-syntax errors
 *     regardless of `--strict`.
 *
 * Pre-computed helpers (Phase 5 design v1.0 §3.2 — pre-compute at the
 * call site instead of putting filter chains in template syntax):
 *
 *   ctx.launchPhaseProse              "pre-launch beta" / "launched"
 *   ctx.civicaIndexDimensionCountWord "four" / "5" etc.
 *   ctx.civicaIndexDimensionLabelsProse "democratic quality, ..."
 *   ctx.civicaIndexWeightsString      "27/26/23/24"
 *   ctx.civicaIndexStatusUpper        "BETA" etc.
 *   ctx.pulseStatusUpper              "BETA" etc.
 *   ctx.pulseBacktestCasesProse       "Myanmar 2021, Niger 2023, ..."
 *   ctx.tier1ShippedCount             integer
 *   ctx.tier1ShippedCountWord         "eleven"
 *   ctx.tier1ShippedFullNamesProse    "World Bank WDI, IMF WEO, ..."
 *   ctx.nsoInProgressCount            integer
 *   ctx.nsoInProgressCountWord        "six"
 *   ctx.nsoInProgressNamesProse       "US Census, ONS-UK, ..."
 *   ctx.nsoDeferredNamesProse         "Destatis-DE deferred to v1.1; NBS-Nigeria permanently deferred"
 *   ctx.nsoDeferredStatusTableProse   table-cell variant with full deferral reasons
 *   ctx.fiveSourceFactKeyNamesProse   "population, life expectancy, ..."
 *   ctx.totalFactsRoundedThousands    "26,000" etc.
 *   ctx.externalReviewStatusProse     "Not yet — planned post-v1" etc.
 */

import { config as dotenvConfig } from "dotenv";
dotenvConfig({ path: ".env.local", override: true });

import { promises as fs } from "node:fs";
import path from "node:path";

// ─────────────────────────────────────────────────────────────────────
// CLI args
// ─────────────────────────────────────────────────────────────────────

interface CliArgs {
  strict: boolean;
  template: string;
  output: string;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    strict: false,
    template: "README.template.md",
    output: "README.md",
  };
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--strict") args.strict = true;
    else if (arg === "--template") args.template = argv[++i] ?? args.template;
    else if (arg === "--output") args.output = argv[++i] ?? args.output;
    else if (arg === "--help" || arg === "-h") {
      console.log(
        [
          "regenerate-readme — Civica README template renderer",
          "",
          "Usage:",
          "  npm run regenerate:readme",
          "  npm run regenerate:readme -- --strict",
          "  npm run regenerate:readme -- --output README.regenerated.md",
          "  npm run regenerate:readme -- --template README.template.md --output README.md",
          "",
          "Flags:",
          "  --strict             exit 1 on unresolved {{path}} markers (default: warn only)",
          "  --template <path>    template input path (default: README.template.md)",
          "  --output <path>      output path (default: README.md)",
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
// Substitution engine
// ─────────────────────────────────────────────────────────────────────

interface Context {
  state: Record<string, unknown>;
  stats: Record<string, unknown> | null;
  ctx: Record<string, unknown>;
}

interface SubstituteResult {
  output: string;
  unresolvedPaths: Array<{ path: string; line: number }>;
  fallbacksUsed: Array<{ path: string; fallback: string; line: number }>;
}

function resolvePath(
  ctx: Context,
  pathStr: string,
): { found: boolean; value: unknown } {
  // Path must start with a top-level key: state, stats, or ctx.
  const segments = pathStr.split(".");
  if (segments.length < 1) return { found: false, value: undefined };
  const root = segments[0];
  let current: unknown;
  if (root === "state") current = ctx.state;
  else if (root === "stats") current = ctx.stats;
  else if (root === "ctx") current = ctx.ctx;
  else return { found: false, value: undefined };

  // If stats is null (soft-fail), short-circuit AFTER recording that
  // we attempted a stats path — caller will use the fallback.
  if (root === "stats" && ctx.stats === null) {
    return { found: false, value: undefined };
  }

  for (let i = 1; i < segments.length; i++) {
    const seg = segments[i];
    if (current === null || current === undefined) {
      return { found: false, value: undefined };
    }
    // .length on arrays + strings
    if (seg === "length" && (Array.isArray(current) || typeof current === "string")) {
      current = (current as Array<unknown> | string).length;
      continue;
    }
    if (typeof current !== "object" || current === null) {
      return { found: false, value: undefined };
    }
    current = (current as Record<string, unknown>)[seg];
    if (current === undefined) {
      return { found: false, value: undefined };
    }
  }
  return { found: true, value: current };
}

/**
 * Parse a single substitution body (the text BETWEEN the `{{` and `}}`).
 * Returns either { type: "path", path } for `{{state.x}}`-style refs
 * or { type: "pathWithFallback", path, fallback } for the soft-fail
 * pipe form `{{stats.x | "fallback"}}`.
 */
interface ParsedRef {
  path: string;
  fallback: string | null;
}

function parseRef(body: string): ParsedRef | null {
  // Trim outer whitespace; we tolerate any whitespace inside `{{ ... }}`
  const trimmed = body.trim();
  if (!trimmed) return null;
  // Look for the pipe form: <path> | "<fallback>"
  // Allow whitespace around the pipe; the fallback is a single-quoted
  // OR double-quoted string per Phase 5 design §3.3.
  const pipeMatch = trimmed.match(
    /^([A-Za-z_][\w.]*)\s*\|\s*(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)')\s*$/,
  );
  if (pipeMatch) {
    return {
      path: pipeMatch[1],
      fallback: pipeMatch[2] !== undefined ? pipeMatch[2] : pipeMatch[3] ?? "",
    };
  }
  const plainMatch = trimmed.match(/^([A-Za-z_][\w.]*)\s*$/);
  if (plainMatch) {
    return { path: plainMatch[1], fallback: null };
  }
  return null;
}

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (Array.isArray(v)) return v.map(formatValue).join(", ");
  // Don't render arbitrary objects; produce a placeholder.
  return JSON.stringify(v);
}

function lineOf(text: string, idx: number): number {
  let line = 1;
  for (let i = 0; i < idx && i < text.length; i++) {
    if (text[i] === "\n") line++;
  }
  return line;
}

function substitute(template: string, ctx: Context): SubstituteResult {
  const unresolvedPaths: SubstituteResult["unresolvedPaths"] = [];
  const fallbacksUsed: SubstituteResult["fallbacksUsed"] = [];
  const output = template.replace(/\{\{([^{}]+?)\}\}/g, (full, body, offset) => {
    const ref = parseRef(body);
    const line = lineOf(template, offset);
    if (!ref) {
      // Could not parse — leave the literal in place.
      unresolvedPaths.push({ path: body.trim(), line });
      return full;
    }
    const { path: pathStr, fallback } = ref;
    const { found, value } = resolvePath(ctx, pathStr);
    if (!found) {
      if (fallback !== null) {
        fallbacksUsed.push({ path: pathStr, fallback, line });
        return fallback;
      }
      unresolvedPaths.push({ path: pathStr, line });
      // Leave the literal `{{path}}` in place so the output is visible
      // in diff and the next regenerator run can spot it.
      return full;
    }
    return formatValue(value);
  });
  return { output, unresolvedPaths, fallbacksUsed };
}

// ─────────────────────────────────────────────────────────────────────
// Pre-computed helpers (ctx.*)
// ─────────────────────────────────────────────────────────────────────

/** Render a list as prose with "and" before the last item. */
function joinProse(items: readonly string[], conjunction = "and"): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} ${conjunction} ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, ${conjunction} ${items[items.length - 1]}`;
}

/** Render a list as prose with comma separation only (Oxford-style),
 *  no conjunction. Used inside parenthetical short-form lists. */
function joinComma(items: readonly string[]): string {
  return items.join(", ");
}

const NUMBER_WORDS: Record<number, string> = {
  0: "zero", 1: "one", 2: "two", 3: "three", 4: "four", 5: "five",
  6: "six", 7: "seven", 8: "eight", 9: "nine", 10: "ten",
  11: "eleven", 12: "twelve",
};

function numberWord(n: number): string {
  return NUMBER_WORDS[n] ?? String(n);
}

/** Round 25,821 → "26,000"; 30,400 → "30,000". */
function roundedThousandsString(n: number): string {
  const rounded = Math.round(n / 1000) * 1000;
  return rounded.toLocaleString("en-US");
}

/** Turn a fact-key snake_case string into a prose label.
 *  population_total → "population"
 *  life_expectancy_years → "life expectancy"
 *  unemployment_rate_pct → "unemployment"
 *  inflation_rate → "inflation"
 *  public_debt_pct_gdp → "public debt"
 */
function factKeyToProse(factKey: string): string {
  // Strip common stat-suffixes and replace underscores with spaces.
  return factKey
    .replace(/_total$/, "")
    .replace(/_years$/, "")
    .replace(/_rate_pct$/, "")
    .replace(/_pct_gdp$/, "")
    .replace(/_rate$/, "")
    .replace(/_/g, " ");
}

/** Stable preferred ordering for the well-known 5+source fact-keys.
 *  Lower index = appears earlier. The intuitive prose ordering puts
 *  the most commonly-cited indicators first: population, then life
 *  expectancy, then labor-market (unemployment), then macro
 *  (inflation, debt). Names not in the table are appended at the end
 *  in alphabetical order. */
const FACT_KEY_PROSE_ORDER: Record<string, number> = {
  population_total: 0,
  life_expectancy_years: 1,
  unemployment_rate_pct: 2,
  inflation_rate: 3,
  public_debt_pct_gdp: 4,
};

function sortFactKeysForProse(factKeys: readonly string[]): string[] {
  const known = factKeys.filter((k) => k in FACT_KEY_PROSE_ORDER);
  const unknown = factKeys.filter((k) => !(k in FACT_KEY_PROSE_ORDER));
  known.sort(
    (a, b) => FACT_KEY_PROSE_ORDER[a] - FACT_KEY_PROSE_ORDER[b],
  );
  unknown.sort();
  return [...known, ...unknown];
}

function buildContext(
  state: typeof import("../src/lib/content/site-state"),
  stats: Awaited<ReturnType<typeof import("../src/lib/content/site-stats").getSiteStats>> | null,
): Context["ctx"] {
  // Tier-1 shipped publishers (excludes IEA which is scrapped).
  const tier1Shipped = state.tier1Publishers.filter((p) => p.shipped);
  const tier1ShippedFullNames = tier1Shipped.map((p) => p.name);

  // NSO Wave 1 in-progress (live syncs).
  const nsoInProgress = state.nsoWave1.filter((n) => n.status === "in-progress");
  const nsoInProgressNames = nsoInProgress.map((n) => n.name);

  // NSO Wave 1 deferred (both deferred and deferred-permanently).
  // We use a wider element type so TS doesn't narrow the filtered
  // tuple to `never` after branch coverage.
  type NsoEntry = (typeof state.nsoWave1)[number];
  const nsoDeferred: NsoEntry[] = (state.nsoWave1 as readonly NsoEntry[])
    .filter((n) => n.status !== "in-progress");
  // Short prose for the prose paragraph: just status mentions, joined
  // with semicolons because each clause is compound enough that commas
  // would read as a list of names rather than a list of status reports.
  const nsoDeferredShort = nsoDeferred
    .map((n) => {
      if (n.status === "deferred") return `${n.name} deferred to v1.1`;
      if (n.status === "deferred-permanently")
        return `${n.name} permanently deferred`;
      return n.name;
    })
    .join("; ");
  // Long prose for the status table cell — includes deferral reasons.
  // Also joined with semicolons for the same reason: each clause has
  // its own parenthetical and reads better separated.
  const nsoDeferredStatusTable = nsoDeferred
    .map((n) => {
      const deferReason =
        "deferReason" in n && typeof n.deferReason === "string"
          ? n.deferReason
          : null;
      if (n.status === "deferred") {
        if (deferReason) {
          // Strip the leading "Deferred to v1.1 — " from the reason if
          // present; the prefix already says "deferred to v1.1".
          const reason = deferReason.replace(/^Deferred to v1\.1 — /, "");
          return `${n.name} deferred to v1.1 (${reason})`;
        }
        return `${n.name} deferred to v1.1`;
      }
      if (n.status === "deferred-permanently") {
        if (deferReason) {
          // Strip the date prefix from "Deferred YYYY-MM-DD — " too.
          const reason = deferReason.replace(
            /^Deferred \d{4}-\d{2}-\d{2} — /,
            "",
          );
          return `${n.name} permanently deferred (${reason})`;
        }
        return `${n.name} permanently deferred`;
      }
      return n.name;
    })
    .join("; ");

  // Civica Index dimensions — labels for prose + weights as percent integers.
  const ciDimensionLabels = state.civicaIndex.dimensions.map((d) => d.label.toLowerCase());
  const ciWeights = state.civicaIndex.dimensions.map((d) =>
    Math.round(d.weight * 100).toString(),
  );

  // Pulse backtest case labels.
  const pulseCaseLabels = state.pulse.backtest.cases.map((c) => c.label);

  // Five-source fact-keys → prose names. Sorted via
  // `sortFactKeysForProse` so the prose reads in intuitive
  // importance order rather than the raw SQL alphabetical order.
  const fiveSourceProse = stats?.fiveSourceFactKeyNames
    ? joinComma(
        sortFactKeysForProse(stats.fiveSourceFactKeyNames).map(
          factKeyToProse,
        ),
      )
    : "population, life expectancy, unemployment, inflation, public debt";

  // Total facts → rounded thousands string.
  const totalFactsRoundedThousands = stats
    ? roundedThousandsString(stats.totalFacts)
    : "26,000";

  // Launch phase prose.
  const launchPhaseProse =
    state.launchPhase === "pre-launch-beta" ? "pre-launch beta" : "launched";

  // External-review status prose.
  const externalReviewStatusProse =
    state.externalReviewStatus === "not-yet"
      ? "Not yet — planned post-v1"
      : state.externalReviewStatus === "in-review"
        ? "In review"
        : "Complete";

  return {
    launchPhaseProse,
    civicaIndexDimensionCountWord: numberWord(state.civicaIndex.dimensionCount),
    civicaIndexDimensionLabelsProse: joinProse(ciDimensionLabels),
    civicaIndexWeightsString: ciWeights.join("/"),
    civicaIndexStatusUpper: state.civicaIndex.status.toUpperCase(),
    pulseStatusUpper: state.pulse.status.toUpperCase(),
    pulseBacktestCasesProse: joinComma(pulseCaseLabels),
    tier1ShippedCount: tier1Shipped.length,
    tier1ShippedCountWord: numberWord(tier1Shipped.length),
    tier1ShippedFullNamesProse: joinComma(tier1ShippedFullNames),
    nsoInProgressCount: nsoInProgress.length,
    nsoInProgressCountWord: numberWord(nsoInProgress.length),
    nsoInProgressNamesProse: joinComma(nsoInProgressNames),
    nsoDeferredNamesProse: nsoDeferredShort,
    nsoDeferredStatusTableProse: nsoDeferredStatusTable,
    fiveSourceFactKeyNamesProse: fiveSourceProse,
    totalFactsRoundedThousands,
    externalReviewStatusProse,
  };
}

// ─────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = parseArgs(process.argv);

  // 1. Read template.
  const templatePath = path.resolve(process.cwd(), args.template);
  let templateText: string;
  try {
    templateText = await fs.readFile(templatePath, "utf8");
  } catch (err) {
    console.error(`Failed to read template at ${templatePath}:`, err);
    process.exit(1);
  }

  // 2. Load site-state (synchronous, never fails — if it does we exit hard).
  const state = await import("../src/lib/content/site-state");

  // 3. Load site-stats with soft-fail.
  let stats: Awaited<
    ReturnType<typeof import("../src/lib/content/site-stats").getSiteStats>
  > | null = null;
  try {
    const statsModule = await import("../src/lib/content/site-stats");
    stats = await statsModule.getSiteStats();
  } catch (err) {
    console.warn(
      "[soft-fail] getSiteStats() failed; falling back to template-defined fallbacks for {{stats.*}} markers.",
    );
    if (process.env.CI) {
      // In CI this is informational; the regenerator should still complete.
      console.warn("[soft-fail] CI=true — proceeding without DB.");
    } else {
      console.warn("[soft-fail] DB error:", (err as Error).message);
    }
    stats = null;
  }

  // 4. Build context (state + stats + pre-computed helpers).
  const ctx = buildContext(state, stats);
  // The TypeScript types on `state` include re-exports the runtime
  // imports won't expose; coerce to a plain object for the resolver.
  const stateRecord = { ...state } as unknown as Record<string, unknown>;
  const statsRecord = stats as unknown as Record<string, unknown> | null;
  const context: Context = {
    state: stateRecord,
    stats: statsRecord,
    ctx,
  };

  // 5. Strip the template's leading author-facing banner BEFORE
  //    substitution so its `{{path}}` examples (which document the
  //    syntax) don't register as unresolved-path warnings.
  const templateWithoutBanner = templateText.replace(
    /^<!--[\s\S]*?-->\n+/,
    "",
  );

  // 6. Substitute.
  const result = substitute(templateWithoutBanner, context);

  // 7. Report fallbacks + unresolved.
  if (result.fallbacksUsed.length > 0) {
    console.warn(`\n[soft-fail] Used template fallbacks for ${result.fallbacksUsed.length} reference(s):`);
    for (const f of result.fallbacksUsed) {
      console.warn(`  L${f.line}: {{${f.path} | "${f.fallback}"}}`);
    }
  }
  if (result.unresolvedPaths.length > 0) {
    console.warn(`\n[unresolved] ${result.unresolvedPaths.length} reference(s) had no value AND no fallback:`);
    for (const u of result.unresolvedPaths) {
      console.warn(`  L${u.line}: {{${u.path}}}`);
    }
    if (args.strict) {
      console.error(`\n--strict: exiting 1 due to ${result.unresolvedPaths.length} unresolved path(s).`);
      process.exit(1);
    }
  }

  // 8. Prepend the auto-generated banner. We deliberately avoid
  //    embedding a render timestamp because it would introduce
  //    spurious git noise on every regeneration; the only state
  //    that should appear in the banner is "this file is generated".
  const bannerStrippedOutput = result.output;
  const generatedBanner = `<!--
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  This file is GENERATED from README.template.md by
  scripts/regenerate-readme.ts. Do not edit it directly — your changes
  will be overwritten on the next regeneration. Edit the template,
  then run:
      npm run regenerate:readme
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-->
`;
  const finalOutput = generatedBanner + bannerStrippedOutput;

  // 9. Write output.
  const outputPath = path.resolve(process.cwd(), args.output);
  try {
    await fs.writeFile(outputPath, finalOutput, "utf8");
  } catch (err) {
    console.error(`Failed to write output at ${outputPath}:`, err);
    process.exit(1);
  }

  console.log(`\n✓ Regenerated ${args.output} from ${args.template}`);
  console.log(`  - state: ${Object.keys(state).length} top-level exports`);
  console.log(`  - stats: ${stats ? "live (DB)" : "null (soft-fall)"}`);
  console.log(`  - ctx:   ${Object.keys(ctx).length} pre-computed helpers`);
  console.log(`  - fallbacks used: ${result.fallbacksUsed.length}`);
  console.log(`  - unresolved:     ${result.unresolvedPaths.length}`);

  process.exit(0);
}

main().catch((err) => {
  console.error("regenerate-readme threw:", err);
  process.exit(1);
});
