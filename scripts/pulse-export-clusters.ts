/**
 * Pulse daily refresh — STEP 1 of 2 (export).
 *
 * Runs the FREE stages of the v2 pipeline (ingest + cluster — neither uses
 * the paid Anthropic API), then exports every unclassified cluster to a JSON
 * file for a Claude Code agent to classify on the Max subscription (see the
 * `pulse-daily` skill). STEP 2 is scripts/pulse-apply-classifications.ts.
 *
 * Why split: classification is the only API-billed stage. By exporting the
 * clusters and letting the Claude Code AGENT classify them (its own work,
 * billed to the subscription), the daily refresh costs no API credits.
 *
 * Usage:
 *   tsx scripts/pulse-export-clusters.ts                 # ingest+cluster+export
 *   tsx scripts/pulse-export-clusters.ts --no-ingest     # export existing clusters only
 *   tsx scripts/pulse-export-clusters.ts --out=/tmp/x.json
 */
import { config } from "dotenv";
config({ path: ".env.local", override: true });

import { writeFile } from "node:fs/promises";
import { createDb, ingestPulseV2 } from "../src/lib/pulse/v2/ingest";
import { runClustering } from "../src/lib/pulse/v2/cluster";
import { loadUnclassifiedClusters } from "../src/lib/pulse/v2/classify";

async function main() {
  const db = createDb();
  const noIngest = process.argv.includes("--no-ingest");
  const out =
    process.argv.find((a) => a.startsWith("--out="))?.slice(6) ??
    "/tmp/pulse-clusters.json";

  if (!noIngest) {
    console.log("STAGE 1: ingest (free — no paid API)...");
    const ing = await ingestPulseV2(db);
    console.log(
      `  ${ing.totalFetched} fetched · ${ing.totalInserted} inserted · ${ing.totalSkipped} dup · ${ing.totalUnmatched} unmatched`
    );
    console.log("STAGE 2: cluster (free — local embeddings)...");
    const cl = await runClustering(db);
    console.log(
      `  ${cl.candidates} candidates → ${cl.clustersCreated} clusters · ${cl.multiSourceClusters} multi-source`
    );
  }

  const clusters = await loadUnclassifiedClusters(db, 500);
  await writeFile(out, JSON.stringify(clusters, null, 2));
  console.log(`\nExported ${clusters.length} unclassified cluster(s) → ${out}`);
  if (clusters.length === 0) {
    console.log("Nothing to classify. Done.");
  } else {
    console.log(
      "Next: the agent classifies each cluster (see the pulse-daily skill), then run\n" +
        "  tsx scripts/pulse-apply-classifications.ts --clusters=" +
        out +
        " --decisions=/tmp/pulse-decisions.json"
    );
  }
  process.exit(0);
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
