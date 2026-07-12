/**
 * Alternative-text policy gate (EXP-023).
 *
 * DESIGN.md "Alternative text" defines a closed policy: every image is
 * either MEANINGFUL (real descriptive `alt`) or DECORATIVE (`alt=""` +
 * `aria-hidden`, because adjacent visible text already names it or it is
 * pure ornament). This script makes the mechanical half of that policy
 * enforceable, the same baseline-ratchet way `validate-design-tokens.ts`
 * does:
 *
 *   npm run validate:alt-text-policy            → fail if NEW violations appear
 *   npm run validate:alt-text-policy -- --update-baseline
 *                                             → re-baseline after a sanctioned
 *                                               cleanup reduces the count
 *
 * What counts as a violation (pragmatic regex heuristics over `.tsx` JSX
 * source, not a real JSX/AST parser — same caveat validate-design-tokens.ts
 * documents):
 *
 *   1. missing-alt      — an `<img>` / `<Image>` self-closing JSX tag with no
 *                          `alt=` attribute at all.
 *   2. missing-aria-hidden — a DECORATIVE image (`alt=""` / `alt={""}` /
 *                          `alt={''}`, a literal empty string) with no
 *                          `aria-hidden` attribute anywhere in the tag.
 *
 * A meaningful image (non-empty or dynamic `alt={expr}`) is never flagged —
 * this script cannot know whether a dynamic alt resolves to "" at runtime,
 * so it only enforces the LITERAL-empty-string case mechanically. Reviewers
 * still own judging whether a dynamic alt is the right call per DESIGN.md.
 *
 * Pre-existing violations live in scripts/alt-text-policy-baseline.json —
 * the gate fails only when a file EXCEEDS its baselined count (new drift),
 * and warns when counts drop (run --update-baseline to ratchet down). New
 * files have baseline 0: fully clean or fail.
 */
import { readFileSync, writeFileSync, existsSync } from "fs";
import { execSync } from "child_process";
import path from "path";

const REPO = path.resolve(__dirname, "..");
const BASELINE_PATH = path.join(REPO, "scripts", "alt-text-policy-baseline.json");
const UPDATE = process.argv.includes("--update-baseline");

// Self-closing <img ...> / <Image ...> JSX tags. Every current call site in
// the repo self-closes (img is a void element; next/image's <Image> never
// takes children), so this is the shape we scan for.
const IMG_TAG_RE = /<(img|Image)\b[\s\S]*?\/>/g;
const ALT_ATTR_RE = /\balt\s*=/;
const ALT_EMPTY_RE = /alt\s*=\s*(""|''|\{\s*""\s*\}|\{\s*''\s*\})/;
const ARIA_HIDDEN_RE = /\baria-hidden\b/;

export interface AltTextViolation {
  file: string;
  line: number;
  rule: "missing-alt" | "missing-aria-hidden";
  snippet: string;
}

/**
 * Blank out `/* ... *\/` and `// ...` comments IN PLACE (replace characters
 * with spaces, preserve newlines) so a commented-out or prose-mentioned
 * `<img>` (e.g. "plain lazy <img>" in a doc comment) can never be mistaken
 * for real JSX — and so line numbers computed on the blanked text still
 * match the original file exactly.
 */
export function blankComments(text: string): string {
  let out = text.replace(/\/\*[\s\S]*?\*\//g, (m) =>
    [...m].map((c) => (c === "\n" ? "\n" : " ")).join("")
  );
  out = out.replace(/(^|\s)\/\/.*/gm, (m, lead: string) =>
    lead + " ".repeat(m.length - lead.length)
  );
  return out;
}

/** Scan one file's source text for alt-text policy violations. */
export function findAltTextViolations(
  file: string,
  source: string
): AltTextViolation[] {
  const text = blankComments(source);
  const violations: AltTextViolation[] = [];
  IMG_TAG_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = IMG_TAG_RE.exec(text))) {
    const tag = m[0];
    const line = text.slice(0, m.index).split("\n").length;
    const snippet = tag.replace(/\s+/g, " ").trim().slice(0, 80);
    if (!ALT_ATTR_RE.test(tag)) {
      violations.push({ file, line, rule: "missing-alt", snippet });
      continue;
    }
    if (ALT_EMPTY_RE.test(tag) && !ARIA_HIDDEN_RE.test(tag)) {
      violations.push({ file, line, rule: "missing-aria-hidden", snippet });
    }
  }
  return violations;
}

function listFiles(): string[] {
  const out = execSync(
    'git ls-files "src/**/*.tsx" && git ls-files --others --exclude-standard "src/**/*.tsx"',
    { cwd: REPO, encoding: "utf8" }
  );
  return [...new Set(out.split("\n").filter(Boolean))];
}

function main() {
  const files = listFiles();
  const current: Record<string, number> = {};
  const allViolations: AltTextViolation[] = [];

  for (const f of files) {
    const abs = path.join(REPO, f);
    if (!existsSync(abs)) continue; // git ls-files can list deleted paths
    const source = readFileSync(abs, "utf8");
    const violations = findAltTextViolations(f, source);
    if (violations.length > 0) {
      current[f] = violations.length;
      allViolations.push(...violations);
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
      regressions.push(`${file}: ${count} violations (baseline ${base}) — NEW alt-text drift`);
    } else if (count < base) improved++;
  }

  if (regressions.length > 0) {
    console.error("✗ ALT-TEXT POLICY DRIFT — new violations detected:\n");
    for (const r of regressions) console.error("  " + r);
    console.error(
      "\nEvery image is either MEANINGFUL (a real descriptive alt) or DECORATIVE"
    );
    console.error(
      "(alt=\"\" + aria-hidden). See DESIGN.md \"Alternative text\" for the"
    );
    console.error("policy and per-class treatment (flags, portraits, maps/charts,");
    console.error("engravings, org marks, icons).");
    const offendingFiles = new Set(regressions.map((r) => r.split(":")[0]));
    const samples = allViolations.filter((v) => offendingFiles.has(v.file));
    if (samples.length) {
      console.error("\nSamples:");
      for (const s of samples.slice(0, 10)) {
        console.error(`  ${s.file}:${s.line} [${s.rule}] → ${s.snippet}`);
      }
    }
    process.exit(1);
  }

  const total = Object.values(current).reduce((a, b) => a + b, 0);
  console.log(
    `✓ No new alt-text policy drift (${total} baselined legacy violations remain${improved ? `; ${improved} files improved — consider --update-baseline` : ""}).`
  );
}

if (require.main === module) {
  main();
}
