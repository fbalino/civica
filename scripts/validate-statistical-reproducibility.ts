import { readFileSync } from "node:fs";

import {
  STATISTICAL_ANALYSIS_REPRODUCIBILITY,
  statisticalReproducibilityErrors,
} from "../src/lib/qa/statistical-reproducibility";

const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as {
  scripts: Record<string, string | undefined>;
};
const errors = statisticalReproducibilityErrors({
  readBytes: (path) => readFileSync(path),
  readText: (path) => readFileSync(path, "utf8"),
  packageScripts: packageJson.scripts,
});

if (errors.length > 0) {
  console.error(errors.map((error) => `FAIL — ${error}`).join("\n"));
  process.exit(1);
}

const randomized = STATISTICAL_ANALYSIS_REPRODUCIBILITY.filter((record) => record.seeds.length > 0);
console.log(`PASS — ${STATISTICAL_ANALYSIS_REPRODUCIBILITY.length} statistical artifacts bind exact result/input/method/table bytes, ${randomized.length} randomized analyses record seeds, and every replay command is registered.`);
