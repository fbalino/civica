import assert from "node:assert/strict";
import test from "node:test";

import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";

import {
  buildCountryFactDemotionHistoryStatement,
  buildCountryFactHistoryStatement,
} from "./country-fact-history-writer";

const JURISDICTION_ID = "123e4567-e89b-42d3-a456-426614174000";
const FACT_ID = "223e4567-e89b-42d3-a456-426614174001";
const CORRECTION_ID = "323e4567-e89b-42d3-a456-426614174002";

const baseValues = {
  id: FACT_ID,
  jurisdictionId: JURISDICTION_ID,
  factKey: "official_languages",
  factGroup: "A",
  category: "society",
  sourceId: "cia_factbook",
  sourceUrl: "https://example.invalid/jersey",
  factValue: "<p>English (official) 94.5%</p> (2001 est.)",
  factValueNumeric: 94.5,
  factUnit: "",
  factYear: 2001,
  upstreamVintageLabel: "CIA Factbook 2026-01-frozen",
  methodologyVersion: "v0.2-beta",
  status: "active",
  statusReason: null,
};

const routineHistory = {
  changeKind: "routine_refresh" as const,
  reason: "cia_factbook country-fact source refresh",
  methodologyVersion: "fact-reconciliation/v0.2-beta",
  releaseId: "atlas-fixture-2026-08",
};

async function factsDatabase() {
  const client = new PGlite();
  await client.exec(`
    CREATE TABLE country_facts (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      jurisdiction_id uuid NOT NULL,
      category text NOT NULL,
      fact_key text NOT NULL,
      fact_value text,
      fact_value_numeric numeric,
      fact_unit text,
      fact_year integer,
      source_note text,
      created_at timestamp NOT NULL DEFAULT now(),
      fact_group text NOT NULL DEFAULT 'B',
      source_id text NOT NULL DEFAULT 'cia_factbook',
      source_url text,
      wikidata_qid text,
      wikidata_pid text,
      wikidata_rank text,
      "references" jsonb,
      source_hash text,
      value_json jsonb,
      as_of timestamp,
      retrieved_at timestamp,
      upstream_vintage_label text,
      methodology_version text NOT NULL DEFAULT 'v0.2-beta',
      status text NOT NULL DEFAULT 'active',
      status_reason text,
      snapshot_id uuid,
      updated_at timestamp NOT NULL DEFAULT now(),
      value_type text NOT NULL DEFAULT 'measured',
      data_vintage_year integer,
      growth_methodology text,
      value_status text NOT NULL DEFAULT 'observed',
      value_status_reason text
    );
    CREATE UNIQUE INDEX idx_country_facts_jurisdiction_factkey_source
      ON country_facts (jurisdiction_id, fact_key, source_id);
    CREATE TABLE correction_log (id uuid PRIMARY KEY, status text NOT NULL);
    INSERT INTO correction_log VALUES ('${CORRECTION_ID}', 'in_review');
    CREATE TABLE atlas_entity_change_history (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      entity_type text NOT NULL,
      entity_id text NOT NULL,
      entity_table text NOT NULL,
      operation text NOT NULL,
      change_kind text NOT NULL,
      changes jsonb NOT NULL,
      reason text NOT NULL,
      methodology_version text NOT NULL,
      release_id text NOT NULL,
      correction_log_id uuid REFERENCES correction_log(id),
      correction_status text,
      recorded_at timestamp NOT NULL DEFAULT now()
    );
  `);
  return { client, database: drizzle(client) };
}

async function readEvents(client: PGlite) {
  const result = await client.query<{
    operation: string;
    change_kind: string;
    changes: unknown;
    correction_log_id: string | null;
  }>(
    "SELECT operation, change_kind, changes, correction_log_id FROM atlas_entity_change_history ORDER BY recorded_at, id",
  );
  return result.rows;
}

test("fresh insert records an insert event without before values", async () => {
  const { client, database } = await factsDatabase();
  await database.execute(
    buildCountryFactHistoryStatement({
      values: baseValues,
      history: routineHistory,
    }),
  );
  const events = await readEvents(client);
  assert.equal(events.length, 1);
  assert.equal(events[0].operation, "insert");
  const changes = events[0].changes as Array<{
    field: string;
    before: unknown;
  }>;
  assert.ok(changes.some((change) => change.field === "fact_value"));
  assert.ok(changes.every((change) => change.before === null));
  await client.close();
});

test("updating an existing row records an update event with the true before value", async () => {
  const { client, database } = await factsDatabase();
  await database.execute(
    buildCountryFactHistoryStatement({
      values: baseValues,
      history: routineHistory,
    }),
  );

  await database.execute(
    buildCountryFactHistoryStatement({
      values: {
        ...baseValues,
        factValue:
          "English (official) 94.5%, Portuguese 4.6% (2001 est.)",
      },
      history: {
        changeKind: "correction",
        reason: "strip literal <p></p> markup imported from upstream JSON",
        methodologyVersion: "fact-reconciliation/v0.2-beta",
        releaseId: "atlas-corrections-fixture-v1",
        correctionLogId: CORRECTION_ID,
        correctionStatus: "in_review",
      },
    }),
  );

  const events = await readEvents(client);
  assert.equal(events.length, 2);
  const correction = events[1];
  assert.equal(correction.operation, "update");
  assert.equal(correction.change_kind, "correction");
  assert.equal(correction.correction_log_id, CORRECTION_ID);
  const changes = correction.changes as Array<{
    field: string;
    before: unknown;
    after: unknown;
  }>;
  assert.equal(changes.length, 1);
  assert.equal(changes[0].field, "fact_value");
  assert.equal(changes[0].before, baseValues.factValue);
  assert.equal(
    changes[0].after,
    "English (official) 94.5%, Portuguese 4.6% (2001 est.)",
  );

  const rows = await client.query<{ id: string }>(
    "SELECT id FROM country_facts",
  );
  assert.equal(rows.rows.length, 1);
  assert.equal(rows.rows[0].id, FACT_ID);
  await client.close();
});

test("a content-identical rerun writes no history event", async () => {
  const { client, database } = await factsDatabase();
  const write = () =>
    database.execute(
      buildCountryFactHistoryStatement({
        values: baseValues,
        history: routineHistory,
      }),
    );
  await write();
  await write();
  const events = await readEvents(client);
  assert.equal(events.length, 1);
  await client.close();
});

test("demotion records an update event with the true before status", async () => {
  const { client, database } = await factsDatabase();
  await database.execute(
    buildCountryFactHistoryStatement({
      values: baseValues,
      history: routineHistory,
    }),
  );
  await database.execute(
    buildCountryFactDemotionHistoryStatement({
      factId: FACT_ID,
      statusReason: "quarantined by fixture review",
      history: {
        changeKind: "substantive_revision",
        reason: "fixture demotion of an implausible value",
        methodologyVersion: "fact-reconciliation/v0.2-beta",
        releaseId: "atlas-fixture-2026-08",
      },
    }),
  );
  const events = await readEvents(client);
  assert.equal(events.length, 2);
  assert.equal(events[1].operation, "update");
  const changes = events[1].changes as Array<{
    field: string;
    before: unknown;
    after: unknown;
  }>;
  const statusChange = changes.find((change) => change.field === "status");
  assert.ok(statusChange);
  assert.equal(statusChange.before, "active");
  assert.equal(statusChange.after, "demoted");
  await client.close();
});
