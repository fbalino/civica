import { readFileSync } from "node:fs";

import {
  DEPLOYMENT_REHEARSAL_SCHEMA_VERSION,
  STAGED_MIGRATION_IDS,
  deploymentRehearsalErrors,
  stagedMigrationCompatibilityErrors,
} from "../src/lib/platform/deployment-rehearsal";
import { AUTHORITATIVE_MIGRATIONS } from "../src/lib/db/authoritative-migration-manifest";

const read = (path: string) => readFileSync(path, "utf8");
const errors = [
  ...deploymentRehearsalErrors(),
  ...stagedMigrationCompatibilityErrors(
    Object.fromEntries(
      STAGED_MIGRATION_IDS.map((id) => [
        id,
        read(`drizzle/authoritative/${id}.sql`),
      ]),
    ) as Record<(typeof STAGED_MIGRATION_IDS)[number], string>,
  ),
];
const productionHeadIndex = AUTHORITATIVE_MIGRATIONS.findIndex(
  ({ id }) => id === "0032_sparkling_genesis",
);
const authoritativeTail = AUTHORITATIVE_MIGRATIONS
  .slice(productionHeadIndex + 1)
  .map(({ id }) => id);
if (productionHeadIndex < 0) {
  errors.push("configured production migration head is absent from the authoritative manifest");
} else if (
  JSON.stringify(STAGED_MIGRATION_IDS) !== JSON.stringify(authoritativeTail)
) {
  errors.push(
    `staged migration scope differs from authoritative tail: ${authoritativeTail.join(", ")}`,
  );
}

const packageJson = JSON.parse(read("package.json")) as { scripts: Record<string, string | undefined> };
if (packageJson.scripts["validate:deployment-rehearsal"] !== "node --import tsx --test src/lib/platform/deployment-rehearsal.test.ts && tsx scripts/validate-deployment-rehearsal.ts") {
  errors.push("package script validate:deployment-rehearsal is not exact");
}
if (
  !(packageJson.scripts["build:core"] ?? "").includes("validate:release-consistency") ||
  !(packageJson.scripts["validate:release-consistency"] ?? "").includes("validate:deployment-rehearsal")
) {
  errors.push("build:core does not reach deployment rehearsal validation");
}
if ((packageJson.scripts["vercel-build"] ?? "").includes("db:migrate")) {
  errors.push("vercel-build must not mutate a database");
}

const vercel = JSON.parse(read("vercel.json")) as { buildCommand?: string };
if (vercel.buildCommand !== "npm run build") {
  errors.push("Vercel build command must run the complete validation build");
}

for (const [path, fragments] of Object.entries({
  "data/DEPLOYMENT-REHEARSAL.md": [DEPLOYMENT_REHEARSAL_SCHEMA_VERSION, "Vercel build never runs `db:migrate`", "Neon child branch", "Instant Rollback", "manually disable Cron Jobs", "forward fix"],
  "data/AUTHORITATIVE-MIGRATIONS.md": ["not a Vercel build", "owner-operated pre-deploy step"],
  "data/OPERATIONAL-RUNBOOKS.md": ["DEPLOYMENT-REHEARSAL.md", "Manually disable Cron Jobs"],
  "plan/MANUAL-CHECKS.md": ["PLT-019 · Owner/platform"],
})) {
  const source = read(path);
  for (const fragment of fragments) {
    if (!source.includes(fragment)) errors.push(`${path}: missing ${fragment}`);
  }
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log(`PASS deployment rehearsal: ${STAGED_MIGRATION_IDS.length} staged migrations, validation-only deploys, and forward-only recovery are closed.`);
