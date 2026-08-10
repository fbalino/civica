import assert from "node:assert/strict";
import test from "node:test";

import type { EntityNameFormsWriteSummary } from "./name-form-store";
import {
  scriptCodeFromLanguageTag,
  syncEntityNameForms,
  type MonolingualClaim,
  type NameFormEntity,
} from "./name-form-sync";

const db = {} as never;

const entities: NameFormEntity[] = [
  {
    entityType: "jurisdiction",
    entityId: "3d0f2f2e-45cb-4c8e-9d3e-6f6f4b1c2a01",
    wikidataQid: "Q142",
  },
  {
    entityType: "person",
    entityId: "6a3b0d43-b2ad-4e50-8a80-1a2f3c4d5e02",
    wikidataQid: "Q3052772",
  },
  {
    entityType: "office",
    entityId: "9c7e1a25-cc41-45c9-a9b3-0d1e2f3a4b03",
    wikidataQid: "Q191954",
  },
];

/** Source-shaped fixture: monolingual truthy claims per property. */
function fixtureClaims(
  qids: readonly string[],
  pid: string,
): Promise<MonolingualClaim[]> {
  const byPid: Record<string, MonolingualClaim[]> = {
    P1448: [
      { qid: "Q142", value: "République française", languageTag: "fr" },
      // Same-language duplicate official names are ambiguous → fail closed.
      { qid: "Q191954", value: "Président de la République", languageTag: "fr" },
      { qid: "Q191954", value: "Président de la République française", languageTag: "fr" },
    ],
    P1705: [
      { qid: "Q142", value: "France", languageTag: "fr" },
      // Non-language tag → fail closed.
      { qid: "Q191954", value: "Présidence", languageTag: "und" },
    ],
    P1559: [
      { qid: "Q3052772", value: "Emmanuel Macron", languageTag: "fr" },
    ],
  };
  return Promise.resolve(
    (byPid[pid] ?? []).filter((claim) => qids.includes(claim.qid)),
  );
}

test("script subtags are surfaced mechanically, never inferred", () => {
  assert.equal(scriptCodeFromLanguageTag("zh-hant"), "Hant");
  assert.equal(scriptCodeFromLanguageTag("sr-Cyrl-RS"), "Cyrl");
  assert.equal(scriptCodeFromLanguageTag("fr"), null);
  assert.equal(scriptCodeFromLanguageTag("pt-br"), null);
});

test("dry run proposes forms, fails ambiguity closed, and writes nothing", async () => {
  const written: unknown[][] = [];
  const summary = await syncEntityNameForms(db, {
    dryRun: true,
    entities,
    getMonolingualClaims: fixtureClaims,
    retrievedAt: new Date("2026-08-09T12:00:00.000Z"),
    write: async (_db, forms, options): Promise<EntityNameFormsWriteSummary> => {
      assert.equal(options?.dryRun, true);
      written.push([...forms]);
      return {
        proposed: forms.length,
        written: 0,
        unchanged: 0,
        sourcesStamped: [],
      };
    },
  });

  assert.equal(summary.dryRun, true);
  assert.equal(summary.entitiesInScope.jurisdiction, 1);
  assert.equal(summary.entitiesInScope.political_party, 0);
  // Q142 official + Q142 native + person native = 3 usable forms.
  assert.equal(summary.proposedForms, 3);
  assert.equal(summary.skippedAmbiguousIdentities, 1);
  assert.equal(summary.skippedUnusableLanguage, 1);
  assert.equal(summary.write.written, 0);
  assert.equal(summary.write.sourcesStamped.length, 0);
  assert.equal(summary.errors.length, 0);
  assert.equal(written.length, 1);
});

test("identical replays converge through the shared writer contract", async () => {
  const batches: unknown[][] = [];
  const run = () =>
    syncEntityNameForms(db, {
      entities,
      getMonolingualClaims: fixtureClaims,
      retrievedAt: new Date("2026-08-09T12:00:00.000Z"),
      write: async (_db, forms): Promise<EntityNameFormsWriteSummary> => {
        batches.push([...forms]);
        return {
          proposed: forms.length,
          written: batches.length === 1 ? forms.length : 0,
          unchanged: batches.length === 1 ? 0 : forms.length,
          sourcesStamped: batches.length === 1 ? ["wikidata"] : [],
        };
      },
    });

  const first = await run();
  const second = await run();
  assert.equal(first.write.written, 3);
  assert.deepEqual(first.write.sourcesStamped, ["wikidata"]);
  assert.equal(second.write.written, 0);
  assert.deepEqual(second.write.sourcesStamped, []);
  // Both runs proposed byte-identical batches.
  assert.deepEqual(batches[0], batches[1]);
});

test("an empty upstream result fails closed without touching freshness", async () => {
  const summary = await syncEntityNameForms(db, {
    entities,
    getMonolingualClaims: async () => [],
    retrievedAt: new Date("2026-08-09T12:00:00.000Z"),
    write: async () => {
      throw new Error("writer must not run for an empty batch");
    },
  });
  assert.equal(summary.proposedForms, 0);
  assert.equal(summary.write.written, 0);
  assert.equal(summary.write.sourcesStamped.length, 0);
  assert.equal(summary.errors.length, 1);
});
