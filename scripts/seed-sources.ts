import { config } from "dotenv";
config({ path: ".env.local" });

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { sources, metricDefinitions } from "../src/lib/db/schema";

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle({ client: sql });

const SOURCES = [
  {
    id: "cia_factbook",
    name: "CIA World Factbook",
    baseUrl: "https://github.com/factbook/factbook.json",
    license: "public_domain",
    isCommercialUseAllowed: true,
    lastSyncAt: new Date("2026-01-23"),
  },
  // --- P4 — CIA World Leaders directory (cabinet ministers, deputies,
  //     central-bank governors, and other listed officials) ---
  // Per plan/gov-p4-cabinets-judiciary-plan-2026-06-30.md §1.6.
  // A distinct US-federal publication from the Factbook, at a distinct URL
  // (`/resources/world-leaders/foreign-governments/`), carrying no copyright
  // notice → public domain, commercial-use OK, attribution to CIA requested
  // (same posture as `cia_factbook`). Refreshed monthly by the CIA; Civica
  // re-syncs monthly via `/api/cron/factbook/sync-cia-cabinets`. Stamped
  // exclusively via `markSourcesSynced("cia_world_leaders", …)`.
  {
    id: "cia_world_leaders",
    name: "CIA World Leaders",
    baseUrl:
      "https://www.cia.gov/resources/world-leaders/foreign-governments/",
    license: "public_domain",
    isCommercialUseAllowed: true,
    lastSyncAt: null,
  },
  {
    id: "wikidata",
    name: "Wikidata",
    baseUrl: "https://query.wikidata.org/sparql",
    license: "CC0",
    isCommercialUseAllowed: true,
    lastSyncAt: null,
  },
  {
    id: "ipu_parline",
    name: "IPU Parline",
    baseUrl: "https://api.data.ipu.org/v1",
    license: "CC-BY-NC-SA-4.0",
    isCommercialUseAllowed: false,
    lastSyncAt: null,
  },
  {
    id: "constitute_project",
    name: "Constitute Project",
    baseUrl: "https://www.constituteproject.org/service/",
    license: "non-commercial",
    isCommercialUseAllowed: false,
    lastSyncAt: null,
  },
  // --- Elections v2 — International IDEA Voter Turnout Database ---
  // Per plan/elections-data-sourcing-resolution-v1.md §2c + owner-adopted Q1
  // (accept the non-commercial posture, same class as ipu_parline).
  // Bulk .xlsx export of all presidential + parliamentary turnout since 1945:
  // https://www.idea.int/data-tools/export?type=region_only&themeId=293&world=all
  // License: IDEA site-wide CC BY-NC-SA 4.0
  // (https://www.idea.int/creative-commons-licence) — attribution required,
  // NON-COMMERCIAL only. `scripts/sync-elections-turnout-idea.ts` matches rows
  // onto our elections by ISO2 + type + nearest date, and stamps freshness via
  // markSourcesSynced("international_idea", …). The sync also defensively
  // upserts this row at start so a cron deploy without a fresh seed run works.
  {
    id: "international_idea",
    name: "International IDEA Voter Turnout Database",
    baseUrl: "https://www.idea.int/data-tools/data/voter-turnout-database",
    license: "CC-BY-NC-SA-4.0",
    isCommercialUseAllowed: false,
    lastSyncAt: null,
  },
  {
    id: "parlgov",
    name: "ParlGov",
    baseUrl: "https://www.parlgov.org/",
    license: "unspecified",
    isCommercialUseAllowed: true,
    lastSyncAt: null,
  },
  {
    id: "congress_gov",
    name: "Congress.gov",
    baseUrl: "https://api.congress.gov/v3",
    license: "public_domain",
    isCommercialUseAllowed: true,
    lastSyncAt: null,
  },
  {
    id: "uk_parliament",
    name: "UK Parliament",
    baseUrl: "https://members-api.parliament.uk/api",
    license: "open_parliament_licence",
    isCommercialUseAllowed: true,
    lastSyncAt: null,
  },
  {
    id: "legisinfo_ca",
    name: "Parliament of Canada (LEGISinfo)",
    baseUrl: "https://www.parl.ca/legisinfo/en/bills/json",
    license: "Open Government Licence – Canada",
    isCommercialUseAllowed: true,
    lastSyncAt: null,
  },
  {
    id: "camara_br",
    name: "Câmara dos Deputados",
    baseUrl: "https://dadosabertos.camara.leg.br/api/v2",
    license: "LAI 12.527/2011 (Brazil)",
    isCommercialUseAllowed: true,
    lastSyncAt: null,
  },
  {
    id: "senado_br",
    name: "Senado Federal",
    baseUrl: "https://legis.senado.leg.br/dadosabertos",
    license: "LAI 12.527/2011 (Brazil)",
    isCommercialUseAllowed: true,
    lastSyncAt: null,
  },
  {
    id: "bundestag_dip",
    name: "Bundestag DIP",
    baseUrl: "https://search.dip.bundestag.de/api/v1",
    license: "Bundestag Open Data (CC-BY-equivalent)",
    isCommercialUseAllowed: true,
    lastSyncAt: null,
  },
  {
    id: "data_assemblee_fr",
    name: "Assemblée Nationale",
    baseUrl: "https://data.assemblee-nationale.fr",
    license: "Etalab Open Licence v2.0",
    isCommercialUseAllowed: true,
    lastSyncAt: null,
  },
  {
    id: "senat_fr",
    name: "Sénat (France)",
    baseUrl: "https://data.senat.fr",
    license: "Etalab Open Licence v2.0",
    isCommercialUseAllowed: true,
    lastSyncAt: null,
  },
  {
    id: "eu_parliament",
    name: "European Parliament",
    baseUrl: "https://data.europarl.europa.eu/api/v2",
    license: "CC-BY-4.0",
    isCommercialUseAllowed: true,
    lastSyncAt: null,
  },
  {
    id: "undp_hdi",
    name: "UNDP Human Development Reports",
    baseUrl: "https://hdr.undp.org/data-center/documentation-and-downloads",
    license: "CC-BY-3.0-IGO",
    isCommercialUseAllowed: true,
    lastSyncAt: null,
  },
  {
    id: "transparency_intl",
    name: "Transparency International CPI",
    baseUrl: "https://www.transparency.org/en/cpi",
    license: "CC-BY-ND-4.0",
    isCommercialUseAllowed: true,
    lastSyncAt: null,
  },
  {
    id: "world_happiness",
    name: "World Happiness Report",
    baseUrl: "https://worldhappiness.report/data/",
    license: "open_data",
    isCommercialUseAllowed: true,
    lastSyncAt: null,
  },
  {
    id: "world_bank",
    name: "World Bank Open Data",
    baseUrl: "https://api.worldbank.org/v2",
    license: "CC-BY-4.0",
    isCommercialUseAllowed: true,
    lastSyncAt: null,
  },
  {
    id: "bjornskov_rode",
    name: "Bjornskov-Rode / CGV Regime Data",
    baseUrl: "https://www.gu.se/en/quality-government/qog-data/data-downloads/standard-dataset",
    license: "academic_noncommercial",
    isCommercialUseAllowed: false,
    lastSyncAt: null,
  },
  {
    id: "rsf_press_freedom",
    name: "Reporters Without Borders Press Freedom Index",
    baseUrl: "https://rsf.org/en/index",
    license: "open_data",
    isCommercialUseAllowed: true,
    lastSyncAt: null,
  },
  {
    id: "unodc",
    name: "UNODC Crime Statistics",
    baseUrl: "https://dataunodc.un.org/",
    license: "open_data",
    isCommercialUseAllowed: true,
    lastSyncAt: null,
  },
  {
    id: "worldbank_economic",
    name: "World Bank — Economic Stability Indicators",
    baseUrl: "https://api.worldbank.org/v2",
    license: "CC-BY-4.0",
    isCommercialUseAllowed: true,
    lastSyncAt: null,
  },
  {
    id: "global_peace_index",
    name: "Institute for Economics & Peace — Global Peace Index",
    baseUrl: "https://www.visionofhumanity.org/maps/",
    license: "non-commercial",
    isCommercialUseAllowed: false,
    lastSyncAt: null,
  },
  // --- Phase 5.5 — Pulse Beta sources ---
  {
    id: "acled",
    name: "ACLED — Armed Conflict Location & Event Data",
    baseUrl: "https://api.acleddata.com",
    license: "academic_noncommercial",
    isCommercialUseAllowed: false,
    lastSyncAt: null,
  },
  {
    id: "civicus_monitor",
    name: "CIVICUS Monitor",
    baseUrl: "https://monitor.civicus.org",
    license: "CC-BY-SA-4.0",
    isCommercialUseAllowed: true,
    lastSyncAt: null,
  },
  {
    id: "rsf_alerts",
    name: "Reporters Without Borders — Press Freedom Alerts",
    baseUrl: "https://rsf.org/en",
    license: "attribution_required",
    isCommercialUseAllowed: false,
    lastSyncAt: null,
  },
  {
    id: "vdem_pulse",
    name: "V-Dem Institute — Pulse / Early-Warning Signals",
    baseUrl: "https://v-dem.net",
    license: "academic_noncommercial",
    isCommercialUseAllowed: false,
    lastSyncAt: null,
  },
  {
    id: "hrw",
    name: "Human Rights Watch",
    baseUrl: "https://www.hrw.org",
    license: "attribution_required",
    isCommercialUseAllowed: false,
    lastSyncAt: null,
  },
  {
    id: "amnesty",
    name: "Amnesty International",
    baseUrl: "https://www.amnesty.org",
    license: "attribution_required",
    isCommercialUseAllowed: false,
    lastSyncAt: null,
  },
  {
    id: "gdelt",
    name: "GDELT Project",
    baseUrl: "https://api.gdeltproject.org/api/v2/doc/doc",
    license: "open_data",
    isCommercialUseAllowed: true,
    lastSyncAt: null,
  },
  {
    id: "reuters_wire",
    name: "Reuters Wire",
    baseUrl: "https://www.reutersagency.com",
    license: "news_attribution",
    isCommercialUseAllowed: false,
    lastSyncAt: null,
  },
  {
    id: "ap_wire",
    name: "Associated Press",
    baseUrl: "https://apnews.com",
    license: "news_attribution",
    isCommercialUseAllowed: false,
    lastSyncAt: null,
  },
  {
    id: "google_news",
    name: "Google News (aggregator)",
    baseUrl: "https://news.google.com",
    license: "news_aggregation",
    isCommercialUseAllowed: false,
    lastSyncAt: null,
  },
  // --- Phase F — Tier 1 multilateral statistical agencies ---
  // Per ~/civica/plan/phase-f-methodology-v0.1.md §2.1.
  // These are the upstream sources that the resolver prefers for
  // Group B fast-changing quantitative facts. Every Wikidata claim
  // we accept must cite one of these (or a Tier 2 NSO). World Bank
  // and UNDP HDI already seeded above.
  {
    id: "imf_weo",
    name: "IMF World Economic Outlook",
    baseUrl: "https://www.imf.org/en/Publications/WEO",
    license: "open_data_attribution",
    isCommercialUseAllowed: true,
    lastSyncAt: null,
  },
  {
    id: "un_data",
    name: "UN Statistics Division",
    baseUrl: "https://data.un.org",
    license: "open_data_attribution",
    isCommercialUseAllowed: true,
    lastSyncAt: null,
  },
  {
    id: "unesco_uis",
    name: "UNESCO Institute for Statistics",
    baseUrl: "https://uis.unesco.org",
    // UIS data is CC BY-SA 4.0, verified live at
    // https://databrowser.uis.unesco.org/terms-and-conditions and the UIS
    // Data API `info.license` block. The earlier `CC-BY-3.0-IGO` label was a
    // seed conflation with the WHO GHO license (which IS CC-BY-NC-SA-3.0-IGO).
    // CC BY-SA 4.0 carries no non-commercial clause, so the commercial-use
    // flag below is correct. Adopted in plan/unesco-uis-resolution-v1.md §Q1.
    license: "CC-BY-SA-4.0",
    isCommercialUseAllowed: true,
    lastSyncAt: null,
  },
  {
    id: "who_gho",
    name: "WHO Global Health Observatory",
    baseUrl: "https://www.who.int/data/gho",
    license: "CC-BY-NC-SA-3.0-IGO",
    isCommercialUseAllowed: false,
    lastSyncAt: null,
  },
  {
    id: "oecd_stat",
    name: "OECD.Stat",
    baseUrl: "https://stats.oecd.org",
    license: "OECD_terms_attribution",
    isCommercialUseAllowed: true,
    lastSyncAt: null,
  },
  {
    id: "fao_faostat",
    name: "FAO FAOSTAT",
    baseUrl: "https://www.fao.org/faostat",
    license: "CC-BY-4.0",
    isCommercialUseAllowed: true,
    lastSyncAt: null,
  },
  {
    id: "iea_data",
    name: "International Energy Agency",
    baseUrl: "https://www.iea.org/data-and-statistics",
    license: "CC-BY-4.0",
    isCommercialUseAllowed: true,
    lastSyncAt: null,
  },
  {
    id: "ilo_ilostat",
    name: "ILO ILOSTAT",
    baseUrl: "https://ilostat.ilo.org",
    license: "open_data_attribution",
    isCommercialUseAllowed: true,
    lastSyncAt: null,
  },
  {
    id: "eurostat",
    name: "Eurostat",
    baseUrl: "https://ec.europa.eu/eurostat",
    license: "CC-BY-4.0",
    isCommercialUseAllowed: true,
    lastSyncAt: null,
  },
  {
    id: "wto_stats",
    name: "WTO Stats",
    baseUrl: "https://stats.wto.org",
    license: "open_data_attribution",
    isCommercialUseAllowed: true,
    lastSyncAt: null,
  },
  // --- Phase R.13 — US Census Bureau (NSO Wave 1, first phase) ---
  // Per ~/civica/plan/us-census-resolution-v1.md §3 step 1.
  // U.S. Government works are public domain (17 U.S.C. § 105);
  // commercial use OK with required attribution notice ("This product
  // uses the Census Bureau Data API but is not endorsed or certified
  // by the Census Bureau"). Cleanest license posture in v1.
  {
    id: "us_census",
    name: "US Census Bureau",
    baseUrl: "https://api.census.gov/data",
    license: "public_domain",
    isCommercialUseAllowed: true,
    lastSyncAt: null,
  },
  // --- Phase R.14 — ONS-UK (NSO Wave 1, second phase) ---
  // Per ~/civica/plan/ons-uk-resolution-v1.md §3 step 7 + §6 Q4
  // (license string `OGL-UK-3.0`). The ONS sync also defensively
  // upserts this row at sync start so cron deploys without a fresh
  // `seed:sources` run still work; this entry is the canonical seed.
  {
    id: "ons_uk",
    name: "Office for National Statistics (UK)",
    baseUrl: "https://www.ons.gov.uk",
    license: "OGL-UK-3.0",
    isCommercialUseAllowed: true,
    lastSyncAt: null,
  },
  // --- Phase R.15 — INSEE (France) (NSO Wave 1) ---
  // Per ~/civica/plan/insee-fr-resolution-v1.md §3 step 1.
  // Open token-less SDMX endpoint at bdm.insee.fr; Etalab Open
  // Licence v2.0 (commercial-OK with attribution; SPDX
  // `Etalab-2.0`).
  {
    id: "insee_fr",
    name: "INSEE (France)",
    baseUrl: "https://www.bdm.insee.fr",
    license: "Etalab Open Licence v2.0",
    isCommercialUseAllowed: true,
    lastSyncAt: null,
  },
  // --- Phase R.17 — Statistics Canada (NSO Wave 2) ---
  // Per ~/civica/plan/statcan-resolution-v1.md §3 step 1.
  // Open token-less REST endpoint at www150.statcan.gc.ca; Statistics
  // Canada Open Licence (commercial-use OK with attribution; functionally
  // equivalent to CC-BY but governed by Ontario law and includes
  // identification-via-merging + federal-logos prohibitions that CC-BY
  // does not — license slug intentionally `statcan_open_licence`, not
  // `CC-BY`).
  {
    id: "statcan_ca",
    name: "Statistics Canada",
    baseUrl: "https://www150.statcan.gc.ca/t1/wds/rest",
    license: "Statistics Canada Open Licence",
    isCommercialUseAllowed: true,
    lastSyncAt: null,
  },
  // --- Phase R.18 — IBGE (Brazil) (NSO Wave 2) ---
  // Per ~/civica/plan/ibge-br-resolution-v1.md §3 step 1.
  // Open token-less SIDRA REST endpoint at apisidra.ibge.gov.br;
  // Brazilian Federal Open Data Policy via Decreto 8.777/2016
  // + Lei 12.527/2011 (LAI) + Art. 8 Lei 9.610/1998. License
  // slug `public_domain` matches R.13 US Census convention.
  // Per-row `references[].license` payload carries the explicit
  // Brazilian-framework descriptor for academic citation
  // precision.
  {
    id: "ibge_br",
    name: "IBGE (Brazil)",
    baseUrl: "https://apisidra.ibge.gov.br",
    license: "public_domain",
    isCommercialUseAllowed: true,
    lastSyncAt: null,
  },
  // --- Phase R.19 — Stats SA (South Africa) (NSO Wave 3) ---
  // Per ~/civica/plan/stats-sa-resolution-v1.md §3 step 1 + §6 Q6.
  // Stats SA has no programmatic API; R.19 ingests headline
  // values from PDF statistical releases at stable URLs under
  // `/publications/<P-CODE>/`, extracted via Anthropic SDK
  // native PDF support (Claude Haiku 4.5, tool-use mode,
  // temperature 0). The `baseUrl` field is the publishing root.
  //
  // License: Stats SA Copyright (CC-BY-4.0 equivalent) per the
  // verbatim text at https://www.statssa.gov.za/?page_id=425 —
  // attribution required, commercial-use OK, redistribution OK,
  // modification OK; no share-alike. NOT an SPDX-listed license,
  // mirroring R.17 StatCan's non-SPDX human-readable convention.
  // Per-row `references[].license` carries the full citation.
  {
    id: "stats_sa",
    name: "Statistics South Africa",
    baseUrl: "https://www.statssa.gov.za",
    license: "Stats SA Copyright (CC-BY-4.0 equivalent)",
    isCommercialUseAllowed: true,
    lastSyncAt: null,
  },
];

const METRIC_DEFINITIONS = [
  {
    id: "hdi",
    name: "Human Development Index",
    description: "Composite index of life expectancy, education, and per capita income",
    category: "society",
    unit: "index (0–1)",
    higherIsBetter: true,
    valueMin: 0,
    valueMax: 1,
    defaultSourceId: "undp_hdi",
  },
  {
    id: "cpi",
    name: "Corruption Perceptions Index",
    description: "Perceived levels of public sector corruption on a scale of 0 (highly corrupt) to 100 (very clean)",
    category: "governance",
    unit: "score (0–100)",
    higherIsBetter: true,
    valueMin: 0,
    valueMax: 100,
    defaultSourceId: "transparency_intl",
  },
  {
    id: "happiness_score",
    name: "World Happiness Score",
    description: "Life evaluation score based on the Cantril ladder question (0 worst to 10 best)",
    category: "society",
    unit: "score (0–10)",
    higherIsBetter: true,
    valueMin: 0,
    valueMax: 10,
    defaultSourceId: "world_happiness",
  },
  {
    id: "press_freedom",
    name: "Press Freedom Index",
    description: "Score measuring the level of press freedom, lower is better",
    category: "governance",
    unit: "score (0–100)",
    higherIsBetter: false,
    valueMin: 0,
    valueMax: 100,
    defaultSourceId: "rsf_press_freedom",
  },
  {
    id: "life_expectancy",
    name: "Life Expectancy at Birth",
    description: "Average number of years a newborn is expected to live",
    category: "health",
    unit: "years",
    higherIsBetter: true,
    valueMin: 0,
    valueMax: 120,
    defaultSourceId: "world_bank",
  },
  {
    id: "gdp_per_capita",
    name: "GDP per Capita (current US$)",
    description: "Gross domestic product divided by midyear population",
    category: "economy",
    unit: "USD",
    higherIsBetter: true,
    valueMin: 0,
    valueMax: null,
    defaultSourceId: "world_bank",
  },
  {
    id: "unemployment_rate",
    name: "Unemployment Rate",
    description: "Share of the labor force that is without work but available and seeking employment",
    category: "economy",
    unit: "percent",
    higherIsBetter: false,
    valueMin: 0,
    valueMax: 100,
    defaultSourceId: "world_bank",
  },
  {
    id: "homicide_rate",
    name: "Intentional Homicide Rate",
    description: "Number of intentional homicides per 100,000 population",
    category: "security",
    unit: "per 100k",
    higherIsBetter: false,
    valueMin: 0,
    valueMax: null,
    defaultSourceId: "unodc",
  },
  {
    id: "gini_index",
    name: "Gini Index",
    description: "Measure of income inequality, 0 is perfect equality, 100 is perfect inequality",
    category: "economy",
    unit: "index (0–100)",
    higherIsBetter: false,
    valueMin: 0,
    valueMax: 100,
    defaultSourceId: "world_bank",
  },
  {
    id: "school_enrollment_tertiary",
    name: "School Enrollment, Tertiary",
    description: "Gross enrollment ratio in tertiary education regardless of age",
    category: "education",
    unit: "percent",
    higherIsBetter: true,
    valueMin: 0,
    valueMax: null,
    defaultSourceId: "world_bank",
  },
];

async function main() {
  console.log("Seeding sources table...");

  for (const source of SOURCES) {
    await db
      .insert(sources)
      .values(source)
      .onConflictDoUpdate({
        target: sources.id,
        set: {
          name: source.name,
          baseUrl: source.baseUrl,
          license: source.license,
          isCommercialUseAllowed: source.isCommercialUseAllowed,
        },
      });
    console.log(`  ✓ ${source.id}`);
  }

  console.log(`Done. ${SOURCES.length} sources seeded.`);

  console.log("\nSeeding metric definitions...");
  for (const metric of METRIC_DEFINITIONS) {
    await db
      .insert(metricDefinitions)
      .values(metric)
      .onConflictDoUpdate({
        target: metricDefinitions.id,
        set: {
          name: metric.name,
          description: metric.description,
          category: metric.category,
          unit: metric.unit,
          higherIsBetter: metric.higherIsBetter,
          valueMin: metric.valueMin,
          valueMax: metric.valueMax,
          defaultSourceId: metric.defaultSourceId,
        },
      });
    console.log(`  ✓ ${metric.id}`);
  }
  console.log(`Done. ${METRIC_DEFINITIONS.length} metric definitions seeded.`);
}

main().catch((err) => {
  console.error("Failed to seed sources:", err);
  process.exit(1);
});
