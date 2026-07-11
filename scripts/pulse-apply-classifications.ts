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
import { sql, eq } from "drizzle-orm";
import { rawEvents } from "../src/lib/db/schema";
import { createDb } from "../src/lib/pulse/v2/ingest";
import {
  persistClassificationFailureDecision,
  persistNonEventDecision,
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
import type {
  ClassifierRun,
  ClassifiedEvent,
  SeverityTier,
} from "../src/lib/pulse/v2/types";
import {
  createPulsePipelineRunRef,
  finishPulsePipelineRun,
  startPulsePipelineRun,
} from "../src/lib/pulse/v2/pipeline-version";
import { versioned } from "../src/lib/research/derivation-version";

interface Decision {
  clusterId: string;
  isGovernanceEvent: boolean;
  category: string;
  severityTier: SeverityTier;
  severityValue: number;
  subjectIso3: string | null;
  /** high | medium | low — low routes to human review instead of
   *  auto-publishing (replaces the old same-prompt-different-temperature
   *  "agreement" signal with a classify→verify confidence). */
  confidence?: "high" | "medium" | "low";
}

const arg = (k: string) =>
  process.argv.find((a) => a.startsWith(k))?.slice(k.length);
const rows = (r: unknown) =>
  (Array.isArray(r) ? r : ((r as { rows?: unknown[] }).rows ?? [])) as Record<
    string,
    unknown
  >[];

async function main() {
  const db = createDb();
  const clustersPath = arg("--clusters=") ?? "/tmp/pulse-clusters.json";
  const decisionsPath = arg("--decisions=") ?? "/tmp/pulse-decisions.json";

  const clusters: ClusterToClassify[] = JSON.parse(
    await readFile(clustersPath, "utf8"),
  );
  const decisions: Decision[] = JSON.parse(
    await readFile(decisionsPath, "utf8"),
  );
  const byId = new Map(clusters.map((c) => [c.clusterId, c]));
  const classificationRun = createPulsePipelineRunRef("classify", {
    sourceIds: clusters.flatMap((cluster) => cluster.sourceIds),
    upstreamRunIds: clusters.flatMap((cluster) => cluster.clusterRunIds),
    models: [
      {
        role: "classify",
        provider: "subscription_agent",
        model: "claude-code-agent",
      },
    ],
    prompt: versioned("pulse-subscription-agent-decision/v1"),
    algorithm: versioned("pulse-classification/subscription-agent-apply-v1"),
  });
  await startPulsePipelineRun(db, classificationRun);

  const iso3Map = new Map<string, string>();
  for (const j of rows(
    await db.execute(
      sql`SELECT id, iso3 FROM jurisdictions WHERE iso3 IS NOT NULL`,
    ),
  ))
    iso3Map.set(String(j.iso3).toUpperCase(), String(j.id));

  let written = 0,
    skipped = 0,
    invalid = 0;
  const subscriptionActor = {
    type: "classifier" as const,
    provider: "subscription_agent",
    model: "claude-code-agent",
    reviewerId: null,
  };

  async function retainDisposition(
    decision: Decision,
    disposition: "event" | "non_governance" | "invalid",
    reason: string,
  ) {
    await db
      .update(rawEvents)
      .set({
        classificationDisposition: disposition,
        classificationReason: reason,
        classificationDecision: decision,
        classifiedAt: new Date(),
        classificationRunId: classificationRun.id,
      })
      .where(eq(rawEvents.clusterId, decision.clusterId));
  }

  for (const d of decisions) {
    const cluster = byId.get(d.clusterId);
    if (!cluster) {
      invalid++;
      continue;
    }
    if (!d.isGovernanceEvent || d.category === "none") {
      await retainDisposition(
        d,
        "non_governance",
        "classifier determined that the cluster was not a governance event",
      );
      await persistNonEventDecision(db, cluster, classificationRun.id, {
        actor: subscriptionActor,
        rationale:
          "Subscription-agent classifier found no qualifying governance event.",
      });
      skipped++;
      continue;
    }
    const cat = EVENT_CATEGORY_INDEX[d.category];
    if (!cat || !cat.allowedTiers.includes(d.severityTier)) {
      console.warn(
        `  ! invalid category/tier for cluster ${d.clusterId}: ${d.category}/${d.severityTier}`,
      );
      await retainDisposition(
        d,
        "invalid",
        `invalid category/tier: ${d.category}/${d.severityTier}`,
      );
      await persistClassificationFailureDecision(
        db,
        cluster,
        classificationRun.id,
        {
          actor: subscriptionActor,
          rationale: `Subscription-agent output had an invalid category/tier: ${d.category}/${d.severityTier}.`,
        },
      );
      invalid++;
      continue;
    }
    const range = SEVERITY_TIER_RANGES[d.severityTier];
    const severityValue = Math.max(
      range.min,
      Math.min(range.max, Math.round(d.severityValue)),
    );
    const jurisdictionId =
      (d.subjectIso3 && iso3Map.get(d.subjectIso3.toUpperCase())) ||
      cluster.jurisdictionId;

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
    // Normalize confidence defensively: a missing/undefined/malformed value
    // must NOT be treated as "not low" (that bug let thin events auto-publish
    // when the classifying prompt dropped the confidence field). Anything
    // that isn't a recognized value is treated as "low" — i.e. it queues for
    // human review rather than silently auto-publishing.
    if (
      d.confidence !== "high" &&
      d.confidence !== "medium" &&
      d.confidence !== "low"
    ) {
      console.warn(
        `  ! missing/invalid confidence for cluster ${d.clusterId} (got ${JSON.stringify(
          d.confidence,
        )}) — treating as "low" (routes to human review).`,
      );
    }
    const conf: "high" | "medium" | "low" =
      d.confidence === "high" ||
      d.confidence === "medium" ||
      d.confidence === "low"
        ? d.confidence
        : "low";
    const ok: ClassifyOneResult = {
      classified,
      // Auto-publish only when the tier is not review-gated AND the agent's
      // classify→verify confidence is not low. Low-confidence events go to
      // the human review queue (published=false) instead of scoring silently.
      autoPublished: !HUMAN_REVIEW_TIERS.has(d.severityTier) && conf !== "low",
      // This legacy subscription-agent import did not preserve the verifier's
      // four independent judgments or a subject-attribution verdict.
      verification: null,
      subjectAttribution: null,
    };
    await writeEvent(db, cluster, ok, classificationRun.id);
    written++;
  }

  console.log(
    `\nWrote ${written} event(s) · skipped ${skipped} (non-governance) · ${invalid} invalid.`,
  );
  await finishPulsePipelineRun(db, classificationRun.id, {
    status: invalid > 0 ? "partial" : "completed",
    counts: { decisions: decisions.length, written, skipped, invalid },
    failures:
      invalid > 0
        ? [
            {
              component: "subscription_agent_decisions",
              message: `${invalid} invalid or unmatched decision(s).`,
            },
          ]
        : [],
  });
  console.log("Re-running corroboration + scoring...");
  const corro = await corroborateEvents(db);
  const score = await calculateDimensionalDeltas(db);
  console.log(
    `  corroboration: ${corro.examined} events, avg conf ${corro.averageConfidence.toFixed(3)}`,
  );
  console.log(
    `  scoring: ${score.eventsConsidered} events × ${score.countriesScored} countries → ${score.significantDeltas} significant deltas`,
  );

  // DAT-016: examined non-events stay in raw_events with their decision and
  // reason. They are excluded from the unclassified queue by disposition and
  // remain available for prospective false-negative studies.
  console.log(
    `  retained ${skipped + invalid} rejected/invalid cluster decision(s) for evaluation.`,
  );
  console.log("DONE.");
  process.exit(0);
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
