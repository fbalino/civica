/**
 * CLM-018 reuse-rights claims validator. Deterministic, DB-free, network-free.
 *
 *   Run with: npx tsx scripts/validate-rights-claims.ts
 *             (wired as `npm run validate:rights-claims`)
 *
 * Validates:
 *   1. Registry invariants — `RIGHTS_ARTIFACT_CLASSES` rows are complete and
 *      free of prohibited overclaim language (delegated to the pure
 *      `findAllProhibitedRightsLanguage` scanner in reuse-rights.ts).
 *   2. Every `REQUIRED_RIGHTS_SURFACES` path exists and carries a rights
 *      pointer — a visible `/licensing` (or anchored `/licensing#reuse`)
 *      link, or (for `machineReadableOnly` surfaces) a machine-readable
 *      `civica:rights` meta / absolute URL.
 *   3. Public-source sweep of the same required-surface files plus every
 *      reader-facing file under src/app, src/components, and content (and the
 *      README/citation artifacts) for blanket "all data is open" claims,
 *      false code-open-source/MIT claims, and false "complete manifest
 *      exists" claims — negation-aware, so honest denials pass.
 *   4. Code-license overclaim guard: fails if any scanned file asserts an
 *      open-source/MIT grant that contradicts the canonical code posture.
 *   5. False affirmative complete-manifest claims anywhere in the swept set.
 *   6. Required public-claim linkage: the `/licensing` page markers
 *      (`licensing.mixed-rights`, `licensing.code-status`,
 *      `licensing.rights-manifest`) are present, matching the
 *      PUBLIC_CLAIM comment convention used across the repo.
 *
 * False-positive guards live in the scanner itself (negation-awareness) and
 * are proven by src/lib/claims/__tests__/reuse-rights.test.ts.
 */

import { promises as fs } from "node:fs";
import path from "node:path";

import {
  REQUIRED_RIGHTS_SURFACES,
  RIGHTS_ARTIFACT_CLASSES,
  CODE_RIGHTS,
  hasRightsPointer,
  hasMachineReadableRightsPointer,
  findAllProhibitedRightsLanguage,
  type RightsScanFinding,
} from "../src/lib/claims/reuse-rights";

const ROOT = process.cwd();

// All reader-facing source trees are swept so a new page/component cannot
// evade the gate merely because it was not added to a hand-maintained list.
const PUBLIC_SWEEP_ROOTS = ["src/app", "src/components", "content"];
const PUBLIC_SWEEP_EXTENSIONS = new Set([".ts", ".tsx", ".md", ".mdx"]);
const ROOT_PUBLIC_ARTIFACTS = [
  "README.template.md",
  "README.md",
  "CITATION.cff",
  "src/lib/og.ts",
];

interface Problem {
  category: string;
  path: string;
  detail: string;
}

async function readFile(relativePath: string): Promise<string | null> {
  try {
    return await fs.readFile(path.resolve(ROOT, relativePath), "utf8");
  } catch {
    return null;
  }
}

async function findRootLicenseFiles(): Promise<string[]> {
  const entries = await fs.readdir(ROOT, { withFileTypes: true });
  return entries
    .filter(
      (entry) =>
        entry.isFile() && /^(LICENSE|COPYING)(\..+)?$/i.test(entry.name),
    )
    .map((entry) => entry.name)
    .sort();
}

async function collectPublicSweepPaths(): Promise<string[]> {
  const paths = new Set(ROOT_PUBLIC_ARTIFACTS);
  async function walk(relativeDir: string): Promise<void> {
    const entries = await fs.readdir(path.resolve(ROOT, relativeDir), {
      withFileTypes: true,
    });
    for (const entry of entries) {
      const relativePath = path.join(relativeDir, entry.name);
      if (entry.isDirectory()) {
        await walk(relativePath);
      } else if (PUBLIC_SWEEP_EXTENSIONS.has(path.extname(entry.name))) {
        paths.add(relativePath);
      }
    }
  }
  for (const root of PUBLIC_SWEEP_ROOTS) await walk(root);
  return [...paths].sort();
}

function reportFindings(
  problems: Problem[],
  category: string,
  filePath: string,
  findings: RightsScanFinding[],
): void {
  for (const finding of findings) {
    problems.push({
      category,
      path: filePath,
      detail: `[${finding.ruleId}] matched "${finding.match}" at offset ${finding.index}`,
    });
  }
}

async function main(): Promise<void> {
  console.log("=== CLM-018 reuse-rights claims validator ===\n");

  const problems: Problem[] = [];

  // 1. Registry invariants ---------------------------------------------
  console.log("--- Registry invariants ---");
  for (const row of RIGHTS_ARTIFACT_CLASSES) {
    const fields = [row.label, row.scope, row.currentPermissionPosture, row.governingBasis, row.readerAction];
    if (fields.some((f) => f.trim() === "")) {
      problems.push({
        category: "registry-invariants",
        path: "src/lib/claims/reuse-rights.ts",
        detail: `artifact class "${row.id}" has an empty required field`,
      });
    }
    const blob = fields.join("\n");
    const findings = findAllProhibitedRightsLanguage(blob);
    reportFindings(problems, "registry-invariants", `reuse-rights.ts#${row.id}`, findings);
  }
  console.log(
    problems.filter((p) => p.category === "registry-invariants").length === 0
      ? "  OK  registry rows are complete and free of prohibited language"
      : "  FAIL  see report below",
  );

  // 2 + 3. Required-surface pointer + prohibited-language sweep --------
  console.log("\n--- Required rights-pointer surfaces ---");
  const sweptPaths = new Set<string>();
  for (const surface of REQUIRED_RIGHTS_SURFACES) {
    for (const filePath of surface.paths) {
      sweptPaths.add(filePath);
      const source = await readFile(filePath);
      if (source === null) {
        problems.push({
          category: "missing-surface",
          path: filePath,
          detail: `required rights surface "${surface.id}" (${surface.label}) does not exist`,
        });
        console.log(`  FAIL  ${filePath} — missing`);
        continue;
      }

      const hasPointer = surface.machineReadableOnlyPaths?.includes(filePath)
        ? hasMachineReadableRightsPointer(source) || hasRightsPointer(source)
        : hasRightsPointer(source);

      if (!hasPointer) {
        problems.push({
          category: "missing-pointer",
          path: filePath,
          detail: `required rights surface "${surface.id}" (${surface.label}) carries no rights pointer`,
        });
        console.log(`  FAIL  ${filePath} — no rights pointer`);
      } else {
        console.log(`  OK  ${filePath}`);
      }

      const findings = findAllProhibitedRightsLanguage(source);
      reportFindings(problems, "prohibited-language", filePath, findings);
    }
  }

  // 3b. Extra prose/doc sweep (no pointer requirement, language only) ---
  console.log("\n--- Public-source sweep (prohibited language only) ---");
  const publicSweepPaths = await collectPublicSweepPaths();
  let additionalFilesScanned = 0;
  for (const filePath of publicSweepPaths) {
    if (sweptPaths.has(filePath)) continue;
    const source = await readFile(filePath);
    if (source === null) {
      problems.push({
        category: "missing-public-surface",
        path: filePath,
        detail: "registered public sweep artifact does not exist",
      });
      continue;
    }
    additionalFilesScanned += 1;
    const findings = findAllProhibitedRightsLanguage(source);
    reportFindings(problems, "prohibited-language", filePath, findings);
    if (findings.length > 0) console.log(`  FAIL  ${filePath} — see report below`);
  }
  console.log(`  ${additionalFilesScanned} additional reader-facing file(s) scanned`);

  // 4. Code-license posture guard (root LICENSE existence) ---------------
  console.log("\n--- Code-license overclaim guard ---");
  const rootLicenseFiles = await findRootLicenseFiles();
  const hasRootLicense = rootLicenseFiles.length > 0;
  if (hasRootLicense !== CODE_RIGHTS.hasLicenseFile) {
    problems.push({
      category: "code-license-drift",
      path: "src/lib/claims/reuse-rights.ts",
      detail: `CODE_RIGHTS.hasLicenseFile is ${CODE_RIGHTS.hasLicenseFile} but root license file(s) are ${hasRootLicense ? rootLicenseFiles.join(", ") : "absent"} — update the registry to match reality`,
    });
    console.log("  FAIL  CODE_RIGHTS.hasLicenseFile is out of sync with the repository root");
  } else {
    console.log(
      `  OK  CODE_RIGHTS.hasLicenseFile (${CODE_RIGHTS.hasLicenseFile}) matches the repository (root LICENSE ${hasRootLicense ? "present" : "absent"})`,
    );
  }
  // Code-open-source-claim findings are collected above as prohibited
  // language. They remain invalid when a root file exists because the
  // canonical LICENSE is deliberately non-open.
  const codeClaimProblems = problems.filter(
    (p) =>
      p.category === "prohibited-language" &&
      p.detail.includes("code-open-source-claim"),
  );
  if (codeClaimProblems.length > 0) {
    console.log(
      `  FAIL  ${codeClaimProblems.length} open-source/MIT overclaim(s) contradict the canonical code posture`,
    );
  }

  // 6. Required public-claim linkage on /licensing ----------------------
  console.log("\n--- Licensing page marker coverage ---");
  const licensingSource = await readFile("src/app/licensing/page.tsx");
  const REQUIRED_MARKERS = [
    "PUBLIC_CLAIM: licensing.mixed-rights",
    "PUBLIC_CLAIM: licensing.access-vs-reuse",
    "PUBLIC_CLAIM: licensing.code-status",
    "PUBLIC_CLAIM: licensing.rights-manifest",
    "PUBLIC_CLAIM: licensing.imagery-policy",
  ];
  if (licensingSource === null) {
    problems.push({
      category: "missing-markers",
      path: "src/app/licensing/page.tsx",
      detail: "licensing page does not exist",
    });
  } else {
    for (const marker of REQUIRED_MARKERS) {
      if (!licensingSource.includes(marker)) {
        problems.push({
          category: "missing-markers",
          path: "src/app/licensing/page.tsx",
          detail: `missing required marker "${marker}"`,
        });
        console.log(`  FAIL  missing marker: ${marker}`);
      } else {
        console.log(`  OK  ${marker}`);
      }
    }
  }

  // ── Report ────────────────────────────────────────────────────────────
  console.log("\n=== Report ===");
  if (problems.length === 0) {
    console.log("PASS — no rights-claims problems found.");
    return;
  }

  const byCategory = new Map<string, Problem[]>();
  for (const p of problems) {
    const list = byCategory.get(p.category) ?? [];
    list.push(p);
    byCategory.set(p.category, list);
  }
  for (const [category, list] of byCategory) {
    console.log(`\n${category} (${list.length}):`);
    for (const p of list) {
      console.log(`  - ${p.path}: ${p.detail}`);
    }
  }

  console.error(`\nFAILED — ${problems.length} rights-claims problem(s) found.`);
  process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
