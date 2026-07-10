/**
 * Validate the CLM-016 policy surface: `/policies` exists with every
 * required anchor, every registered research artifact links its
 * required anchors, no mirror duplicates policy prose or overpromises
 * staffing/notification/hardcoded values, and the correction simulator
 * still matches its frozen fixtures. Pure, DB-free — see
 * `src/lib/policy/policy-surface.ts` for the invariants themselves.
 */

import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

import { RESEARCH_ARTIFACTS } from "../src/lib/policy/research-artifacts";
import {
  validatePolicySurface,
  type ArtifactSource,
  type MirrorSource,
} from "../src/lib/policy/policy-surface";

const POLICY_MARKDOWN_PATH = "content/policies.md";

/** Link-only mirrors scanned for duplicated policy prose. Each is a
 *  file the OP48 contract §2.2 names as a mirror of the policy. */
const MIRROR_PATHS = [
  "content/methodology-civica-index.md",
  "content/methodology-pca-appendix.md",
  "content/methodology-peer-grouping.md",
  "content/methodology-pulse.md",
  "content/about.md",
  "README.template.md",
  "src/app/(reader)/civica-index/corrections/page.tsx",
  "src/app/(reader)/country/methodology/reconciliation/page.tsx",
];

function readIfExists(relPath: string): string | null {
  const abs = path.resolve(process.cwd(), relPath);
  if (!existsSync(abs)) return null;
  return readFileSync(abs, "utf8");
}

function main(): void {
  console.log("=== Civica policy-surface validation (CLM-016) ===\n");

  const policyMarkdown = readIfExists(POLICY_MARKDOWN_PATH);

  const artifactSources: ArtifactSource[] = RESEARCH_ARTIFACTS.map(
    (artifact) => {
      const pageText = readIfExists(artifact.pageFile) ?? "";
      const contentText = artifact.contentFile
        ? readIfExists(artifact.contentFile) ?? ""
        : "";
      return {
        artifact,
        combinedSource: `${pageText}\n${contentText}`,
      };
    },
  );

  const mirrors: MirrorSource[] = MIRROR_PATHS.map((p) => ({
    label: p,
    text: readIfExists(p) ?? "",
  }));

  const issues = validatePolicySurface({
    policyMarkdown,
    artifactSources,
    registry: RESEARCH_ARTIFACTS,
    mirrors,
  });

  console.log(`Policy page: ${policyMarkdown ? "found" : "MISSING"}`);
  console.log(`Registered artifacts: ${RESEARCH_ARTIFACTS.length}`);
  console.log(`Mirrors scanned: ${mirrors.filter((m) => m.text).length}/${mirrors.length}`);

  if (issues.length > 0) {
    console.error(`\nFAILED — ${issues.length} problem(s):`);
    for (const issue of issues) {
      console.error(`- [${issue.code}] ${issue.message}`);
    }
    process.exit(1);
  }

  console.log("\nPASS — policy surface invariants hold.");
}

main();
