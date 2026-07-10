/**
 * validate-doc-sources — CLM-009 documentation-source registry
 * validator. Deterministic, DB-free, network-free.
 *
 *   Run with:  npm run validate:doc-sources
 *              npm run validate:doc-sources -- --help
 *
 * Checks, in order (any failure sets a non-zero exit code; all checks
 * still run and report so a single pass shows every problem):
 *
 *   1. Registry invariants — `checkRegistryInvariants(DOC_CONCEPTS)`:
 *      unique concept ids, unique canonical path+symbol pairs, no
 *      relation duplicating its own canonical, no deferred concept
 *      declaring a `generated` relation — plus `checkSurfaceCoverage`:
 *      every mandated surface kind (reader-markdown, reader-tsx,
 *      readme, api-example, runbook, memory) is actually used at
 *      least once.
 *   2. Registry location existence — every path named in DOC_CONCEPTS
 *      (canonical or relation) actually exists on disk.
 *   3. publicClaimIds cross-reference — every `DocConcept.publicClaimIds`
 *      entry is a real id in `PUBLIC_CLAIMS` (id-only comparison; no
 *      claim prose/tier/value is imported or duplicated here).
 *   4. Generated-block drift — re-runs the two CLM-009 generators in
 *      `--check` mode (normalization table, PCA analysis snapshot).
 *   5. Formula-fingerprint scan — every registered `generated`
 *      concept's formula/table text must not appear a second time
 *      OUTSIDE its declared generated block, in any SCANNABLE surface
 *      (`content/*.md`, README.md/README.template.md, and every
 *      reader-tsx/readme/api-example path named in the registry).
 *      `memory` and `runbook` locations are scan-exempt by design.
 *   6. Redirect route resolution — every `next.config.ts` redirect
 *      (via `src/lib/routing/redirects.ts`) either resolves to a real
 *      app route, is a legitimate dynamic passthrough (skipped, not
 *      failed — see `src/lib/docs/routes.ts`), or is reported as a
 *      stale route.
 *   7. Same-document anchor links — every `content/*.md` file's
 *      same-document `#anchor` links resolve to a real heading anchor.
 *   8. Cross-document links — every STATIC `/route` and `/route#anchor`
 *      link found in a registered reader-markdown/reader-tsx surface
 *      resolves through the route resolver (step 6's machinery) and,
 *      for the anchor portion, against the pooled set of anchors
 *      known from registered content. Dynamic JSX link expressions
 *      (`href={...}`) are never extracted, so they can never be
 *      reported as passing.
 *
 * Does NOT import `next.config.ts` (see `src/lib/docs/routes.ts`'s
 * module doc for why) and does not worsen the known Turbopack
 * broad-trace warning — this script never touches Next's build
 * pipeline.
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

import {
  DOC_CONCEPTS,
  checkRegistryInvariants,
  checkSurfaceCoverage,
  checkPublicClaimIds,
  type DocConcept,
  type DocLocation,
  type DocSurfaceKind,
} from "../src/lib/docs/doc-concepts";
import { scanForFingerprints, type ScanTarget } from "../src/lib/docs/formula-scan";
import { getNormalizationTableRows } from "../src/lib/ci/normalization-table";
import { scanAppRoutes, destinationResolves, type AppRoute } from "../src/lib/docs/routes";
import { REDIRECTS } from "../src/lib/routing/redirects";
import {
  extractHeadingAnchorIds,
  extractInternalLinks,
  extractStaticTsxLinks,
  extractTsxSectionAnchorIds,
  checkSameDocumentAnchorLink,
  checkCrossDocumentLink,
} from "../src/lib/docs/links";
import { PUBLIC_CLAIMS } from "../src/lib/claims/public-claims";

const ROOT = process.cwd();

interface Report {
  errors: string[];
  info: string[];
}

function parseArgs(argv: string[]): { help: boolean } {
  const help = argv.includes("--help") || argv.includes("-h");
  return { help };
}

async function fileExists(relPath: string): Promise<boolean> {
  try {
    await fs.access(path.join(ROOT, relPath));
    return true;
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────
// 1 + 2. Registry invariants + location existence
// ─────────────────────────────────────────────────────────────────────

async function checkRegistry(report: Report): Promise<void> {
  const issues = checkRegistryInvariants(DOC_CONCEPTS);
  for (const issue of issues) {
    report.errors.push(`[registry] ${issue.conceptId}: ${issue.message}`);
  }
  if (issues.length === 0) {
    report.info.push(`[registry] ${DOC_CONCEPTS.length} concept(s), no invariant violations`);
  }

  const coverageIssues = checkSurfaceCoverage(DOC_CONCEPTS);
  for (const issue of coverageIssues) {
    report.errors.push(`[registry] ${issue.message}`);
  }
  if (coverageIssues.length === 0) {
    report.info.push(
      "[registry] all 6 mandated surface kinds (reader-markdown, reader-tsx, readme, api-example, runbook, memory) are represented",
    );
  }

  const allLocations: { concept: DocConcept; location: DocLocation }[] = [];
  for (const concept of DOC_CONCEPTS) {
    allLocations.push({ concept, location: concept.canonical });
    for (const relation of concept.relations) {
      allLocations.push({ concept, location: relation });
    }
  }

  let missing = 0;
  for (const { concept, location } of allLocations) {
    // "source" locations may name a directory (e.g. the PCA
    // analysis-run bundle) — existence-check the directory itself.
    const exists = await fileExists(location.path);
    if (!exists) {
      missing++;
      report.errors.push(
        `[registry] ${concept.id}: location does not exist on disk: ${location.path}`,
      );
    }
  }
  if (missing === 0) {
    report.info.push(`[registry] all ${allLocations.length} registered location(s) exist on disk`);
  }
}

// ─────────────────────────────────────────────────────────────────────
// 3. publicClaimIds cross-reference (id-only; never imports claim prose)
// ─────────────────────────────────────────────────────────────────────

function runPublicClaimIdsCheck(report: Report): void {
  const knownIds = new Set(PUBLIC_CLAIMS.map((c) => c.id));
  const checked = DOC_CONCEPTS.reduce(
    (sum, c) => sum + (c.publicClaimIds?.length ?? 0),
    0,
  );
  const issues = checkPublicClaimIds(DOC_CONCEPTS, knownIds);
  for (const issue of issues) {
    report.errors.push(`[claims] ${issue.conceptId}: ${issue.message}`);
  }
  report.info.push(
    `[claims] ${checked} publicClaimIds reference(s) checked against ${knownIds.size} registered PUBLIC_CLAIMS id(s), ${issues.length} unknown`,
  );
}

// ─────────────────────────────────────────────────────────────────────
// 4. Generated-block / snapshot drift
// ─────────────────────────────────────────────────────────────────────

function runGeneratorCheck(scriptRelPath: string, label: string, report: Report): void {
  try {
    execFileSync("npx", ["tsx", scriptRelPath, "--check"], {
      cwd: ROOT,
      encoding: "utf8",
      stdio: "pipe",
    });
    report.info.push(`[generated] ${label}: no drift`);
  } catch (err) {
    const output =
      err && typeof err === "object" && "stdout" in err
        ? String((err as { stdout?: unknown }).stdout ?? "") +
          String((err as { stderr?: unknown }).stderr ?? "")
        : String(err);
    report.errors.push(`[generated] ${label}: drift detected\n${output.trim()}`);
  }
}

function checkGeneratedDrift(report: Report): void {
  runGeneratorCheck(
    "scripts/generate-ci-normalization-table.ts",
    "CI normalization table",
    report,
  );
  runGeneratorCheck("scripts/generate-pca-analysis.ts", "PCA analysis snapshot", report);
}

// ─────────────────────────────────────────────────────────────────────
// 5. Formula-fingerprint scan
// ─────────────────────────────────────────────────────────────────────

/** Registered fingerprints, one per concept whose canonical formula
 *  text must never be hand-retyped outside its declared generated
 *  block. Kept short/deliberate per CLM-009 §2 — no bare numbers. */
function buildFingerprints() {
  return getNormalizationTableRows().map((row) => ({
    conceptId: "ci-normalization-table",
    text: row.transformLabel,
  }));
}

function surfaceKindForPath(p: string): DocSurfaceKind | null {
  if (p.startsWith("content/") && p.endsWith(".md")) return "reader-markdown";
  if (p === "README.md" || p === "README.template.md") return "readme";
  if (p.endsWith(".tsx") && p.startsWith("src/app/")) return "reader-tsx";
  return null;
}

async function collectScanTargets(): Promise<ScanTarget[]> {
  const targets: ScanTarget[] = [];
  const seen = new Set<string>();

  const contentDir = path.join(ROOT, "content");
  const contentEntries = await fs.readdir(contentDir, { withFileTypes: true });
  for (const entry of contentEntries) {
    if (entry.isFile() && entry.name.endsWith(".md")) {
      const relPath = `content/${entry.name}`;
      seen.add(relPath);
      targets.push({
        path: relPath,
        kind: "reader-markdown",
        content: await fs.readFile(path.join(contentDir, entry.name), "utf8"),
      });
    }
  }

  for (const relPath of ["README.md", "README.template.md"]) {
    if (await fileExists(relPath)) {
      seen.add(relPath);
      targets.push({
        path: relPath,
        kind: "readme",
        content: await fs.readFile(path.join(ROOT, relPath), "utf8"),
      });
    }
  }

  // Every reader-tsx/readme/api-example location named anywhere in
  // the registry, so the scanner covers registered TSX pages without
  // walking the entire (unrelated) src/app tree.
  for (const concept of DOC_CONCEPTS) {
    const locations = [concept.canonical, ...concept.relations];
    for (const location of locations) {
      if (location.kind !== "reader-tsx" && location.kind !== "api-example") continue;
      if (seen.has(location.path)) continue;
      const kind = surfaceKindForPath(location.path) ?? location.kind;
      if (await fileExists(location.path)) {
        seen.add(location.path);
        targets.push({
          path: location.path,
          kind,
          content: await fs.readFile(path.join(ROOT, location.path), "utf8"),
        });
      }
    }
  }

  return targets;
}

async function checkFormulaFingerprints(report: Report, targets: ScanTarget[]): Promise<void> {
  const fingerprints = buildFingerprints();
  const violations = scanForFingerprints(targets, fingerprints);

  if (violations.length === 0) {
    report.info.push(
      `[fingerprint] ${targets.length} surface(s) scanned for ${fingerprints.length} registered formula(s), no duplicates found outside generated blocks`,
    );
    return;
  }
  for (const v of violations) {
    report.errors.push(
      `[fingerprint] ${v.conceptId}: duplicated formula text found outside its generated block at ${v.path}:${v.line}`,
    );
  }
}

// ─────────────────────────────────────────────────────────────────────
// 6. Redirect route resolution
// ─────────────────────────────────────────────────────────────────────

async function checkRedirectRoutes(report: Report, routes: AppRoute[]): Promise<void> {
  let ok = 0;
  let skipped = 0;
  let bad = 0;
  for (const redirect of REDIRECTS) {
    const result = destinationResolves(redirect.destination, routes);
    if (result === true) {
      ok++;
    } else if (result === "skipped") {
      skipped++;
    } else {
      bad++;
      report.errors.push(
        `[routes] stale redirect: "${redirect.source}" -> "${redirect.destination}" does not resolve to any known app route`,
      );
    }
  }
  report.info.push(
    `[routes] ${REDIRECTS.length} redirect(s) checked against ${routes.length} app route(s): ${ok} resolved, ${skipped} skipped (ambiguous dynamic passthrough), ${bad} stale`,
  );
}

// ─────────────────────────────────────────────────────────────────────
// 7. Same-document anchor links (registered reader-markdown only)
// ─────────────────────────────────────────────────────────────────────

async function checkAnchorLinks(report: Report): Promise<void> {
  const contentDir = path.join(ROOT, "content");
  const entries = await fs.readdir(contentDir, { withFileTypes: true });
  let checked = 0;
  let bad = 0;
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
    const relPath = `content/${entry.name}`;
    const content = await fs.readFile(path.join(contentDir, entry.name), "utf8");
    const anchorIds = extractHeadingAnchorIds(content);
    const links = extractInternalLinks(content);
    for (const link of links) {
      if (!link.href.startsWith("#")) continue; // cross-document: step 8, below
      checked++;
      const result = checkSameDocumentAnchorLink(link, anchorIds);
      if (!result.ok) {
        bad++;
        report.errors.push(`[anchors] ${relPath}:${link.line}: ${result.reason}`);
      }
    }
  }
  report.info.push(`[anchors] ${checked} same-document anchor link(s) checked, ${bad} broken`);
}

// ─────────────────────────────────────────────────────────────────────
// 8. Cross-document links (registered reader-markdown + reader-tsx)
// ─────────────────────────────────────────────────────────────────────

async function checkCrossDocumentLinks(
  report: Report,
  routes: AppRoute[],
  scanTargets: ScanTarget[],
): Promise<void> {
  const resolver = (p: string) => destinationResolves(p, routes);

  // Pooled anchor ids from every scanned reader-markdown/readme
  // (heading anchors) and reader-tsx (static `id="..."` section
  // anchors) surface. See checkCrossDocumentLink's doc for why this
  // is a POOL rather than a precise per-route mapping.
  const knownAnchorIds = new Set<string>();
  for (const target of scanTargets) {
    if (target.kind === "reader-markdown" || target.kind === "readme") {
      for (const id of extractHeadingAnchorIds(target.content)) knownAnchorIds.add(id);
    } else if (target.kind === "reader-tsx") {
      for (const id of extractTsxSectionAnchorIds(target.content)) knownAnchorIds.add(id);
    }
  }

  let checked = 0;
  let bad = 0;
  for (const target of scanTargets) {
    let links: { href: string; line: number }[] = [];
    if (target.kind === "reader-markdown" || target.kind === "readme") {
      links = extractInternalLinks(target.content).filter((l) => l.href.startsWith("/"));
    } else if (target.kind === "reader-tsx") {
      links = extractStaticTsxLinks(target.content);
    } else {
      continue;
    }
    for (const link of links) {
      checked++;
      const result = checkCrossDocumentLink(link, resolver, knownAnchorIds);
      if (!result.ok) {
        bad++;
        report.errors.push(`[cross-links] ${target.path}:${link.line}: ${result.reason}`);
      }
    }
  }
  report.info.push(
    `[cross-links] ${checked} cross-document link(s) checked across ${scanTargets.length} surface(s) (${knownAnchorIds.size} pooled anchor id(s)), ${bad} broken`,
  );
}

// ─────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(
      [
        "validate-doc-sources — CLM-009 documentation-source registry validator",
        "",
        "Usage:",
        "  npm run validate:doc-sources",
        "",
        "Deterministic, DB-free, network-free. Checks registry invariants,",
        "surface coverage, publicClaimIds, generated-block drift,",
        "formula-fingerprint duplication, redirect route resolution, and",
        "same-document + cross-document internal links.",
      ].join("\n"),
    );
    process.exit(0);
  }

  console.log("=== Civica doc-sources validation (CLM-009) ===\n");

  const report: Report = { errors: [], info: [] };

  await checkRegistry(report);
  runPublicClaimIdsCheck(report);
  checkGeneratedDrift(report);
  const scanTargets = await collectScanTargets();
  await checkFormulaFingerprints(report, scanTargets);
  const routes = await scanAppRoutes();
  await checkRedirectRoutes(report, routes);
  await checkAnchorLinks(report);
  await checkCrossDocumentLinks(report, routes, scanTargets);

  for (const line of report.info) console.log(`✓ ${line}`);
  console.log("");

  if (report.errors.length > 0) {
    console.error(`${report.errors.length} error(s):\n`);
    for (const line of report.errors) console.error(`✗ ${line}`);
    process.exit(1);
  }

  console.log("All doc-sources checks passed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
