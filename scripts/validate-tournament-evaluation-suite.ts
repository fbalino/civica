import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { tournamentEvaluationErrors } from "../src/lib/ci/tournament-evaluation-interface";
import { buildCheckedTournamentEvaluationSuite } from "./generate-tournament-evaluation-suite";

const stored = JSON.parse(readFileSync("data/releases/index-tournament-evaluation-suite-v1/manifest.v1.json", "utf8")); const suite = buildCheckedTournamentEvaluationSuite(); assert.deepEqual(suite, stored); assert.equal(tournamentEvaluationErrors(suite).length, 0); assert.equal(suite.heldoutOutcomeMetricsComputed, false); assert.equal(suite.winnerSelected, false); console.log(`PASS — shared interface covers K0–K5 at ${suite.suiteSha256}; held-out outcomes remain sealed.`);
