import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { countryDayEvaluationSetErrors, countryDaySampleErrors, countryDayTraceSetErrors } from "../src/lib/pulse/v2/country-day-evaluation";

const sample = JSON.parse(readFileSync(resolve("data/research/pulse-country-day-sample-v1.json"), "utf8"));
const population = JSON.parse(readFileSync(resolve("data/research/pulse-evaluation-frame-population-v1.json"), "utf8"));
const traces = JSON.parse(readFileSync(resolve("data/research/pulse-country-day-search-traces-v1.json"), "utf8"));
const set = JSON.parse(readFileSync(resolve("data/research/pulse-country-day-evaluation-set-v1.json"), "utf8"));
interface SearchTrace { totalResultCount: number }
interface SampleRow { evidenceRefs: string[] }
const errors = [
  ...countryDaySampleErrors(sample, population),
  ...countryDayTraceSetErrors(traces, sample),
  ...countryDayEvaluationSetErrors(set, sample, traces),
];
if (errors.length > 0) throw new Error(`Pulse country-day evaluation validation failed:\n- ${errors.join("\n- ")}`);
const zeroResults = (traces.traces as SearchTrace[]).filter((trace) => trace.totalResultCount === 0).length;
const retainedEvidence = (sample.rows as SampleRow[]).filter((row) => row.evidenceRefs.length > 0).length;
console.log(`PASS — pulse-country-day-evaluation-set/v1: 536 unlabeled packets, ${retainedEvidence} with retained evidence, ${zeroResults} zero-result searches preserved as non-label evidence.`);
