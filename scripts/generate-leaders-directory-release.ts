import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import { getWorldLeadersDirectory } from "@/lib/leaders/query";
import {
  buildLeaderDirectoryRelease,
  type LeaderDirectoryRelease,
} from "@/lib/leaders/release";

const OUTPUT = "data/leaders-directory-release.v1.json";
const write = process.argv.includes("--write");
const markReady = process.argv.includes("--ready");

async function main() {
  const previous = (() => {
    try {
      return JSON.parse(readFileSync(OUTPUT, "utf8")) as LeaderDirectoryRelease;
    } catch {
      return null;
    }
  })();
  const generatedAt =
    write || !previous ? new Date().toISOString() : previous.generatedAt;
  const rows = await getWorldLeadersDirectory();
  const publicationStatus = markReady
    ? "ready"
    : previous?.publicationStatus ?? "blocked_source_refresh";
  const artifact = buildLeaderDirectoryRelease(
    rows,
    generatedAt,
    publicationStatus,
  );

  if (write) {
    mkdirSync(dirname(OUTPUT), { recursive: true });
    writeFileSync(OUTPUT, `${JSON.stringify(artifact, null, 2)}\n`);
    console.log(
      `WROTE ${OUTPUT} — ${artifact.counts.rows} records, ${artifact.counts.people} people, ${artifact.counts.jurisdictions} jurisdictions.`,
    );
    return;
  }

  if (!previous) {
    console.error(`ERROR: ${OUTPUT} is missing; run with --write.`);
    process.exit(1);
  }
  const comparable = (value: LeaderDirectoryRelease) => ({
    ...value,
    generatedAt: previous.generatedAt,
    releaseId: previous.releaseId,
  });
  if (JSON.stringify(comparable(artifact)) !== JSON.stringify(previous)) {
    console.error(
      "ERROR: the live world-leaders query no longer matches the checked release artifact; regenerate only after reviewing the source change.",
    );
    process.exit(1);
  }
  console.log(
    `PASS — live leader directory matches ${previous.releaseId}: ${previous.counts.rows} records across ${previous.counts.jurisdictions} jurisdictions.`,
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
