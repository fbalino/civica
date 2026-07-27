import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

import {
  GATE_COMMANDS,
  READINESS_GATES,
  buildGateReadinessReports,
  loadReadinessInputs,
  readinessReportErrors,
  renderGateReadinessReports,
  type CommandResult,
  type ReadinessGate,
} from "../src/lib/qa/readiness-reports";

const outputPath = "data/readiness/gate-reports.v1.json";
const args = new Set(process.argv.slice(2));
const gateArg = process.argv.find((arg) => arg.startsWith("--gate="));
const gate = gateArg?.slice("--gate=".length) as ReadinessGate | undefined;
const execute = args.has("--execute");
const write = args.has("--write");
const check = args.has("--check");
const requirePass = args.has("--require-pass");

if (gate && !READINESS_GATES.includes(gate)) throw new Error(`Unknown readiness gate ${gate}`);
if (write && check) throw new Error("Choose either --write or --check");
if (write && execute) throw new Error("Refusing to write runtime command timings into the checked report; run --execute without --write");
if (requirePass && !execute) throw new Error("--require-pass requires --execute");

function executeGate(selected: ReadinessGate) {
  const results: Record<string, CommandResult> = {};
  for (const command of GATE_COMMANDS[selected]) {
    const started = performance.now();
    const result = spawnSync(command.program, command.args, {
      cwd: process.cwd(),
      encoding: "utf8",
      stdio: "ignore",
    });
    results[command.id] = {
      status: result.status === 0 ? "passed" : "failed",
      exitCode: result.status ?? 1,
      durationMs: Math.round(performance.now() - started),
    };
  }
  return results;
}

const inputs = loadReadinessInputs();
const selected = gate ? [gate] : [...READINESS_GATES];
const commandResults = execute
  ? Object.fromEntries(selected.map((selectedGate) => [selectedGate, executeGate(selectedGate)]))
  : {};
const reports = buildGateReadinessReports(inputs, commandResults);
const errors = readinessReportErrors(reports);
if (errors.length) throw new Error(errors.join("\n"));
const rendered = renderGateReadinessReports(reports);

if (write) {
  writeFileSync(outputPath, rendered);
  console.log(`Wrote ${outputPath}.`);
} else if (check) {
  if (!existsSync(outputPath)) throw new Error(`${outputPath} is missing; run npm run generate:readiness-reports`);
  if (readFileSync(outputPath, "utf8") !== rendered) throw new Error(`${outputPath} is stale; run npm run generate:readiness-reports`);
  console.log(`PASS — ${reports.schemaVersion}: checked reports match canonical plan/evidence inputs.`);
} else {
  const visible = reports.reports.filter((report) => selected.includes(report.gate));
  console.log(JSON.stringify({ schemaVersion: reports.schemaVersion, reports: visible }, null, 2));
}

if (requirePass) {
  const failed = reports.reports.filter((report) => selected.includes(report.gate) && report.status !== "pass");
  if (failed.length) throw new Error(`Readiness gate(s) not passing: ${failed.map((report) => report.gate).join(", ")}`);
}
