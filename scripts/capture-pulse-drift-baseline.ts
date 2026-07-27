import { config } from "dotenv";

import { getDb } from "../src/lib/db";
import { capturePulseDriftBaseline } from "../src/lib/pulse/v2/drift-monitor-store";

const WRITE = process.argv.includes("--write");
const unknown = process.argv.slice(2).filter((arg) => arg !== "--write");

async function main(): Promise<void> {
  if (unknown.length) {
    throw new Error(`Unknown argument(s): ${unknown.join(", ")}`);
  }
  config({ path: ".env.local", quiet: true });
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required to read the Pulse drift baseline candidate");
  }
  const result = await capturePulseDriftBaseline(getDb(), { write: WRITE });
  const totals = Object.fromEntries(
    result.snapshot.metrics.map((metric) => [metric.metric, metric.total]),
  );
  console.log("=== PUL-024 Pulse drift baseline ===\n");
  console.log(`Method: ${result.snapshot.runtimeMethodVersion}`);
  console.log(`Window: ${result.snapshot.windowStart} → ${result.snapshot.windowEnd}`);
  console.log(`Metric totals: ${JSON.stringify(totals)}`);
  if (!result.eligible) {
    console.log(`NOT ELIGIBLE — ${result.reasons.join("; ")}`);
    process.exitCode = 2;
    return;
  }
  if (!WRITE) {
    console.log("READY — no baseline was written. Re-run with --write only after the PUL-040 start boundary is satisfied.");
    return;
  }
  if (!result.baseline) throw new Error("Eligible baseline write returned no baseline");
  console.log(
    `${result.wrote ? "WROTE" : "REUSED"} — ${result.baseline.baselineKey} (${result.baseline.id})`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
