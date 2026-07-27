/**
 * Produces a deterministic ATL-028 construct-study artifact from a frozen
 * Conditions release extract. This command never contacts the database or an
 * upstream source: callers must record input hashes before invoking it.
 *
 * Usage:
 *   tsx scripts/analyze-economic-stability-construct.ts --input=<frozen.json> --output=<result.json>
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import {
  analyzeEconomicStabilityConstruct,
  type EconomicStabilityConstructStudyInput,
} from "../src/lib/conditions/economic-construct";

function argument(name: string): string | undefined {
  return process.argv.find((value) => value.startsWith(`${name}=`))?.slice(name.length + 1);
}

const inputPath = argument("--input");
const outputPath = argument("--output");

if (!inputPath) {
  throw new Error("Pass --input=<frozen-study-input.json>; the command refuses implicit database reads");
}

const input = JSON.parse(readFileSync(resolve(inputPath), "utf8")) as EconomicStabilityConstructStudyInput;
const result = analyzeEconomicStabilityConstruct(input);
const serialized = `${JSON.stringify(result, null, 2)}\n`;

if (outputPath) {
  const destination = resolve(outputPath);
  mkdirSync(dirname(destination), { recursive: true });
  writeFileSync(destination, serialized);
  console.log(`Wrote ${destination} (${result.resultSha256})`);
} else {
  process.stdout.write(serialized);
}
