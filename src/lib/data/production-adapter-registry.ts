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
  canonicalNpmScript: string;
  entrypoint: string;
  implementationPaths: readonly string[];
}

export interface ScheduledProductionAdapter {
  id: string;
  route: string;
  inputKind: "external" | "derived";
  sources: readonly string[];
  implementationPaths: readonly string[];
}

/**
 * Source ownership for every deployed cron route. `vercel.json` remains the
 * schedule authority; this registry adds the source/input meaning that a URL
 * alone cannot express. Derived stages must name their upstream stage in the
 * input manifest rather than pretending they fetched a publisher artifact.
 */
export const SCHEDULED_PRODUCTION_ADAPTERS: readonly ScheduledProductionAdapter[] =
  [
    {
      id: "bills.us",
      route: "/api/cron/bills/us",
      inputKind: "external",
      sources: ["congress_gov"],
      implementationPaths: ["src/lib/bills/sources/us-congress.ts"],
    },
    {
      id: "bills.uk",
      route: "/api/cron/bills/uk",
      inputKind: "external",
      sources: ["uk_parliament"],
      implementationPaths: ["src/lib/bills/sources/uk-parliament.ts"],
    },
    {
      id: "bills.ca",
      route: "/api/cron/bills/ca",
      inputKind: "external",
      sources: ["legisinfo_ca"],
      implementationPaths: ["src/lib/bills/sources/legisinfo-ca.ts"],
    },
    {
      id: "bills.br",
      route: "/api/cron/bills/br",
      inputKind: "external",
      sources: ["camara_br", "senado_br"],
      implementationPaths: ["src/lib/bills/sources/camara-senado-br.ts"],
    },
    {
      id: "bills.de",
      route: "/api/cron/bills/de",
      inputKind: "external",
      sources: ["bundestag_dip"],
      implementationPaths: ["src/lib/bills/sources/bundestag-dip.ts"],
    },
    {
      id: "bills.fr",
      route: "/api/cron/bills/fr",
      inputKind: "external",
      sources: ["data_assemblee_fr", "senat_fr"],
      implementationPaths: ["src/lib/bills/sources/an-senat-fr.ts"],
    },
    {
      id: "factbook.wikidata",
      route: "/api/cron/factbook/sync-wikidata",
      inputKind: "external",
      sources: ["wikidata"],
      implementationPaths: ["src/lib/factbook/reconcile/wikidata-client.ts"],
    },
    {
      id: "factbook.officeholders",
      route: "/api/cron/factbook/sync-officeholders",
      inputKind: "external",
      sources: ["wikidata"],
      implementationPaths: ["src/lib/factbook/officeholders-sync.ts"],
    },
    {
      id: "factbook.cia-cabinets",
      route: "/api/cron/factbook/sync-cia-cabinets",
      inputKind: "external",
      sources: ["cia_world_leaders"],
      implementationPaths: ["src/lib/factbook/cia-cabinets-sync.ts"],
    },
    {
      id: "factbook.refresh-cache",
      route: "/api/cron/factbook/refresh-cache",
      inputKind: "derived",
      sources: [],
      implementationPaths: ["src/app/api/cron/factbook/refresh-cache/route.ts"],
    },
    {
      id: "factbook.classifications",
      route: "/api/cron/factbook/sync-classifications",
      inputKind: "external",
      sources: ["world_bank", "vdem", "cia_factbook"],
      implementationPaths: [
        "src/lib/factbook/reconcile/sync-classifications.ts",
      ],
    },
    {
      id: "factbook.wdi",
      route: "/api/cron/factbook/sync-wdi",
      inputKind: "external",
      sources: ["world_bank"],
      implementationPaths: ["src/lib/factbook/reconcile/sync-wdi.ts"],
    },
    {
      id: "factbook.imf-weo",
      route: "/api/cron/factbook/sync-imf-weo",
      inputKind: "external",
      sources: ["imf_weo"],
      implementationPaths: ["src/lib/factbook/reconcile/sync-imf-weo.ts"],
    },
    {
      id: "factbook.un-data",
      route: "/api/cron/factbook/sync-un-data",
      inputKind: "external",
      sources: ["un_data"],
      implementationPaths: ["src/lib/factbook/reconcile/sync-un-data.ts"],
    },
    {
      id: "factbook.who-gho",
      route: "/api/cron/factbook/sync-who-gho",
      inputKind: "external",
      sources: ["who_gho"],
      implementationPaths: ["src/lib/factbook/reconcile/sync-who-gho.ts"],
    },
    {
      id: "factbook.unesco-uis",
      route: "/api/cron/factbook/sync-unesco-uis",
      inputKind: "external",
      sources: ["unesco_uis"],
      implementationPaths: ["src/lib/factbook/reconcile/sync-unesco-uis.ts"],
    },
    {
      id: "factbook.undp-hdi",
      route: "/api/cron/factbook/sync-undp-hdi",
      inputKind: "external",
      sources: ["undp_hdi"],
      implementationPaths: ["src/lib/factbook/reconcile/sync-undp-hdi.ts"],
    },
    {
      id: "factbook.oecd-stat",
      route: "/api/cron/factbook/sync-oecd-stat",
      inputKind: "external",
      sources: ["oecd_stat"],
      implementationPaths: ["src/lib/factbook/reconcile/sync-oecd-stat.ts"],
    },
    {
      id: "factbook.fao-faostat",
      route: "/api/cron/factbook/sync-fao-faostat",
      inputKind: "external",
      sources: ["fao_faostat"],
      implementationPaths: ["src/lib/factbook/reconcile/sync-fao-faostat.ts"],
    },
    {
      id: "factbook.ilo-ilostat",
      route: "/api/cron/factbook/sync-ilo-ilostat",
      inputKind: "external",
      sources: ["ilo_ilostat"],
      implementationPaths: ["src/lib/factbook/reconcile/sync-ilo-ilostat.ts"],
    },
    {
      id: "factbook.eurostat",
      route: "/api/cron/factbook/sync-eurostat",
      inputKind: "external",
      sources: ["eurostat"],
      implementationPaths: ["src/lib/factbook/reconcile/sync-eurostat.ts"],
    },
    {
      id: "factbook.wto-stats",
      route: "/api/cron/factbook/sync-wto-stats",
      inputKind: "external",
      sources: ["wto_stats"],
      implementationPaths: ["src/lib/factbook/reconcile/sync-wto-stats.ts"],
    },
    {
      id: "factbook.insee-fr",
      route: "/api/cron/factbook/sync-insee-fr",
      inputKind: "external",
      sources: ["insee_fr"],
      implementationPaths: ["src/lib/factbook/reconcile/sync-insee-fr.ts"],
    },
    {
      id: "factbook.us-census",
      route: "/api/cron/factbook/sync-us-census",
      inputKind: "external",
      sources: ["us_census"],
      implementationPaths: ["src/lib/factbook/reconcile/sync-us-census.ts"],
    },
    {
      id: "factbook.ons-uk",
      route: "/api/cron/factbook/sync-ons-uk",
      inputKind: "external",
      sources: ["ons_uk"],
      implementationPaths: ["src/lib/factbook/reconcile/sync-ons-uk.ts"],
    },
    {
      id: "factbook.ibge-br",
      route: "/api/cron/factbook/sync-ibge-br",
      inputKind: "external",
      sources: ["ibge_br"],
      implementationPaths: ["src/lib/factbook/reconcile/sync-ibge-br.ts"],
    },
    {
      id: "factbook.statcan-ca",
      route: "/api/cron/factbook/sync-statcan-ca",
      inputKind: "external",
      sources: ["statcan_ca"],
      implementationPaths: ["src/lib/factbook/reconcile/sync-statcan-ca.ts"],
    },
    {
      id: "factbook.stats-sa",
      route: "/api/cron/factbook/sync-stats-sa",
      inputKind: "external",
      sources: ["stats_sa"],
      implementationPaths: ["src/lib/factbook/reconcile/sync-stats-sa.ts"],
    },
    {
      id: "factbook.auto-resolve",
      route: "/api/cron/factbook/auto-resolve-disputes",
      inputKind: "derived",
      sources: [],
      implementationPaths: [
        "src/app/api/cron/factbook/auto-resolve-disputes/route.ts",
      ],
    },
    {
      id: "factbook.snapshot-vintage",
      route: "/api/cron/factbook/snapshot-vintage",
      inputKind: "derived",
      sources: [],
      implementationPaths: [
        "src/app/api/cron/factbook/snapshot-vintage/route.ts",
      ],
    },
    {
      id: "factbook.verify-reconciliation",
      route: "/api/cron/factbook/verify-reconciliation",
      inputKind: "derived",
      sources: [],
      implementationPaths: [
        "src/app/api/cron/factbook/verify-reconciliation/route.ts",
      ],
    },
    {
      id: "pulse.v2.ingest",
      route: "/api/cron/pulse/v2/ingest",
      inputKind: "external",
      sources: ["amnesty", "civicus_monitor", "gdelt", "hrw"],
      implementationPaths: ["src/lib/pulse/v2/ingest.ts"],
    },
    {
      id: "pulse.v2.cluster",
      route: "/api/cron/pulse/v2/cluster",
      inputKind: "derived",
      sources: [],
      implementationPaths: ["src/lib/pulse/v2/cluster.ts"],
    },
    {
      id: "pulse.v2.classify",
      route: "/api/cron/pulse/v2/classify",
      inputKind: "derived",
      sources: [],
      implementationPaths: ["src/lib/pulse/v2/classify.ts"],
    },
    {
      id: "pulse.v2.score",
      route: "/api/cron/pulse/v2/score",
      inputKind: "derived",
      sources: [],
      implementationPaths: ["src/lib/pulse/v2/score.ts"],
    },
    {
      id: "pulse.v2.review-sla",
      route: "/api/cron/pulse/v2/review-sla",
      inputKind: "derived",
      sources: [],
      implementationPaths: [
        "src/app/api/cron/pulse/v2/review-sla/route.ts",
        "src/lib/pulse/v2/review-sla-store.ts",
      ],
    },
    {
      id: "operations.error-alerts",
      route: "/api/cron/operations/error-alerts",
      inputKind: "derived",
      sources: [],
      implementationPaths: [
        "src/app/api/cron/operations/error-alerts/route.ts",
        "src/lib/platform/error-monitoring.ts",
      ],
    },
    {
      id: "operations.pipeline-alerts",
      route: "/api/cron/operations/pipeline-alerts",
      inputKind: "derived",
      sources: [],
      implementationPaths: [
        "src/app/api/cron/operations/pipeline-alerts/route.ts",
        "src/lib/platform/pipeline-observability.ts",
      ],
    },
  ] as const;

export const MANUAL_PRODUCTION_ADAPTERS: readonly ProductionAdapterEntrypoint[] =
  [
    {
      id: "atlas.cia-factbook",
      product: "atlas",
      sources: ["cia_factbook"],
      canonicalNpmScript: "seed:factbook",
      entrypoint: "scripts/seed-from-factbook.ts",
      implementationPaths: ["scripts/seed-from-factbook.ts"],
    },
    {
      id: "atlas.organization-memberships",
      product: "atlas",
      sources: ["civica_organization_roster_v1"],
      canonicalNpmScript: "sync:organization-memberships",
      entrypoint: "scripts/sync-organization-memberships.ts",
      implementationPaths: [
        "scripts/sync-organization-memberships.ts",
        "src/lib/organizations/membership-release.ts",
      ],
    },
    {
      id: "atlas.constitutions",
      product: "atlas",
      sources: ["constitute_project"],
      canonicalNpmScript: "sync:constitutions",
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
      canonicalNpmScript: "sync:elections-ipu",
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
      canonicalNpmScript: "sync:ipu",
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
      canonicalNpmScript: "ingest:vparty",
      entrypoint: "scripts/ingest-vparty-positions.ts",
      implementationPaths: ["scripts/ingest-vparty-positions.ts"],
    },
    {
      id: "atlas.government-taxonomy",
      product: "atlas",
      sources: ["bjornskov_rode", "cia_factbook", "wikidata"],
      canonicalNpmScript: "sync:government-taxonomy",
      entrypoint: "scripts/ingest-government-taxonomy-br.ts",
      implementationPaths: [
        "scripts/ingest-government-taxonomy-br.ts",
        "scripts/derive-government-taxonomy.ts",
        "src/lib/government-taxonomy/index.ts",
        "src/lib/government-taxonomy/writer.ts",
      ],
    },
    {
      id: "atlas.country-metrics",
      product: "atlas",
      sources: ["world_bank", "undp_hdi", "transparency_intl"],
      canonicalNpmScript: "sync:country-metrics",
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
      canonicalNpmScript: "ingest:indicator-history",
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
      canonicalNpmScript: "ingest:ci",
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
      canonicalNpmScript: "ingest:conditions:all",
      entrypoint: "scripts/ingest-conditions-hdi.ts",
      implementationPaths: [
        "scripts/ingest-conditions-hdi.ts",
        "scripts/ingest-conditions-gpi.ts",
        "scripts/ingest-conditions-economic.ts",
      ],
    },
  ] as const;
