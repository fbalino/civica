#!/usr/bin/env node

import { readFileSync, readdirSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const toolDir = dirname(fileURLToPath(import.meta.url));
const planDir = resolve(toolDir, "..");
const masterPath = join(planDir, "MASTER-CHECKLIST.md");
const initialize = process.argv.includes("--initialize");
const taskPattern = /^- \[([ x])\] \*\*([A-Z]+-\d{3})\*\* \((P[012])\) (.+) _Done when: (.+)_$/;

const areaFiles = readdirSync(planDir)
  .filter((name) => /^(0[2-9]|1[01])-.*\.md$/.test(name))
  .sort();

if (areaFiles.length === 0) {
  throw new Error("No master-plan area files found.");
}

const areas = [];
const byId = new Map();
const errors = [];

for (const file of areaFiles) {
  const body = readFileSync(join(planDir, file), "utf8");
  const heading = body.split("\n").find((line) => line.startsWith("# Area "));
  if (!heading) errors.push(`${file}: missing '# Area …' heading`);
  const tasks = [];
  for (const [index, line] of body.split("\n").entries()) {
    if (!line.startsWith("- [")) continue;
    const match = line.match(taskPattern);
    if (!match) {
      errors.push(`${file}:${index + 1}: malformed task line`);
      continue;
    }
    const [, checked, id, priority, description, doneWhen] = match;
    if (byId.has(id)) {
      errors.push(`${file}:${index + 1}: duplicate ${id}; first seen in ${byId.get(id).file}`);
      continue;
    }
    const task = {
      file,
      line,
      checked: checked === "x",
      id,
      priority,
      description,
      doneWhen,
    };
    byId.set(id, task);
    tasks.push(task);
  }
  if (tasks.length === 0) errors.push(`${file}: contains no task lines`);
  areas.push({ file, heading: heading ?? `# ${file}`, tasks });
}

function summary() {
  const tasks = [...byId.values()];
  const completed = tasks.filter((task) => task.checked).length;
  return {
    total: tasks.length,
    completed,
    remaining: tasks.length - completed,
    progress: tasks.length === 0 ? 0 : Number(((completed / tasks.length) * 100).toFixed(1)),
    priorities: Object.fromEntries(
      ["P0", "P1", "P2"].map((priority) => [
        priority,
        tasks.filter((task) => task.priority === priority).length,
      ]),
    ),
  };
}

function renderMaster() {
  const totals = summary();
  const lines = [
    "# Civica Academic Publication Readiness — MASTER CHECKLIST",
    "",
    "**Single source of execution truth.** Task text is mirrored from the numbered area files and must be checked in both places. Run `node plan/tools/validate-master-plan.mjs` after every task/checklist edit.",
    "",
    `- **Total tasks:** ${totals.total}`,
    `- **Completed:** ${totals.completed}`,
    `- **Remaining:** ${totals.remaining}`,
    `- **Progress:** ${totals.progress}%`,
    `- **Priority mix:** P0 ${totals.priorities.P0} · P1 ${totals.priorities.P1} · P2 ${totals.priorities.P2}`,
    "",
    "Work in dependency/gate order defined in `00-mission-and-operating-rules.md`, not simply top to bottom. A checked box without evidence under `plan/evidence/<ID>/` and a matching `PROGRESS.md` line is invalid.",
    "",
  ];
  for (const area of areas) {
    lines.push(area.heading.replace(/^# /, "## "), "", `Source: \`plan/${area.file}\``, "");
    lines.push(...area.tasks.map((task) => task.line), "");
  }
  return `${lines.join("\n").trim()}\n`;
}

if (initialize) {
  if (existsSync(masterPath)) {
    throw new Error("MASTER-CHECKLIST.md already exists; --initialize refuses to overwrite it.");
  }
  if (errors.length) {
    throw new Error(`Cannot initialize master checklist:\n${errors.join("\n")}`);
  }
  writeFileSync(masterPath, renderMaster(), "utf8");
}

if (!existsSync(masterPath)) {
  errors.push("MASTER-CHECKLIST.md is missing; run with --initialize after all area files exist");
} else {
  const master = readFileSync(masterPath, "utf8");
  const masterById = new Map();
  for (const [index, line] of master.split("\n").entries()) {
    if (!line.startsWith("- [")) continue;
    const match = line.match(taskPattern);
    if (!match) {
      errors.push(`MASTER-CHECKLIST.md:${index + 1}: malformed task line`);
      continue;
    }
    const id = match[2];
    if (masterById.has(id)) errors.push(`MASTER-CHECKLIST.md:${index + 1}: duplicate ${id}`);
    masterById.set(id, line);
  }
  for (const [id, task] of byId) {
    if (!masterById.has(id)) errors.push(`MASTER-CHECKLIST.md: missing ${id}`);
    else if (masterById.get(id) !== task.line) errors.push(`MASTER-CHECKLIST.md: ${id} does not exactly match ${task.file}`);
  }
  for (const id of masterById.keys()) {
    if (!byId.has(id)) errors.push(`MASTER-CHECKLIST.md: extra task ${id}`);
  }

  const totals = summary();
  const expectedSummary = [
    `- **Total tasks:** ${totals.total}`,
    `- **Completed:** ${totals.completed}`,
    `- **Remaining:** ${totals.remaining}`,
    `- **Progress:** ${totals.progress}%`,
    `- **Priority mix:** P0 ${totals.priorities.P0} · P1 ${totals.priorities.P1} · P2 ${totals.priorities.P2}`,
  ];
  for (const line of expectedSummary) {
    if (!master.includes(line)) errors.push(`MASTER-CHECKLIST.md: stale or missing summary line '${line}'`);
  }
}

const result = { ok: errors.length === 0, areas: areaFiles, ...summary(), errors };
console.log(JSON.stringify(result, null, 2));
if (errors.length) process.exitCode = 1;
