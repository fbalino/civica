import { config } from "dotenv";
config({ path: ".env.local" });

import {
  computeCabinetPlan,
  reportCabinetPlan,
  syncCiaCabinets,
  backfillCabinetQids,
  buildCiaSlugList,
} from "../src/lib/factbook/cia-cabinets-sync";
import { markSourcesSynced } from "../src/lib/db/source-freshness";

// Thin CLI wrapper around the shared CIA-cabinets-sync core in
// `src/lib/factbook/cia-cabinets-sync.ts` (the single implementation the cron
// route also uses).
//
// Modes:
//   --dry-run (or DRY_RUN=1)  → fetch a SAMPLE, parse, resolve jurisdictions +
//                               persons, and PRINT the proposed change set.
//                               Writes NOTHING to the DB.
//   --apply   (or APPLY=1)    → the FULL crawl (~194 CIA pages, 404-tolerant),
//                               persisting offices / persons / terms /
//                               statements and stamping markSourcesSynced.
//                               Owner scope: cabinet + central-bank + deputy +
//                               other; diplomatic DROPPED. NO per-person
//                               Wikidata call — persons are matched-else-ID-less.
//                               ~35–45 min (crawl-delay-bound).
//   --apply --sample          → apply, but only over SAMPLE_SLUGS (fast check).
//   --apply --limit=<n>       → apply, but only the first <n> CIA slugs (a small
//                               smoke test of the write path).
//   --backfill-qids           → the DEFERRED, decoupled QID pass. Finds
//                               cia-sourced ID-less persons and attaches a
//                               Wikidata QID when confident. Throttled +
//                               resumable; run it SLOWLY off the critical path.
//                               Add --limit=<n> (default 50) and/or --dry-run.
//
// NOTE: `united-states` is intentionally in the SAMPLE to demonstrate a key
// finding — the CIA "World Leaders" directory lists FOREIGN governments only,
// so the US has NO page there (HTTP 404). The full apply crawl skips it.
const SAMPLE_SLUGS = [
  "united-states",
  "united-kingdom",
  "france",
  "germany",
  "china",
  "brazil",
  "india",
  "saudi-arabia",
  "nigeria",
  "japan",
  "mexico",
  "nauru", // small state
];

const DRY_RUN =
  process.argv.includes("--dry-run") || process.env.DRY_RUN === "1";
const APPLY = process.argv.includes("--apply") || process.env.APPLY === "1";
const BACKFILL_QIDS = process.argv.includes("--backfill-qids");
const SAMPLE = process.argv.includes("--sample");

/**
 * Optional `--limit=<n>` arg. In `--apply` mode it caps the CIA slug list (a
 * fast smoke test of the write path); in `--backfill-qids` mode it caps the
 * number of persons processed this run. Undefined when absent/invalid.
 */
function limitFromArgs(): number | undefined {
  const arg = process.argv.find((a) => a.startsWith("--limit="));
  if (!arg) return undefined;
  const n = Number(arg.split("=")[1]);
  return Number.isInteger(n) && n > 0 ? n : undefined;
}

/**
 * Optional `--crawl-delay=<ms>` override. Defaults to the library's 10s (the
 * cia.gov robots.txt Crawl-delay). A shorter value is only appropriate for a
 * small sample run.
 */
function crawlDelayFromArgs(): number | undefined {
  const arg = process.argv.find((a) => a.startsWith("--crawl-delay="));
  if (!arg) return undefined;
  const n = Number(arg.split("=")[1]);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

/**
 * Optional `--only=<slug,slug>` filter. Restricts the crawl to specific CIA
 * slugs — handy for re-running a straggler country (writes are idempotent) or
 * a targeted refresh without a full ~3h crawl. Case-insensitive; no-op in
 * --sample mode.
 */
function onlySlugsFromArgs(): string[] | undefined {
  const arg = process.argv.find((a) => a.startsWith("--only="));
  if (!arg) return undefined;
  const slugs = arg
    .split("=")[1]
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return slugs.length ? slugs : undefined;
}

async function runDryRun() {
  console.log("=== CIA World Leaders Cabinet Import (DRY RUN) ===");
  console.log(`Sample: ${SAMPLE_SLUGS.length} countries`);
  console.log(
    "Fetching cia.gov with a browser UA, honoring the crawl-delay …\n",
  );

  const plan = await computeCabinetPlan({
    slugs: SAMPLE_SLUGS,
    crawlDelayMs: crawlDelayFromArgs(),
    onProgress: (line) => {
      if (line.startsWith("!")) console.error(line);
      else console.log(line);
    },
  });

  reportCabinetPlan(plan);

  // Dry runs never advance freshness (guarded by dryRun + rowsWritten=0).
  await markSourcesSynced("cia_world_leaders", {
    rowsWritten: 0,
    dryRun: true,
  });
}

async function runApply() {
  const base = SAMPLE ? SAMPLE_SLUGS : await buildCiaSlugList();
  const only = SAMPLE ? undefined : onlySlugsFromArgs();
  const scoped = only ? base.filter((s) => only.includes(s.toLowerCase())) : base;
  const limit = limitFromArgs();
  const slugs = limit ? scoped.slice(0, limit) : scoped;
  const scopeLabel = SAMPLE
    ? " (SAMPLE)"
    : only
      ? ` (ONLY: ${slugs.join(", ") || "no match"})`
      : limit
        ? ` (first ${limit})`
        : " (FULL)";
  console.log("=== CIA World Leaders Cabinet Import (APPLY — REAL WRITES) ===");
  console.log(`Crawling ${slugs.length} CIA candidate pages${scopeLabel} …`);
  console.log(
    "Crawl-delay-bound (10s × pages); NO per-person Wikidata call. Expected.\n",
  );

  const summary = await syncCiaCabinets({
    slugs,
    crawlDelayMs: crawlDelayFromArgs(),
    onProgress: (line) => {
      if (line.startsWith("!")) console.error(line);
      else console.log(line);
    },
  });

  console.log("\n=== SUMMARY (JSON) ===");
  console.log(JSON.stringify(summary, null, 2));
}

async function runBackfill() {
  const limit = limitFromArgs();
  console.log(
    `=== CIA Cabinet QID Backfill${DRY_RUN ? " (DRY RUN)" : ""} — deferred, decoupled ===`,
  );
  console.log(
    "Throttled Wikidata lookups (~11s each) for cia-sourced ID-less persons.",
  );
  console.log("Resumable — re-run to continue where this batch left off.\n");

  const summary = await backfillCabinetQids({
    limit,
    dryRun: DRY_RUN,
    onProgress: (line) => {
      if (line.startsWith("!")) console.error(line);
      else console.log(line);
    },
  });

  console.log("\n=== SUMMARY (JSON) ===");
  console.log(JSON.stringify(summary, null, 2));
}

async function main() {
  // Check --backfill-qids BEFORE --dry-run (they combine: a dry-run backfill).
  if (BACKFILL_QIDS) {
    await runBackfill();
    return;
  }
  if (APPLY) {
    await runApply();
    return;
  }
  if (DRY_RUN) {
    await runDryRun();
    return;
  }
  console.error(
    "Specify a mode: --dry-run (sample preview, no writes), --apply (full crawl, real writes; add --sample or --limit=<n> for a subset), or --backfill-qids (deferred QID attach; add --limit=<n> and/or --dry-run).",
  );
  process.exit(1);
}

main().catch((err) => {
  console.error("CIA cabinet sync failed:", err);
  process.exit(1);
});
