import { config } from "dotenv";
import { readFileSync } from "node:fs";
import { createDb } from "../src/lib/ci/ingest";
import { decoupleAbsorbedEvents } from "../src/lib/pulse/v2/decouple";
import { parseExplicitAbsorptionLinks } from "../src/lib/pulse/v2/absorption";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
import type * as schema from "../src/lib/db/schema";

config({ path: ".env.local", override: true });

async function main(): Promise<void> {
  const input = process.argv.find((arg) => arg.startsWith("--input="))
    ?.split("=")
    .slice(1)
    .join("=");
  const releaseId = process.argv.find((arg) => arg.startsWith("--release="))
    ?.split("=")
    .slice(1)
    .join("=");
  const apply = process.argv.includes("--apply");
  if (!input || !releaseId)
    throw new Error("Pass --input=<reviewed-links.json> and --release=<closed-release-id>");
  if (apply && process.env.PULSE_APPLY_ABSORPTIONS !== "yes")
    throw new Error("Set PULSE_APPLY_ABSORPTIONS=yes to write reviewed decisions");
  const links = parseExplicitAbsorptionLinks(
    JSON.parse(readFileSync(input, "utf8")) as unknown,
  );
  const summary = await decoupleAbsorbedEvents(
    createDb() as unknown as NeonHttpDatabase<typeof schema>,
    releaseId,
    { links, dryRun: !apply },
  );
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
