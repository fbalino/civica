import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import type {
  GovernmentBodyHistoryWrite,
  upsertGovernmentBodyWithHistory,
} from "../src/lib/factbook/government-entity-history-writer";
import { writeIpuGovernmentBody } from "./sync-ipu-parline";
import { writeWikidataGovernmentBodyLink } from "./sync-wikidata-parties";

const jurisdictionId = "10000000-0000-4000-8000-000000000001";
const bodyId = "20000000-0000-4000-8000-000000000001";
const database = {} as Parameters<typeof upsertGovernmentBodyWithHistory>[0];

const body: Omit<GovernmentBodyHistoryWrite, "history"> = {
  stableId: bodyId,
  jurisdictionId,
  name: "Example Assembly",
  bodyType: "legislature",
  chamberType: "unicameral",
  totalSeats: 100,
  branch: "legislative",
  wikidataQid: "Q123",
  ipuParlineId: "EX-LC01",
  hierarchyLevel: 2,
  electoralSystemFamily: "proportional_representation",
  electoralSubsystem: "list_proportional_representation_list_pr",
};

const adapters = [
  {
    name: "IPU Parline",
    write: writeIpuGovernmentBody,
    method: "ipu-parline-legislature-sync/v1",
    reason: "IPU Parline legislature metadata routine refresh",
  },
  {
    name: "Wikidata parties",
    write: writeWikidataGovernmentBodyLink,
    method: "wikidata-legislature-qid-sync/v1",
    reason: "Wikidata legislature identity routine refresh",
  },
] as const;

for (const adapter of adapters) {
  test(`${adapter.name} rejects missing release context before a body write`, async () => {
    const previousReleaseId = process.env.CIVICA_ATLAS_RELEASE_ID;
    delete process.env.CIVICA_ATLAS_RELEASE_ID;
    let writes = 0;
    const writer: typeof upsertGovernmentBodyWithHistory = async () => {
      writes++;
      return bodyId;
    };

    try {
      await assert.rejects(
        adapter.write(database, body, { writer }),
        /named Atlas release/,
      );
      assert.equal(writes, 0);
    } finally {
      if (previousReleaseId === undefined) {
        delete process.env.CIVICA_ATLAS_RELEASE_ID;
      } else {
        process.env.CIVICA_ATLAS_RELEASE_ID = previousReleaseId;
      }
    }
  });

  test(`${adapter.name} dry-run is release-independent and performs zero body writes`, async () => {
    let writes = 0;
    const writer: typeof upsertGovernmentBodyWithHistory = async () => {
      writes++;
      return bodyId;
    };

    assert.equal(
      await adapter.write(database, body, { dryRun: true, writer }),
      bodyId,
    );
    assert.equal(writes, 0);
  });

  test(`${adapter.name} preserves the selected UUID and records routine refresh metadata`, async () => {
    const captured: GovernmentBodyHistoryWrite[] = [];
    const writer: typeof upsertGovernmentBodyWithHistory = async (
      _database,
      input,
    ) => {
      captured.push(input);
      return bodyId;
    };

    assert.equal(
      await adapter.write(database, body, {
        atlasReleaseId: "atlas-test-release",
        writer,
      }),
      bodyId,
    );
    assert.equal(captured[0]?.stableId, bodyId);
    assert.deepEqual(captured[0]?.history, {
      changeKind: "routine_refresh",
      reason: adapter.reason,
      methodologyVersion: adapter.method,
      releaseId: "atlas-test-release",
    });
  });
}

test("production legislature syncs contain no direct government-body mutation", () => {
  for (const path of [
    "scripts/sync-ipu-parline.ts",
    "scripts/sync-wikidata-parties.ts",
  ]) {
    const source = readFileSync(resolve(process.cwd(), path), "utf8");
    assert.match(source, /upsertGovernmentBodyWithHistory/);
    assert.doesNotMatch(
      source,
      /\.(?:insert|update)\(\s*governmentBodies\s*\)/,
      `${path} must use the atomic government-body history writer`,
    );
    assert.doesNotMatch(
      source,
      /\b(?:INSERT\s+INTO|UPDATE)\s+government_bodies\b/i,
      `${path} must not bypass the atomic government-body history writer with raw SQL`,
    );
  }
});
