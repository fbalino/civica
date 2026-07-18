import { spawnSync } from "node:child_process";

import { STATISTICAL_ANALYSIS_REPRODUCIBILITY } from "../src/lib/qa/statistical-reproducibility";

if (!process.env.CIVICA_RESEARCH_INPUT_DIR) {
  throw new Error("CIVICA_RESEARCH_INPUT_DIR is required for offline statistical replay");
}

const commands = [
  "validate:statistical-reproducibility",
  ...new Set(STATISTICAL_ANALYSIS_REPRODUCIBILITY.map((record) => record.replayCommand)),
];
const environment = { ...process.env };
delete environment.DATABASE_URL;

for (const command of commands) {
  const result = spawnSync("npm", ["run", command], {
    cwd: process.cwd(),
    env: environment,
    stdio: "inherit",
  });
  if (result.status !== 0) {
    throw new Error(`Offline statistical replay failed at ${command}`);
  }
}

console.log(
  `PASS — ${STATISTICAL_ANALYSIS_REPRODUCIBILITY.length} registered statistical analyses replayed with DATABASE_URL removed.`,
);
