import { createHash } from "node:crypto";

import { parseQueryContract } from "@/lib/api/request-contract";
import {
  ATLAS_QUERY_RELEASE_ID,
  ATLAS_QUERY_RIGHTS_MANIFEST,
  atlasQueryInputFromRequest,
  runAtlasQuery,
  type AtlasQueryResult,
  type LoadedAtlasQueryRelease,
} from "@/lib/exports/atlas-query";

export const ATLAS_CASE_STUDIES_SCHEMA_VERSION =
  "civica-atlas-case-studies/v1" as const;
export const ATLAS_CASE_STUDIES_PATH =
  "data/releases/atlas-2026-07-11/case-studies.v1.json" as const;
export const ATLAS_CASE_STUDIES_PUBLIC_URL =
  "https://civicaatlas.org/methodology/case-studies" as const;

type CellValue = string | number | boolean | null;

export interface AtlasCaseStudyRecipeDefinition {
  id: string;
  label: string;
  path: string;
}

export interface AtlasCaseStudyDefinition {
  id: string;
  title: string;
  researchQuestion: string;
  methods: string;
  decisionTrail: readonly string[];
  limitations: readonly string[];
  recipes: readonly AtlasCaseStudyRecipeDefinition[];
}

export interface AtlasCaseStudyRecipeResult
  extends AtlasCaseStudyRecipeDefinition {
  releaseId: string;
  releaseSemanticSha256: string;
  exportSchemaVersion: string;
  inputRowCount: number;
  pagesRead: number;
  fields: string[];
  inputRows: Record<string, unknown>[];
}

export interface AtlasCaseStudyTable {
  caption: string;
  columns: Array<{ key: string; label: string }>;
  rows: Array<Record<string, CellValue>>;
}

export interface AtlasCaseStudyResult {
  id: string;
  title: string;
  researchQuestion: string;
  answer: string;
  methods: string;
  decisionTrail: string[];
  recipes: AtlasCaseStudyRecipeResult[];
  table: AtlasCaseStudyTable;
  sourceRights: Record<string, unknown>[];
  rightsNote: string;
  limitations: string[];
  citation: string;
  stableUrl: string;
}

export interface AtlasCaseStudyReport {
  schemaVersion: typeof ATLAS_CASE_STUDIES_SCHEMA_VERSION;
  semanticSha256: string;
  generatedAt: string;
  release: {
    id: string;
    date: string;
    exportSchemaVersion: string;
    semanticSha256: string;
    sourceArtifact: string;
    rightsManifest: typeof ATLAS_QUERY_RIGHTS_MANIFEST;
  };
  reproduction: {
    generator: "scripts/generate-atlas-case-studies.ts";
    validator: "scripts/validate-atlas-case-studies.ts";
    command: "npm run reproduce:atlas-case-studies";
    tolerance: "byte_exact";
    endpoint: "/api/v1/atlas/query";
  };
  cases: AtlasCaseStudyResult[];
}

export const ATLAS_CASE_STUDIES: readonly AtlasCaseStudyDefinition[] = [
  {
    id: "jurisdiction-status-denominator",
    title: "Where the sovereign-state denominator begins",
    researchQuestion:
      "How does the frozen Atlas separate sovereign states from territories, associated states, disputed entities, and aggregate areas?",
    methods:
      "Select every frozen jurisdiction with its closed jurisdiction-status/v1 type, review fields, and source identifiers; aggregate only after preserving the row-level classifications.",
    decisionTrail: [
      "Use the release row's type field rather than inferring sovereignty from ISO codes, names, map presence, or a country count.",
      "Count sovereign_state separately; every other closed type remains visible rather than being silently discarded.",
      "Report reviewed and disputed flags alongside category totals so the denominator cannot imply stronger certainty than the source rows support.",
    ],
    limitations: [
      "This is Civica's release-bound jurisdiction-status contract, not a new legal determination of statehood.",
      "The case reproduces the checked classification rows and their cited source identifiers; it does not redistribute the underlying UN materials.",
      "Later status reviews require a new Atlas release and must not rewrite this frozen result.",
    ],
    recipes: [
      {
        id: "all-jurisdictions",
        label: "All frozen jurisdiction-status rows",
        path:
          "/api/v1/atlas/query?table=jurisdictions&fields=id,slug,name,iso3,type,status_source_ids,status_reviewed_at,status_note,status_disputed&limit=1000",
      },
    ],
  },
  {
    id: "france-population-selection",
    title: "Reading one reconciled population observation",
    researchQuestion:
      "Which population observation does the frozen Atlas release expose for France, and which metadata is required to interpret that choice?",
    methods:
      "Select France's canonical population row with its displayed and numeric forms, unit, source, observation year, upstream release, method, content hash, and dispute flag.",
    decisionTrail: [
      "Resolve France by its release-bound ISO alpha-3 identifier rather than a display-name match.",
      "Treat fact_value and fact_value_numeric as two representations of one selected observation, not as independent estimates.",
      "Bind the interpretation to source_id, observation_reference_year, upstream_dataset_release, methodology_version, vintage_label, and content_hash.",
      "Keep is_disputed_at_cut visible; a false value means no dispute was open at the release cut, not independent verification.",
    ],
    limitations: [
      "The frozen public package contains the selected canonical row only; alternate, projected, rejected, or later observations are not reconstructed here.",
      "The case demonstrates traceability of the released choice. It does not claim that the selected value is uniquely correct or current after the release cut.",
      "The source-specific rights row governs reuse of the observation.",
    ],
    recipes: [
      {
        id: "france-population",
        label: "France canonical population row",
        path:
          "/api/v1/atlas/query?table=facts&jurisdiction=FRA&fact_key=population&fields=fact_key,fact_value,fact_value_numeric,fact_unit,value_status,source_id,source_url,observation_reference_year,upstream_dataset_release,source_retrieved_at,methodology_version,vintage_label,content_hash,is_disputed_at_cut&limit=100",
      },
    ],
  },
  {
    id: "institutional-context-without-taxonomy-collapse",
    title: "Comparing institutions without collapsing taxonomies",
    researchQuestion:
      "How can a small cross-regional comparison keep government form, monarchy status, World Bank region, and income group as separate sourced dimensions?",
    methods:
      "Join five frozen sovereign-jurisdiction rows to four selected fact keys, then pivot the source-native values without creating a composite or treating region and income as government classifications.",
    decisionTrail: [
      "Use one explicit, named five-jurisdiction teaching sample: France, Ghana, Japan, Samoa, and Uruguay.",
      "Join facts to jurisdictions only through the documented jurisdiction_id = id relation.",
      "Keep government_form_description and monarchy_status separate from world_bank_region and world_bank_income_group.",
      "Retain the source and reference-year rows in the frozen inputs even though the compact output table shows the values.",
    ],
    limitations: [
      "The five jurisdictions are a transparent teaching sample, not a statistically representative sample.",
      "Publisher labels are reproduced as source-native categories and are not harmonized into a single Civica scale.",
      "The table is descriptive; it supports no causal, quality, ranking, or cultural inference.",
    ],
    recipes: [
      {
        id: "comparison-jurisdictions",
        label: "Five selected sovereign jurisdictions",
        path:
          "/api/v1/atlas/query?table=jurisdictions&jurisdiction=FRA,GHA,JPN,WSM,URY&status=sovereign_state&fields=id,name,iso3,type&limit=100",
      },
      {
        id: "comparison-facts",
        label: "Four separate institutional and peer-context dimensions",
        path:
          "/api/v1/atlas/query?table=facts&jurisdiction=FRA,GHA,JPN,WSM,URY&fact_key=government_form_description,monarchy_status,world_bank_region,world_bank_income_group&fields=jurisdiction_id,fact_key,fact_value,value_status,source_id,observation_reference_year,upstream_dataset_release,vintage_label,content_hash&limit=100",
      },
    ],
  },
] as const;

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function stableUrl(caseId: string): string {
  return `${ATLAS_CASE_STUDIES_PUBLIC_URL}#${caseId}`;
}

function runRecipe(
  loaded: LoadedAtlasQueryRelease,
  recipe: AtlasCaseStudyRecipeDefinition,
): {
  result: AtlasCaseStudyRecipeResult;
  rights: Record<string, unknown>[];
} {
  const request = new Request(`https://civicaatlas.org${recipe.path}`);
  const parsed = parseQueryContract(request, "v1-atlas-query/v1");
  if (!parsed.ok) {
    throw new Error(`${recipe.id}: query recipe does not satisfy the API contract`);
  }
  if (parsed.data.format !== "json") {
    throw new Error(`${recipe.id}: case-study recipes must use JSON`);
  }

  const input = atlasQueryInputFromRequest(parsed.data);
  const inputRows: Record<string, unknown>[] = [];
  const rights = new Map<string, Record<string, unknown>>();
  let pagesRead = 0;
  let firstResult: AtlasQueryResult | null = null;
  let offset = input.offset;

  while (true) {
    const page = runAtlasQuery(loaded, { ...input, offset });
    firstResult ??= page;
    pagesRead += 1;
    inputRows.push(...page.data);
    for (const source of page.rights.sources) {
      rights.set(String(source.sourceId), source);
    }
    if (!page.meta.hasMore || page.meta.nextOffset === null) break;
    offset = page.meta.nextOffset;
  }

  if (!firstResult) throw new Error(`${recipe.id}: no query result was produced`);
  if (inputRows.length !== firstResult.meta.total) {
    throw new Error(`${recipe.id}: pagination did not reproduce every input row`);
  }

  return {
    result: {
      ...recipe,
      releaseId: firstResult.release.id,
      releaseSemanticSha256: firstResult.release.semanticSha256,
      exportSchemaVersion: firstResult.release.exportSchemaVersion,
      inputRowCount: inputRows.length,
      pagesRead,
      fields: firstResult.query.fields,
      inputRows,
    },
    rights: [...rights.values()],
  };
}

function buildStatusCase(
  definition: AtlasCaseStudyDefinition,
  recipes: AtlasCaseStudyRecipeResult[],
): Pick<AtlasCaseStudyResult, "answer" | "table" | "rightsNote"> {
  const rows = recipes[0].inputRows;
  const order = [
    "sovereign_state",
    "associated_state",
    "dependency_or_territory",
    "disputed_or_limited_recognition",
    "aggregate_or_special_area",
  ];
  const tableRows = order.map((status) => {
    const matching = rows.filter((row) => row.type === status);
    return {
      status,
      jurisdictions: matching.length,
      reviewed: matching.filter(
        (row) =>
          typeof row.status_reviewed_at === "string" &&
          row.status_reviewed_at.length > 0,
      ).length,
      disputed: matching.filter((row) => row.status_disputed === true).length,
    };
  });
  const sovereign = tableRows.find(
    (row) => row.status === "sovereign_state",
  )!;
  return {
    answer:
      `The release contains ${rows.length} jurisdiction rows across five closed status classes. ` +
      `${sovereign.jurisdictions} rows are sovereign_state and therefore enter Civica's sovereign-state totals; the other rows remain separately typed.`,
    table: {
      caption:
        "Frozen jurisdiction rows by jurisdiction-status/v1 class, with review and dispute flags.",
      columns: [
        { key: "status", label: "Status class" },
        { key: "jurisdictions", label: "Jurisdictions" },
        { key: "reviewed", label: "Reviewed rows" },
        { key: "disputed", label: "Disputed rows" },
      ],
      rows: tableRows,
    },
    rightsNote:
      "The query redistributes only Civica's normalized status rows and their source identifiers. Consult the rights manifest and cited publishers before reusing underlying source materials.",
  };
}

function buildPopulationCase(
  definition: AtlasCaseStudyDefinition,
  recipes: AtlasCaseStudyRecipeResult[],
): Pick<AtlasCaseStudyResult, "answer" | "table" | "rightsNote"> {
  const rows = recipes[0].inputRows;
  if (rows.length !== 1) {
    throw new Error(
      `${definition.id}: expected one canonical France population row, found ${rows.length}`,
    );
  }
  const row = rows[0];
  const source = String(row.source_id);
  const year = String(row.observation_reference_year);
  return {
    answer:
      `The frozen release exposes one France population row from ${source}, describing reference year ${year}. ` +
      "Its display text, numeric value, unit, source release, method, vintage, content hash, and dispute-at-cut state travel together.",
    table: {
      caption:
        "The single canonical France population observation exposed by atlas-2026-07-11.",
      columns: [
        { key: "fact", label: "Fact" },
        { key: "displayValue", label: "Released value" },
        { key: "numericValue", label: "Numeric value" },
        { key: "unit", label: "Unit" },
        { key: "source", label: "Source" },
        { key: "referenceYear", label: "Reference year" },
        { key: "upstreamRelease", label: "Upstream release" },
        { key: "method", label: "Method" },
        { key: "disputedAtCut", label: "Disputed at cut" },
      ],
      rows: [
        {
          fact: String(row.fact_key),
          displayValue: String(row.fact_value),
          numericValue:
            typeof row.fact_value_numeric === "number"
              ? row.fact_value_numeric
              : null,
          unit: String(row.fact_unit),
          source,
          referenceYear:
            typeof row.observation_reference_year === "number"
              ? row.observation_reference_year
              : null,
          upstreamRelease: String(row.upstream_dataset_release),
          method: String(row.methodology_version),
          disputedAtCut: row.is_disputed_at_cut === true,
        },
      ],
    },
    rightsNote:
      "The embedded source-rights row is part of the result. Reuse must follow that source's terms, attribution requirements, and restrictions.",
  };
}

function buildTaxonomyCase(
  definition: AtlasCaseStudyDefinition,
  recipes: AtlasCaseStudyRecipeResult[],
): Pick<AtlasCaseStudyResult, "answer" | "table" | "rightsNote"> {
  const jurisdictions = recipes.find(
    (recipe) => recipe.id === "comparison-jurisdictions",
  )?.inputRows;
  const facts = recipes.find(
    (recipe) => recipe.id === "comparison-facts",
  )?.inputRows;
  if (!jurisdictions || !facts) {
    throw new Error(`${definition.id}: required joined recipes are missing`);
  }
  const factsByJurisdiction = new Map<string, Map<string, string>>();
  for (const row of facts) {
    const jurisdictionId = String(row.jurisdiction_id);
    const byKey =
      factsByJurisdiction.get(jurisdictionId) ?? new Map<string, string>();
    byKey.set(String(row.fact_key), String(row.fact_value));
    factsByJurisdiction.set(jurisdictionId, byKey);
  }
  const tableRows = jurisdictions
    .map((jurisdiction) => {
      const byKey = factsByJurisdiction.get(String(jurisdiction.id));
      if (!byKey || byKey.size !== 4) {
        throw new Error(
          `${definition.id}: ${String(jurisdiction.iso3)} lacks one or more selected dimensions`,
        );
      }
      return {
        jurisdiction: String(jurisdiction.name),
        iso3: String(jurisdiction.iso3),
        governmentForm: byKey.get("government_form_description") ?? null,
        monarchyStatus: byKey.get("monarchy_status") ?? null,
        worldBankRegion: byKey.get("world_bank_region") ?? null,
        worldBankIncome: byKey.get("world_bank_income_group") ?? null,
      };
    })
    .sort((a, b) => a.jurisdiction.localeCompare(b.jurisdiction));
  return {
    answer:
      `All ${tableRows.length} selected jurisdictions have four separately sourced rows in the frozen release. ` +
      "The resulting table preserves institutional description, monarchy status, region, and income group as distinct fields rather than combining them into a score or single taxonomy.",
    table: {
      caption:
        "Five-jurisdiction teaching sample with four source-native dimensions kept separate.",
      columns: [
        { key: "jurisdiction", label: "Jurisdiction" },
        { key: "iso3", label: "ISO3" },
        { key: "governmentForm", label: "Government form" },
        { key: "monarchyStatus", label: "Monarchy status" },
        { key: "worldBankRegion", label: "World Bank region" },
        { key: "worldBankIncome", label: "World Bank income group" },
      ],
      rows: tableRows,
    },
    rightsNote:
      "The compact table combines only rights-allowed released rows. CIA and World Bank source-rights records remain attached to the frozen inputs and govern downstream reuse.",
  };
}

function uniqueRights(
  recipes: Array<{
    rights: Record<string, unknown>[];
  }>,
): Record<string, unknown>[] {
  const rights = new Map<string, Record<string, unknown>>();
  for (const recipe of recipes) {
    for (const source of recipe.rights) {
      rights.set(String(source.sourceId), source);
    }
  }
  return [...rights.values()].sort((a, b) =>
    String(a.sourceId).localeCompare(String(b.sourceId)),
  );
}

function buildCase(
  loaded: LoadedAtlasQueryRelease,
  definition: AtlasCaseStudyDefinition,
): AtlasCaseStudyResult {
  const executed = definition.recipes.map((recipe) =>
    runRecipe(loaded, recipe),
  );
  const recipes = executed.map(({ result }) => result);
  const derived =
    definition.id === "jurisdiction-status-denominator"
      ? buildStatusCase(definition, recipes)
      : definition.id === "france-population-selection"
        ? buildPopulationCase(definition, recipes)
        : buildTaxonomyCase(definition, recipes);
  const url = stableUrl(definition.id);
  return {
    id: definition.id,
    title: definition.title,
    researchQuestion: definition.researchQuestion,
    answer: derived.answer,
    methods: definition.methods,
    decisionTrail: [...definition.decisionTrail],
    recipes,
    table: derived.table,
    sourceRights: uniqueRights(executed),
    rightsNote: derived.rightsNote,
    limitations: [...definition.limitations],
    citation:
      `Civica Atlas. "${definition.title}." Atlas case studies, release ${ATLAS_QUERY_RELEASE_ID}, ` +
      `${ATLAS_CASE_STUDIES_SCHEMA_VERSION}. ${url}.`,
    stableUrl: url,
  };
}

export function buildAtlasCaseStudyReport(
  loaded: LoadedAtlasQueryRelease,
): AtlasCaseStudyReport {
  const reportWithoutHash = {
    schemaVersion: ATLAS_CASE_STUDIES_SCHEMA_VERSION,
    generatedAt: loaded.release.generatedAt,
    release: {
      id: loaded.release.releaseId,
      date: loaded.release.releaseDate,
      exportSchemaVersion: loaded.release.schemaVersion,
      semanticSha256: loaded.semanticSha256,
      sourceArtifact:
        "data/releases/atlas-2026-07-11/atlas-export.v1.json.gz",
      rightsManifest: ATLAS_QUERY_RIGHTS_MANIFEST,
    },
    reproduction: {
      generator: "scripts/generate-atlas-case-studies.ts",
      validator: "scripts/validate-atlas-case-studies.ts",
      command: "npm run reproduce:atlas-case-studies",
      tolerance: "byte_exact",
      endpoint: "/api/v1/atlas/query",
    },
    cases: ATLAS_CASE_STUDIES.map((definition) =>
      buildCase(loaded, definition),
    ),
  } as const;
  const semanticSha256 = sha256(JSON.stringify(reportWithoutHash));
  return { ...reportWithoutHash, semanticSha256 };
}

export function renderAtlasCaseStudyReport(
  report: AtlasCaseStudyReport,
): string {
  return `${JSON.stringify(report, null, 2)}\n`;
}

export function atlasCaseStudyReportErrors(
  report: AtlasCaseStudyReport,
): string[] {
  const errors: string[] = [];
  const { semanticSha256, ...withoutHash } = report;
  if (semanticSha256 !== sha256(JSON.stringify(withoutHash))) {
    errors.push("case-study semantic hash does not match the report");
  }
  if (report.release.id !== ATLAS_QUERY_RELEASE_ID) {
    errors.push("case studies are not bound to the selected frozen release");
  }
  if (report.cases.length !== 3) {
    errors.push("exactly three published case studies are required");
  }
  const ids = new Set<string>();
  for (const study of report.cases) {
    if (ids.has(study.id)) errors.push(`duplicate case-study id: ${study.id}`);
    ids.add(study.id);
    if (
      !study.researchQuestion.trim() ||
      !study.answer.trim() ||
      !study.methods.trim() ||
      !study.rightsNote.trim() ||
      !study.citation.includes(study.stableUrl) ||
      study.decisionTrail.length === 0 ||
      study.limitations.length === 0 ||
      study.table.columns.length === 0 ||
      study.table.rows.length === 0 ||
      study.recipes.length === 0
    ) {
      errors.push(`${study.id}: publication contract is incomplete`);
    }
    for (const recipe of study.recipes) {
      if (
        !recipe.path.startsWith("/api/v1/atlas/query?") ||
        recipe.releaseId !== report.release.id ||
        recipe.releaseSemanticSha256 !== report.release.semanticSha256 ||
        recipe.inputRowCount !== recipe.inputRows.length ||
        recipe.pagesRead < 1
      ) {
        errors.push(`${study.id}/${recipe.id}: recipe evidence is incomplete`);
      }
    }
  }
  return errors;
}
