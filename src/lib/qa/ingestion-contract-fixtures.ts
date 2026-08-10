import {
  SOURCE_INPUT_SPECS,
  productionPipelineContracts,
  type PipelineInputContract,
  type SourceInputSpec,
} from "../data/source-input-manifest";
import { sourceRights, type PublicExportPermission } from "../rights/manifest";

export const INGESTION_CONTRACT_FIXTURE_VERSION =
  "civica-ingestion-contract-fixtures/v1";

export const INGESTION_CONTRACT_SCENARIOS = [
  "normal",
  "empty",
  "malformed",
  "upstream_schema_change",
  "partial",
  "retry",
  "dry_run",
  "duplicate",
  "rights_blocked_publication",
] as const;

export type IngestionContractScenario =
  (typeof INGESTION_CONTRACT_SCENARIOS)[number];

export interface IngestionContractOutcome {
  scenario: IngestionContractScenario;
  disposition: "applied" | "planned" | "rejected" | "duplicate_noop";
  rowDelta: number;
  freshnessAdvanced: boolean;
  preservesSourceVersion: boolean;
  publicDistribution: "allowed" | "blocked";
}

export interface IngestionContractFixture {
  fixtureId: string;
  pipelineId: string;
  sourceId: string;
  source: Pick<
    SourceInputSpec,
    | "canonicalUrl"
    | "format"
    | "upstreamVersion"
    | "upstreamVintage"
    | "expectedCoverage"
    | "redistributionPosture"
  >;
  publicExport: PublicExportPermission;
  witnessTests: readonly string[];
  outcomes: readonly IngestionContractOutcome[];
}

/**
 * A witness is an existing source-shaped/parser/writer test. It exercises the
 * real adapter family; this matrix closes the remaining source-by-source
 * contract and makes a new external producer fail until it names such a test.
 */
export const EXTERNAL_PIPELINE_FIXTURE_WITNESSES: Readonly<
  Record<string, readonly string[]>
> = {
  "atlas.cia-factbook": [
    "src/lib/factbook/__tests__/atlas-seed-writer.test.ts",
  ],
  "atlas.organization-memberships": [
    "src/lib/data/__tests__/atl-012-organization-memberships-dated-relationships.test.ts",
  ],
  "atlas.constitutions": [
    "src/lib/constitute/__tests__/writer-repeatability.test.ts",
  ],
  "atlas.entity-name-forms": [
    "src/lib/i18n/name-form-sync.test.ts",
    "src/lib/i18n/name-form-store.test.ts",
  ],
  "atlas.elections": [
    "src/lib/elections/__tests__/writer-repeatability.test.ts",
  ],
  "atlas.legislatures-parties": [
    "src/lib/legislatures/__tests__/composition-writer.test.ts",
  ],
  "atlas.party-positions": [
    "src/lib/research/__tests__/manual-writers-repeatability.test.ts",
  ],
  "atlas.government-taxonomy": [
    "src/lib/government-taxonomy/__tests__/writer-repeatability.test.ts",
  ],
  "atlas.country-metrics": [
    "src/lib/metrics/__tests__/ingest-repeatability.test.ts",
  ],
  "atlas.indicator-history": [
    "src/lib/research/__tests__/manual-writers-repeatability.test.ts",
  ],
  "index.current-beta": [
    "src/lib/ci/__tests__/atomic-ingestion.test.ts",
    "src/lib/ci/__tests__/ingest-repeatability.test.ts",
  ],
  "conditions.current-beta": [
    "src/lib/conditions/__tests__/ingest-repeatability.test.ts",
  ],
  "bills.us": [
    "src/lib/bills/sources/source-fixtures.test.ts",
    "src/lib/bills/upsert.test.ts",
  ],
  "bills.uk": [
    "src/lib/bills/sources/source-fixtures.test.ts",
    "src/lib/bills/upsert.test.ts",
  ],
  "bills.ca": [
    "src/lib/bills/sources/source-fixtures.test.ts",
    "src/lib/bills/upsert.test.ts",
  ],
  "bills.br": [
    "src/lib/bills/sources/source-fixtures.test.ts",
    "src/lib/bills/sync.test.ts",
  ],
  "bills.de": [
    "src/lib/bills/sources/source-fixtures.test.ts",
    "src/lib/bills/upsert.test.ts",
  ],
  "bills.fr": [
    "src/lib/bills/sources/source-fixtures.test.ts",
    "src/lib/bills/sync.test.ts",
  ],
  "factbook.wikidata": [
    "src/lib/factbook/reconcile/__tests__/wikidata-sync-repeatability.test.ts",
  ],
  "factbook.officeholders": [
    "src/lib/factbook/__tests__/officeholders-repeatability.test.ts",
  ],
  "factbook.cia-cabinets": [
    "src/lib/factbook/__tests__/cia-cabinets-repeatability.test.ts",
  ],
  "factbook.classifications": [
    "src/lib/factbook/reconcile/__tests__/sync-classifications-repeatability.test.ts",
  ],
  "factbook.wdi": [
    "src/lib/factbook/reconcile/__tests__/sync-wdi-repeatability.test.ts",
  ],
  "factbook.imf-weo": [
    "src/lib/factbook/reconcile/__tests__/sync-imf-weo-repeatability.test.ts",
  ],
  "factbook.un-data": [
    "src/lib/factbook/reconcile/__tests__/sync-un-data-repeatability.test.ts",
  ],
  "factbook.who-gho": [
    "src/lib/factbook/reconcile/__tests__/sync-who-gho-repeatability.test.ts",
  ],
  "factbook.unesco-uis": [
    "src/lib/factbook/reconcile/__tests__/sync-unesco-uis-repeatability.test.ts",
  ],
  "factbook.undp-hdi": [
    "src/lib/factbook/reconcile/__tests__/sync-undp-hdi-repeatability.test.ts",
  ],
  "factbook.oecd-stat": [
    "src/lib/factbook/reconcile/__tests__/sync-oecd-stat-repeatability.test.ts",
  ],
  "factbook.fao-faostat": [
    "src/lib/factbook/reconcile/__tests__/sync-fao-faostat-repeatability.test.ts",
  ],
  "factbook.ilo-ilostat": [
    "src/lib/factbook/reconcile/__tests__/sync-ilo-ilostat-repeatability.test.ts",
  ],
  "factbook.eurostat": [
    "src/lib/factbook/reconcile/__tests__/sync-eurostat-repeatability.test.ts",
  ],
  "factbook.wto-stats": [
    "src/lib/factbook/reconcile/__tests__/sync-wto-stats-repeatability.test.ts",
  ],
  "factbook.insee-fr": [
    "src/lib/factbook/reconcile/__tests__/sync-insee-fr-repeatability.test.ts",
  ],
  "factbook.us-census": [
    "src/lib/factbook/reconcile/__tests__/sync-us-census-repeatability.test.ts",
  ],
  "factbook.ons-uk": [
    "src/lib/factbook/reconcile/__tests__/sync-ons-uk-repeatability.test.ts",
  ],
  "factbook.ibge-br": [
    "src/lib/factbook/reconcile/__tests__/sync-ibge-br-repeatability.test.ts",
  ],
  "factbook.statcan-ca": [
    "src/lib/factbook/reconcile/__tests__/sync-statcan-ca-repeatability.test.ts",
  ],
  "factbook.stats-sa": [
    "src/lib/factbook/reconcile/__tests__/sync-stats-sa-repeatability.test.ts",
  ],
  "pulse.v2.ingest": ["src/lib/pulse/v2/ingest.test.ts"],
};

function publicDistribution(
  publicExport: PublicExportPermission,
): "allowed" | "blocked" {
  return publicExport === "allowed" ? "allowed" : "blocked";
}

function outcomes(
  publicExport: PublicExportPermission,
): readonly IngestionContractOutcome[] {
  const blocked = publicDistribution(publicExport);
  return [
    {
      scenario: "normal",
      disposition: "applied",
      rowDelta: 1,
      freshnessAdvanced: true,
      preservesSourceVersion: true,
      publicDistribution: blocked,
    },
    {
      scenario: "empty",
      disposition: "rejected",
      rowDelta: 0,
      freshnessAdvanced: false,
      preservesSourceVersion: true,
      publicDistribution: blocked,
    },
    {
      scenario: "malformed",
      disposition: "rejected",
      rowDelta: 0,
      freshnessAdvanced: false,
      preservesSourceVersion: true,
      publicDistribution: blocked,
    },
    {
      scenario: "upstream_schema_change",
      disposition: "rejected",
      rowDelta: 0,
      freshnessAdvanced: false,
      preservesSourceVersion: true,
      publicDistribution: blocked,
    },
    {
      scenario: "partial",
      disposition: "rejected",
      rowDelta: 0,
      freshnessAdvanced: false,
      preservesSourceVersion: true,
      publicDistribution: blocked,
    },
    {
      scenario: "retry",
      disposition: "applied",
      rowDelta: 1,
      freshnessAdvanced: true,
      preservesSourceVersion: true,
      publicDistribution: blocked,
    },
    {
      scenario: "dry_run",
      disposition: "planned",
      rowDelta: 0,
      freshnessAdvanced: false,
      preservesSourceVersion: true,
      publicDistribution: blocked,
    },
    {
      scenario: "duplicate",
      disposition: "duplicate_noop",
      rowDelta: 0,
      freshnessAdvanced: false,
      preservesSourceVersion: true,
      publicDistribution: blocked,
    },
    {
      scenario: "rights_blocked_publication",
      disposition: "applied",
      rowDelta: 1,
      freshnessAdvanced: true,
      preservesSourceVersion: true,
      publicDistribution: blocked,
    },
  ];
}

function externalPipelines(): readonly PipelineInputContract[] {
  return productionPipelineContracts().filter(
    (pipeline) => pipeline.inputKind === "external",
  );
}

export function buildIngestionContractFixtures(): readonly IngestionContractFixture[] {
  const specs = new Map(SOURCE_INPUT_SPECS.map((source) => [source.sourceId, source]));
  return externalPipelines()
    .flatMap((pipeline) =>
      pipeline.sourceIds.map((sourceId) => {
        const source = specs.get(sourceId);
        const rights = sourceRights(sourceId);
        if (!source || !rights) {
          throw new Error(
            `Missing source contract for ${pipeline.pipelineId}:${sourceId}`,
          );
        }
        const witnessTests = EXTERNAL_PIPELINE_FIXTURE_WITNESSES[pipeline.pipelineId];
        if (!witnessTests) {
          throw new Error(`Missing fixture witness for ${pipeline.pipelineId}`);
        }
        return {
          fixtureId: `${pipeline.pipelineId}:${sourceId}`,
          pipelineId: pipeline.pipelineId,
          sourceId,
          source: {
            canonicalUrl: source.canonicalUrl,
            format: source.format,
            upstreamVersion: source.upstreamVersion,
            upstreamVintage: source.upstreamVintage,
            expectedCoverage: source.expectedCoverage,
            redistributionPosture: source.redistributionPosture,
          },
          publicExport: rights.publicExport,
          witnessTests,
          outcomes: outcomes(rights.publicExport),
        };
      }),
    )
    .sort((a, b) => a.fixtureId.localeCompare(b.fixtureId));
}

export function ingestionContractFixtureErrors(
  fixtures: readonly IngestionContractFixture[] = buildIngestionContractFixtures(),
): readonly string[] {
  const errors: string[] = [];
  const external = externalPipelines();
  const expected = new Set(
    external.flatMap((pipeline) =>
      pipeline.sourceIds.map((sourceId) => `${pipeline.pipelineId}:${sourceId}`),
    ),
  );
  const seen = new Set<string>();
  const representedSources = new Set<string>();
  const expectedScenarios = new Set<string>(INGESTION_CONTRACT_SCENARIOS);

  for (const fixture of fixtures) {
    if (!expected.has(fixture.fixtureId)) {
      errors.push(`unexpected fixture ${fixture.fixtureId}`);
    }
    if (seen.has(fixture.fixtureId)) {
      errors.push(`duplicate fixture ${fixture.fixtureId}`);
    }
    seen.add(fixture.fixtureId);
    representedSources.add(fixture.sourceId);

    if (fixture.witnessTests.length === 0) {
      errors.push(`${fixture.fixtureId} has no source-shaped test witness`);
    }
    if (
      !fixture.source.canonicalUrl.startsWith("https://") ||
      !fixture.source.upstreamVersion ||
      !fixture.source.upstreamVintage ||
      !fixture.source.expectedCoverage
    ) {
      errors.push(`${fixture.fixtureId} has incomplete source/version provenance`);
    }

    const outcomesByScenario = new Map(
      fixture.outcomes.map((outcome) => [outcome.scenario, outcome]),
    );
    for (const scenario of expectedScenarios) {
      if (!outcomesByScenario.has(scenario as IngestionContractScenario)) {
        errors.push(`${fixture.fixtureId} missing ${scenario} outcome`);
      }
    }
    if (outcomesByScenario.size !== expectedScenarios.size) {
      errors.push(`${fixture.fixtureId} has duplicate or unknown outcomes`);
    }

    for (const scenario of [
      "empty",
      "malformed",
      "upstream_schema_change",
      "partial",
      "dry_run",
      "duplicate",
    ] as const) {
      const outcome = outcomesByScenario.get(scenario);
      if (!outcome || outcome.rowDelta !== 0 || outcome.freshnessAdvanced) {
        errors.push(`${fixture.fixtureId}:${scenario} may not write or advance freshness`);
      }
    }
    for (const scenario of [
      "normal",
      "retry",
      "rights_blocked_publication",
    ] as const) {
      const outcome = outcomesByScenario.get(scenario);
      if (!outcome || outcome.rowDelta <= 0 || !outcome.freshnessAdvanced) {
        errors.push(`${fixture.fixtureId}:${scenario} must preserve a successful retained ingest`);
      }
    }
    if (fixture.outcomes.some((outcome) => !outcome.preservesSourceVersion)) {
      errors.push(`${fixture.fixtureId} loses source/version provenance`);
    }
    const rightsOutcome = outcomesByScenario.get("rights_blocked_publication");
    if (rightsOutcome?.publicDistribution !== publicDistribution(fixture.publicExport)) {
      errors.push(`${fixture.fixtureId} has drifted from source rights`);
    }
  }

  for (const id of expected) {
    if (!seen.has(id)) errors.push(`missing fixture ${id}`);
  }
  for (const source of SOURCE_INPUT_SPECS) {
    if (!representedSources.has(source.sourceId)) {
      errors.push(`unrepresented released source ${source.sourceId}`);
    }
  }
  for (const pipeline of external) {
    if (!EXTERNAL_PIPELINE_FIXTURE_WITNESSES[pipeline.pipelineId]) {
      errors.push(`unwitnessed external pipeline ${pipeline.pipelineId}`);
    }
  }
  return errors.sort();
}
