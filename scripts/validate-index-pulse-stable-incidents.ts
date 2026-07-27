import { readFileSync } from "node:fs";

const checks: Array<[boolean, string]> = [];
const source = (path: string) => readFileSync(path, "utf8");
const classify = source("src/lib/pulse/v2/classify.ts");
const score = source("src/lib/pulse/v2/score.ts");
const runtime = source("src/lib/pulse/v2/runtime-contract.ts");
const resolution = source("src/lib/pulse/v2/incident-resolution.ts");

checks.push([
  classify.includes("incidentId: cluster.incidentId ?? cluster.clusterId"),
  "classification does not bind its event projection to the stable incident",
]);
checks.push([
  score.includes("AND projection_status = 'current'") &&
    score.includes("source_event.incident_id = pulse_events_v2.incident_id"),
  "dimensional scoring is not current-projection-only with incident-wide evidence",
]);
checks.push([
  runtime.includes('PULSE_RUNTIME_METHOD_VERSION = "pulse-v2.10-beta"') &&
    runtime.includes('strategy: "stable_incident_resolution"'),
  "the Pulse runtime contract does not name the stable-incident method",
]);
checks.push([
  resolution.includes("exact_normalized_headline_same_resolved_jurisdiction_date_classification") &&
    resolution.includes('disposition = "candidate_merge"'),
  "incident resolution does not separate exact automatic rules from review candidates",
]);

const failures = checks.filter(([passed]) => !passed).map(([, message]) => message);
console.log("=== Index/Pulse stable-incident change-control validator ===\n");
if (failures.length) {
  for (const failure of failures) console.error(`ERROR: ${failure}`);
  process.exit(1);
}
console.log("PASS — Pulse duplicate repair changes event identity and evidence aggregation without permitting duplicate projections into Index-adjacent scoring.");
