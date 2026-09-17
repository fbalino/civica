/**
 * Restore canonical CIA capital facts from retained government sections, then
 * reconcile only the denormalized jurisdiction capital cache.
 *
 * Dry-run is the default. Apply requires both `--apply` and a stable
 * `--release-id=<id>`. The source-of-truth fact/history writes execute in one
 * Neon transaction. The subsequent cache pass is deliberately capital-only:
 * it neither rewrites unrelated cache columns nor advances their shared
 * freshness timestamp.
 */
// civica-affected-relations: atlas_entity_change_history,country_facts,country_factbook_sections,jurisdictions,research_evidence_history,sources,statements
import { config } from "dotenv";

config({ path: ".env.local" });

import { and, eq, sql } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";

import { createServerlessSql, db } from "../src/lib/db";
import {
  countryFacts,
  sources,
} from "../src/lib/db/schema";
import {
  buildCiaCapitalFact,
  canonicalCapitalFactMatches,
  canonicalCapitalSqlParameters,
  CIA_FACTBOOK_SOURCE_URL,
  retainedFactbookDateFromEpoch,
} from "../src/lib/factbook/cia-capital";
import {
  buildCountryFactHistoryStatement,
  resolveAtlasReleaseId,
  type CountryFactHistoryWrite,
} from "../src/lib/factbook/country-fact-history-writer";
import {
  getCanonicalFactsForJurisdictions,
} from "../src/lib/factbook/reconcile/api";
import {
  refreshJurisdictionCache,
  type CacheJurisdiction,
} from "../src/lib/factbook/reconcile/cache";

const SOURCE_ID = "cia_factbook";
const EXPECTED_LICENSE = "public_domain";

interface RetainedRow extends CacheJurisdiction {
  iso3: string | null;
  currentCapital: string | null;
  governmentSection: unknown | null;
  factbookRetrievedAtEpochMs: string | number | null;
}

function rowsFrom<T>(result: unknown): T[] {
  return (Array.isArray(result)
    ? result
    : ((result as { rows?: T[] }).rows ?? [])) as T[];
}

function factNeedsWrite(
  existing: typeof countryFacts.$inferSelect | undefined,
  proposed: CountryFactHistoryWrite["values"],
): boolean {
  if (!existing) return true;
  return !canonicalCapitalFactMatches(existing, proposed);
}

function parseArgs() {
  const args = process.argv.slice(2);
  if (args.includes("--apply") && args.includes("--dry-run")) {
    throw new Error("Pass either --apply or --dry-run, not both");
  }
  return {
    apply: args.includes("--apply"),
    releaseId:
      args.find((arg) => arg.startsWith("--release-id="))?.slice("--release-id=".length) ??
      "",
  };
}

async function loadRetainedRows(): Promise<RetainedRow[]> {
  return rowsFrom<RetainedRow>(
    await db.execute(sql`
      SELECT
        j.id,
        j.slug,
        j.iso3,
        j.capital AS "currentCapital",
        section.section_data AS "governmentSection",
        (
          SELECT EXTRACT(
            EPOCH FROM (MIN(statement.retrieved_at) AT TIME ZONE 'UTC')
          ) * 1000
          FROM statements statement
          WHERE statement.subject_table = 'jurisdictions'
            AND statement.subject_id = j.id
            AND statement.predicate = 'factbook_import'
            AND statement.source_id = ${SOURCE_ID}
        ) AS "factbookRetrievedAtEpochMs"
      FROM jurisdictions j
      LEFT JOIN country_factbook_sections section
        ON section.jurisdiction_id = j.id
       AND section.section_name = 'government'
      ORDER BY j.slug
    `),
  );
}

async function main() {
  const { apply, releaseId: rawReleaseId } = parseArgs();
  const releaseId = apply ? resolveAtlasReleaseId(rawReleaseId) : "dry-run";
  const retainedRows = await loadRetainedRows();
  const jurisdictionIds = retainedRows.map((row) => row.id);

  const sourceRows = await db
    .select({
      baseUrl: sources.baseUrl,
      license: sources.license,
      lastSyncAt: sources.lastSyncAt,
    })
    .from(sources)
    .where(eq(sources.id, SOURCE_ID));
  const source = sourceRows[0];
  if (
    !source ||
    source.baseUrl !== CIA_FACTBOOK_SOURCE_URL ||
    source.license !== EXPECTED_LICENSE
  ) {
    throw new Error(
      `CIA source contract mismatch: expected ${CIA_FACTBOOK_SOURCE_URL} / ${EXPECTED_LICENSE}`,
    );
  }

  const existingFacts = await db
    .select()
    .from(countryFacts)
    .where(
      and(
        eq(countryFacts.sourceId, SOURCE_ID),
        eq(countryFacts.factKey, "capital"),
      ),
    );
  const existingByJurisdiction = new Map(
    existingFacts.map((fact) => [fact.jurisdictionId, fact]),
  );
  const canonicalBefore = await getCanonicalFactsForJurisdictions(
    jurisdictionIds,
    ["capital"],
  );

  const writes: CountryFactHistoryWrite[] = [];
  const proposedByJurisdiction = new Map<
    string,
    { value: string; activeAfterWrite: boolean }
  >();
  const missingPublisherValue: string[] = [];
  const missingRetainedProvenance: string[] = [];
  let governmentSections = 0;
  let inserts = 0;
  let updates = 0;
  let unchanged = 0;

  for (const row of retainedRows) {
    if (row.governmentSection === null) continue;
    governmentSections += 1;
    const fact = buildCiaCapitalFact(row.governmentSection);
    if (!fact) {
      missingPublisherValue.push(row.slug);
      continue;
    }
    if (row.factbookRetrievedAtEpochMs === null) {
      missingRetainedProvenance.push(row.slug);
      continue;
    }

    const existing = existingByJurisdiction.get(row.id);
    const values: CountryFactHistoryWrite["values"] = {
      ...(existing ?? {}),
      jurisdictionId: row.id,
      sourceId: SOURCE_ID,
      ...fact,
      valueJson: null,
      asOf: null,
      retrievedAt: retainedFactbookDateFromEpoch(
        row.factbookRetrievedAtEpochMs,
      ),
      sourceNote: null,
      status: existing?.status ?? "active",
      statusReason: existing?.statusReason ?? null,
    };
    proposedByJurisdiction.set(row.id, {
      value: fact.factValue,
      activeAfterWrite: (existing?.status ?? "active") === "active",
    });
    if (!factNeedsWrite(existing, values)) {
      unchanged += 1;
      continue;
    }
    if (existing) updates += 1;
    else inserts += 1;
    writes.push({
      values,
      history: {
        changeKind: "substantive_revision",
        reason:
          "Restore the omitted canonical capital observation from the retained CIA Factbook government section",
        methodologyVersion: "v0.2-beta",
        releaseId,
      },
      // Default true: a source repair must not reactivate a reviewer-demoted
      // or rejected row.
    });
  }

  const expectedCapitalByJurisdiction = new Map<string, string | null>();
  for (const row of retainedRows) {
    const proposal = proposedByJurisdiction.get(row.id);
    expectedCapitalByJurisdiction.set(
      row.id,
      proposal?.activeAfterWrite
        ? proposal.value
        : (canonicalBefore[row.id]?.capital?.canonical?.factValue ?? null),
    );
  }
  const projectedCacheTargets = retainedRows.filter(
    (row) =>
      row.currentCapital !== expectedCapitalByJurisdiction.get(row.id),
  );

  const report = {
    schemaVersion: "civica-canonical-capital-backfill-plan/v1",
    mode: apply ? "authorized_apply" : "zero_write",
    releaseId: apply ? releaseId : null,
    jurisdictions: retainedRows.length,
    governmentSections,
    retainedCapitalValues: proposedByJurisdiction.size,
    missingPublisherValues: missingPublisherValue.length,
    missingGovernmentSections: retainedRows.length - governmentSections,
    missingRetainedProvenance: missingRetainedProvenance.length,
    canonicalCapitalFactsBefore: existingFacts.length,
    canonicalFactInserts: inserts,
    canonicalFactUpdates: updates,
    canonicalFactsUnchanged: unchanged,
    canonicalFactsToWrite: writes.length,
    projectedCapitalCacheWrites: projectedCacheTargets.length,
    sourceLastSyncAtBefore: source.lastSyncAt,
    writesPerformed: 0,
    sample: projectedCacheTargets.slice(0, 10).map((row) => ({
      slug: row.slug,
      before: row.currentCapital,
      after: expectedCapitalByJurisdiction.get(row.id),
    })),
  };

  if (!apply) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }
  if (missingRetainedProvenance.length > 0) {
    throw new Error(
      `Refusing apply: ${missingRetainedProvenance.length} capital value(s) lack retained factbook_import retrieval provenance`,
    );
  }

  if (writes.length > 0) {
    const dialect = new PgDialect();
    const sqlClient = createServerlessSql(process.env.DATABASE_URL!);
    const queries = writes.map((write) => {
      const compiled = dialect.sqlToQuery(
        buildCountryFactHistoryStatement(write),
      );
      return sqlClient.query(
        compiled.sql,
        canonicalCapitalSqlParameters(compiled.params),
      );
    });
    const results = await sqlClient.transaction(queries);
    const incomplete = results.filter(
      (rows) => rows[0]?.history_written !== true,
    );
    if (incomplete.length > 0) {
      throw new Error(
        `${incomplete.length} canonical capital write(s) lacked an atomic history event`,
      );
    }
  }

  const canonicalAfter = await getCanonicalFactsForJurisdictions(
    jurisdictionIds,
    ["capital"],
  );
  const cacheTargets = retainedRows.filter(
    (row) =>
      row.currentCapital !==
      (canonicalAfter[row.id]?.capital?.canonical?.factValue ?? null),
  );
  const cacheSummary = await refreshJurisdictionCache(db, {
    jurisdictions: cacheTargets,
    fields: ["capital"],
    resolveFacts: async (jurisdictionId) =>
      canonicalAfter[jurisdictionId] ?? {},
  });
  if (cacheSummary.errors.length > 0) {
    throw new Error(
      `Canonical facts committed but capital cache refresh failed: ${cacheSummary.errors.join("; ")}`,
    );
  }

  const sourceAfter = await db
    .select({ lastSyncAt: sources.lastSyncAt })
    .from(sources)
    .where(eq(sources.id, SOURCE_ID));
  if (
    new Date(source.lastSyncAt!).getTime() !==
    new Date(sourceAfter[0]?.lastSyncAt ?? "").getTime()
  ) {
    throw new Error("Repair advanced CIA source freshness unexpectedly");
  }

  console.log(
    JSON.stringify(
      {
        ...report,
        writesPerformed: writes.length,
        capitalCacheWrites: cacheTargets.length,
        capitalCacheFieldsWritten: cacheSummary.fieldsWritten,
        capitalCacheFieldsCleared: cacheSummary.fieldsCleared,
        sourceLastSyncAtAfter: sourceAfter[0]?.lastSyncAt ?? null,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
