/**
 * CLI — Constitute Project constitution sync.
 *
 * Usage:
 *   npm run sync:constitutions -- --dry-run
 *   npm run sync:constitutions -- --limit=5
 *   npm run sync:constitutions -- --slug=united-states --slug=germany
 *   npm run sync:constitutions -- --dry-run --limit=3 --slug=india
 *   npm run sync:constitutions -- --regenerate-taxonomy   (refresh the cached /topics JSON)
 *
 * Flags:
 *   --dry-run              parse + resolve, write nothing, never stamp freshness.
 *   --limit=<n>            cap the number of constitutions processed.
 *   --slug=<civica-slug>   restrict to these jurisdiction slug(s); repeatable.
 *   --regenerate-taxonomy  re-fetch /topics and rewrite topic-taxonomy.generated.json.
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  syncConstitutions,
  reportSyncSummary,
} from "../src/lib/constitute/sync-constitutions";

interface CliArgs {
  dryRun: boolean;
  limit: number | undefined;
  slugs: string[];
  regenerateTaxonomy: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    dryRun: false,
    limit: undefined,
    slugs: [],
    regenerateTaxonomy: false,
  };
  for (const a of argv) {
    if (a === "--dry-run") args.dryRun = true;
    else if (a === "--regenerate-taxonomy") args.regenerateTaxonomy = true;
    else if (a.startsWith("--limit=")) {
      const n = parseInt(a.slice("--limit=".length), 10);
      if (Number.isFinite(n) && n > 0) args.limit = n;
    } else if (a.startsWith("--slug=")) {
      const s = a.slice("--slug=".length).trim();
      if (s) args.slugs.push(s);
    }
  }
  return args;
}

/**
 * Re-fetch the Constitute topic taxonomy and rewrite the cached JSON
 * (12 categories, 414 leaf topics: key/label/description/categoryKey/count).
 */
async function regenerateTaxonomy(): Promise<void> {
  console.log("Fetching /topics …");
  const res = await fetch(
    "https://www.constituteproject.org/service/topics?lang=en",
    {
      headers: {
        "User-Agent":
          "CivicaAtlas/1.0 (https://civicaatlas.org; admin@civicaatlas.org)",
        Accept: "application/json",
      },
    },
  );
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching /topics`);
  interface RawNode {
    key: string;
    label: string;
    description?: string;
    count: number;
    topics?: RawNode[];
  }
  const raw = (await res.json()) as RawNode[];

  const categories = raw.map((c) => ({
    key: c.key,
    label: c.label,
    description: c.description ?? "",
    count: c.count,
  }));
  const leaves: Array<{
    key: string;
    label: string;
    description: string;
    categoryKey: string;
    count: number;
  }> = [];
  const walk = (nodes: RawNode[], categoryKey: string) => {
    for (const t of nodes) {
      if (t.topics && t.topics.length) walk(t.topics, categoryKey);
      else
        leaves.push({
          key: t.key,
          label: t.label,
          description: t.description ?? "",
          categoryKey,
          count: t.count,
        });
    }
  };
  for (const c of raw) walk(c.topics ?? [], c.key);

  const out = {
    generatedAt: new Date().toISOString().slice(0, 10),
    source: "https://www.constituteproject.org/service/topics?lang=en",
    categories,
    leaves,
  };
  const path = join(
    process.cwd(),
    "src/lib/constitute/topic-taxonomy.generated.json",
  );
  writeFileSync(path, JSON.stringify(out, null, 2) + "\n");
  console.log(
    `Wrote ${path}\n  ${categories.length} categories, ${leaves.length} leaf topics.`,
  );
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.regenerateTaxonomy) {
    await regenerateTaxonomy();
    return;
  }

  console.log("=== Constitute Project constitution sync ===");
  if (args.dryRun) console.log("MODE: dry run (no writes)\n");
  if (args.limit != null) console.log(`LIMIT: ${args.limit}`);
  if (args.slugs.length) console.log(`SLUGS: ${args.slugs.join(", ")}`);

  const summary = await syncConstitutions({
    dryRun: args.dryRun,
    limit: args.limit,
    slugs: args.slugs.length ? args.slugs : undefined,
    onProgress: (line) => console.log(line),
  });

  reportSyncSummary(summary);

  if (summary.failed.length > 0) {
    console.log(
      `\n${summary.failed.length} country/countries failed — re-run with --slug=<slug> to retry.`,
    );
  }
}

main().catch((err) => {
  console.error("\nFATAL:", err);
  process.exit(1);
});
