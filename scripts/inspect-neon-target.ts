import { writeFile } from "node:fs/promises";

import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";

import {
  inspectNeonTarget,
  neonTargetExpectationsFromArguments,
} from "../src/lib/qa/neon-target";

config({ path: ".env.local", override: false, quiet: true });

function argument(prefix: string): string | undefined {
  return process.argv
    .slice(2)
    .find((value) => value.startsWith(prefix))
    ?.slice(prefix.length);
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) throw new Error("DATABASE_URL is required");
  const expectations = neonTargetExpectationsFromArguments(process.argv);
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
