/**
 * DAT-001 registry for production ingestion entrypoints that are not derived
 * from `vercel.json` cron routes. Scheduled routes are discovered directly
 * from the deployment manifest; this list closes manual/seeded Atlas, Index,
 * and Conditions producers that would otherwise be invisible to that scan.
 */

export interface ProductionAdapterEntrypoint {
  id: string;
  product: "atlas" | "index" | "conditions";
  sources: readonly string[];
  entrypoint: string;
  implementationPaths: readonly string[];
}

export const MANUAL_PRODUCTION_ADAPTERS: readonly ProductionAdapterEntrypoint[] =
  [
    {
      id: "atlas.cia-factbook",
      product: "atlas",
      sources: ["cia_factbook"],
      entrypoint: "scripts/seed-from-factbook.ts",
      implementationPaths: ["scripts/seed-from-factbook.ts"],
    },
    {
      id: "atlas.constitutions",
      product: "atlas",
      sources: ["constitute_project"],
      entrypoint: "scripts/sync-constitutions.ts",
      implementationPaths: [
        "scripts/sync-constitutions.ts",
        "src/lib/constitute/sync-constitutions.ts",
      ],
    },
    {
      id: "atlas.elections",
      product: "atlas",
      sources: ["ipu_parline", "international_idea", "wikidata"],
      entrypoint: "scripts/sync-elections-ipu.ts",
      implementationPaths: [
        "scripts/sync-elections-ipu.ts",
        "scripts/sync-elections-turnout-idea.ts",
        "scripts/sync-elections-wikidata.ts",
      ],
    },
    {
      id: "atlas.legislatures-parties",
      product: "atlas",
      sources: ["ipu_parline", "wikidata"],
      entrypoint: "scripts/sync-ipu-parline.ts",
      implementationPaths: [
        "scripts/sync-ipu-parline.ts",
        "scripts/sync-wikidata-parties.ts",
      ],
    },
    {
      id: "atlas.party-positions",
      product: "atlas",
      sources: ["vparty"],
      entrypoint: "scripts/ingest-vparty-positions.ts",
      implementationPaths: ["scripts/ingest-vparty-positions.ts"],
    },
    {
      id: "atlas.government-taxonomy",
      product: "atlas",
      sources: ["bjornskov_rode", "cia_factbook", "wikidata"],
      entrypoint: "scripts/ingest-government-taxonomy-br.ts",
      implementationPaths: [
        "scripts/ingest-government-taxonomy-br.ts",
        "scripts/derive-government-taxonomy.ts",
        "src/lib/government-taxonomy/index.ts",
      ],
    },
    {
      id: "atlas.country-metrics",
      product: "atlas",
      sources: ["world_bank", "undp_hdi", "transparency_intl"],
      entrypoint: "scripts/sync-world-bank-metrics.ts",
      implementationPaths: [
        "scripts/sync-world-bank-metrics.ts",
        "scripts/derive-country-metric-hdi.ts",
        "scripts/sync-transparency-cpi.ts",
      ],
    },
    {
      id: "atlas.indicator-history",
      product: "atlas",
      sources: [
        "vdem",
        "worldbank_wgi",
        "freedom_house",
        "transparency_intl",
        "undp_hdi",
      ],
      entrypoint: "scripts/ingest-indicator-history.ts",
      implementationPaths: [
        "scripts/ingest-indicator-history.ts",
        "src/lib/ci/history-adapters.ts",
      ],
    },
    {
      id: "index.current-beta",
      product: "index",
      sources: ["vdem", "worldbank_wgi", "freedom_house", "transparency_intl"],
      entrypoint: "scripts/ingest-ci-all.ts",
      implementationPaths: [
        "scripts/ingest-ci-all.ts",
        "scripts/ingest-ci-vdem.ts",
        "scripts/ingest-ci-wgi.ts",
        "scripts/ingest-ci-wgi-democracy-fallback.ts",
        "scripts/ingest-ci-freedom-house.ts",
        "scripts/ingest-ci-cpi.ts",
        "src/lib/ci/ingest.ts",
        "src/lib/ci/production-source-adapters.ts",
        "src/lib/ci/source-utils.ts",
        "src/lib/ci/production-release-coverage.generated.json",
      ],
    },
    {
      id: "conditions.current-beta",
      product: "conditions",
      sources: ["undp_hdi", "global_peace_index", "worldbank_economic"],
      entrypoint: "scripts/ingest-conditions-hdi.ts",
      implementationPaths: [
        "scripts/ingest-conditions-hdi.ts",
        "scripts/ingest-conditions-gpi.ts",
        "scripts/ingest-conditions-economic.ts",
      ],
    },
  ] as const;
