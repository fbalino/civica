/**
 * Design-token drift gate.
 *
 * Owner mandate (2026-07-05, stated emphatically after repeated drift):
 * EVERYTHING follows the design system. Hardcoded values are never
 * acceptable; when something new is needed, a new design-system component
 * gets created first. This script makes that mechanical:
 *
 *   npm run validate:design-tokens            → fail if NEW violations appear
 *   npm run validate:design-tokens -- --update-baseline
 *                                             → re-baseline after a sanctioned
 *                                               cleanup reduces the count
 *
 * What counts as a violation (pragmatic regex heuristics, not a CSS parser):
 *   1. Hex / rgb() / rgba() / oklch() color literals OUTSIDE token-definition
 *      blocks (:root / [data-theme] in CSS) and outside the allowlist.
 *   2. Pixel font sizes (font-size: NNpx / fontSize: "NNpx" or numeric)
 *      outside token definitions.
 *   3. Monospace font usage via --font-code outside code-snippet contexts is
 *      NOT detectable by regex — that stays a review rule. But raw
 *      font-family literals naming fonts other than the stack tokens are
 *      flagged.
 *
 * Pre-existing violations live in scripts/design-token-baseline.json — the
 * gate fails only when a file EXCEEDS its baselined count (new drift), and
 * warns when counts drop (run --update-baseline to ratchet down). New files
 * have baseline 0: fully clean or fail.
 */
import { readFileSync, writeFileSync, existsSync } from "fs";
import { execSync } from "child_process";
import path from "path";

const REPO = path.resolve(__dirname, "..");
const BASELINE_PATH = path.join(REPO, "scripts", "design-token-baseline.json");
const UPDATE = process.argv.includes("--update-baseline");

// Files where raw color values are sanctioned.
const ALLOWLIST = [
  "src/app/globals.css", // token-definition blocks (stripped below), engraving filters
  "src/components/DesignSystemSwatch", // documented swatch primitive
  "src/app/design-system/", // canonical reference page shows literals on purpose
  "src/app/embed/", // self-contained embed defines its own token block
  "src/lib/og", // baked share-image colors, documented
];

const COLOR_RE = /#[0-9a-fA-F]{3,8}\b|(?<![-\w])(?:rgba?|oklch|hsla?)\(/g;
const PX_FONT_RE = /font-size:\s*\d+px|fontSize:\s*["']?\d+(?:px)?["']?\s*[,}]/g;
const FONT_FAMILY_RE =
  /font-family:\s*["']?(?!var\()(?:(?!inherit|initial|unset)[A-Za-z])/g;

/** Strip CSS token-definition blocks (:root{...}, [data-theme...]{...}). */
function stripTokenBlocks(css: string): string {
  return css.replace(
    /(^|\n)\s*(:root|\[data-theme[^\]]*\])[^{]*\{[^}]*\}/g,
    "\n"
  );
}

function listFiles(): string[] {
  const out = execSync(
    'git ls-files "src/**/*.tsx" "src/**/*.ts" "src/**/*.css" && git ls-files --others --exclude-standard "src/**/*.tsx" "src/**/*.ts" "src/**/*.css"',
    { cwd: REPO, encoding: "utf8" }
  );
  return [...new Set(out.split("\n").filter(Boolean))];
}

function countViolations(file: string): { count: number; samples: string[] } {
  const abs = path.join(REPO, file);
  // git ls-files lists tracked-but-deleted paths; skip anything not on disk.
  if (!existsSync(abs)) return { count: 0, samples: [] };
  let text = readFileSync(abs, "utf8");
  if (file.endsWith(".css")) text = stripTokenBlocks(text);
  const samples: string[] = [];
  let count = 0;
  for (const re of [COLOR_RE, PX_FONT_RE, FONT_FAMILY_RE]) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      count++;
      if (samples.length < 3) {
        const line = text.slice(0, m.index).split("\n").length;
        samples.push(`${file}:${line} → ${m[0].trim().slice(0, 40)}`);
      }
    }
  }
  return { count, samples };
}

function main() {
  const files = listFiles().filter(
    (f) => !ALLOWLIST.some((a) => f.startsWith(a))
  );
  const current: Record<string, number> = {};
  const allSamples: string[] = [];
  for (const f of files) {
    const { count, samples } = countViolations(f);
    if (count > 0) {
      current[f] = count;
      allSamples.push(...samples);
    }
  }

  if (UPDATE || !existsSync(BASELINE_PATH)) {
    writeFileSync(BASELINE_PATH, JSON.stringify(current, null, 2) + "\n");
    const total = Object.values(current).reduce((a, b) => a + b, 0);
    console.log(
      `✓ Baseline ${UPDATE ? "updated" : "created"}: ${Object.keys(current).length} files, ${total} pre-existing violations recorded.`
    );
    return;
  }

  const baseline: Record<string, number> = JSON.parse(
    readFileSync(BASELINE_PATH, "utf8")
  );
  const regressions: string[] = [];
  let improved = 0;
  for (const [file, count] of Object.entries(current)) {
    const base = baseline[file] ?? 0;
    if (count > base) {
      regressions.push(
        `${file}: ${count} violations (baseline ${base}) — NEW hardcoded values`
      );
    } else if (count < base) improved++;
  }

  if (regressions.length > 0) {
    console.error("✗ DESIGN-TOKEN DRIFT — new hardcoded values detected:\n");
    for (const r of regressions) console.error("  " + r);
    console.error(
      "\nUse design tokens (var(--color-*), var(--text-*), var(--font-*))."
    );
    console.error(
      "If the system genuinely lacks what you need, add a token/component to"
    );
    console.error(
      "the design system FIRST (globals.css + /design-system + DESIGN.md)."
    );
    const offending = allSamples.filter((s) =>
      regressions.some((r) => s.startsWith(r.split(":")[0]))
    );
    if (offending.length) {
      console.error("\nSamples:");
      for (const s of offending.slice(0, 10)) console.error("  " + s);
    }
    process.exit(1);
  }

  const total = Object.values(current).reduce((a, b) => a + b, 0);
  console.log(
    `✓ No new design-token drift (${total} baselined legacy violations remain${improved ? `; ${improved} files improved — consider --update-baseline` : ""}).`
  );
}

main();
