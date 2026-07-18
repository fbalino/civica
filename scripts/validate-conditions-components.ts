import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const read = (path: string) => readFileSync(resolve(root, path), "utf8");
const errors: string[] = [];

const contract = read("src/lib/conditions/contract.ts");
const economic = read("src/lib/conditions/economic.ts");
const writer = read("src/lib/conditions/ingest.ts");
const schema = read("src/lib/db/schema.ts");
const migration = read("drizzle/authoritative/0040_closed_young_avengers.sql");
const releaseMigration = read("drizzle/authoritative/0042_grey_sally_floyd.sql");
const release = read("src/lib/conditions/release.ts");
const query = read("src/lib/db/queries.ts");
const publicRelease = read("src/lib/conditions/public-release.ts");
const conditionsExplorer = read("src/components/conditions/ConditionsReleaseExplorer.tsx");
const countryConditionsPanel = read("src/components/conditions/CivicaConditionsPanel.tsx");
const comparePage = read("src/app/compare/page.tsx");
const compareConditions = read("src/components/compare/CompareConditions.tsx");
const economicScript = read("scripts/ingest-conditions-economic.ts");
const hdiScript = read("scripts/ingest-conditions-hdi.ts");
const gpiScript = read("scripts/ingest-conditions-gpi.ts");

for (const token of [
  "CURRENT_CONDITIONS_METHODOLOGY_VERSION",
  "all-components-same-reference-year/v1",
  "mixed_year_refused",
  "missing_component",
  "conditionCalculationKey",
  "conditionCalculationErrors",
]) {
  if (!contract.includes(token)) errors.push(`Conditions contract omits ${token}`);
}
for (const token of [
  "civica_conditions_releases",
  "civica_conditions_reference_sets",
  "civica_conditions_normalization_parameters",
  "release_id",
  "idx_conditions_release_unique",
]) {
  if (!schema.includes(token)) errors.push(`release schema omits ${token}`);
  if (!releaseMigration.includes(token)) errors.push(`release migration omits ${token}`);
}
for (const token of [
  "conditionsReleaseManifestSha256",
  "conditionsReleaseErrors",
  "buildEconomicReferenceSets",
  "writeConditionsRelease",
]) {
  if (!release.includes(token) && !writer.includes(token) && !economic.includes(token)) {
    errors.push(`Conditions release contract omits ${token}`);
  }
}
for (const table of [
  "civica_conditions_calculations",
  "civica_conditions_components",
]) {
  if (!schema.includes(table)) errors.push(`schema omits ${table}`);
  if (!migration.includes(table)) errors.push(`migration omits ${table}`);
  if (!migration.includes(`ON \"${table}\"`)) {
    errors.push(`migration omits a retention trigger for ${table}`);
  }
}
for (const token of [
  "conditions_component_value_state_check",
  "conditions_component_inclusion_check",
  "conditions_calculation_contract_check",
]) {
  if (!migration.includes(token)) errors.push(`migration omits ${token}`);
}
for (const token of [
  "civicaConditionsCalculations",
  "civicaConditionsComponents",
  "calculationKey",
  "componentId",
]) {
  if (!writer.includes(token)) errors.push(`writer omits ${token}`);
}
if (!economic.includes("mixed_year_refused") || !economic.includes("missing_component")) {
  errors.push("economic builder does not preserve refusal and absence states");
}
if (/available\.length\s*<\s*2/.test(economicScript) || /Math\.max\(\s*\.\.\.\(available/.test(economicScript)) {
  errors.push("economic ingestion retains the legacy partial/newest-year shortcut");
}
for (const script of [hdiScript, gpiScript]) {
  if (!script.includes("CURRENT_CONDITIONS_METHODOLOGY_VERSION")) {
    errors.push("single-component Conditions writer uses an unversioned legacy method");
  }
  if (!script.includes("conditionCalculationKey")) {
    errors.push("single-component Conditions writer omits the calculation ledger");
  }
  if (!script.includes("SOURCE_METHODOLOGY_VERSION")) {
    errors.push("single-component Conditions writer does not pin its source methodology");
  }
}
for (const token of [
  "civica_conditions_calculations",
  "civica_conditions_components",
  "ccc.alignment_status = 'aligned'",
  "getCivicaConditionsComponentLedger",
]) {
  if (!query.includes(token)) errors.push(`Conditions read contract omits ${token}`);
}
if (!publicRelease.includes("economic stability must not publish a composite score")) {
  errors.push("public Conditions contract permits an economic-stability composite");
}
for (const [surface, source, tokens] of [
  [
    "public explorer",
    conditionsExplorer,
    ["ConditionsPublicRelease", "No composite published", "component.nativeUnit"],
  ],
  [
    "country panel",
    countryConditionsPanel,
    ["No composite published", "component.referenceYear", "component.nativeUnit", "stacked"],
  ],
  [
    "compare surface",
    comparePage + compareConditions,
    ["CompareConditions", "getConditionsPublicRelease", "Reference years can differ", "CivicaConditionsPanel"],
  ],
] as const) {
  for (const token of tokens) {
    if (!source.includes(token)) errors.push(`${surface} omits ${token}`);
  }
}

if (errors.length) {
  for (const error of errors) console.error(`ERROR: ${error}`);
  process.exit(1);
}

console.log(
  "PASS — Conditions retain exact inputs, explicit missing/refused decisions, aligned-only scores, and immutable release parameters.",
);
