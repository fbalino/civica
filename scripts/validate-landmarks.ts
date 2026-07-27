/**
 * Document landmark / heading policy gate (EXP-034).
 *
 * The root layout (`src/app/layout.tsx`) provides the ONE page `<main>`
 * landmark and the site-wide `<footer>` (contentinfo, since it renders as a
 * sibling of `<main>`, not nested inside it). This script makes three related
 * structural rules mechanically enforceable, the same baseline-ratchet way
 * `validate-design-tokens.ts` and `validate-alt-text-policy.ts` do:
 *
 *   npm run validate:landmarks                 → fail if NEW violations appear
 *   npm run validate:landmarks -- --update-baseline
 *                                             → re-baseline after a sanctioned
 *                                               cleanup reduces the count
 *
 * What counts as a violation (pragmatic regex heuristics over `.tsx` JSX
 * source, not a real JSX/AST parser — same caveat validate-design-tokens.ts
 * and validate-alt-text-policy.ts document):
 *
 *   1. nested-main — a page-level `<main` tag or `role="main"` attribute
 *      anywhere under `src/**​/*.tsx` OTHER than the two files allowed to own
 *      a document `<main>`: the root layout (which wraps every route's
 *      `{children}` in the single page `<main>`) and `global-error.tsx`
 *      (which replaces the ENTIRE document, including the root layout, when
 *      the layout itself throws, so it must render its own landmark tree).
 *      Any other file declaring `<main>` nests a second main landmark inside
 *      the layout's — invalid per the HTML landmark spec (one `main` per
 *      document) and confusing for screen-reader "jump to main" navigation.
 *
 *   2. banner-contentinfo-misuse — a literal `role="banner"` or
 *      `role="contentinfo"` attribute anywhere outside the allowlist. Civica's
 *      site chrome (`SiteHeader.tsx`, `SiteFooter.tsx`) intentionally relies
 *      on implicit landmark roles from `<nav>`/`<footer>` element semantics
 *      rather than manual role overrides, so the allowlist starts empty — any
 *      occurrence is new drift by construction.
 *
 *   3. multiple-h1 — more than one literal `<h1` tag inside a single
 *      `page.tsx` file. A page module rendering two h1s in the SAME return
 *      branch is a heading-order bug; a few page.tsx files render one h1 per
 *      mutually-exclusive early-return branch (loading/error/empty/success
 *      states that never render together) and are baselined with a comment
 *      explaining why — see scripts/landmark-policy-baseline.json.
 *
 * Known limitation (documented, not silently ignored): heading order and h1
 * presence are frequently composed from imported components (e.g. a shared
 * `PageHero` that renders the literal `<h1>`), so this script does NOT flag
 * "zero `<h1>` in page.tsx" as a violation — that would be overwhelmingly
 * false positives. It only catches the two-or-more-in-one-file class, and the
 * unambiguous nested-`<main>` / manual banner-contentinfo-role classes.
 */
import { readFileSync, writeFileSync, existsSync } from "fs";
import { execSync } from "child_process";
import path from "path";
import { blankComments } from "./validate-alt-text-policy";

const REPO = path.resolve(__dirname, "..");
const BASELINE_PATH = path.join(REPO, "scripts", "landmark-policy-baseline.json");
const UPDATE = process.argv.includes("--update-baseline");

// The only two files permitted to render a document `<main>` — see the rule
// doc comment above.
const NESTED_MAIN_EXEMPT_FILES = new Set<string>([
  "src/app/layout.tsx",
  "src/app/global-error.tsx",
]);

// Files permitted to declare role="banner" / role="contentinfo" manually.
// Empty today: SiteHeader.tsx is a <nav>, SiteFooter.tsx is a <footer>
// rendered as a sibling of the layout's <main> — both get correct implicit
// landmark roles without an explicit role attribute.
const BANNER_CONTENTINFO_ALLOWLIST = new Set<string>([]);

const MAIN_TAG_RE = /<main(?=[\s/>])/g;
const ROLE_MAIN_RE = /\brole\s*=\s*(?:"main"|'main'|\{\s*["']main["']\s*\})/g;
const ROLE_BANNER_CONTENTINFO_RE =
  /\brole\s*=\s*(?:"(banner|contentinfo)"|'(banner|contentinfo)'|\{\s*["'](banner|contentinfo)["']\s*\})/g;
const H1_TAG_RE = /<h1(?=[\s/>])/g;

export interface LandmarkViolation {
  file: string;
  line: number;
  rule: "nested-main" | "banner-contentinfo-misuse" | "multiple-h1";
  snippet: string;
}

function lineOf(text: string, index: number): number {
  return text.slice(0, index).split("\n").length;
}

function snippetAt(text: string, index: number, len = 80): string {
  return text
    .slice(index, index + len)
    .replace(/\s+/g, " ")
    .trim();
}

/** Rule 1 — a page-level `<main>` / `role="main"` outside the two exempt files. */
export function findNestedMainViolations(
  file: string,
  source: string,
): LandmarkViolation[] {
  if (NESTED_MAIN_EXEMPT_FILES.has(file)) return [];
  const text = blankComments(source);
  const violations: LandmarkViolation[] = [];
  for (const re of [MAIN_TAG_RE, ROLE_MAIN_RE]) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      violations.push({
        file,
        line: lineOf(text, m.index),
        rule: "nested-main",
        snippet: snippetAt(text, m.index),
      });
    }
  }
  return violations;
}

/** Rule 2 — manual role="banner" / role="contentinfo" outside the allowlist. */
export function findBannerContentinfoViolations(
  file: string,
  source: string,
): LandmarkViolation[] {
  if (BANNER_CONTENTINFO_ALLOWLIST.has(file)) return [];
  const text = blankComments(source);
  const violations: LandmarkViolation[] = [];
  ROLE_BANNER_CONTENTINFO_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = ROLE_BANNER_CONTENTINFO_RE.exec(text))) {
    violations.push({
      file,
      line: lineOf(text, m.index),
      rule: "banner-contentinfo-misuse",
      snippet: snippetAt(text, m.index),
    });
  }
  return violations;
}

/** Rule 3 — more than one literal `<h1` in a single file. */
export function findMultipleH1Violations(
  file: string,
  source: string,
): LandmarkViolation[] {
  const text = blankComments(source);
  H1_TAG_RE.lastIndex = 0;
  const matches: RegExpExecArray[] = [];
  let m: RegExpExecArray | null;
  while ((m = H1_TAG_RE.exec(text))) matches.push(m);
  if (matches.length <= 1) return [];
  return matches.map((mm) => ({
    file,
    line: lineOf(text, mm.index),
    rule: "multiple-h1" as const,
    snippet: snippetAt(text, mm.index),
  }));
}

function listFiles(pattern: string): string[] {
  const out = execSync(
    `git ls-files "${pattern}" && git ls-files --others --exclude-standard "${pattern}"`,
    { cwd: REPO, encoding: "utf8" },
  );
  return [...new Set(out.split("\n").filter(Boolean))];
}

interface Baseline {
  nestedMain: Record<string, number>;
  bannerContentinfo: Record<string, number>;
  multipleH1: Record<string, number>;
}

const EMPTY_BASELINE: Baseline = {
  nestedMain: {},
  bannerContentinfo: {},
  multipleH1: {},
};

function countByFile(violations: LandmarkViolation[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const v of violations) out[v.file] = (out[v.file] ?? 0) + 1;
  return out;
}

function checkCategory(
  label: string,
  current: Record<string, number>,
  baseline: Record<string, number>,
  allViolations: LandmarkViolation[],
): { regressions: string[]; improved: number } {
  const regressions: string[] = [];
  let improved = 0;
  for (const [file, count] of Object.entries(current)) {
    const base = baseline[file] ?? 0;
    if (count > base) {
      regressions.push(`[${label}] ${file}: ${count} violations (baseline ${base})`);
    } else if (count < base) {
      improved++;
    }
  }
  if (regressions.length > 0) {
    const offendingFiles = new Set(
      regressions.map((r) => r.slice(r.indexOf("]") + 2, r.indexOf(":"))),
    );
    const samples = allViolations.filter((v) => offendingFiles.has(v.file));
    for (const s of samples.slice(0, 10)) {
      regressions.push(`    ${s.file}:${s.line} → ${s.snippet}`);
    }
  }
  return { regressions, improved };
}

function main() {
  const tsxFiles = listFiles("src/**/*.tsx");
  const pageFiles = listFiles("src/app/**/page.tsx");

  const nestedMainViolations: LandmarkViolation[] = [];
  const bannerViolations: LandmarkViolation[] = [];
  const h1Violations: LandmarkViolation[] = [];

  for (const f of tsxFiles) {
    const abs = path.join(REPO, f);
    if (!existsSync(abs)) continue; // git ls-files can list deleted paths
    const source = readFileSync(abs, "utf8");
    nestedMainViolations.push(...findNestedMainViolations(f, source));
    bannerViolations.push(...findBannerContentinfoViolations(f, source));
  }

  for (const f of pageFiles) {
    const abs = path.join(REPO, f);
    if (!existsSync(abs)) continue;
    const source = readFileSync(abs, "utf8");
    h1Violations.push(...findMultipleH1Violations(f, source));
  }

  const current: Baseline = {
    nestedMain: countByFile(nestedMainViolations),
    bannerContentinfo: countByFile(bannerViolations),
    multipleH1: countByFile(h1Violations),
  };

  if (UPDATE || !existsSync(BASELINE_PATH)) {
    writeFileSync(BASELINE_PATH, JSON.stringify(current, null, 2) + "\n");
    const total =
      Object.values(current.nestedMain).reduce((a, b) => a + b, 0) +
      Object.values(current.bannerContentinfo).reduce((a, b) => a + b, 0) +
      Object.values(current.multipleH1).reduce((a, b) => a + b, 0);
    console.log(
      `✓ Baseline ${UPDATE ? "updated" : "created"}: ${total} pre-existing violations recorded across nested-main/banner-contentinfo/multiple-h1.`,
    );
    return;
  }

  const baseline: Baseline = JSON.parse(readFileSync(BASELINE_PATH, "utf8"));
  const allViolations = [...nestedMainViolations, ...bannerViolations, ...h1Violations];

  const nestedMainResult = checkCategory(
    "nested-main",
    current.nestedMain,
    baseline.nestedMain ?? EMPTY_BASELINE.nestedMain,
    allViolations,
  );
  const bannerResult = checkCategory(
    "banner-contentinfo-misuse",
    current.bannerContentinfo,
    baseline.bannerContentinfo ?? EMPTY_BASELINE.bannerContentinfo,
    allViolations,
  );
  const h1Result = checkCategory(
    "multiple-h1",
    current.multipleH1,
    baseline.multipleH1 ?? EMPTY_BASELINE.multipleH1,
    allViolations,
  );

  const regressions = [
    ...nestedMainResult.regressions,
    ...bannerResult.regressions,
    ...h1Result.regressions,
  ];
  const improved = nestedMainResult.improved + bannerResult.improved + h1Result.improved;

  if (regressions.length > 0) {
    console.error("✗ LANDMARK POLICY DRIFT — new violations detected:\n");
    for (const r of regressions) console.error("  " + r);
    console.error(
      "\nEach page must expose exactly one main landmark (the root layout owns it —",
    );
    console.error(
      "never add a page-level <main> or role=\"main\"), correct banner/contentinfo",
    );
    console.error(
      "usage (no manual role=\"banner\"/role=\"contentinfo\" outside the allowlist),",
    );
    console.error("and a single <h1> per page module. See EXP-034 evidence at");
    console.error("plan/evidence/EXP-034/README.md for the full policy and rationale.");
    process.exit(1);
  }

  const total =
    Object.values(current.nestedMain).reduce((a, b) => a + b, 0) +
    Object.values(current.bannerContentinfo).reduce((a, b) => a + b, 0) +
    Object.values(current.multipleH1).reduce((a, b) => a + b, 0);
  console.log(
    `✓ No new landmark policy drift (${total} baselined legacy violations remain${improved ? `; ${improved} categories improved — consider --update-baseline` : ""}).`,
  );
}

if (require.main === module) {
  main();
}
