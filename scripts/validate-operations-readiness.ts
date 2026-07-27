import { existsSync, readFileSync } from "node:fs";

import {
  MANUAL_PRODUCTION_ADAPTERS,
  SCHEDULED_PRODUCTION_ADAPTERS,
} from "../src/lib/data/production-adapter-registry";
import { ROUTE_INVENTORY } from "../src/lib/api/route-inventory/registry";

const reportPath = "data/OPERATIONS-READINESS.md";
const report = readFileSync(reportPath, "utf8");
const readiness = JSON.parse(
  readFileSync("data/readiness/gate-reports.v1.json", "utf8"),
) as {
  reports: Array<{
    gate: string;
    status: string;
    openP0: string[];
    openP0P1: string[];
    evidenceGaps: string[];
    masterMirrorErrors: string[];
    waivers: unknown[];
    taskSummary: { total: number; completed: number };
  }>;
};
const g4 = readiness.reports.find((candidate) => candidate.gate === "G4");
const errors: string[] = [];

const requireText = (text: string) => {
  if (!report.includes(text)) errors.push(`report omits ${text}`);
};

for (const text of [
  "civica-g4-operations-readiness/v1",
  "**Status:** blocked",
  "**Waivers:** none",
  "## Route and exposure inventory",
  "## Security and access controls",
  "## CI and release verification",
  "## Jobs, freshness, and error monitoring",
  "## Backup, restoration, and recovery",
  "## Deployment, rollback, caches, and releases",
  "## Performance and browser support",
  "## Open incidents and unwaived operational blockers",
  "G4 operations readiness is **blocked**",
]) {
  requireText(text);
}

if (!g4) {
  errors.push("generated readiness artifact has no G4 report");
} else {
  if (g4.status !== "blocked") {
    errors.push(`G4 status is ${g4.status}; review the operations decision`);
  }
  if (!g4.openP0.includes("PLT-025")) {
    errors.push("G4 no longer lists PLT-025 as open");
  }
  if (!g4.openP0P1.includes("PLT-029")) {
    errors.push("G4 no longer lists PLT-029 as open");
  }
  if (g4.waivers.length !== 0) errors.push("operations report declares zero waivers");
  if (g4.evidenceGaps.length !== 0 || g4.masterMirrorErrors.length !== 0) {
    errors.push("G4 has evidence or master-mirror integrity gaps");
  }
  requireText(
    `${g4.taskSummary.completed} of ${g4.taskSummary.total} tasks complete`,
  );
  requireText(`${g4.openP0.length} open P0 tasks`);
  requireText(`${g4.openP0P1.length} open P0/P1 tasks`);
}

requireText(`${ROUTE_INVENTORY.length} repository-owned`);
requireText(
  `${SCHEDULED_PRODUCTION_ADAPTERS.length} scheduled and ${MANUAL_PRODUCTION_ADAPTERS.length} canonical`,
);

for (const path of [
  "plan/evidence/PLT-001/README.md",
  "plan/evidence/PLT-007/README.md",
  "plan/evidence/PLT-008/README.md",
  "plan/evidence/PLT-017/README.md",
  "plan/evidence/PLT-018/README.md",
  "plan/evidence/PLT-019/README.md",
  "plan/evidence/PLT-024/README.md",
  "plan/evidence/QA-014/README.md",
  "plan/evidence/QA-016/README.md",
  "plan/evidence/QA-017/README.md",
  "plan/evidence/DAT-021/restore-drill.json",
  "plan/MANUAL-CHECKS.md",
]) {
  if (!existsSync(path)) errors.push(`missing operations evidence ${path}`);
}

if (errors.length > 0) {
  for (const error of errors) console.error(`ERROR: ${error}`);
  process.exit(1);
}

console.log(
  `PASS — blocked G4 operations report binds ${ROUTE_INVENTORY.length} routes, ${SCHEDULED_PRODUCTION_ADAPTERS.length + MANUAL_PRODUCTION_ADAPTERS.length} pipelines, zero waivers, and every named evidence source.`,
);
