import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  GATE_COMMANDS,
  buildGateReadinessReport,
  buildGateReadinessReports,
  loadReadinessInputs,
  readinessReportErrors,
  type CommandResult,
  type ReadinessGate,
} from "./readiness-reports";

function task(id: string, priority: "P0" | "P1" | "P2", checked: boolean) {
  return `- [${checked ? "x" : " "}] **${id}** (${priority}) Fixture task. _Done when: fixture completes._`;
}

function fixture(options: { completed: boolean; evidence?: boolean; progress?: boolean }) {
  const root = mkdtempSync(join(tmpdir(), "civica-readiness-"));
  mkdirSync(join(root, "plan", "evidence"), { recursive: true });
  mkdirSync(join(root, "data", "readiness"), { recursive: true });
  const first = task("QA-001", "P0", options.completed);
  const second = task("QA-099", "P0", false);
  writeFileSync(join(root, "plan", "02-fixture.md"), `# Area fixture\n\n${first}\n${second}\n`);
  writeFileSync(join(root, "plan", "MASTER-CHECKLIST.md"), `# Master\n\n${first}\n${second}\n`);
  writeFileSync(join(root, "plan", "PROGRESS.md"), options.progress === false ? "# Progress\n" : "# Progress\n\n- QA-001 completed: fixture\n");
  writeFileSync(join(root, "plan", "MANUAL-CHECKS.md"), "# Manual\n\n- **QA-099** requires a human check.\n");
  writeFileSync(join(root, "data", "readiness", "waivers.v1.json"), '{"schemaVersion":"civica-readiness-waivers/v1","waivers":[]}\n');
  if (options.evidence !== false) mkdirSync(join(root, "plan", "evidence", "QA-001"));
  return root;
}

function passing(gate: ReadinessGate): Record<string, CommandResult> {
  return Object.fromEntries(GATE_COMMANDS[gate].map((command) => [command.id, { status: "passed", exitCode: 0, durationMs: 1 }]));
}

test("G4 cannot report pass with an open P0 task even when every command passes", () => {
  const root = fixture({ completed: true });
  try {
    const inputs = loadReadinessInputs(root);
    const report = buildGateReadinessReport(inputs, "G4", passing("G4"));
    assert.equal(report.status, "blocked");
    assert.deepEqual(report.openP0P1, ["QA-099"]);
    assert.match(report.blockers.join("\n"), /unchecked P0\/P1/);
    assert.deepEqual(readinessReportErrors(buildGateReadinessReports(inputs)), []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("missing evidence or progress is a visible blocking gap", () => {
  const root = fixture({ completed: true, evidence: false, progress: false });
  try {
    const report = buildGateReadinessReport(loadReadinessInputs(root), "G2", passing("G2"));
    assert.equal(report.status, "blocked");
    assert.deepEqual(report.evidenceGaps, ["QA-001: completion record missing", "QA-001: evidence directory missing"]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("every gate rejects a green status while an unchecked P0 remains", () => {
  const root = fixture({ completed: true });
  try {
    const report = buildGateReadinessReport(loadReadinessInputs(root), "G2", passing("G2"));
    assert.equal(report.status, "blocked");
    assert.deepEqual(report.openP0, ["QA-099"]);
    assert.match(report.blockers.join("\n"), /unchecked P0 tasks prevent a green report/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("a failed fixed command fails the report without copying shell text from an artifact", () => {
  const root = fixture({ completed: false });
  try {
    const results = passing("G2");
    results["atlas-release"] = { status: "failed", exitCode: 1, durationMs: 2 };
    const report = buildGateReadinessReport(loadReadinessInputs(root), "G2", results);
    assert.equal(report.status, "failed");
    assert.equal(report.commands.find((command) => command.id === "atlas-release")?.command, "npm run validate:g2-atlas");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
