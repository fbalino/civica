import { existsSync, readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");
const errors: string[] = [];

const requiredFiles = [
  "src/lib/i18n/presentation.ts",
  "src/lib/i18n/name-forms.ts",
  "src/lib/i18n/name-form-store.ts",
  "src/components/editorial/SourceText.tsx",
  "scripts/verify-internationalization-browser.ts",
  "drizzle/authoritative/0048_entity_name_forms.sql",
  "plan/EXP-029-internationalization-readiness-2026-07-18.md",
];
for (const path of requiredFiles) {
  if (!existsSync(path)) errors.push(`missing required file: ${path}`);
}

const layout = read("src/app/layout.tsx");
if (!layout.includes('lang="en"'))
  errors.push("root document does not declare lang=en");

const about = read("content/about.md");
for (const fragment of [
  "## Language scope {#language}",
  "English interface and English editorial copy",
  "does not currently offer a translated interface",
  "not a Civica translation unless a visible label explicitly says so",
  "Missing name-form metadata remains missing rather than being inferred",
]) {
  if (!about.includes(fragment))
    errors.push(`about language disclosure is missing: ${fragment}`);
}

const presentation = read("src/lib/i18n/presentation.ts");
for (const fragment of [
  'PUBLIC_PRESENTATION_LOCALE = "en-US"',
  "new Intl.Collator(PUBLIC_PRESENTATION_LOCALE",
  "new Intl.NumberFormat(PUBLIC_PRESENTATION_LOCALE",
  "new Intl.DateTimeFormat(PUBLIC_PRESENTATION_LOCALE",
  'timeZone: "UTC"',
]) {
  if (!presentation.includes(fragment))
    errors.push(`presentation contract is missing: ${fragment}`);
}

const sourceText = read("src/components/editorial/SourceText.tsx");
for (const fragment of ['<bdi dir="auto"', "lang={languageTag}", "<Chip"]) {
  if (!sourceText.includes(fragment))
    errors.push(`SourceText direction/language disclosure is missing: ${fragment}`);
}

const schema = read("src/lib/db/schema.ts");
const migration = read("drizzle/authoritative/0048_entity_name_forms.sql");
const store = read("src/lib/i18n/name-form-store.ts");
for (const fragment of [
  "civica-entity-name-form/v1",
  "jurisdiction",
  "person",
  "office",
  "political_party",
  "language_tag",
  "script_code",
  "translation_status",
  "transliteration_status",
  "source_url",
  "upstream_vintage",
]) {
  if (!schema.includes(fragment))
    errors.push(`Drizzle name-form contract is missing: ${fragment}`);
  if (!migration.includes(fragment))
    errors.push(`0048 name-form migration is missing: ${fragment}`);
}
for (const fragment of [
  "normalizeEntityNameForms",
  "writeEntityNameForms",
  "getCurrentEntityNameForms",
  "markSourcesSynced",
  "sameEntityNameForm",
]) {
  if (!store.includes(fragment))
    errors.push(`name-form store is missing: ${fragment}`);
}
for (const fragment of [
  "entity_name_forms_research_evidence_history",
  "civica_capture_research_evidence_history",
]) {
  if (!migration.includes(fragment))
    errors.push(`0048 retention protection is missing: ${fragment}`);
}

const adoptedCollationPaths = [
  "src/components/country/CountryDirectory.tsx",
  "src/components/editorial/SortableDataTable.tsx",
  "src/components/leaders/WorldLeadersDirectoryClient.tsx",
  "src/components/atlas/AtlasStandaloneClient.tsx",
  "src/components/factbook/PartyBrowser.tsx",
  "src/lib/governance-change/explorer.ts",
];
for (const path of adoptedCollationPaths) {
  const source = read(path);
  if (!source.includes("comparePublicLabels"))
    errors.push(`${path} does not use the public collation contract`);
}

const designSystem = read("src/app/design-system/page.tsx");
for (const fragment of [
  'languageTag="ar"',
  'languageTag="he"',
  'languageTag="ja"',
  'languageTag="es-UY"',
  "not translated",
]) {
  if (!designSystem.includes(fragment))
    errors.push(`design-system stress fixture is missing: ${fragment}`);
}

const constitution = read(
  "src/components/constitution/ConstitutionPassageCard.tsx",
);
if (
  !constitution.includes(
    "English text supplied by Constitute; original language and translation",
  )
) {
  errors.push("constitution passage lacks visible language/translation status");
}

if (errors.length) {
  throw new Error(
    `EXP-029 internationalization readiness validation failed:\n- ${errors.join("\n- ")}`,
  );
}

console.log(
  "PASS — English scope, deterministic presentation, source-form schema, direction isolation, multilingual stress fixtures, and translation-status boundaries are closed.",
);
