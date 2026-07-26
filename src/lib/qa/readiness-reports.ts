import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const READINESS_REPORT_SCHEMA_VERSION =
  "civica-gate-readiness-report/v1" as const;

export const READINESS_GATES = ["G2", "G4", "G5", "G6"] as const;
export type ReadinessGate = (typeof READINESS_GATES)[number];

export type CommandStatus = "not_run" | "passed" | "failed";
export type GateStatus = "pending" | "blocked" | "failed" | "pass";

export interface GateCommand {
  id: string;
  program: string;
  args: readonly string[];
}

export interface CommandResult {
  status: Exclude<CommandStatus, "not_run">;
  exitCode: number;
  durationMs: number;
}

export interface ReadinessTask {
  id: string;
  priority: "P0" | "P1" | "P2";
  areaFile: string;
  completed: boolean;
  evidencePath: string;
  evidencePresent: boolean;
  progressPresent: boolean;
  manualCheckLines: readonly number[];
}

export interface ReadinessInputs {
  root: string;
  tasks: readonly ReadinessTask[];
  masterMirrorErrors: readonly string[];
  sourceHashes: Record<string, string>;
  manualCheckPath: string;
  waivers: readonly ReadinessWaiver[];
}

export interface ReadinessWaiver {
  id: string;
  gate: ReadinessGate;
  taskId: string | null;
  status: "approved";
  reason: string;
  evidencePath: string;
}

export interface GateCommandReport {
  id: string;
  command: string;
  status: CommandStatus;
  exitCode: number | null;
  durationMs: number | null;
}

export interface GateReadinessReport {
  gate: ReadinessGate;
  status: GateStatus;
  checkedAt: null;
  taskSummary: {
    total: number;
    completed: number;
    remaining: number;
    byPriority: Record<ReadinessTask["priority"], { total: number; completed: number }>;
    byArea: Record<string, { total: number; completed: number }>;
  };
  openP0: readonly string[];
  openP0P1: readonly string[];
  evidenceGaps: readonly string[];
  masterMirrorErrors: readonly string[];
  manualChecks: { path: string; sha256: string; linkedTaskIds: readonly string[] };
  waivers: readonly ReadinessWaiver[];
  commands: readonly GateCommandReport[];
  blockers: readonly string[];
}

export interface GateReadinessReports {
  schemaVersion: typeof READINESS_REPORT_SCHEMA_VERSION;
  sourceHashes: Record<string, string>;
  reports: readonly GateReadinessReport[];
}

const TASK_LINE = /^- \[([ x])\] \*\*([A-Z]+-\d{3})\*\* \((P[012])\) /;
const AREA_FILE = /^(0[2-9]|1[01])-.*\.md$/;

export const GATE_COMMANDS: Record<ReadinessGate, readonly GateCommand[]> = {
  G2: [
    { id: "master-plan", program: "node", args: ["plan/tools/validate-master-plan.mjs"] },
    { id: "atlas-release", program: "npm", args: ["run", "validate:g2-atlas"] },
    { id: "atlas-reproduction", program: "npm", args: ["run", "reproduce:g2-atlas"] },
    { id: "clean-room", program: "npm", args: ["run", "validate:clean-room"] },
    { id: "release-quality", program: "npm", args: ["run", "validate:release-quality-report"] },
  ],
  G4: [
    { id: "master-plan", program: "node", args: ["plan/tools/validate-master-plan.mjs"] },
    { id: "verification-matrix", program: "npm", args: ["run", "validate:verification-matrix"] },
    { id: "unit-suite", program: "npm", args: ["test"] },
    { id: "typecheck", program: "npm", args: ["run", "typecheck"] },
    { id: "lint", program: "npm", args: ["run", "lint"] },
    {
      id: "production-build",
      program: "npm",
      args: ["run", "build:ci"],
    },
  ],
  G5: [
    { id: "master-plan", program: "node", args: ["plan/tools/validate-master-plan.mjs"] },
    { id: "atlas-review-packet", program: "npm", args: ["run", "validate:atlas-review-packet"] },
    { id: "index-review-packet", program: "npm", args: ["run", "validate:index-review-packet"] },
    { id: "claims-docs", program: "npm", args: ["run", "validate:claims-docs"] },
  ],
  G6: [
    { id: "master-plan", program: "node", args: ["plan/tools/validate-master-plan.mjs"] },
    { id: "rights-manifest", program: "npm", args: ["run", "validate:rights-manifest"] },
    { id: "release-consistency", program: "npm", args: ["run", "validate:release-consistency"] },
    { id: "claims-docs", program: "npm", args: ["run", "validate:claims-docs"] },
  ],
};

const sha256 = (value: string) =>
  createHash("sha256").update(value).digest("hex");

const relative = (root: string, path: string) =>
  path.startsWith(`${root}/`) ? path.slice(root.length + 1) : path;

function parseTasks(path: string) {
  const content = readFileSync(path, "utf8");
  return content.split("\n").flatMap((line) => {
    const match = line.match(TASK_LINE);
    if (!match) return [];
    return [{ line, completed: match[1] === "x", id: match[2], priority: match[3] as ReadinessTask["priority"] }];
  });
}

function loadWaivers(path: string): ReadinessWaiver[] {
  const parsed = JSON.parse(readFileSync(path, "utf8")) as {
    schemaVersion?: string;
    waivers?: ReadinessWaiver[];
  };
  if (parsed.schemaVersion !== "civica-readiness-waivers/v1") {
    throw new Error("readiness-waivers schema version is invalid");
  }
  if (!Array.isArray(parsed.waivers)) throw new Error("readiness waivers must be an array");
  return parsed.waivers;
}

/** Loads the canonical plan state without executing a gate command. */
export function loadReadinessInputs(root = process.cwd()): ReadinessInputs {
  const planDir = join(root, "plan");
  const masterPath = join(planDir, "MASTER-CHECKLIST.md");
  const progressPath = join(planDir, "PROGRESS.md");
  const manualPath = join(planDir, "MANUAL-CHECKS.md");
  const waiverPath = join(root, "data", "readiness", "waivers.v1.json");
  const progress = readFileSync(progressPath, "utf8");
  const manual = readFileSync(manualPath, "utf8");
  const areas = readdirSync(planDir).filter((file) => AREA_FILE.test(file)).sort();
  const masterById = new Map(parseTasks(masterPath).map((task) => [task.id, task.line]));
  const masterMirrorErrors: string[] = [];
  const seen = new Set<string>();
  const tasks: ReadinessTask[] = [];
  const manualLines = manual.split("\n");

  for (const areaFile of areas) {
    for (const task of parseTasks(join(planDir, areaFile))) {
      if (seen.has(task.id)) {
        masterMirrorErrors.push(`duplicate task id ${task.id}`);
        continue;
      }
      seen.add(task.id);
      if (masterById.get(task.id) !== task.line) {
        masterMirrorErrors.push(`master mirror drift for ${task.id}`);
      }
      const evidencePath = `plan/evidence/${task.id}`;
      tasks.push({
        id: task.id,
        priority: task.priority,
        areaFile,
        completed: task.completed,
        evidencePath,
        evidencePresent: existsSync(join(root, evidencePath)),
        progressPresent: new RegExp(`^- ${task.id} completed\\b`, "m").test(progress),
        manualCheckLines: manualLines.flatMap((line, index) => line.includes(task.id) ? [index + 1] : []),
      });
    }
  }
  for (const id of masterById.keys()) {
    if (!seen.has(id)) masterMirrorErrors.push(`master has extra task ${id}`);
  }
  if (!existsSync(waiverPath)) throw new Error("readiness waivers file is missing");
  const sourceFiles = [masterPath, progressPath, manualPath, waiverPath, ...areas.map((file) => join(planDir, file))];
  return {
    root,
    tasks: tasks.sort((left, right) => left.id.localeCompare(right.id)),
    masterMirrorErrors,
    sourceHashes: Object.fromEntries(sourceFiles.map((path) => [relative(root, path), sha256(readFileSync(path, "utf8"))])),
    manualCheckPath: relative(root, manualPath),
    waivers: loadWaivers(waiverPath),
  };
}

function taskSummary(tasks: readonly ReadinessTask[]) {
  const byPriority: GateReadinessReport["taskSummary"]["byPriority"] = {
    P0: { total: 0, completed: 0 },
    P1: { total: 0, completed: 0 },
    P2: { total: 0, completed: 0 },
  };
  const byArea: GateReadinessReport["taskSummary"]["byArea"] = {};
  for (const task of tasks) {
    byPriority[task.priority].total += 1;
    if (task.completed) byPriority[task.priority].completed += 1;
    const area = (byArea[task.areaFile] ??= { total: 0, completed: 0 });
    area.total += 1;
    if (task.completed) area.completed += 1;
  }
  const completed = tasks.filter((task) => task.completed).length;
  return { total: tasks.length, completed, remaining: tasks.length - completed, byPriority, byArea };
}

function commandReport(command: GateCommand, result?: CommandResult): GateCommandReport {
  return {
    id: command.id,
    command: [command.program, ...command.args].join(" "),
    status: result?.status ?? "not_run",
    exitCode: result?.exitCode ?? null,
    durationMs: result?.durationMs ?? null,
  };
}

/** Builds one honest status report. `commandResults` is supplied only by the fixed-command runner. */
export function buildGateReadinessReport(
  inputs: ReadinessInputs,
  gate: ReadinessGate,
  commandResults: Readonly<Record<string, CommandResult | undefined>> = {},
): GateReadinessReport {
  const completed = inputs.tasks.filter((task) => task.completed);
  const evidenceGaps = completed
    .flatMap((task) => [
      ...(task.evidencePresent ? [] : [`${task.id}: evidence directory missing`]),
      ...(task.progressPresent ? [] : [`${task.id}: completion record missing`]),
    ])
    .sort();
  const openP0P1 = inputs.tasks
    .filter((task) => !task.completed && (task.priority === "P0" || task.priority === "P1"))
    .map((task) => task.id)
    .sort();
  const openP0 = inputs.tasks
    .filter((task) => !task.completed && task.priority === "P0")
    .map((task) => task.id)
    .sort();
  const commands = GATE_COMMANDS[gate].map((command) => commandReport(command, commandResults[command.id]));
  const blockers = [
    ...inputs.masterMirrorErrors,
    ...evidenceGaps,
    ...(openP0.length > 0
      ? [`${openP0.length} unchecked P0 tasks prevent a green report`]
      : []),
    ...(gate === "G4" && openP0P1.length > 0
      ? [`${openP0P1.length} unchecked P0/P1 tasks prevent G4`]
      : []),
    ...(gate === "G5" ? ["G5 requires an independently recorded external-review resolution"] : []),
    ...(gate === "G6" ? ["G6 requires a G5 resolution and a citable public release"] : []),
  ];
  const hasFailedCommand = commands.some((command) => command.status === "failed");
  const hasUnrunCommand = commands.some((command) => command.status === "not_run");
  const status: GateStatus = hasFailedCommand
    ? "failed"
    : blockers.length > 0
      ? "blocked"
      : hasUnrunCommand
        ? "pending"
        : "pass";
  const manual = readFileSync(join(inputs.root, inputs.manualCheckPath), "utf8");
  return {
    gate,
    status,
    checkedAt: null,
    taskSummary: taskSummary(inputs.tasks),
    openP0,
    openP0P1,
    evidenceGaps,
    masterMirrorErrors: [...inputs.masterMirrorErrors],
    manualChecks: {
      path: inputs.manualCheckPath,
      sha256: sha256(manual),
      linkedTaskIds: inputs.tasks.filter((task) => task.manualCheckLines.length > 0).map((task) => task.id),
    },
    waivers: inputs.waivers.filter((waiver) => waiver.gate === gate),
    commands,
    blockers,
  };
}

export function buildGateReadinessReports(
  inputs: ReadinessInputs,
  commandResults: Partial<Record<ReadinessGate, Readonly<Record<string, CommandResult | undefined>>>> = {},
): GateReadinessReports {
  return {
    schemaVersion: READINESS_REPORT_SCHEMA_VERSION,
    sourceHashes: inputs.sourceHashes,
    reports: READINESS_GATES.map((gate) => buildGateReadinessReport(inputs, gate, commandResults[gate])),
  };
}

export function renderGateReadinessReports(reports: GateReadinessReports) {
  return `${JSON.stringify(reports, null, 2)}\n`;
}

/** Returns contract failures; blocked gates are expected state, never validation failures. */
export function readinessReportErrors(reports: GateReadinessReports): string[] {
  const errors: string[] = [];
  if (reports.schemaVersion !== READINESS_REPORT_SCHEMA_VERSION) errors.push("schema version drifted");
  if (reports.reports.length !== READINESS_GATES.length) errors.push("missing gate report");
  for (const gate of READINESS_GATES) {
    const report = reports.reports.find((candidate) => candidate.gate === gate);
    if (!report) continue;
    const ids = report.commands.map((command) => command.id);
    if (new Set(ids).size !== ids.length) errors.push(`${gate}: duplicate command id`);
    if (report.status === "pass") {
      if (report.commands.some((command) => command.status !== "passed")) errors.push(`${gate}: passing report has an unpassed command`);
      if (report.blockers.length > 0) errors.push(`${gate}: passing report has blockers`);
      if (report.openP0.length > 0) errors.push(`${gate}: passing report has unchecked P0 tasks`);
    }
    if (gate === "G4" && report.status === "pass" && report.openP0P1.length > 0) {
      errors.push("G4 cannot pass with unchecked P0/P1 tasks");
    }
    for (const waiver of report.waivers) {
      if (waiver.gate !== gate || waiver.status !== "approved" || !waiver.reason || !waiver.evidencePath) {
        errors.push(`${gate}: invalid waiver ${waiver.id}`);
      }
    }
  }
  return errors;
}
