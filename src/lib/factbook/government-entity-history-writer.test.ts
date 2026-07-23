import assert from "node:assert/strict";
import test from "node:test";

import { PgDialect } from "drizzle-orm/pg-core";

import {
  buildGovernmentBodyHistoryStatement,
  buildOfficeHistoryStatement,
  buildPersonHistoryStatement,
  type GovernmentEntityHistoryContext,
} from "./government-entity-history-writer";

const history: GovernmentEntityHistoryContext = {
  changeKind: "routine_refresh",
  reason: "Publisher roster refresh",
  methodologyVersion: "government-entity-sync/v1",
  releaseId: "atlas-2026-07",
};

const jurisdictionId = "10000000-0000-4000-8000-000000000001";
const bodyId = "20000000-0000-4000-8000-000000000001";
const officeId = "30000000-0000-4000-8000-000000000001";
const personId = "40000000-0000-4000-8000-000000000001";

function query(statement: Parameters<PgDialect["sqlToQuery"]>[0]) {
  return new PgDialect().sqlToQuery(statement);
}

test("institution, office, and person statements atomically mutate and append bounded history", () => {
  const statements = [
    query(
      buildGovernmentBodyHistoryStatement(
        {
          jurisdictionId,
          name: "Executive of Example",
          bodyType: "cabinet",
          branch: "executive",
          hierarchyLevel: 0,
          history,
        },
        bodyId,
      ),
    ),
    query(
      buildOfficeHistoryStatement(
        {
          bodyId,
          name: "Prime Minister",
          officeType: "head_of_government",
          isElected: true,
          stableId: officeId,
          identityMode: "office_type",
          history,
        },
        officeId,
      ),
    ),
    query(
      buildPersonHistoryStatement(
        {
          stableId: personId,
          identityQid: "Q42",
          insertName: "Example Person",
          values: { name: "Example Person", wikidataQid: "Q42" },
          history,
        },
        personId,
      ),
    ),
  ];

  for (const item of statements) {
    assert.match(item.sql, /^\s*WITH lock_row AS MATERIALIZED/i);
    assert.match(item.sql, /FOR UPDATE/i);
    assert.match(item.sql, /INSERT INTO atlas_entity_change_history/i);
    assert.match(item.sql, /jsonb_array_length\(changes\) > 0/i);
    assert.ok(item.params.includes("atlas-2026-07"));
  }
});

test("office title updates bind history to the retained stable office UUID", () => {
  const item = query(
    buildOfficeHistoryStatement({
      bodyId,
      stableId: officeId,
      name: "Chancellor",
      officeType: "head_of_government",
      isElected: true,
      identityMode: "office_type",
      history,
    }),
  );
  assert.match(item.sql, /COALESCE\(\(SELECT id FROM before_row\)/i);
  assert.ok(item.params.includes(officeId));
  assert.ok(item.params.includes("Chancellor"));
});

test("omitted optional institution fields preserve the retained row", () => {
  const item = query(
    buildGovernmentBodyHistoryStatement(
      {
        jurisdictionId,
        name: "Executive of Example",
        bodyType: "cabinet",
        branch: "executive",
        history,
      },
      bodyId,
    ),
  );
  assert.match(
    item.sql,
    /hierarchy_level = CASE WHEN .* THEN EXCLUDED\.hierarchy_level ELSE government_bodies\.hierarchy_level END/i,
  );
});

test("QID-less person mutation fails closed without an explicit immutable UUID", () => {
  assert.throws(
    () =>
      buildPersonHistoryStatement({
        insertName: "Mutable Display Name",
        values: { name: "Mutable Display Name" },
        history,
      }),
    /QID-less person history writes require an explicit stable person UUID/,
  );
});
