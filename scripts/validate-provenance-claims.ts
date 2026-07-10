/**
 * CLM-019 compact-surface provenance coverage validator.
 * Deterministic, DB-free, clock-free, and network-free.
 */

import { promises as fs } from "node:fs";
import path from "node:path";

import {
  PROVENANCE_COVERAGE_SUMMARY,
  PROVENANCE_RENDERER_CLASSES,
  PROVENANCE_SURFACE_IDS,
  findUniversalProvenanceClaims,
  hasCompleteCompactProvenance,
  validateProvenanceRendererSources,
} from "../src/lib/claims/provenance-coverage";

const ROOT = process.cwd();
const PUBLIC_SWEEP_ROOTS = ["src/app", "src/components", "content"];
const PUBLIC_SWEEP_EXTENSIONS = new Set([".ts", ".tsx", ".md", ".mdx"]);
const EXTRA_PUBLIC_FILES = [
  "README.md",
  "README.template.md",
  "CITATION.cff",
  "src/lib/api/contract/csv.ts",
  "src/lib/claims/public-claims.ts",
  "src/lib/data/glossary.ts",
];

interface Problem {
  category: string;
  file: string;
  detail: string;
}

async function read(relativePath: string): Promise<string | null> {
  try {
    return await fs.readFile(path.resolve(ROOT, relativePath), "utf8");
  } catch {
    return null;
  }
}

async function collectPublicFiles(): Promise<string[]> {
  const files = new Set(EXTRA_PUBLIC_FILES);
  async function walk(relativeDir: string): Promise<void> {
    const entries = await fs.readdir(path.resolve(ROOT, relativeDir), {
      withFileTypes: true,
    });
    for (const entry of entries) {
      const relativePath = path.join(relativeDir, entry.name);
      if (entry.isDirectory()) await walk(relativePath);
      else if (PUBLIC_SWEEP_EXTENSIONS.has(path.extname(entry.name))) {
        files.add(relativePath);
      }
    }
  }
  for (const root of PUBLIC_SWEEP_ROOTS) await walk(root);
  return [...files].sort();
}

/** Remove author/developer comments so internal warnings and negative fixture
 * descriptions are not mistaken for rendered public claims. String literals
 * and JSX/markdown prose remain scannable. */
export function stripNonPublicComments(source: string): string {
  return source
    .replace(/<!--[^]*?-->/g, "")
    .replace(/\{?\/\*[^]*?\*\/\}?/g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

async function main(): Promise<void> {
  console.log("=== CLM-019 provenance-coverage validation ===\n");
  const problems: Problem[] = [];

  // Registry shape and marker coverage.
  const surfaces = new Set(PROVENANCE_RENDERER_CLASSES.map((row) => row.surface));
  for (const required of PROVENANCE_SURFACE_IDS) {
    if (!surfaces.has(required)) {
      problems.push({
        category: "registry",
        file: "src/lib/claims/provenance-coverage.ts",
        detail: `missing required surface ${required}`,
      });
    }
  }

  const ids = new Set<string>();
  for (const row of PROVENANCE_RENDERER_CLASSES) {
    if (ids.has(row.id)) {
      problems.push({
        category: "registry",
        file: "src/lib/claims/provenance-coverage.ts",
        detail: `duplicate renderer id ${row.id}`,
      });
    }
    ids.add(row.id);
    if (hasCompleteCompactProvenance(row) !== (row.exception === null)) {
      problems.push({
        category: "registry",
        file: "src/lib/claims/provenance-coverage.ts",
        detail: `${row.id} completion and exception disagree`,
      });
    }
  }

  const rendererSources: Record<string, string | undefined> = {};
  for (const file of new Set(
    PROVENANCE_RENDERER_CLASSES.flatMap((row) => row.implementationPaths),
  )) {
    rendererSources[file] = (await read(file)) ?? undefined;
  }
  for (const issue of validateProvenanceRendererSources(rendererSources)) {
    const row = PROVENANCE_RENDERER_CLASSES.find(
      (candidate) => candidate.id === issue.rendererId,
    )!;
    problems.push({
      category: "marker",
      file: row.implementationPaths.join(", "),
      detail: `${issue.ruleId} for ${issue.rendererId}`,
    });
  }

  // The generated public statement must keep its denominator and DAT-005
  // boundary visible in the canonical methodology prose.
  const approachPath = "content/data-approach.md";
  const approach = (await read(approachPath)) ?? "";
  for (const marker of [
    "{{ctx.provenanceCoverageComplete}}",
    "{{ctx.provenanceCoverageTotal}}",
    "{{ctx.provenanceCoveragePercent}}",
    "{{ctx.provenanceCoverageCompleteLabels}}",
    "{{ctx.provenanceCoverageExceptions}}",
  ]) {
    if (!approach.includes(marker)) {
      problems.push({
        category: "public-summary",
        file: approachPath,
        detail: `missing generated marker ${marker}`,
      });
    }
  }
  if (!/renderer[- ]class coverage/i.test(approach) || !/DAT-005/.test(approach)) {
    problems.push({
      category: "public-summary",
      file: approachPath,
      detail: "must say renderer-class coverage and defer dataset-wide metrics to DAT-005",
    });
  }

  const about = (await read("src/app/about/page.tsx")) ?? "";
  if (!about.includes("PROVENANCE_COVERAGE_SUMMARY")) {
    problems.push({
      category: "public-summary",
      file: "src/app/about/page.tsx",
      detail: "About provenance section must render the generated coverage summary",
    });
  }

  // Evidence fragments for the four classes currently counted complete.
  const rankingsPage = (await read("src/app/rankings/page.tsx")) ?? "";
  const rankingsMatrix = (await read("src/app/rankings/RankingsMatrix.tsx")) ?? "";
  if (!rankingsMatrix.includes("<SourceDot") || !rankingsPage.includes("/licensing#reuse")) {
    problems.push({
      category: "complete-proof",
      file: "src/app/rankings",
      detail: "rankings completion requires per-cell SourceDot plus an inline rights link",
    });
  }
  const embed = (await read("src/app/embed/[slug]/route.ts")) ?? "";
  for (const fragment of [
    'name="civica:sources"',
    "getNormalizationTableRows",
    'name="civica:rights"',
    "quarterLabel",
    "attributionHtml",
    "Reuse: civicaatlas.org/licensing",
  ]) {
    if (!embed.includes(fragment)) {
      problems.push({
        category: "complete-proof",
        file: "src/app/embed/[slug]/route.ts",
        detail: `fixed embed completion requires ${fragment}`,
      });
    }
  }

  // Sweep rendered-source trees and the few public strings outside them.
  const publicFiles = await collectPublicFiles();
  let scanned = 0;
  for (const file of publicFiles) {
    const source = await read(file);
    if (source === null) {
      problems.push({
        category: "missing-public-file",
        file,
        detail: "public sweep file is missing",
      });
      continue;
    }
    scanned += 1;
    for (const finding of findUniversalProvenanceClaims(
      stripNonPublicComments(source),
    )) {
      problems.push({
        category: "universal-claim",
        file,
        detail: `matched "${finding.match}" at offset ${finding.index}`,
      });
    }
  }

  console.log(
    `Registry: ${PROVENANCE_COVERAGE_SUMMARY.complete}/${PROVENANCE_COVERAGE_SUMMARY.total} ${PROVENANCE_COVERAGE_SUMMARY.unit} complete (${PROVENANCE_COVERAGE_SUMMARY.percent}%).`,
  );
  console.log(`Public sweep: ${scanned} file(s).`);

  if (problems.length > 0) {
    const grouped = new Map<string, Problem[]>();
    for (const problem of problems) {
      const list = grouped.get(problem.category) ?? [];
      list.push(problem);
      grouped.set(problem.category, list);
    }
    for (const [category, list] of grouped) {
      console.log(`\n${category} (${list.length}):`);
      for (const problem of list) {
        console.log(`  - ${problem.file}: ${problem.detail}`);
      }
    }
    console.error(`\nFAILED — ${problems.length} provenance-coverage problem(s).`);
    process.exitCode = 1;
    return;
  }

  console.log("\nPASS — measured coverage, named exceptions, and public claims agree.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
