import { spawnSync } from "node:child_process";

import {
  QA_011_OPERATOR_JOURNEYS,
  qa011OperatorJourneyErrors,
} from "../src/lib/qa/operator-journeys";

const errors = qa011OperatorJourneyErrors();
if (errors.length) throw new Error(errors.join("\n"));

const environment = { ...process.env };
for (const key of [
  "DATABASE_URL",
  "RUN_DB_TESTS",
  "ANTHROPIC_API_KEY_CHAT",
  "ANTHROPIC_API_KEY_PULSE_CLASSIFIER",
  "DEEPSEEK_API_KEY",
  "GLM_API_KEY",
]) {
  delete environment[key];
}

const tests = QA_011_OPERATOR_JOURNEYS.flatMap((journey) => journey.tests);
const result = spawnSync(process.execPath, ["--import", "tsx", "--test", ...tests], {
  cwd: process.cwd(),
  env: environment,
  stdio: "inherit",
});
if (result.status !== 0) throw new Error("QA-011 isolated operator journey suite failed");

console.log(
  `PASS — ${QA_011_OPERATOR_JOURNEYS.length} isolated QA-011 operator journeys passed with database and paid-model credentials removed.`,
);
