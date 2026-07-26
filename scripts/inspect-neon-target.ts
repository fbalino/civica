import { writeFile } from "node:fs/promises";

import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";

import {
  inspectNeonTarget,
  type NeonTargetExpectations,
} from "../src/lib/qa/neon-target";

config({ path: ".env.local", override: false, quiet: true });

function argument(prefix: string): string | undefined {
  return process.argv
    .slice(2)
    .find((value) => value.startsWith(prefix))
    ?.slice(prefix.length);
}

function requiredArgument(prefix: string): string {
  const value = argument(prefix)?.trim();
  if (!value) {
    throw new Error(`Missing required argument ${prefix}<value>`);
  }
  return value;
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) throw new Error("DATABASE_URL is required");
  const expectations: NeonTargetExpectations = {
    expectedProjectId: requiredArgument("--expected-project="),
    forbiddenBranchId: requiredArgument("--forbidden-branch="),
    forbiddenHostnameSha256: requiredArgument("--forbidden-hostname-sha256="),
    requiredMigrationHead: requiredArgument("--required-migration-head="),
  };
  const report = await inspectNeonTarget({
    databaseUrl,
    sql: neon(databaseUrl),
    expectations,
  });
  const output = `${JSON.stringify(report, null, 2)}\n`;
  const outputPath = argument("--out=");
  if (outputPath) {
    // The target and migration guards have passed before any evidence file write.
    await writeFile(outputPath, output, { encoding: "utf8", flag: "wx" });
  }
  process.stdout.write(output);
}

main().catch(() => {
  console.error("Neon target inspection failed closed");
  process.exit(1);
});
