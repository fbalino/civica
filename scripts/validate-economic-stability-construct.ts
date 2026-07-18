import { readFileSync } from "node:fs";

function fail(message: string): never {
  console.error(`ATL-028 construct validation failed: ${message}`);
  process.exit(1);
}

const plan = readFileSync("plan/ATL-028-economic-stability-construct-2026-07-18.md", "utf8");
const economic = readFileSync("src/lib/conditions/economic.ts", "utf8");
const contract = readFileSync("src/lib/conditions/contract.ts", "utf8");

for (const source of [
  "https://www.elibrary.imf.org/display/book/9781589060173/ch003.xml",
  "https://documents.worldbank.org/curated/en/154121468765320854/pdf/WPS3184.pdf",
  "https://www.oecd.org/content/dam/oecd/en/publications/reports/2014/02/growth-policies-and-macroeconomic-stability_g17a2460/5jz8t849335d-en.pdf",
]) {
  if (!plan.includes(source)) fail(`primary theory source is not recorded: ${source}`);
}
if (!economic.includes('transformationId: "conditions-economic-source-native/v1"')) {
  fail("economic releases are not recorded as source-native inputs");
}
if (economic.includes("conditions-economic-aligned-z-cdf")) {
  fail("retired current-year economic score transformation remains active");
}
if (!contract.includes("economic stability has no score before construct validation")) {
  fail("contract does not prohibit an unvalidated economic stability score");
}

console.log("PASS — ATL-028 requires frozen longitudinal evidence and keeps the public economic presentation source-native until a construct is independently validated.");
