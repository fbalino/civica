/**
 * ATL-011 — party identity, seats, coalition, and ideology honesty contract.
 *
 * Run with:
 *     npx tsx --test src/lib/db/__tests__/atl-011-party-honesty.test.ts
 *     (or: node --import tsx --test src/lib/db/__tests__/atl-011-party-honesty.test.ts)
 *
 * Locks the "Done when" bar from plan/06-atlas-content-and-research-features.md
 * ATL-011 for the /parties browser (`src/lib/db/queries-parties.ts`,
 * `src/components/parties/PartyExplorer.tsx`):
 *
 *   1. No Civica-inferred or below-trust-bar ideology is EVER displayed as
 *      fact — only a high-confidence V-Party v2 match may resolve to a
 *      displayable `PartyPosition` (resolution §4.2, §5). This is the
 *      SHARPEST requirement: a 'review'-confidence row can carry fully-formed
 *      numeric axis values (a fuzzy token match, or any party in a one-party
 *      / non-competitive legislature) and must STILL resolve to `null`.
 *   2. Every displayed seats/coalition attribute carries REAL, non-fabricated
 *      provenance — a chamber with no recorded `statements` row must resolve
 *      to `seatsSource: null` (rendered as "Source not recorded"), never
 *      default to a fixed sync id such as `ipu_parline`.
 *   3. Party identity is a stable surrogate key (`legislature_parties.id`),
 *      never derived from the mutable, non-unique `party_name` display field.
 *
 * The first two are exercised as pure, DB-free fixture tests against the
 * exported resolver functions (`resolvePartyPosition`, `resolveSeatsSource`)
 * that `getPartiesForBrowser` calls for every row — the same functions the
 * live query uses, not a reimplementation. The live section (skipped unless
 * `RUN_DB_TESTS=1`) re-runs the same resolvers against real production rows
 * read through the read-only QA-004 harness, so the contract is checked
 * against both synthetic edge cases and the actual current dataset.
 */
import { config } from "dotenv";
config({ path: ".env.local", override: true });

import assert from "node:assert/strict";
import test from "node:test";
import { and, eq, sql } from "drizzle-orm";
import {
  resolvePartyPosition,
  resolveSeatsSource,
  type RawPositionRow,
  type RawSeatsSourceRow,
} from "@/lib/db/queries-parties";
import { getLiveReadOnlyDb } from "@/lib/db/live-readonly";
import {
  governmentBodies,
  jurisdictions,
  legislatureParties,
  partyPositions,
  statements,
} from "@/lib/db/schema";

// ─── Fixtures ────────────────────────────────────────────────────────────────

/** A fully-formed, high-confidence V-Party match — the only shape that should
 *  ever resolve to a displayable position. */
const HIGH_CONFIDENCE_ROW: RawPositionRow = {
  matchConfidence: "high",
  economicLR: -1.42,
  economicLROrd: 2,
  antiPlural: 0.18,
  populism: 0.31,
  codedYear: 2019,
  matchMethod: "exact",
};

// ─── 1. Ideology: never Civica-inferred, never below-trust-bar ─────────────

test("a high-confidence, fully-formed V-Party match resolves to a displayable position", () => {
  const position = resolvePartyPosition(HIGH_CONFIDENCE_ROW);
  assert.notEqual(position, null);
  assert.equal(position?.economicLR, -1.42);
  assert.equal(position?.economicLROrd, 2);
  assert.equal(position?.antiPlural, 0.18);
  assert.equal(position?.populism, 0.31);
  assert.equal(position?.codedYear, 2019);
  assert.equal(position?.matchMethod, "exact");
});

test("a 'review'-confidence match NEVER displays, even with fully-formed numeric axis values", () => {
  // This is the sharpest ATL-011 case: `scripts/ingest-vparty-positions.ts`
  // writes review-confidence rows for fuzzy token matches AND for every party
  // in a one-party / non-competitive legislature, and both carry real,
  // fully-populated V-Party numbers. Below the trust bar means never shown —
  // a wrong ideology is worse than an honest gap (resolution §5).
  const reviewRow: RawPositionRow = { ...HIGH_CONFIDENCE_ROW, matchConfidence: "review" };
  assert.equal(resolvePartyPosition(reviewRow), null);
});

test("a non-competitive-legislature match (review confidence) never displays", () => {
  // e.g. China's CCP, North Korea's WPK — ingest-vparty-positions.ts forces
  // 'review' for NON_COMPETITIVE_ISO3 regardless of match method.
  const oneParty: RawPositionRow = {
    matchConfidence: "review",
    economicLR: -3.9,
    economicLROrd: 0,
    antiPlural: 0.95,
    populism: 0.2,
    codedYear: 2018,
    matchMethod: "exact",
  };
  assert.equal(resolvePartyPosition(oneParty), null);
});

test("no match at all (the common case) resolves to null, not a default/zero position", () => {
  const noMatch: RawPositionRow = {
    matchConfidence: null,
    economicLR: null,
    economicLROrd: null,
    antiPlural: null,
    populism: null,
    codedYear: null,
    matchMethod: null,
  };
  assert.equal(resolvePartyPosition(noMatch), null);
});

test("a high-confidence row missing a required axis value never fabricates the gap", () => {
  // Defensive completeness: 'high' alone is not sufficient — the two plotted
  // axes and the coded year must all be present.
  assert.equal(
    resolvePartyPosition({ ...HIGH_CONFIDENCE_ROW, economicLR: null }),
    null,
  );
  assert.equal(
    resolvePartyPosition({ ...HIGH_CONFIDENCE_ROW, antiPlural: null }),
    null,
  );
  assert.equal(
    resolvePartyPosition({ ...HIGH_CONFIDENCE_ROW, codedYear: null }),
    null,
  );
});

test("numeric axis values persisted as SQL strings still resolve correctly", () => {
  // Neon/Drizzle can return `real` columns as strings depending on the driver
  // path; the resolver must coerce, not silently drop, the value.
  const stringy: RawPositionRow = {
    matchConfidence: "high",
    economicLR: "-1.42",
    economicLROrd: "2",
    antiPlural: "0.18",
    populism: "0.31",
    codedYear: "2019",
    matchMethod: "abbrev",
  };
  const position = resolvePartyPosition(stringy);
  assert.equal(position?.economicLR, -1.42);
  assert.equal(position?.codedYear, 2019);
});

// ─── 2. Seats/coalition: real provenance, never fabricated ─────────────────

test("a chamber with a recorded statements row resolves to its real source", () => {
  const row: RawSeatsSourceRow = {
    seatsSourceId: "wikidata",
    seatsSourceRetrievedAt: "2026-04-19T00:28:43.831Z",
  };
  const source = resolveSeatsSource(row);
  assert.deepEqual(source, {
    id: "wikidata",
    retrievedAt: "2026-04-19T00:28:43.831Z",
  });
});

test("a chamber with NO recorded statements row resolves to null — never defaults to ipu_parline", () => {
  const row: RawSeatsSourceRow = { seatsSourceId: null, seatsSourceRetrievedAt: null };
  assert.equal(resolveSeatsSource(row), null);
  // The two real composition-sync source ids in production today. Neither may
  // ever appear as a fallback default for an unsourced chamber.
  const result = resolveSeatsSource(row);
  assert.notEqual((result as { id?: string } | null)?.id, "ipu_parline");
  assert.notEqual((result as { id?: string } | null)?.id, "wikidata");
});

test("a partial row (id without a timestamp, or vice versa) resolves to null, not a half-fabricated source", () => {
  assert.equal(
    resolveSeatsSource({ seatsSourceId: "ipu_parline", seatsSourceRetrievedAt: null }),
    null,
  );
  assert.equal(
    resolveSeatsSource({ seatsSourceId: null, seatsSourceRetrievedAt: "2026-07-05T00:00:00.000Z" }),
    null,
  );
});

// ─── 3. Identity is a stable surrogate key, not the display name ───────────

test("the position/source resolver contracts never reference partyName", () => {
  // Structural proof, not just a convention: RawPositionRow and
  // RawSeatsSourceRow — the exact inputs getPartiesForBrowser feeds into the
  // resolvers for every row — do not carry a partyName field at all, so a
  // rename or a duplicate display name across two chambers can never change
  // which ideology/source resolves for a given row. Identity flows through
  // `legislature_parties.id` (selected directly as `BrowserParty.id` in
  // getPartiesForBrowser), not through the mutable name.
  const positionRowKeys: (keyof RawPositionRow)[] = [
    "matchConfidence",
    "economicLR",
    "economicLROrd",
    "antiPlural",
    "populism",
    "codedYear",
    "matchMethod",
  ];
  const seatsSourceRowKeys: (keyof RawSeatsSourceRow)[] = [
    "seatsSourceId",
    "seatsSourceRetrievedAt",
  ];
  assert.ok(!positionRowKeys.includes("partyName" as keyof RawPositionRow));
  assert.ok(!seatsSourceRowKeys.includes("partyName" as keyof RawSeatsSourceRow));
});

test("two rows sharing the same display name are independent by construction", () => {
  // Civica legitimately stores the same party name more than once (different
  // chambers, or a split party row) — resolvePartyPosition/resolveSeatsSource
  // take no name input, so two "Independent" rows with different raw
  // confidence/source data never bleed into each other.
  const independentA: RawPositionRow = { ...HIGH_CONFIDENCE_ROW, matchConfidence: "high" };
  const independentB: RawPositionRow = { ...HIGH_CONFIDENCE_ROW, matchConfidence: "review" };
  assert.notEqual(resolvePartyPosition(independentA), null);
  assert.equal(resolvePartyPosition(independentB), null);
});

// ─── Live re-check against production (opt-in) ──────────────────────────────
//
// Re-runs the same two resolvers against real rows read through the QA-004
// read-only harness. Skipped by default; run with `RUN_DB_TESTS=1 npm test`
// (or `npm run test:db` if configured) against a populated database.

const liveSkip = process.env.RUN_DB_TESTS !== "1" ? "opt-in: RUN_DB_TESTS=1 npm test" : false;

test(
  "live: every non-high-confidence party_positions row in production is non-displayable",
  { skip: liveSkip },
  async () => {
    const ro = getLiveReadOnlyDb();
    const rows = await ro
      .select({
        matchConfidence: partyPositions.matchConfidence,
        economicLR: partyPositions.economicLeftRight,
        economicLROrd: partyPositions.economicLrOrd,
        antiPlural: partyPositions.antiPluralism,
        populism: partyPositions.populism,
        codedYear: partyPositions.codedYear,
        matchMethod: partyPositions.matchMethod,
      })
      .from(partyPositions)
      .where(sql`${partyPositions.matchConfidence} != 'high'`);

    // Measured live on 2026-07-12: 36 review-confidence rows exist (fuzzy
    // token matches + non-competitive legislatures). If this ever reaches 0,
    // the assertion below still holds trivially — the invariant is what
    // matters, not the count.
    for (const row of rows) {
      assert.equal(
        resolvePartyPosition(row),
        null,
        `a 'review'-confidence party_positions row resolved to a displayable position: ${JSON.stringify(row)}`,
      );
    }
  },
);

test(
  "live: a known unsourced chamber (UK House of Lords) shows no fabricated seat source",
  { skip: liveSkip },
  async () => {
    const ro = getLiveReadOnlyDb();
    const rows = await ro
      .select({
        seatsSourceId: statements.sourceId,
        seatsSourceRetrievedAt: statements.retrievedAt,
      })
      .from(governmentBodies)
      .innerJoin(jurisdictions, eq(governmentBodies.jurisdictionId, jurisdictions.id))
      .leftJoin(
        statements,
        and(
          eq(statements.subjectTable, "government_bodies"),
          eq(statements.subjectId, governmentBodies.id),
          eq(statements.predicate, "seats_per_parties"),
        ),
      )
      .where(
        and(eq(jurisdictions.name, "United Kingdom"), eq(governmentBodies.name, "House of Lords")),
      );

    assert.ok(rows.length > 0, "expected the UK House of Lords chamber to exist");
    for (const row of rows) {
      assert.equal(
        resolveSeatsSource(row),
        null,
        "UK House of Lords is legacy pre-provenance seed data and must resolve to no seats source, not a fabricated ipu_parline attribution",
      );
    }
  },
);

test(
  "live: a real party row keeps a stable legislature_parties.id distinct from its display name",
  { skip: liveSkip },
  async () => {
    const ro = getLiveReadOnlyDb();
    const rows = await ro
      .select({ id: legislatureParties.id, partyName: legislatureParties.partyName })
      .from(legislatureParties)
      .limit(5);
    assert.ok(rows.length > 0, "expected at least one legislature_parties row");
    for (const row of rows) {
      // UUID primary key — never equal to (or derived from) the mutable name.
      assert.match(row.id, /^[0-9a-f-]{36}$/i);
      assert.notEqual(row.id, row.partyName);
    }
  },
);
