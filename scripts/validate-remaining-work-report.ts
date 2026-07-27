import { readFileSync } from "node:fs";

const masterPath = "plan/MASTER-CHECKLIST.md";
const dataPath = "data/readiness/remaining-work.v1.json";
const reportPath = "plan/REMAINING-WORK-REPORT-2026-07-23.md";

const master = readFileSync(masterPath, "utf8");
const data = JSON.parse(readFileSync(dataPath, "utf8")) as {
  schemaVersion: string;
  checklist: {
    total: number;
    completed: number;
    remaining: number;
    progressPercent: number;
  };
  agentExecutableNow: string[];
  categories: Array<{
    id: string;
    label: string;
    count: number;
    taskIds: string[];
    nextStep: string;
  }>;
};
const report = readFileSync(reportPath, "utf8");
const normalizedReport = report.replace(/\s+/g, " ");
const errors: string[] = [];

const allRows = [...master.matchAll(/^- \[(x| )\] \*\*([A-Z]+-\d+)\*\* \((P[0-2])\)/gm)];
const openIds = allRows.filter((match) => match[1] === " ").map((match) => match[2]).sort();
const openP0 = allRows.filter((match) => match[1] === " " && match[3] === "P0").length;
const openP0P1 = allRows.filter(
  (match) => match[1] === " " && (match[3] === "P0" || match[3] === "P1"),
).length;
const completed = allRows.length - openIds.length;
const progress = Number(((completed / allRows.length) * 100).toFixed(1));

if (data.schemaVersion !== "civica-remaining-work/v1") {
  errors.push(`unexpected schema version ${data.schemaVersion}`);
}
if (
  data.checklist.total !== allRows.length ||
  data.checklist.completed !== completed ||
  data.checklist.remaining !== openIds.length ||
  data.checklist.progressPercent !== progress
) {
  errors.push(
    `checklist summary is stale: observed ${completed}/${allRows.length}, ${openIds.length} remaining, ${progress}%`,
  );
}

const classified = data.categories.flatMap((category) => {
  if (category.count !== category.taskIds.length) {
    errors.push(`${category.id}: count ${category.count} does not match ${category.taskIds.length} ids`);
  }
  if (category.label.trim().length < 10 || category.nextStep.trim().length < 30) {
    errors.push(`${category.id}: reader label or next step is incomplete`);
  }
  if (!report.includes(`### ${data.categories.indexOf(category) + 1}. ${category.label} — ${category.count}`)) {
    errors.push(`${category.id}: report heading/count is stale`);
  }
  return category.taskIds;
});

const duplicates = classified.filter((id, index) => classified.indexOf(id) !== index);
if (duplicates.length > 0) {
  errors.push(`duplicate classifications: ${[...new Set(duplicates)].sort().join(", ")}`);
}
const missing = openIds.filter((id) => !classified.includes(id));
const stale = classified.filter((id) => !openIds.includes(id));
if (missing.length > 0) errors.push(`unclassified open tasks: ${missing.join(", ")}`);
if (stale.length > 0) errors.push(`classified ids are no longer open: ${stale.join(", ")}`);
if (data.agentExecutableNow.length !== 0) {
  errors.push(`agent-executable-now queue is not empty: ${data.agentExecutableNow.join(", ")}`);
}

for (const text of [
  "No: the remaining work is not only human review.",
  `${completed} of ${allRows.length} complete`,
  `${openIds.length} remain`,
  "There is no checklist item that an agent can finish now",
  `G4 remains blocked with ${openP0} unchecked P0 tasks and ${openP0P1} unchecked P0/P1 tasks.`,
]) {
  if (!normalizedReport.includes(text)) errors.push(`report omits current conclusion: ${text}`);
}

if (errors.length > 0) {
  for (const error of errors) console.error(`ERROR: ${error}`);
  process.exit(1);
}

console.log(
  `Remaining-work report valid: ${openIds.length} open tasks classified exactly once; agent-executable-now queue empty.`,
);
