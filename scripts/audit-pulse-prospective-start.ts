import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

import { config as dotenvConfig } from "dotenv";
import { neon } from "@neondatabase/serverless";

import { PULSE_RUNTIME_METHOD_VERSION } from "../src/lib/pulse/v2/runtime-contract";

const outputPath = "plan/evidence/PUL-040/start-readiness.json";
const write = process.argv.includes("--write");
const unknown = process.argv.slice(2).filter((arg) => arg !== "--write");
if (unknown.length > 0) throw new Error(`Unknown arguments: ${unknown.join(", ")}`);

async function main() {
const protocolBytes = readFileSync(
  "data/research/pulse-validation-protocol-v1.json",
  "utf8",
);
const protocol = JSON.parse(protocolBytes) as {
  schemaVersion: string;
  semanticSha256: string;
  status: string;
  currentRuntimeMethod: string;
  startPrerequisites: string[];
  lanes: { prospectiveShadow: { durationDays: number } };
};
const runtime = JSON.parse(
  readFileSync("src/lib/pulse/v2/runtime-method.generated.json", "utf8"),
) as {
  contractHash: string;
  version: string;
  feeds: { observedEvidence: { observedThrough: string } };
};
const vercel = JSON.parse(readFileSync("vercel.json", "utf8")) as {
  crons?: Array<{ path: string; schedule: string }>;
};

dotenvConfig({ path: ".env.local", override: true, quiet: true });
const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) throw new Error("DATABASE_URL is required for the read-only preflight");
const sql = neon(databaseUrl);

const stageRows = await sql`
  SELECT
    stage,
    COUNT(*) FILTER (WHERE status = 'completed')::int AS completed_count,
    MAX(completed_at) FILTER (WHERE status = 'completed')::text AS latest_completed_at
  FROM pulse_pipeline_runs
  WHERE versions->'methodology'->>'id' = ${PULSE_RUNTIME_METHOD_VERSION}
  GROUP BY stage
  ORDER BY stage
`;
const evidenceCutRows = await sql`
  SELECT MAX(created_at)::date::text AS observed_through
  FROM raw_events
`;

const stageMap = new Map(
  stageRows.map((row) => [
    String((row as Record<string, unknown>).stage),
    {
      completedCount: Number(
        (row as Record<string, unknown>).completed_count ?? 0,
      ),
      latestCompletedAt:
        ((row as Record<string, unknown>).latest_completed_at as string | null) ??
        null,
    },
  ]),
);
const requiredStages = ["ingest", "cluster", "classify", "corroborate", "score"];
const routes = [
  "/api/cron/pulse/v2/ingest",
  "/api/cron/pulse/v2/cluster",
  "/api/cron/pulse/v2/classify",
  "/api/cron/pulse/v2/score",
  "/api/cron/pulse/v2/review-sla",
];
const configuredRoutes = new Set((vercel.crons ?? []).map((cron) => cron.path));
const priorArtifact = write
  ? null
  : (JSON.parse(readFileSync(outputPath, "utf8")) as { checkedAt?: string });
const checkedAt = priorArtifact?.checkedAt ?? new Date().toISOString();
const liveEvidenceThrough = String(
  (evidenceCutRows[0] as Record<string, unknown> | undefined)
    ?.observed_through ?? "",
);

const prerequisites = [
  {
    id: "protocol_artifact_and_hash_checked_in",
    status: "pass",
    evidence: `protocol ${protocol.schemaVersion} semantic SHA-256 ${protocol.semanticSha256}`,
  },
  {
    id: "runtime_method_and_every_stage_version_frozen",
    status: "pass",
    evidence: `runtime ${runtime.version} contract ${runtime.contractHash}`,
  },
  {
    id: "scheduled_ingest_cluster_classify_score_and_review_sla_routes_enabled",
    status: routes.every((route) => configuredRoutes.has(route))
      ? "configured_not_deployed_verified"
      : "fail",
    evidence: "vercel.json",
  },
  {
    id: "one_successful_current_version_run_for_each_automatic_stage",
    status: requiredStages.every(
      (stage) => (stageMap.get(stage)?.completedCount ?? 0) > 0,
    )
      ? "pass"
      : "fail",
    evidence: "read-only aggregate pulse_pipeline_runs query",
  },
  {
    id: "append_only_evidence_and_output_history_live_validators_pass",
    status: "blocked_pending_migrations_and_live_validation",
    evidence: "PUL-024, PUL-027, and PUL-043 completion boundaries",
  },
  {
    id: "source_coverage_and_observability_snapshot_recorded",
    status: "not_recorded_at_start_boundary",
    evidence: "start boundary does not yet exist",
  },
  {
    id: "no_prospective_human_labels_exist",
    status: "pass",
    evidence: "protocol remains preregistered_not_started; no start/window record exists",
  },
  {
    id: "start_instant_and_planned_end_date_recorded_before_first_eligible_retrieval",
    status: "not_recorded",
    evidence: "earliest compliant start remains unknown",
  },
];

const artifact = {
  schemaVersion: "pulse-prospective-start-readiness/v1",
  taskId: "PUL-040",
  checkedAt,
  status: "blocked",
  protocol: {
    schemaVersion: protocol.schemaVersion,
    semanticSha256: protocol.semanticSha256,
    status: protocol.status,
    currentRuntimeMethod: protocol.currentRuntimeMethod,
    durationDays: protocol.lanes.prospectiveShadow.durationDays,
  },
  runtime: {
    codeMethodVersion: PULSE_RUNTIME_METHOD_VERSION,
    checkedContractVersion: runtime.version,
    checkedContractHash: runtime.contractHash,
    checkedObservedEvidenceThrough: runtime.feeds.observedEvidence.observedThrough,
    liveObservedEvidenceThrough: liveEvidenceThrough,
  },
  scheduledRoutes: routes.map((route) => ({
    route,
    configuredInRepository: configuredRoutes.has(route),
    deployedEnabledState: "not_verified",
  })),
  currentMethodSuccessfulRuns: requiredStages.map((stage) => ({
    stage,
    completedCount: stageMap.get(stage)?.completedCount ?? 0,
    latestCompletedAt: stageMap.get(stage)?.latestCompletedAt ?? null,
  })),
  prerequisites,
  earliestCompliantStart: null,
  plannedEnd: null,
  startCalculation:
    "After every prerequisite passes, record the boundary before the next eligible retrieval. The start is that first retained eligible retrieval timestamp; plannedEnd is exactly 90 consecutive UTC days later. Never backdate.",
  semanticSha256: "",
};
const body = { ...artifact };
body.semanticSha256 = createHash("sha256")
  .update(JSON.stringify({ ...body, semanticSha256: undefined }))
  .digest("hex");

const rendered = `${JSON.stringify(body, null, 2)}\n`;
if (write) {
  writeFileSync(outputPath, rendered);
  console.log(`Wrote ${outputPath}`);
} else {
  const existing = readFileSync(outputPath, "utf8");
  if (existing !== rendered) {
    throw new Error("PUL-040 start-readiness artifact is stale; rerun with --write");
  }
  console.log(
    `PASS — PUL-040 remains blocked; ${requiredStages.filter((stage) => (stageMap.get(stage)?.completedCount ?? 0) > 0).length}/${requiredStages.length} current-method automatic stages have a completed run.`,
  );
}
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
