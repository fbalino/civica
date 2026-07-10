/**
 * CLM-015 research-terminology validator. Deterministic, DB-free, network-free.
 *
 * Proves that the canonical 14-term registry generates the public glossary,
 * the glossary page publishes stable term anchors, and every registered
 * methodology surface either links to the glossary or conforms to the narrow
 * prohibited-usage policy.
 */

import { promises as fs } from "node:fs";
import path from "node:path";

import { GLOSSARY_TERMS } from "../src/lib/data/glossary";
import {
  RESEARCH_TERMINOLOGY_SURFACES,
  RESEARCH_TERMS,
  lintTerminology,
  validateResearchTerminologyRegistry,
} from "../src/lib/research-terminology";

const ROOT = process.cwd();
const GLOSSARY_PAGE = "src/app/glossary/page.tsx";

interface ValidationIssue {
  scope: string;
  message: string;
}

async function read(relativePath: string): Promise<string | null> {
  try {
    return await fs.readFile(path.resolve(ROOT, relativePath), "utf8");
  } catch {
    return null;
  }
}

async function main(): Promise<void> {
  const issues: ValidationIssue[] = validateResearchTerminologyRegistry().map((issue) => ({
    scope: "registry",
    message: `[${issue.ruleId}] ${issue.message}`,
  }));

  const glossaryIds = new Map<string, number>();
  for (const entry of GLOSSARY_TERMS) {
    glossaryIds.set(entry.id, (glossaryIds.get(entry.id) ?? 0) + 1);
  }

  for (const term of RESEARCH_TERMS) {
    const matches = GLOSSARY_TERMS.filter((entry) => entry.id === term.id);
    if (matches.length !== 1) {
      issues.push({
        scope: "glossary",
        message: `Research term "${term.id}" appears ${matches.length} times; expected exactly once.`,
      });
      continue;
    }
    if (matches[0].term !== term.term || matches[0].definition !== term.definition) {
      issues.push({
        scope: "glossary",
        message: `Research term "${term.id}" drifts from the canonical registry.`,
      });
    }
  }

  for (const [id, count] of glossaryIds) {
    if (count > 1) {
      issues.push({ scope: "glossary", message: `Glossary id "${id}" appears ${count} times.` });
    }
  }

  const glossaryPageSource = await read(GLOSSARY_PAGE);
  if (glossaryPageSource === null) {
    issues.push({ scope: "glossary-page", message: `${GLOSSARY_PAGE} is missing.` });
  } else if (!/id=\{term\.id\}/.test(glossaryPageSource)) {
    issues.push({
      scope: "glossary-page",
      message: "The glossary page no longer publishes each registry id as a stable anchor.",
    });
  }

  const surfaceResults: string[] = [];
  for (const surface of RESEARCH_TERMINOLOGY_SURFACES) {
    const source = await read(surface.path);
    if (source === null) {
      issues.push({ scope: surface.id, message: `${surface.path} is missing.` });
      continue;
    }

    const violations = lintTerminology(source);
    for (const violation of violations) {
      issues.push({
        scope: surface.id,
        message: `[${violation.ruleId}] ${violation.reason}\n    ${violation.sentence}`,
      });
    }

    const relationship = /\/glossary#[a-z0-9-]+/.test(source) ? "linked" : "conformant";
    surfaceResults.push(`  OK  ${surface.path} (${relationship})`);
  }

  console.log("=== Civica research-terminology validation ===\n");
  console.log(
    `Registry: ${RESEARCH_TERMS.length} canonical terms; glossary: ${GLOSSARY_TERMS.length} total entries`,
  );
  console.log(`Registered research surfaces: ${RESEARCH_TERMINOLOGY_SURFACES.length}\n`);
  for (const result of surfaceResults) console.log(result);

  if (issues.length > 0) {
    console.error(`\nFAIL — ${issues.length} issue${issues.length === 1 ? "" : "s"}:`);
    for (const issue of issues) console.error(`- ${issue.scope}: ${issue.message}`);
    process.exitCode = 1;
    return;
  }

  console.log("\nPASS — glossary generation, stable anchors, and terminology conformance agree.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
