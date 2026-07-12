import { readFileSync } from "node:fs";
import {
  PULSE_CODER_RECRUITMENT_SOURCES,
  PULSE_CODER_WORKLOAD_SCENARIOS,
  calculatePulseCoderWorkload,
  pulseCoderRecruitmentErrors,
} from "../src/lib/pulse/v2/coder-recruitment";

const errors = pulseCoderRecruitmentErrors();
const packageText = readFileSync(
  "plan/research/pulse-independent-coder-recruitment-package-v1.md",
  "utf8",
);
const manualChecks = readFileSync("plan/MANUAL-CHECKS.md", "utf8");

for (const heading of [
  "## Roles and separation",
  "## Independence and conflicts",
  "## Frozen workload",
  "## Compensation options",
  "## Training and qualification",
  "## Sourcing pools",
  "## Draft public call",
  "## Owner approval and lead time",
]) {
  if (!packageText.includes(heading)) errors.push(`package lacks ${heading}`);
}

for (const source of PULSE_CODER_RECRUITMENT_SOURCES) {
  if (!packageText.includes(source.url))
    errors.push(`package omits source ${source.id}`);
}

for (const workload of PULSE_CODER_WORKLOAD_SCENARIOS.map(
  calculatePulseCoderWorkload,
)) {
  if (!packageText.includes(`$${workload.totalBudgetUsd.toLocaleString("en-US")}`))
    errors.push(`package omits ${workload.id} budget`);
}

for (const boundary of [
  "no contact made",
  "The owner, model output, and the 12-agent dry pilot cannot define the key.",
  "External contact remains blocked until the master plan's G4 gate",
  "The retained event census and system-negative draw still need rights-safe, unlabeled packet releases under PUL-041",
]) {
  if (!packageText.includes(boundary))
    errors.push(`package weakens contact or gold boundary: ${boundary}`);
}

if (!manualChecks.includes("PUL-039") || !manualChecks.includes("six to eight weeks"))
  errors.push("manual owner approval check lacks PUL-039 lead time");

if (/mailto:|@[a-z0-9.-]+\.[a-z]{2,}/i.test(packageText))
  errors.push("recruitment package contains a direct individual contact");

if (errors.length) {
  for (const error of errors) console.error(`ERROR: ${error}`);
  process.exit(1);
}

console.log(
  "PASS — pulse-independent-coder-recruitment/v1: 1,456 initial units, 2,912 blind assignments, separate coder/adjudicator roles, executable low/base/high budgets, six sourcing pools, draft outreach, and zero contact.",
);
