/**
 * validate-stable-identifiers — ATL-019 stable entity identity validator.
 *
 * Default mode is DB-FREE and static: it introspects the Drizzle schema
 * (`getTableConfig`) for each of the 8 registered entity kinds and asserts
 * the identity column ATL-019's resolvers use really is that table's
 * PRIMARY KEY / content digest — never a mutable display column
 * (`name`, `election_name`, `heading_label`, `fact_value`, …). A schema
 * edit that quietly repointed a resolver at a display column would fail
 * this check before ever touching a database.
 *
 * `--live` additionally resolves ONE real row of each kind against the
 * production database (read-only SELECTs only — this script never writes)
 * and asserts the resulting `EntityCitation`: strictly Zod-parses, echoes
 * the same id it was asked for (proving the round trip), and carries a
 * release/version/source leg appropriate to its kind.
 *
 * Usage:
 *   npx tsx scripts/validate-stable-identifiers.ts
 *   npx tsx scripts/validate-stable-identifiers.ts --live
 */
import { getTableConfig } from "drizzle-orm/pg-core";
import type { PgTable } from "drizzle-orm/pg-core";

import {
  countryFacts,
  countryMetrics,
  constitutionPassages,
  elections,
  governmentBodies,
  offices,
  organizations,
  persons,
} from "../src/lib/db/schema";
import {
  ENTITY_TYPES,
  STABLE_ENTITY_CITATION_SCHEMA_VERSION,
  buildCitationUrl,
  zEntityCitation,
  type EntityType,
} from "../src/lib/citations/stable-identity";
import { RESEARCH_EVIDENCE_RETENTION_VERSION } from "../src/lib/research/evidence-retention";

function fail(message: string): never {
  throw new Error(`ATL-019 stable-identifier validation failed: ${message}`);
}

// ── Minimal runtime shape for a Drizzle column (mirrors the cast pattern
//    already used by `src/lib/data-dictionary/build.ts`). ──
interface RuntimeColumn {
  name: string;
  primary: boolean;
  isUnique: boolean;
}

interface IdentitySpec {
  entityType: EntityType;
  table: PgTable;
  /** Database column name (snake_case) the resolver keys off. */
  identityColumnName: string;
  /** Database column names that MUST NOT be the table's identity — the
   *  mutable display text a rename would touch. */
  disallowedDisplayColumnNames: string[];
}

const SPECS: IdentitySpec[] = [
  {
    entityType: "fact",
    table: countryFacts,
    identityColumnName: "id",
    disallowedDisplayColumnNames: ["fact_value", "fact_key"],
  },
  {
    entityType: "institution",
    table: governmentBodies,
    identityColumnName: "id",
    disallowedDisplayColumnNames: ["name"],
  },
  {
    entityType: "office",
    table: offices,
    identityColumnName: "id",
    disallowedDisplayColumnNames: ["name"],
  },
  {
    entityType: "person",
    table: persons,
    identityColumnName: "id",
    disallowedDisplayColumnNames: ["name"],
  },
  {
    entityType: "election",
    table: elections,
    identityColumnName: "id",
    disallowedDisplayColumnNames: ["election_name"],
  },
  {
    entityType: "constitution-passage",
    // Content-digest primary key — see
    // `src/lib/constitution/passage-index.ts` (already shipped).
    table: constitutionPassages,
    identityColumnName: "passage_id",
    disallowedDisplayColumnNames: ["heading_label"],
  },
  {
    entityType: "organization",
    table: organizations,
    identityColumnName: "id",
    disallowedDisplayColumnNames: ["name", "full_name", "slug"],
  },
  {
    entityType: "indicator",
    table: countryMetrics,
    identityColumnName: "id",
    disallowedDisplayColumnNames: [],
  },
];

function validateStatic(): void {
  if (SPECS.length !== ENTITY_TYPES.length) {
    fail(
      `registered ${SPECS.length} identity specs but ENTITY_TYPES has ${ENTITY_TYPES.length}`,
    );
  }
  const specKinds = new Set(SPECS.map((s) => s.entityType));
  for (const kind of ENTITY_TYPES) {
    if (!specKinds.has(kind)) fail(`no identity spec registered for '${kind}'`);
  }

  for (const spec of SPECS) {
    const config = getTableConfig(spec.table);
    const columns = config.columns as unknown as RuntimeColumn[];

    const idCol = columns.find((c) => c.name === spec.identityColumnName);
    if (!idCol) {
      fail(
        `${spec.entityType}: identity column '${spec.identityColumnName}' not found on table '${config.name}'`,
      );
    }
    if (!idCol.primary) {
      fail(
        `${spec.entityType}: identity column '${spec.identityColumnName}' on '${config.name}' is not a primary key`,
      );
    }

    for (const displayName of spec.disallowedDisplayColumnNames) {
      if (displayName === spec.identityColumnName) {
        fail(
          `${spec.entityType}: identity column must not equal disallowed display column '${displayName}'`,
        );
      }
      const displayCol = columns.find((c) => c.name === displayName);
      if (displayCol?.primary) {
        fail(
          `${spec.entityType}: disallowed display column '${displayName}' on '${config.name}' is ALSO a primary key — a rename would break the identity`,
        );
      }
    }
  }
}

async function validateLive(): Promise<void> {
  const { config } = await import("dotenv");
  config({ path: ".env.local", override: true });
  if (!process.env.DATABASE_URL) fail("DATABASE_URL is required for --live");

  const { db } = await import("../src/lib/db");
  const { sql } = await import("drizzle-orm");
  const { ENTITY_CITATION_RESOLVERS } = await import(
    "../src/lib/citations/resolvers"
  );

  const PROBES: Record<EntityType, { table: string; column: string }> = {
    fact: { table: "country_facts", column: "id" },
    institution: { table: "government_bodies", column: "id" },
    office: { table: "offices", column: "id" },
    person: { table: "persons", column: "id" },
    election: { table: "elections", column: "id" },
    "constitution-passage": {
      table: "constitution_passages",
      column: "passage_id",
    },
    organization: { table: "organizations", column: "id" },
    indicator: { table: "country_metrics", column: "id" },
  };

  for (const entityType of ENTITY_TYPES) {
    const probe = PROBES[entityType];
    // Read-only probe — SELECT only, never a write.
    const result = await db.execute(
      sql.raw(
        `SELECT ${probe.column} AS probe_id FROM ${probe.table} LIMIT 1`,
      ),
    );
    const row = (result as unknown as { rows: Record<string, unknown>[] })
      .rows[0];
    if (!row) fail(`${entityType}: '${probe.table}' has no rows to probe`);
    const rawId = String(row.probe_id);
    const id =
      entityType === "constitution-passage"
        ? rawId.replace(/^constitution-passage\//, "")
        : rawId;

    const resolver = ENTITY_CITATION_RESOLVERS[entityType];
    const citation = await resolver(id);
    if (!citation) fail(`${entityType}: resolver returned null for a real row (${id})`);

    const parsed = zEntityCitation.parse(citation);
    if (parsed.schemaVersion !== STABLE_ENTITY_CITATION_SCHEMA_VERSION) {
      fail(`${entityType}: unexpected schemaVersion ${parsed.schemaVersion}`);
    }
    if (parsed.entityType !== entityType) {
      fail(`${entityType}: resolver returned entityType ${parsed.entityType}`);
    }
    if (parsed.id !== id) {
      fail(`${entityType}: citation.id ('${parsed.id}') does not echo the requested id ('${id}')`);
    }
    if (parsed.citationUrl !== buildCitationUrl(entityType, id)) {
      fail(`${entityType}: citationUrl does not match the canonical /api/citations URL`);
    }

    // Release/version/source leg, per kind.
    if (parsed.entityType === "fact" || parsed.entityType === "indicator") {
      if (!parsed.source.sourceId) {
        fail(`${entityType}: live row resolved with no source — release/source leg is missing`);
      }
    } else if (
      parsed.entityType === "institution" ||
      parsed.entityType === "office" ||
      parsed.entityType === "person" ||
      parsed.entityType === "election"
    ) {
      if (parsed.revision.retentionContractVersion !== RESEARCH_EVIDENCE_RETENTION_VERSION) {
        fail(`${entityType}: revision leg is not on the DAT-016 retention contract`);
      }
    } else if (parsed.entityType === "constitution-passage") {
      if (parsed.source.sourceId !== "constitute_project" || !parsed.source.licenseId) {
        fail(`${entityType}: constitution-passage citation is missing source/license`);
      }
    }

    console.log(
      `  ${entityType.padEnd(21)} id=${id.slice(0, 24)}… -> ${parsed.citationUrl}`,
    );
  }
}

async function main() {
  validateStatic();
  console.log(
    `Static: ${SPECS.length}/${ENTITY_TYPES.length} entity kinds have a schema-verified stable-primary-key identity.`,
  );

  if (process.argv.includes("--live")) {
    console.log("\nLive (read-only):");
    await validateLive();
  }

  console.log(
    `\nPASS — stable-entity-citation/v1 identifiers are primary-key/digest bound for all ${ENTITY_TYPES.length} entity kinds${process.argv.includes("--live") ? "; live resolution verified against production." : "."}`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
