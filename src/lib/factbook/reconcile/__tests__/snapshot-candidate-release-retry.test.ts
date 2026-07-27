import assert from "node:assert/strict";
import test from "node:test";

import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";

import * as schema from "@/lib/db/schema";
import { buildCandidateReleasePackage } from "../candidate-vintage";
import { snapshotCompleteCandidateRelease } from "../snapshot-candidate-release";
import type { FactRow } from "../types";

const LABEL_Q2 =
  "Civica Atlas Reconciled v0.3-beta — vintage 2026-Q2";
const LABEL_Q3 =
  "Civica Atlas Reconciled v0.3-beta — vintage 2026-Q3";
const CUT_Q2 = new Date("2026-07-15T04:00:00.000Z");
const CUT_Q3 = new Date("2026-10-15T04:00:00.000Z");
const JURISDICTION_ID = "11111111-1111-4111-8111-111111111111";
const ADAPTER_HASHES = new Map([["world_bank", "adapter-world-bank-v1"]]);
const RESOLVER_HASH = "resolver-v1";

function factRow(
  id: string,
  retrievedAt = "2026-07-01T00:00:00.000Z",
): FactRow {
  return {
    id,
    jurisdictionId: JURISDICTION_ID,
    factKey: "population_total",
    factGroup: "B",
    category: "demographics",
    sourceId: "world_bank",
    sourceUrl: "https://example.test/world-bank",
    wikidataQid: null,
    wikidataPid: null,
    wikidataRank: null,
    references: null,
    factValue: "3,500,000",
    factValueNumeric: 3_500_000,
    factUnit: "people",
    factYear: 2025,
    valueJson: null,
    valueStatus: "observed",
    valueStatusReason: null,
    asOf: "2025-01-01",
    dataVintageYear: 2025,
    retrievedAt,
    upstreamVintageLabel: "WDI-2025",
    methodologyVersion: "v0.3-beta",
    status: "active",
    statusReason: null,
    sourceNote: null,
    valueType: "measured",
    growthMethodology: null,
  };
}

const fixtureRows = (...rows: FactRow[]) =>
  rows.map((candidate) => ({
    candidate,
    sourceHash: null,
    sourceSnapshotId: null,
  }));

const DDL = `
  CREATE TABLE country_fact_vintage_releases (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    vintage_label text NOT NULL UNIQUE,
    cut_at_timestamp timestamp NOT NULL,
    methodology_version text NOT NULL,
    resolver_version_hash text NOT NULL,
    completeness_status text NOT NULL,
    candidate_count integer,
    winner_count integer NOT NULL,
    candidate_set_checksum text,
    winner_set_checksum text NOT NULL,
    input_manifest jsonb NOT NULL,
    created_at timestamp NOT NULL DEFAULT NOW()
  );
  CREATE TABLE country_fact_vintage_candidates (
    id uuid PRIMARY KEY,
    vintage_label text NOT NULL,
    cut_at_timestamp timestamp NOT NULL,
    jurisdiction_id uuid NOT NULL,
    fact_key text NOT NULL,
    source_id text NOT NULL,
    source_row_id uuid NOT NULL,
    source_hash text,
    source_snapshot_id uuid,
    input_evidence_kind text NOT NULL,
    input_evidence_hash text NOT NULL,
    adapter_version_hash text NOT NULL,
    candidate_content_hash text NOT NULL,
    candidate_status text NOT NULL,
    candidate_payload jsonb NOT NULL,
    is_canonical_at_cut boolean NOT NULL,
    decision_reason text,
    decision_trace jsonb,
    created_at timestamp NOT NULL DEFAULT NOW(),
    UNIQUE (vintage_label, jurisdiction_id, fact_key, source_id)
  );
  CREATE TABLE country_fact_vintages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    jurisdiction_id uuid NOT NULL,
    fact_key text NOT NULL,
    vintage_label text NOT NULL,
    supersedes_vintage_label text,
    observation_reference_year integer,
    upstream_dataset_release text,
    source_retrieved_at timestamp,
    civica_publication_version text,
    canonical_fact_id uuid NOT NULL,
    canonical_candidate_id uuid,
    value_text text,
    value_numeric real,
    value_unit text,
    value_json jsonb,
    as_of date,
    source_id text NOT NULL,
    methodology_version text NOT NULL,
    derivation_version_key text NOT NULL,
    derivation_versions jsonb NOT NULL,
    snapshot_at timestamp NOT NULL DEFAULT NOW(),
    cut_at_timestamp timestamp,
    content_hash text,
    is_disputed_at_cut boolean,
    UNIQUE (jurisdiction_id, fact_key, vintage_label)
  );
`;

function atomicDb(database: PGlite) {
  const db = drizzle(database, { schema }) as unknown as {
    batch: (queries: readonly unknown[]) => Promise<unknown[]>;
  };
  db.batch = async (queries: readonly unknown[]) =>
    database.transaction(async (tx) => {
      const results: unknown[] = [];
      for (const [index, query] of queries.entries()) {
        const compilable = query as {
          toSQL?: () => { sql: string; params: unknown[] };
        };
        if (
          !query ||
          typeof compilable.toSQL !== "function"
        ) {
          throw new TypeError(`snapshot batch item ${index} is not compilable`);
        }
        const compiled = compilable.toSQL();
        results.push(await tx.query(compiled.sql, compiled.params));
      }
      return results;
    });
  return db;
}

function snapshotInput(label: string, cutDate: Date, rows: FactRow[]) {
  return {
    vintageLabel: label,
    cutDate,
    fixture: {
      rows: fixtureRows(...rows),
      adapterHashes: ADAPTER_HASHES,
      resolverHash: RESOLVER_HASH,
      disputedKeys: new Set<string>(),
    },
  };
}

test("late finalization failure rolls back the complete release and retry converges", async () => {
  const database = new PGlite();
  try {
    await database.exec(`${DDL}
      ALTER TABLE country_fact_vintage_releases
      ADD CONSTRAINT force_finalize_failure
      CHECK (completeness_status = 'staging');
    `);
    const db = atomicDb(database);
    const input = snapshotInput(
      LABEL_Q2,
      CUT_Q2,
      [factRow("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa")],
    );

    await assert.rejects(
      snapshotCompleteCandidateRelease(input, db as never),
    );
    assert.deepEqual(
      (
        await database.query<{
          releases: number;
          candidates: number;
          winners: number;
        }>(`
          SELECT
            (SELECT count(*)::integer FROM country_fact_vintage_releases) AS releases,
            (SELECT count(*)::integer FROM country_fact_vintage_candidates) AS candidates,
            (SELECT count(*)::integer FROM country_fact_vintages) AS winners
        `)
      ).rows[0],
      { releases: 0, candidates: 0, winners: 0 },
    );

    await database.exec(`
      ALTER TABLE country_fact_vintage_releases
      DROP CONSTRAINT force_finalize_failure
    `);
    const retried = await snapshotCompleteCandidateRelease(input, db as never);
    assert.equal(retried.unchanged, false);
    assert.equal(retried.cutAt, CUT_Q2.toISOString());

    const duplicate = await snapshotCompleteCandidateRelease(
      snapshotInput(LABEL_Q2, CUT_Q3, [
        factRow("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"),
      ]),
      db as never,
    );
    assert.equal(duplicate.unchanged, true);
    assert.equal(duplicate.cutAt, CUT_Q2.toISOString());
    assert.deepEqual(
      (
        await database.query<{
          releases: number;
          candidates: number;
          winners: number;
        }>(`
          SELECT
            (SELECT count(*)::integer FROM country_fact_vintage_releases) AS releases,
            (SELECT count(*)::integer FROM country_fact_vintage_candidates) AS candidates,
            (SELECT count(*)::integer FROM country_fact_vintages) AS winners
        `)
      ).rows[0],
      { releases: 1, candidates: 1, winners: 1 },
    );
  } finally {
    await database.close();
  }
});

test("staging retry keeps its original cut and later vintages get distinct candidate ids", async () => {
  const database = new PGlite();
  try {
    await database.exec(DDL);
    const db = atomicDb(database);
    const retained = factRow("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
    const stagedPackage = buildCandidateReleasePackage({
      vintageLabel: LABEL_Q2,
      cutAt: CUT_Q2.toISOString(),
      methodologyVersion: "v0.3-beta",
      rows: fixtureRows(retained),
      adapterHashes: ADAPTER_HASHES,
      resolverHash: RESOLVER_HASH,
    });
    await database.query(
      `INSERT INTO country_fact_vintage_releases (
        vintage_label, cut_at_timestamp, methodology_version,
        resolver_version_hash, completeness_status, candidate_count,
        winner_count, candidate_set_checksum, winner_set_checksum,
        input_manifest
      ) VALUES ($1, $2, $3, $4, 'staging', $5, $6, $7, $8, $9)`,
      [
        LABEL_Q2,
        CUT_Q2,
        "v0.3-beta",
        stagedPackage.manifest.resolverVersionHash,
        stagedPackage.manifest.candidateCount,
        stagedPackage.manifest.winnerCount,
        stagedPackage.manifest.candidateSetChecksum,
        stagedPackage.manifest.winnerSetChecksum,
        stagedPackage.inputManifest,
      ],
    );

    const afterCut = factRow(
      "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      "2026-08-01T00:00:00.000Z",
    );
    const resumed = await snapshotCompleteCandidateRelease(
      snapshotInput(LABEL_Q2, CUT_Q3, [retained, afterCut]),
      db as never,
    );
    assert.equal(resumed.cutAt, CUT_Q2.toISOString());
    assert.equal(resumed.candidateCount, 1);

    await snapshotCompleteCandidateRelease(
      snapshotInput(LABEL_Q3, CUT_Q3, [retained]),
      db as never,
    );
    const candidates = await database.query<{
      vintage_label: string;
      id: string;
      cut_at: string;
    }>(`
      SELECT
        vintage_label,
        id::text,
        to_char(cut_at_timestamp, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS cut_at
      FROM country_fact_vintage_candidates
      ORDER BY vintage_label
    `);
    assert.equal(candidates.rows.length, 2);
    assert.notEqual(candidates.rows[0].id, candidates.rows[1].id);
    assert.equal(candidates.rows[0].cut_at, CUT_Q2.toISOString());
    assert.equal(candidates.rows[1].cut_at, CUT_Q3.toISOString());
  } finally {
    await database.close();
  }
});
