/**
 * Pulse daily refresh — STEP 2 of 2 (apply).
 *
 * Takes the clusters exported by pulse-export-clusters.ts plus the
 * classifications a Claude Code agent produced (on the subscription), writes
 * the resulting events via the EXISTING validated pipeline writer
 * (writeEvent), then re-runs corroboration + scoring. No paid Anthropic API
 * call happens here — the LLM work was the agent's.
 *
 * Decision JSON shape (array, produced by the agent — see pulse-daily skill):
 *   [{ "clusterId": "...", "isGovernanceEvent": true,
 *      "category": "judicial_purge", "severityTier": "severe_neg",
 *      "severityValue": -7, "subjectIso3": "USA" }, ...]
 * dimension is derived from the taxonomy (not trusted from the agent);
 * non-governance items (isGovernanceEvent=false or category "none") are skipped.
 *
 * Usage:
 *   tsx scripts/pulse-apply-classifications.ts \
 *     --clusters=/tmp/pulse-clusters.json --decisions=/tmp/pulse-decisions.json
 */
import { config } from "dotenv";
config({ path: ".env.local", override: true });

import { readFile } from "node:fs/promises";
import { sql } from "drizzle-orm";
import { createDb } from "../src/lib/pulse/v2/ingest";
import {
  writeEvent,
  type ClusterToClassify,
  type ClassifyOneResult,
} from "../src/lib/pulse/v2/classify";
import {
  EVENT_CATEGORY_INDEX,
  HUMAN_REVIEW_TIERS,
  SEVERITY_TIER_RANGES,
} from "../src/lib/pulse/v2/taxonomy";
import { corroborateEvents } from "../src/lib/pulse/v2/corroborate";
import { calculateDimensionalDeltas } from "../src/lib/pulse/v2/score";
import type { ClassifierRun, ClassifiedEvent, SeverityTier } from "../src/lib/pulse/v2/types";

interface Decision {
  clusterId: string;
  isGovernanceEvent: boolean;
  category: string;
  severityTier: SeverityTier;
  severityValue: number;
  subjectIso3: string | null;
}

const arg = (k: string) => process.argv.find((a) => a.startsWith(k))?.slice(k.length);
const rows = (r: unknown) =>
  (Array.isArray(r) ? r : ((r as { rows?: unknown[] }).rows ?? [])) as Record<string, unknown>[];

async function main() {
  const db = createDb();
  const clustersPath = arg("--clusters=") ?? "/tmp/pulse-clusters.json";
  const decisionsPath = arg("--decisions=") ?? "/tmp/pulse-decisions.json";

  const clusters: ClusterToClassify[] = JSON.parse(await readFile(clustersPath, "utf8"));
  const decisions: Decision[] = JSON.parse(await readFile(decisionsPath, "utf8"));
  const byId = new Map(clusters.map((c) => [c.clusterId, c]));

  const iso3Map = new Map<string, string>();
  for (const j of rows(
    await db.execute(sql`SELECT id, iso3 FROM jurisdictions WHERE iso3 IS NOT NULL`)
  ))
    iso3Map.set(String(j.iso3).toUpperCase(), String(j.id));

  let written = 0,
    skipped = 0,
    invalid = 0;

  for (const d of decisions) {
    const cluster = byId.get(d.clusterId);
    if (!cluster) {
      invalid++;
      continue;
    }
    if (!d.isGovernanceEvent || d.category === "none") {
      skipped++;
      continue;
    }
    const cat = EVENT_CATEGORY_INDEX[d.category];
    if (!cat || !cat.allowedTiers.includes(d.severityTier)) {
      console.warn(`  ! invalid category/tier for cluster ${d.clusterId}: ${d.category}/${d.severityTier}`);
      invalid++;
      continue;
    }
    const range = SEVERITY_TIER_RANGES[d.severityTier];
    const severityValue = Math.max(range.min, Math.min(range.max, Math.round(d.severityValue)));
    const jurisdictionId =
      (d.subjectIso3 && iso3Map.get(d.subjectIso3.toUpperCase())) || cluster.jurisdictionId;

    const run: ClassifierRun = {
      run: 1,
      temp: 0,
      model: "claude-code-agent",
      category: d.category,
      dimension: cat.dimension,
      severityTier: d.severityTier,
      severityValue,
      selfConfidence: 0.8,
      rationale: "subscription-agent classification",
      raw: JSON.stringify(d),
    };
    const classified: ClassifiedEvent = {
      jurisdictionId,
      eventDate: cluster.eventDate,
      category: d.category,
      dimension: cat.dimension,
      severityTier: d.severityTier,
      severityValue,
      classifierRuns: [run],
      classifierAgreement: "two_of_three", // single trusted agent ⇒ neutral boost
      headline: cluster.title.slice(0, 200),
      description: cluster.body.slice(0, 1500),
    };
    const ok: ClassifyOneResult = {
      classified,
      autoPublished: !HUMAN_REVIEW_TIERS.has(d.severityTier),
    };
    await writeEvent(db, cluster, ok);
    written++;
  }

  console.log(`\nWrote ${written} event(s) · skipped ${skipped} (non-governance) · ${invalid} invalid.`);
  console.log("Re-running corroboration + scoring...");
  const corro = await corroborateEvents(db);
  const score = await calculateDimensionalDeltas(db);
  console.log(`  corroboration: ${corro.examined} events, avg conf ${corro.averageConfidence.toFixed(3)}`);
  console.log(
    `  scoring: ${score.eventsConsidered} events × ${score.countriesScored} countries → ${score.significantDeltas} significant deltas`
  );
  console.log("DONE.");
  process.exit(0);
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
