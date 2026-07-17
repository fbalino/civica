/**
 * DAT-002 source-input manifest contract.
 *
 * This file separates stable source/pipeline specifications from captured
 * release instances. A specification says what must be captured; a release
 * instance is valid only with an exact retrieval time and SHA-256 content
 * hash. `validate-source-input-manifest.ts` closes every deployed producer and
 * deliberately fails release generation when a required capture is absent.
 */

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import {
  MANUAL_PRODUCTION_ADAPTERS,
  SCHEDULED_PRODUCTION_ADAPTERS,
} from "./production-adapter-registry";
import indexRelease from "../ci/production-release-coverage.generated.json";

export const SOURCE_INPUT_MANIFEST_VERSION = "source-input-manifest/v1";

export type AccessMethod =
  "api" | "bulk-download" | "rss" | "sparql" | "html" | "derived-database";

export type InputFormat =
  | "json"
  | "csv"
  | "xlsx"
  | "zip-csv"
  | "xml"
  | "pdf"
  | "html"
  | "rdf-json"
  | "database-rows"
  | "mixed";

export type RedistributionPosture =
  | "public-domain"
  | "open-with-attribution"
  | "open-share-alike"
  | "non-commercial"
  | "restricted-no-redistribution"
  | "review-required";

export interface SourceInputSpec {
  sourceId: string;
  canonicalUrl: string;
  accessMethod: AccessMethod;
  format: InputFormat;
  upstreamVersion: string;
  upstreamVintage: string;
  expectedCoverage: string;
  redistributionPosture: RedistributionPosture;
}

const spec = (
  sourceId: string,
  canonicalUrl: string,
  accessMethod: AccessMethod,
  format: InputFormat,
  upstreamVersion: string,
  upstreamVintage: string,
  expectedCoverage: string,
  redistributionPosture: RedistributionPosture,
): SourceInputSpec => ({
  sourceId,
  canonicalUrl,
  accessMethod,
  format,
  upstreamVersion,
  upstreamVintage,
  expectedCoverage,
  redistributionPosture,
});

/** Stable publisher/access contract for every source used by a deployed job. */
export const SOURCE_INPUT_SPECS: readonly SourceInputSpec[] = [
  spec(
    "amnesty",
    "https://www.amnesty.org/en/feed/",
    "rss",
    "xml",
    "feed response at retrieval",
    "publication timestamps in feed",
    "eligible global news items returned by the active connector window",
    "restricted-no-redistribution",
  ),
  spec(
    "bjornskov_rode",
    "https://www.gu.se/en/quality-government/qog-data/data-downloads/standard-dataset",
    "bulk-download",
    "mixed",
    "QoG Standard release containing Bjornskov-Rode/CGV",
    "dataset reference year retained per row",
    "matched jurisdictions in the selected cross-section",
    "non-commercial",
  ),
  spec(
    "bundestag_dip",
    "https://search.dip.bundestag.de/api/v1",
    "api",
    "json",
    "API response schema at retrieval",
    "bill update/publication timestamps",
    "most recent configured Bundestag proceedings",
    "open-with-attribution",
  ),
  spec(
    "camara_br",
    "https://dadosabertos.camara.leg.br/api/v2",
    "api",
    "json",
    "API v2",
    "bill update/publication timestamps",
    "most recent configured Câmara proceedings",
    "open-with-attribution",
  ),
  spec(
    "cia_factbook",
    "https://github.com/factbook/factbook.json",
    "bulk-download",
    "json",
    "frozen repository revision",
    "2026-01 frozen editorial vintage",
    "all matched Factbook country and territory records",
    "public-domain",
  ),
  spec(
    "cia_world_leaders",
    "https://www.cia.gov/resources/world-leaders/foreign-governments/",
    "html",
    "html",
    "page response at retrieval",
    "page retrieval date",
    "all country pages and parsed officials available in the directory",
    "public-domain",
  ),
  spec(
    "civica_organization_roster_v1",
    "https://www.civicaatlas.org/methodology/source-coverage",
    "derived-database",
    "database-rows",
    "organization-membership-release/2026-07-v1",
    "official organization pages retrieved 2026-07-12",
    "23 organization identities and 446 retained relationships; nine complete rosters and fourteen selected checked subsets",
    "restricted-no-redistribution",
  ),
  spec(
    "civicus_monitor",
    "https://monitor.civicus.org/RSSFeed.xml",
    "rss",
    "xml",
    "feed response at retrieval",
    "publication timestamps in feed",
    "eligible monitored civic-space items in the active connector window",
    "open-share-alike",
  ),
  spec(
    "congress_gov",
    "https://api.congress.gov/v3",
    "api",
    "json",
    "Congress.gov API v3",
    "bill update/publication timestamps",
    "latest configured United States bills",
    "public-domain",
  ),
  spec(
    "constitute_project",
    "https://www.constituteproject.org/service/",
    "api",
    "json",
    "service response at retrieval",
    "constitution document dates plus retrieval date",
    "matched constitutions and excerpts available through the service",
    "non-commercial",
  ),
  spec(
    "data_assemblee_fr",
    "https://data.assemblee-nationale.fr",
    "api",
    "mixed",
    "publisher dataset/API response at retrieval",
    "dossier update/publication timestamps",
    "latest configured Assemblée nationale dossiers",
    "open-with-attribution",
  ),
  spec(
    "eurostat",
    "https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/",
    "api",
    "json",
    "dissemination API response at retrieval",
    "observation time retained per value",
    "configured indicators for Eurostat-covered jurisdictions",
    "open-with-attribution",
  ),
  spec(
    "fao_faostat",
    "https://fenixservices.fao.org/faostat/api/v1/",
    "api",
    "json",
    "FAOSTAT API response at retrieval",
    "observation year retained per value",
    "configured FAOSTAT indicators and available countries",
    "open-with-attribution",
  ),
  spec(
    "freedom_house",
    "https://freedomhouse.org/sites/default/files/2024-02/Aggregate_Category_and_Subcategory_Scores_FIW_2003-2024.xlsx",
    "bulk-download",
    "xlsx",
    "Freedom in the World workbook through 2024",
    "2024 edition",
    "country rows matched to the Civica release universe",
    "restricted-no-redistribution",
  ),
  spec(
    "gdelt",
    "https://api.gdeltproject.org/api/v2/doc/doc",
    "api",
    "json",
    "DOC 2.0 response at retrieval",
    "article timestamps in response",
    "eligible governance-related documents in the active query window",
    "open-with-attribution",
  ),
  spec(
    "global_peace_index",
    "https://www.visionofhumanity.org/maps/",
    "bulk-download",
    "mixed",
    "operator-supplied licensed edition",
    "edition year retained per row",
    "countries present in the supplied edition",
    "non-commercial",
  ),
  spec(
    "hrw",
    "https://www.hrw.org/rss/news",
    "rss",
    "xml",
    "feed response at retrieval",
    "publication timestamps in feed",
    "eligible global news items returned by the active connector window",
    "restricted-no-redistribution",
  ),
  spec(
    "ibge_br",
    "https://servicodados.ibge.gov.br/api/",
    "api",
    "json",
    "IBGE API response at retrieval",
    "observation time retained per value",
    "configured Brazil indicators",
    "open-with-attribution",
  ),
  spec(
    "ilo_ilostat",
    "https://rplumber.ilo.org/data/indicator/",
    "api",
    "mixed",
    "ILOSTAT bulk/API response at retrieval",
    "observation year retained per value",
    "configured labour indicators and available countries",
    "open-with-attribution",
  ),
  spec(
    "imf_weo",
    "https://www.imf.org/en/Publications/WEO/weo-database",
    "bulk-download",
    "mixed",
    "named WEO edition",
    "edition and observation year retained per value",
    "configured WEO indicators and available economies",
    "open-with-attribution",
  ),
  spec(
    "insee_fr",
    "https://www.bdm.insee.fr/series/sdmx/",
    "api",
    "xml",
    "INSEE BDM SDMX response at retrieval",
    "observation time retained per value",
    "configured France indicators",
    "open-with-attribution",
  ),
  spec(
    "international_idea",
    "https://www.idea.int/data-tools/export?type=region_only&themeId=293&world=all",
    "bulk-download",
    "xlsx",
    "export response at retrieval",
    "election dates retained per row",
    "presidential and parliamentary turnout rows matched to Civica elections",
    "non-commercial",
  ),
  spec(
    "ipu_parline",
    "https://api.data.ipu.org/v1",
    "api",
    "json",
    "Parline API response at retrieval",
    "legislature/election dates retained per row",
    "available national legislatures, chambers, elections, and party seats",
    "non-commercial",
  ),
  spec(
    "legisinfo_ca",
    "https://www.parl.ca/legisinfo/en/bills/json",
    "api",
    "json",
    "LEGISinfo response schema at retrieval",
    "bill update/publication timestamps",
    "latest configured Canadian bills",
    "open-with-attribution",
  ),
  spec(
    "oecd_stat",
    "https://sdmx.oecd.org/public/rest/v1/",
    "api",
    "mixed",
    "OECD SDMX response at retrieval",
    "observation time retained per value",
    "configured OECD indicators and available members",
    "open-with-attribution",
  ),
  spec(
    "ons_uk",
    "https://api.beta.ons.gov.uk/v1/",
    "api",
    "json",
    "ONS API response at retrieval",
    "observation time retained per value",
    "configured United Kingdom indicators",
    "open-with-attribution",
  ),
  spec(
    "senado_br",
    "https://legis.senado.leg.br/dadosabertos",
    "api",
    "xml",
    "open-data response at retrieval",
    "bill update/publication timestamps",
    "most recent configured Senado Federal proceedings",
    "open-with-attribution",
  ),
  spec(
    "senat_fr",
    "https://data.senat.fr",
    "bulk-download",
    "mixed",
    "publisher dataset response at retrieval",
    "dossier update/publication timestamps",
    "latest configured Sénat dossiers",
    "open-with-attribution",
  ),
  spec(
    "statcan_ca",
    "https://www150.statcan.gc.ca/t1/wds/rest/",
    "api",
    "json",
    "Web Data Service response at retrieval",
    "observation time retained per value",
    "configured Canada indicators",
    "open-with-attribution",
  ),
  spec(
    "stats_sa",
    "https://www.statssa.gov.za/publications/",
    "bulk-download",
    "pdf",
    "named Stats SA statistical release",
    "release period retained per value",
    "configured South Africa indicators extracted from publisher releases",
    "open-with-attribution",
  ),
  spec(
    "transparency_intl",
    "https://images.transparencycdn.org/images/CPI2024-Results-and-trends.xlsx",
    "bulk-download",
    "xlsx",
    "CPI 2024 results workbook",
    "2024 edition",
    "country rows matched to the Civica release universe",
    "restricted-no-redistribution",
  ),
  spec(
    "uk_parliament",
    "https://bills-api.parliament.uk/api/v1",
    "api",
    "json",
    "UK Parliament Bills API response at retrieval",
    "bill update/publication timestamps",
    "latest configured United Kingdom bills",
    "open-with-attribution",
  ),
  spec(
    "un_data",
    "https://data.un.org/Handlers/DownloadHandler.ashx",
    "bulk-download",
    "csv",
    "UNdata export response at retrieval",
    "observation year retained per value",
    "configured UNdata indicators and available countries",
    "open-with-attribution",
  ),
  spec(
    "undp_hdi",
    "https://hdr.undp.org/sites/default/files/2025_HDR/HDR25_Composite_indices_complete_time_series.csv",
    "bulk-download",
    "csv",
    "2025 Human Development Report composite-indices time series",
    "report edition and observation year retained per value",
    "countries in the selected HDI series matched to Civica",
    "open-with-attribution",
  ),
  spec(
    "unesco_uis",
    "https://api.uis.unesco.org/sdmx/data/",
    "api",
    "mixed",
    "UIS SDMX response at retrieval",
    "observation year retained per value",
    "configured education indicators and available countries",
    "open-with-attribution",
  ),
  spec(
    "us_census",
    "https://api.census.gov/data/",
    "api",
    "json",
    "Census API response at retrieval",
    "dataset year retained per value",
    "configured United States indicators",
    "public-domain",
  ),
  spec(
    "vdem",
    "https://www.v-dem.net/media/datasets/V-Dem-CY-Core-v15_csv.zip",
    "bulk-download",
    "zip-csv",
    "V-Dem Country-Year Core v15",
    "2024 observations for the frozen Index; source year retained elsewhere",
    "country rows matched to the Civica release universe",
    "open-with-attribution",
  ),
  spec(
    "vparty",
    "https://www.v-dem.net/data/v-party-dataset/",
    "bulk-download",
    "csv",
    "V-Party v2",
    "fixed February 2022 release covering through 2019",
    "matched parties present in the fixed release",
    "open-share-alike",
  ),
  spec(
    "who_gho",
    "https://ghoapi.azureedge.net/api/",
    "api",
    "json",
    "GHO OData response at retrieval",
    "observation year retained per value",
    "configured health indicators and available countries",
    "open-with-attribution",
  ),
  spec(
    "wikidata",
    "https://query.wikidata.org/sparql",
    "sparql",
    "rdf-json",
    "Wikidata revision state at retrieval",
    "statement/reference dates plus retrieval date",
    "entities matched by the configured SPARQL query",
    "public-domain",
  ),
  spec(
    "world_bank",
    "https://api.worldbank.org/v2",
    "api",
    "json",
    "World Bank Indicators API response at retrieval",
    "observation year retained per value",
    "configured indicators and available economies",
    "open-with-attribution",
  ),
  spec(
    "worldbank_economic",
    "https://api.worldbank.org/v2",
    "api",
    "json",
    "World Bank Indicators API response at retrieval",
    "observation year retained per value",
    "configured economic-condition indicators and available economies",
    "open-with-attribution",
  ),
  spec(
    "worldbank_wgi",
    "https://www.worldbank.org/content/dam/sites/govindicators/doc/wgidataset_with_sourcedata-2025.xlsx",
    "bulk-download",
    "xlsx",
    "WGI 2025 revision",
    "2024 observations",
    "country rows matched to the Civica release universe",
    "open-with-attribution",
  ),
  spec(
    "wto_stats",
    "https://api.wto.org/timeseries/v1/",
    "api",
    "json",
    "WTO Timeseries API response at retrieval",
    "observation year retained per value",
    "configured trade indicators and available members",
    "open-with-attribution",
  ),
] as const;

export interface PipelineInputContract {
  pipelineId: string;
  entrypoint: string;
  inputKind: "external" | "derived";
  sourceIds: readonly string[];
  implementationPaths: readonly string[];
  derivedInput: string | null;
}

const DERIVED_INPUTS: Readonly<Record<string, string>> = {
  "factbook.refresh-cache":
    "current canonical country facts in the production database",
  "factbook.auto-resolve":
    "current unresolved data disputes and admitted country facts",
  "factbook.snapshot-vintage":
    "complete country-fact candidate observations, source/input hashes, adapter versions, and resolver code selected at the named cut",
  "factbook.verify-reconciliation":
    "current country facts, snapshots, disputes, and reconciliation policy",
  "pulse.v2.cluster": "admitted Pulse v2 article rows from pulse.v2.ingest",
  "pulse.v2.classify": "Pulse v2 clusters from pulse.v2.cluster",
  "pulse.v2.score": "verified Pulse v2 classifications and corroboration state",
  "pulse.v2.review-sla":
    "current Pulse review obligations and append-only SLA event evidence",
  "operations.error-alerts":
    "open content-free error-monitoring records retained for the active alert window",
  "operations.pipeline-alerts":
    "retained production pipeline-run rows and the registered cron schedule contract",
  "operations.health-alerts":
    "content-free application, database, active-map-asset, scheduled-freshness, and optional-model availability states",
};

export function productionPipelineContracts(): readonly PipelineInputContract[] {
  const manual = MANUAL_PRODUCTION_ADAPTERS.map((pipeline) => ({
    pipelineId: pipeline.id,
    entrypoint: pipeline.entrypoint,
    inputKind: "external" as const,
    sourceIds: pipeline.sources,
    implementationPaths: pipeline.implementationPaths,
    derivedInput: null,
  }));
  const scheduled = SCHEDULED_PRODUCTION_ADAPTERS.map((pipeline) => ({
    pipelineId: pipeline.id,
    entrypoint: `src/app${pipeline.route}/route.ts`,
    inputKind: pipeline.inputKind,
    sourceIds: pipeline.sources,
    implementationPaths: pipeline.implementationPaths,
    derivedInput: DERIVED_INPUTS[pipeline.id] ?? null,
  }));
  return [...manual, ...scheduled];
}

export function adapterVersion(paths: readonly string[]): string {
  const canonical = [...new Set(paths)]
    .sort()
    .map((path) => `${path}\0${readFileSync(path)}`)
    .join("\0");
  return `sha256:${createHash("sha256").update(canonical).digest("hex")}`;
}

export interface CapturedSourceInput {
  pipelineId: string;
  sourceId: string;
  accessUrl: string;
  retrievedAt: string;
  contentSha256: string;
  format: InputFormat;
  upstreamVersion: string;
  upstreamVintage: string;
  expectedCoverage: string;
  redistributionPosture: RedistributionPosture;
  adapterVersion: string;
}

export interface SourceInputManifestIssue {
  code: string;
  detail: string;
}

const SHA256 = /^[a-f0-9]{64}$/;

export function validateSourceInputContract(
  captures: readonly CapturedSourceInput[] = frozenIndexInputCaptures(),
): SourceInputManifestIssue[] {
  const issues: SourceInputManifestIssue[] = [];
  const pipelines = productionPipelineContracts();
  const sourceIds = new Set(
    pipelines.flatMap((pipeline) => [...pipeline.sourceIds]),
  );
  const specsById = new Map<string, SourceInputSpec>();

  for (const source of SOURCE_INPUT_SPECS) {
    if (specsById.has(source.sourceId)) {
      issues.push({ code: "duplicate-source-spec", detail: source.sourceId });
    }
    specsById.set(source.sourceId, source);
    if (!source.canonicalUrl.startsWith("https://")) {
      issues.push({ code: "non-https-canonical-url", detail: source.sourceId });
    }
    for (const [field, value] of Object.entries(source)) {
      if (typeof value === "string" && value.trim().length === 0) {
        issues.push({
          code: "blank-source-field",
          detail: `${source.sourceId}.${field}`,
        });
      }
    }
  }
  for (const sourceId of sourceIds) {
    if (!specsById.has(sourceId)) {
      issues.push({ code: "missing-source-spec", detail: sourceId });
    }
  }
  for (const sourceId of specsById.keys()) {
    if (!sourceIds.has(sourceId)) {
      issues.push({ code: "orphan-source-spec", detail: sourceId });
    }
  }

  const pipelineIds = new Set<string>();
  for (const pipeline of pipelines) {
    if (pipelineIds.has(pipeline.pipelineId)) {
      issues.push({ code: "duplicate-pipeline", detail: pipeline.pipelineId });
    }
    pipelineIds.add(pipeline.pipelineId);
    if (pipeline.inputKind === "external" && pipeline.sourceIds.length === 0) {
      issues.push({
        code: "external-without-source",
        detail: pipeline.pipelineId,
      });
    }
    if (pipeline.inputKind === "derived" && pipeline.sourceIds.length > 0) {
      issues.push({ code: "derived-with-source", detail: pipeline.pipelineId });
    }
    if (pipeline.inputKind === "derived" && !pipeline.derivedInput) {
      issues.push({
        code: "derived-without-input",
        detail: pipeline.pipelineId,
      });
    }
    if (pipeline.inputKind === "external" && pipeline.derivedInput) {
      issues.push({
        code: "external-with-derived-input",
        detail: pipeline.pipelineId,
      });
    }
  }

  const captureKeys = new Set<string>();
  for (const capture of captures) {
    const key = `${capture.pipelineId}:${capture.sourceId}`;
    if (captureKeys.has(key)) {
      issues.push({ code: "duplicate-capture", detail: key });
    }
    captureKeys.add(key);
    const pipeline = pipelines.find(
      (candidate) => candidate.pipelineId === capture.pipelineId,
    );
    if (!pipeline) {
      issues.push({ code: "unknown-capture-pipeline", detail: key });
      continue;
    }
    if (!pipeline.sourceIds.includes(capture.sourceId)) {
      issues.push({ code: "capture-source-not-in-pipeline", detail: key });
    }
    if (!specsById.has(capture.sourceId)) {
      issues.push({ code: "capture-source-without-spec", detail: key });
    }
    if (!SHA256.test(capture.contentSha256)) {
      issues.push({ code: "invalid-content-hash", detail: key });
    }
    if (!/^sha256:[a-f0-9]{64}$/.test(capture.adapterVersion)) {
      issues.push({ code: "invalid-adapter-version", detail: key });
    }
    if (Number.isNaN(Date.parse(capture.retrievedAt))) {
      issues.push({ code: "invalid-retrieval-time", detail: key });
    }
    if (!/^https?:\/\//.test(capture.accessUrl)) {
      issues.push({ code: "invalid-access-url", detail: key });
    }
  }
  return issues;
}

export function missingReleaseCaptures(
  pipelineIds: readonly string[],
  captures: readonly CapturedSourceInput[],
): readonly string[] {
  const pipelines = productionPipelineContracts();
  const captured = new Set(
    captures.map((capture) => `${capture.pipelineId}:${capture.sourceId}`),
  );
  const missing: string[] = [];
  for (const pipelineId of pipelineIds) {
    const pipeline = pipelines.find(
      (candidate) => candidate.pipelineId === pipelineId,
    );
    if (!pipeline) {
      missing.push(`${pipelineId}:unknown-pipeline`);
      continue;
    }
    for (const sourceId of pipeline.sourceIds) {
      const key = `${pipeline.pipelineId}:${sourceId}`;
      if (!captured.has(key)) missing.push(key);
    }
  }
  return missing.sort();
}

export interface VersionedSourceInputManifest {
  schemaVersion: typeof SOURCE_INPUT_MANIFEST_VERSION;
  releaseId: string;
  generatedFrom: "checked-in-captures";
  pipelineIds: readonly string[];
  inputs: readonly CapturedSourceInput[];
}

export function buildVersionedSourceInputManifest(
  releaseId: string,
  pipelineIds: readonly string[],
  captures: readonly CapturedSourceInput[],
): VersionedSourceInputManifest {
  const issues = validateSourceInputContract(captures);
  const missing = missingReleaseCaptures(pipelineIds, captures);
  if (!releaseId.trim()) throw new Error("releaseId is required");
  if (issues.length > 0 || missing.length > 0) {
    throw new Error(
      `Source-input manifest is incomplete: ${[
        ...issues.map((issue) => `${issue.code}:${issue.detail}`),
        ...missing.map((item) => `missing-capture:${item}`),
      ].join(", ")}`,
    );
  }
  const selected = captures
    .filter((capture) => pipelineIds.includes(capture.pipelineId))
    .sort((a, b) =>
      `${a.pipelineId}:${a.sourceId}`.localeCompare(
        `${b.pipelineId}:${b.sourceId}`,
      ),
    );
  return {
    schemaVersion: SOURCE_INPUT_MANIFEST_VERSION,
    releaseId,
    generatedFrom: "checked-in-captures",
    pipelineIds: [...pipelineIds].sort(),
    inputs: selected,
  };
}

/** Exact captured publisher artifacts for the named frozen Index release. */
export function frozenIndexInputCaptures(): readonly CapturedSourceInput[] {
  const pipeline = productionPipelineContracts().find(
    (candidate) => candidate.pipelineId === "index.current-beta",
  );
  if (!pipeline) throw new Error("index.current-beta pipeline is missing");
  const version = adapterVersion(pipeline.implementationPaths);
  const capturedAt = "2026-07-10T20:56:16.125Z";
  const bySource = new Map(
    SOURCE_INPUT_SPECS.map((item) => [item.sourceId, item]),
  );
  const inputs = [
    ["vdem", indexRelease.inputSha256.vdem],
    ["worldbank_wgi", indexRelease.inputSha256.worldbankWgi],
    ["freedom_house", indexRelease.inputSha256.freedomHouse],
    ["transparency_intl", indexRelease.inputSha256.transparencyCpi],
  ] as const;
  return inputs.map(([sourceId, contentSha256]) => {
    const source = bySource.get(sourceId);
    if (!source) throw new Error(`source input spec missing: ${sourceId}`);
    return {
      pipelineId: pipeline.pipelineId,
      sourceId,
      accessUrl: source.canonicalUrl,
      retrievedAt: capturedAt,
      contentSha256,
      format: source.format,
      upstreamVersion: source.upstreamVersion,
      upstreamVintage: source.upstreamVintage,
      expectedCoverage: source.expectedCoverage,
      redistributionPosture: source.redistributionPosture,
      adapterVersion: version,
    };
  });
}
