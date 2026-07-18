import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";

const files = {
  transport: "src/lib/db/serverless.ts",
  database: "src/lib/db/index.ts",
  cron: "src/lib/api/cron-job.ts",
  docs: "data/SERVERLESS-DATABASE-OPERATIONS.md",
  evidence: "plan/evidence/PLT-023/serverless-database.json",
  plan: "plan/MASTER-CHECKLIST.md",
  progress: "plan/PROGRESS.md",
  packageJson: "package.json",
} as const;

const errors: string[] = [];
for (const [name, path] of Object.entries(files)) {
  if (!existsSync(path)) errors.push(`missing ${name}: ${path}`);
}

function sourceFiles(root: string): string[] {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(?:ts|tsx)$/.test(entry.name) ? [path] : [];
  });
}

function hasDirectNeonCall(source: string): boolean {
  // Tokenization ignores comments, strings, and regex literals. That keeps a
  // control-plane fixture snapshot from being mistaken for request-serving
  // source while still catching an executable `neon(...)` call.
  const scanner = ts.createScanner(
    ts.ScriptTarget.Latest,
    true,
    ts.LanguageVariant.Standard,
    source,
  );
  for (let token = scanner.scan(); token !== ts.SyntaxKind.EndOfFileToken; token = scanner.scan()) {
    if (
      token === ts.SyntaxKind.Identifier &&
      scanner.getTokenText() === "neon" &&
      scanner.scan() === ts.SyntaxKind.OpenParenToken
    ) {
      return true;
    }
  }
  return false;
}

if (!errors.length) {
  const read = (path: string) => readFileSync(path, "utf8");
  const transport = read(files.transport);
  const database = read(files.database);
  const cron = read(files.cron);
  const docs = read(files.docs);
  const evidence = JSON.parse(read(files.evidence)) as Record<string, unknown>;
  const plan = read(files.plan);
  const progress = read(files.progress);
  const packageJson = JSON.parse(read(files.packageJson)) as { scripts?: Record<string, string> };

  for (const token of [
    "civica-serverless-db-http/v1",
    "SERVERLESS_DB_HTTP_TIMEOUT_MS = 10_000",
    "createBoundedServerlessDbFetch",
    "There is deliberately no retry loop here",
  ]) {
    if (!transport.includes(token)) errors.push(`serverless transport omits ${token}`);
  }
  for (const token of [
    "neonConfig.fetchFunction",
    "createBoundedServerlessDbFetch",
    "createServerlessSql",
    "installServerlessDbTransport",
  ]) {
    if (!database.includes(token)) errors.push(`database factory omits ${token}`);
  }
  for (const token of [
    "IDEMPOTENCY_HEADER", "leaseFence", "MAX_CRON_ATTEMPTS", "postgresCronExecutionStore",
  ]) {
    if (!cron.includes(token)) errors.push(`cron boundary omits ${token}`);
  }
  for (const token of [
    "civica-serverless-db-http/v1",
    "non-interactive", "It never automatically", "withCronJob()", "Verified 2026-07-18",
  ]) {
    if (!docs.includes(token)) errors.push(`serverless database documentation omits ${token}`);
  }
  for (const [key, expected] of Object.entries({
    task: "PLT-023",
    contract: "civica-serverless-db-http/v1",
    status: "implemented-and-locally-validated",
  })) {
    if (evidence[key] !== expected) errors.push(`PLT-023 evidence ${key} drifted`);
  }
  if (!plan.includes("[x] **PLT-023**")) errors.push("master checklist does not close PLT-023");
  if (!progress.includes("PLT-023 completed")) errors.push("progress ledger does not close PLT-023");
  if (!packageJson.scripts?.["validate:serverless-db"]) errors.push("package scripts omit validate:serverless-db");
  if (!packageJson.scripts?.["validate:route-performance-telemetry"]?.includes("validate:serverless-db")) {
    errors.push("platform validation gate omits validate:serverless-db");
  }

  const directNeon = ["src/app", "src/lib"].flatMap(sourceFiles).filter((path) => {
    if (path === files.database || path.endsWith(".test.ts")) return false;
    return hasDirectNeonCall(read(path));
  });
  if (directNeon.length) {
    errors.push(`request-serving source bypasses createServerlessSql: ${directNeon.join(", ")}`);
  }
}

if (errors.length) {
  throw new Error(`Serverless database contract failed:\n${errors.map((error) => `- ${error}`).join("\n")}`);
}

console.log("civica-serverless-db-http/v1: bounded Neon HTTP transport, atomicity limits, and durable retry ownership pass static validation.");
