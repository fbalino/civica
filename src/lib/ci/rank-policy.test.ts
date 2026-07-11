import assert from "node:assert/strict";
import test from "node:test";
import { competitionRankPublishedScores } from "./rank-policy";

test("competition ranks equal published scores without an ordinal tiebreak", () => {
  const ranked = competitionRankPublishedScores(
    [
      { id: "c", score: 80 },
      { id: "a", score: 90 },
      { id: "b", score: 90 },
      { id: "d", score: 70 },
    ],
    (row) => row.score,
    (row) => row.id,
  );
  assert.deepEqual(
    ranked.map(({ row, rank, tieCount, occupiedPositionEnd }) => ({ id: row.id, rank, tieCount, occupiedPositionEnd })),
    [
      { id: "a", rank: 1, tieCount: 2, occupiedPositionEnd: 2 },
      { id: "b", rank: 1, tieCount: 2, occupiedPositionEnd: 2 },
      { id: "c", rank: 3, tieCount: 1, occupiedPositionEnd: 3 },
      { id: "d", rank: 4, tieCount: 1, occupiedPositionEnd: 4 },
    ],
  );
});

test("input order cannot alter ranks or stable nonordinal display order", () => {
  const rows = [{ id: "b", score: 50 }, { id: "a", score: 50 }, { id: "c", score: 40 }];
  const run = (input: typeof rows) => competitionRankPublishedScores(input, (row) => row.score, (row) => row.id);
  assert.deepEqual(run(rows), run([...rows].reverse()));
});
