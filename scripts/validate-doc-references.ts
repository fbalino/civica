/**
 * validate-doc-references — CLM-011 documentation-drift guard.
 * Deterministic, DB-free, network-free.
 *
 *   Run with:  npm run validate:doc-references
 *
 * Checks, in order (any failure sets a non-zero exit code; all checks
 * still run and report so a single pass shows every problem):
 *
 *   1. npm script existence — every `npm run <token>` mention in
 *      README.md, README.template.md, and AGENTS.md resolves to a real
 *      `package.json` script (brace-expansions and trailing `:*`
 *      families are expanded/prefix-checked first).
 *   2. Route link existence — every internal route mention (backtick
 *      spans, markdown links, civicaatlas.org absolute links, ASCII
 *      diagram citations, bracket-dynamic segments, trailing `/*` and
 *      `/...` families) across README.md, README.template.md,
 *      AGENTS.md, DESIGN.md, and .env.example resolves against a
 *      DIRECT `src/app` route. Unlike `validate-doc-sources.ts`'s
 *      redirect-destination checker, this NEVER consults
 *      `next.config.ts` redirects — a route that only resolves through
 *      a redirect is reported as broken, because prose citing it reads
 *      as if it were a live page.
 *   3. Schema table count — AGENTS.md's "**N tables**" literal in
 *      `## Database` must equal the live `pgTable(...)` declaration
 *      count in `src/lib/db/schema.ts`.
 *   4. CRON_SECRET scope wording — no operational doc (AGENTS.md,
 *      README.md, README.template.md, .env.example) may still claim
 *      CRON_SECRET's scope is narrowly `/api/cron/pulse/*`; each must
 *      name the broad `/api/cron/*` scope somewhere near its
 *      CRON_SECRET description.
 *   5. Repo-relative file pointers — every backtick-wrapped
 *      repo-relative path named in README.md, README.template.md,
 *      AGENTS.md, and DESIGN.md exists on disk. `~/civica/plan/...`
 *      references are out of scope by design (owner-global planning
 *      convention, not a repo link).
 *   6. README freshness — README.md's embedded template hash equals a
 *      fresh SHA-256 of README.template.md, and its generated-body hash
 *      equals the actual body bytes. This catches both an unregenerated
 *      template edit and a direct README.md edit.
 *   7. Project memory — all four required project-memory files exist,
 *      their command/file pointers participate in checks 1/5, and the
 *      current architecture summary names `/country/:slug` (not the
 *      retired `/factbook/:slug`) as the Atlas redirect target.
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

import {
  extractNpmScriptMentions,
  findUnknownNpmScripts,
  extractRouteMentions,
  routeMentionResolves,
  extractRepoFilePointers,
  countPgTableDeclarations,
  extractDocumentedTableCount,
  hasStaleCronSecretScopeClaim,
  mentionsCronSecret,
  mentionsBroadCronScope,
  extractEmbeddedTemplateHash,
  extractEmbeddedGeneratedBodyHash,
  computeGeneratedReadmeBodyHash,
  hasStaleAtlasRedirectMemoryClaim,
  mentionsCurrentAtlasRedirectTarget,
} from "../src/lib/docs/doc-references";
import { scanAppRoutes } from "../src/lib/docs/routes";

const ROOT = process.cwd();

interface Report {
  errors: string[];
  info: string[];
}

function parseArgs(argv: string[]): { help: boolean } {
  return { help: argv.includes("--help") || argv.includes("-h") };
}

async function readFile(relPath: string): Promise<string> {
  return fs.readFile(path.join(ROOT, relPath), "utf8");
}

async function fileExists(relPath: string): Promise<boolean> {
  try {
    await fs.access(path.join(ROOT, relPath));
    return true;
  } catch {
    return false;
  }
}

// Surfaces scanned for npm-script and route mentions.
const CORE_DOC_SURFACES = ["README.md", "README.template.md", "AGENTS.md", "DESIGN.md"];
const PROJECT_MEMORY_SURFACES = [
  ".claude/rules/memory-profile.md",
  ".claude/rules/memory-preferences.md",
  ".claude/rules/memory-decisions.md",
  ".claude/rules/memory-sessions.md",
];
const OPERATIONAL_REFERENCE_SURFACES = [...CORE_DOC_SURFACES, ...PROJECT_MEMORY_SURFACES];
const ROUTE_SURFACES = [...CORE_DOC_SURFACES, ".env.example"];
const CRON_SCOPE_SURFACES = ["AGENTS.md", "README.md", "README.template.md", ".env.example"];

// ─────────────────────────────────────────────────────────────────────
// 1. npm script existence
// ─────────────────────────────────────────────────────────────────────

async function runNpmScriptCheck(report: Report): Promise<void> {
  const pkgRaw = await readFile("package.json");
  const pkg = JSON.parse(pkgRaw) as { scripts?: Record<string, string> };
  const knownScripts = new Set(Object.keys(pkg.scripts ?? {}));

  let totalMentions = 0;
  let totalUnknown = 0;
  for (const surface of OPERATIONAL_REFERENCE_SURFACES) {
    const text = await readFile(surface);
    const mentions = extractNpmScriptMentions(text);
    totalMentions += mentions.length;
    const unknown = findUnknownNpmScripts(mentions, knownScripts);
    totalUnknown += unknown.length;
    for (const u of unknown) {
      report.errors.push(
        `[npm-scripts] ${surface}: "npm run ${u.raw}" — no matching script(s) in package.json (${u.scripts.join(", ")})`,
      );
    }
  }
  report.info.push(
    `[npm-scripts] ${totalMentions} "npm run" mention(s) checked across ${OPERATIONAL_REFERENCE_SURFACES.length} surface(s), ${totalUnknown} unknown`,
  );
}

// ─────────────────────────────────────────────────────────────────────
// 2. Route link existence (direct app routes only — never redirects)
// ─────────────────────────────────────────────────────────────────────

async function runRouteCheck(report: Report): Promise<void> {
  const routes = await scanAppRoutes();

  let totalMentions = 0;
  let totalBroken = 0;
  for (const surface of ROUTE_SURFACES) {
    const text = await readFile(surface);
    const mentions = extractRouteMentions(text);
    totalMentions += mentions.length;
    for (const mention of mentions) {
      if (!routeMentionResolves(mention, routes)) {
        totalBroken++;
        report.errors.push(
          `[routes] ${surface}: "${mention.raw}" does not resolve to a direct app route (redirect-only or dead)`,
        );
      }
    }
  }
  report.info.push(
    `[routes] ${totalMentions} route mention(s) checked across ${ROUTE_SURFACES.length} surface(s) against ${routes.length} app route(s), ${totalBroken} broken`,
  );
}

// ─────────────────────────────────────────────────────────────────────
// 3. Schema table count
// ─────────────────────────────────────────────────────────────────────

async function runSchemaTableCountCheck(report: Report): Promise<void> {
  const [agentsText, schemaText] = await Promise.all([
    readFile("AGENTS.md"),
    readFile("src/lib/db/schema.ts"),
  ]);
  const documented = extractDocumentedTableCount(agentsText);
  const actual = countPgTableDeclarations(schemaText);

  if (documented === null) {
    report.errors.push(
      `[schema-count] AGENTS.md "## Database" section does not state a "**N tables**" literal`,
    );
    return;
  }
  if (documented !== actual) {
    report.errors.push(
      `[schema-count] AGENTS.md claims ${documented} tables; src/lib/db/schema.ts has ${actual} pgTable(...) declarations`,
    );
    return;
  }
  report.info.push(`[schema-count] AGENTS.md's ${documented} tables matches schema.ts's live pgTable(...) count`);
}

// ─────────────────────────────────────────────────────────────────────
// 4. CRON_SECRET scope wording
// ─────────────────────────────────────────────────────────────────────

async function runCronScopeCheck(report: Report): Promise<void> {
  let staleFound = 0;
  let checked = 0;
  for (const surface of CRON_SCOPE_SURFACES) {
    const text = await readFile(surface);
    if (hasStaleCronSecretScopeClaim(text)) {
      staleFound++;
      report.errors.push(
        `[cron-scope] ${surface}: still claims the stale narrow "/api/cron/pulse/*" CRON_SECRET scope`,
      );
    }
    if (mentionsCronSecret(text)) {
      checked++;
      if (!mentionsBroadCronScope(text)) {
        report.errors.push(
          `[cron-scope] ${surface}: documents CRON_SECRET but never names the broad "/api/cron/*" scope`,
        );
      }
    }
  }
  if (staleFound === 0) {
    report.info.push(
      `[cron-scope] no stale "/api/cron/pulse/*"-only CRON_SECRET scope claims; ${checked} surface(s) documenting CRON_SECRET all name "/api/cron/*"`,
    );
  }
}

// ─────────────────────────────────────────────────────────────────────
// 5. Repo-relative file pointers
// ─────────────────────────────────────────────────────────────────────

async function runFilePointerCheck(report: Report): Promise<void> {
  let totalPointers = 0;
  let totalMissing = 0;
  for (const surface of OPERATIONAL_REFERENCE_SURFACES) {
    const text = await readFile(surface);
    const pointers = extractRepoFilePointers(text);
    totalPointers += pointers.length;
    for (const pointer of pointers) {
      if (!(await fileExists(pointer))) {
        totalMissing++;
        report.errors.push(`[file-pointers] ${surface}: "${pointer}" does not exist on disk`);
      }
    }
  }
  report.info.push(
    `[file-pointers] ${totalPointers} repo-relative file pointer(s) checked across ${OPERATIONAL_REFERENCE_SURFACES.length} surface(s), ${totalMissing} missing`,
  );
}

// ─────────────────────────────────────────────────────────────────────
// 6. README freshness (embedded template hash)
// ─────────────────────────────────────────────────────────────────────

async function runReadmeFreshnessCheck(report: Report): Promise<void> {
  const [readmeText, templateText] = await Promise.all([
    readFile("README.md"),
    readFile("README.template.md"),
  ]);
  const embedded = extractEmbeddedTemplateHash(readmeText);
  if (!embedded) {
    report.errors.push(
      `[readme-freshness] README.md has no embedded "Template SHA-256:" banner line — run npm run regenerate:readme`,
    );
    return;
  }
  const fresh = createHash("sha256").update(templateText, "utf8").digest("hex");
  if (embedded !== fresh) {
    report.errors.push(
      `[readme-freshness] README.md's embedded template hash is stale (README.template.md changed without regenerating). Run: npm run regenerate:readme`,
    );
    return;
  }
  const embeddedBody = extractEmbeddedGeneratedBodyHash(readmeText);
  if (!embeddedBody) {
    report.errors.push(
      `[readme-freshness] README.md has no embedded "Generated body SHA-256:" banner line — run npm run regenerate:readme`,
    );
    return;
  }
  const freshBody = computeGeneratedReadmeBodyHash(readmeText);
  if (embeddedBody !== freshBody) {
    report.errors.push(
      `[readme-freshness] README.md's generated body was edited directly. Edit README.template.md, then run: npm run regenerate:readme`,
    );
    return;
  }
  report.info.push(
    `[readme-freshness] README.md's template and generated-body hashes both match`,
  );
}

// ─────────────────────────────────────────────────────────────────────
// 7. Project-memory runtime claims
// ─────────────────────────────────────────────────────────────────────

async function runProjectMemoryCheck(report: Report): Promise<void> {
  const missing: string[] = [];
  for (const surface of PROJECT_MEMORY_SURFACES) {
    if (!(await fileExists(surface))) missing.push(surface);
  }
  if (missing.length > 0) {
    report.errors.push(`[project-memory] missing required file(s): ${missing.join(", ")}`);
    return;
  }

  const sessions = await readFile(".claude/rules/memory-sessions.md");
  if (hasStaleAtlasRedirectMemoryClaim(sessions)) {
    report.errors.push(
      `[project-memory] memory-sessions.md still says Atlas country redirects target retired /factbook/:slug`,
    );
  }
  if (!mentionsCurrentAtlasRedirectTarget(sessions)) {
    report.errors.push(
      `[project-memory] memory-sessions.md does not name /country/:slug as the current Atlas country redirect target`,
    );
  }
  if (
    !hasStaleAtlasRedirectMemoryClaim(sessions) &&
    mentionsCurrentAtlasRedirectTarget(sessions)
  ) {
    report.info.push(
      `[project-memory] all ${PROJECT_MEMORY_SURFACES.length} required files exist and the Atlas redirect target is current`,
    );
  }
}

// ─────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = parseArgs(process.argv);
  if (args.help) {
    console.log(
      [
        "validate-doc-references — CLM-011 documentation-drift guard",
        "",
        "Usage:",
        "  npm run validate:doc-references",
      ].join("\n"),
    );
    process.exit(0);
  }

  const report: Report = { errors: [], info: [] };

  console.log("=== Civica doc-references validation (CLM-011) ===\n");

  await runNpmScriptCheck(report);
  await runRouteCheck(report);
  await runSchemaTableCountCheck(report);
  await runCronScopeCheck(report);
  await runFilePointerCheck(report);
  await runReadmeFreshnessCheck(report);
  await runProjectMemoryCheck(report);

  for (const line of report.info) console.log(`✓ ${line}`);
  if (report.errors.length > 0) {
    console.log("");
    for (const line of report.errors) console.error(`✗ ${line}`);
    console.error(`\n${report.errors.length} doc-reference issue(s) found.`);
    process.exit(1);
  }

  console.log("\nAll doc-references checks passed.");
  process.exit(0);
}

main().catch((err) => {
  console.error("validate-doc-references threw:", err);
  process.exit(1);
});
