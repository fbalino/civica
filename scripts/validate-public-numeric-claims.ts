/**
 * CLM-006 public numeric-claim audit.
 *
 * Scans only public prose/metadata source files:
 *   - README.template.md (README.md is generated and therefore derivative)
 *   - rendered content/*.md
 *   - MDX files recursively below content/blog
 *   - public src/app + src/components TS/TSX copy
 *
 * Admin, cron, tests, design-system/dev demos, styles, and implementation-only
 * numeric literals are excluded. The pure discovery/registry rules live in
 * src/lib/claims/public-numeric-claims.ts and are unit-tested there.
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import {
  PUBLIC_NUMERIC_CLAIMS,
  auditPublicNumericClaims,
  type PublicNumericDocument,
} from "../src/lib/claims/public-numeric-claims";
import { EXAMPLES } from "../src/lib/api/contract/examples";

const ROOT = process.cwd();
const TYPESCRIPT_EXTENSIONS = new Set([".ts", ".tsx"]);
// This file is an authoring mirror; its paired TSX page remains the rendered
// source of truth until the WorkedExample migration lands (see AGENTS.md).
const UNRENDERED_CONTENT_FILES = new Set([
  "content/methodology-reconciliation.md",
]);

function toPosix(relativePath: string): string {
  return relativePath.split(path.sep).join(path.posix.sep);
}

async function exists(relativePath: string): Promise<boolean> {
  try {
    await fs.stat(path.resolve(ROOT, relativePath));
    return true;
  } catch {
    return false;
  }
}

async function listFiles(relativeDirectory: string): Promise<string[]> {
  const absoluteDirectory = path.resolve(ROOT, relativeDirectory);
  const entries = await fs.readdir(absoluteDirectory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const child = toPosix(path.join(relativeDirectory, entry.name));
      return entry.isDirectory() ? listFiles(child) : [child];
    }),
  );
  return nested.flat();
}

function isTestFile(file: string): boolean {
  return (
    file.includes("/__tests__/") ||
    /\.(?:test|spec)\.[cm]?[jt]sx?$/.test(file)
  );
}

function isExcludedPublicCodeFile(file: string): boolean {
  return (
    isTestFile(file) ||
    file.startsWith("src/app/(admin)/") ||
    file.startsWith("src/app/admin/") ||
    file.startsWith("src/app/api/admin/") ||
    file.startsWith("src/app/api/cron/") ||
    file.startsWith("src/app/design-system/") ||
    file.startsWith("src/components/dev/") ||
    file === "src/components/DesignSystemSwatch.tsx"
  );
}

function appSurface(file: string): string {
  const relative = file
    .replace(/^src\/app\//, "")
    .replace(/\/(?:page|layout|route|loading|error|not-found)\.tsx?$/, "")
    .replace(/^(?:page|layout|route|loading|error|not-found)\.tsx?$/, "")
    .split("/")
    .filter((segment) => !/^\(.+\)$/.test(segment))
    .join("/");
  return relative ? `/${relative}` : "/";
}

function surfaceFor(file: string): string {
  if (file === "README.template.md") return "README";
  if (file.startsWith("content/blog/")) {
    return `/${file.replace(/^content\//, "").replace(/\.mdx$/, "")}`;
  }
  if (file.startsWith("content/")) {
    return `reader:${file.replace(/^content\//, "").replace(/\.md$/, "")}`;
  }
  if (file.startsWith("src/app/")) return appSurface(file);
  return `component:${file.replace(/^src\/components\//, "").replace(/\.tsx?$/, "")}`;
}

async function collectSourceFiles(): Promise<string[]> {
  const files = new Set<string>();
  if (await exists("README.template.md")) files.add("README.template.md");

  if (await exists("content")) {
    for (const file of await listFiles("content")) {
      const isRenderedRootMarkdown =
        path.posix.dirname(file) === "content" &&
        file.endsWith(".md") &&
        !UNRENDERED_CONTENT_FILES.has(file);
      const isBlogMdx = file.startsWith("content/blog/") && file.endsWith(".mdx");
      if (isRenderedRootMarkdown || isBlogMdx) files.add(file);
    }
  }

  for (const root of ["src/app", "src/components"] as const) {
    if (!(await exists(root))) continue;
    for (const file of await listFiles(root)) {
      if (!TYPESCRIPT_EXTENSIONS.has(path.extname(file))) continue;
      if (isExcludedPublicCodeFile(file)) continue;
      files.add(file);
    }
  }

  // CLM-012: these modules render directly into /api-docs and are public
  // prose/example sources even though they live under src/lib.
  if (await exists("src/lib/api/contract/registry.ts")) {
    files.add("src/lib/api/contract/registry.ts");
  }

  return [...files].sort();
}

async function collectDocuments(): Promise<PublicNumericDocument[]> {
  const files = await collectSourceFiles();
  const documents = await Promise.all(
    files.map(async (file) => ({
      file,
      surface:
        file === "src/lib/api/contract/registry.ts"
          ? "/api-docs"
          : surfaceFor(file),
      source: await fs.readFile(path.resolve(ROOT, file), "utf8"),
      kind:
        file.endsWith(".md") || file.endsWith(".mdx")
          ? ("markdown" as const)
          : ("typescript" as const),
    })),
  );

  // Canonical examples are objects, so serialize them into the same visible
  // "Illustrative Example Response" context rendered by EndpointSection.
  // This preserves the CLM-006 guard after examples moved out of page.tsx.
  for (const [id, value] of Object.entries(EXAMPLES)) {
    documents.push({
      file: "src/lib/api/contract/examples.ts",
      surface: "/api-docs",
      source: `const ${id} = ${JSON.stringify(
        `Illustrative Example Response: ${JSON.stringify(value)}`,
      )};`,
      kind: "typescript",
    });
  }

  return documents;
}

async function main(): Promise<void> {
  if (process.argv.slice(2).some((arg) => arg === "--help" || arg === "-h")) {
    console.log(
      [
        "validate-public-numeric-claims — CLM-006 mutable coverage/count audit",
        "",
        "Usage: npm run validate:numeric-claims",
      ].join("\n"),
    );
    return;
  }
  const unknownArgs = process.argv.slice(2);
  if (unknownArgs.length > 0) {
    console.error(`Unknown argument(s): ${unknownArgs.join(" ")}`);
    process.exitCode = 2;
    return;
  }

  console.log("=== Civica public numeric-claim validation ===\n");
  const documents = await collectDocuments();
  const result = auditPublicNumericClaims(documents, PUBLIC_NUMERIC_CLAIMS);

  console.log(`Scanned ${documents.length} public source file(s).`);
  console.log(`Discovered ${result.candidates.length} mutable coverage/count claim(s).`);
  console.log(`Registry contains ${PUBLIC_NUMERIC_CLAIMS.length} row(s).\n`);

  if (result.errors.length > 0) {
    for (const error of result.errors) console.error(`✗ ${error.message}`);
    console.error(`\n✗ Numeric-claim validation failed with ${result.errors.length} error(s).`);
    process.exitCode = 1;
    return;
  }

  console.log("✓ Every discovered public coverage/count claim is runtime-backed, visibly frozen, or explicitly exempt.");
}

main().catch((error) => {
  console.error("validate-public-numeric-claims threw:", error);
  process.exitCode = 1;
});
