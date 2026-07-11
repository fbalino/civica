import assert from "node:assert/strict";
import test from "node:test";
import { postgresRealRoundTrip, reproduceCurrentCiRelease } from "./reproduce-current-release";
import type { IngestionResult } from "./types";

const spine = [{ id: "j1", name: "Example", iso3: "EXP" }];
const input = (sourceId: string, dimension: IngestionResult["dimension"], indicator: string, rawValue: number, nativeMin: number, nativeMax: number): IngestionResult => ({ sourceId, dimension, datasetYear: 2024, globalMinObserved: nativeMin, globalMaxObserved: nativeMax, records: [{ iso3:"EXP",year:2024,dimension,indicator,rawValue,nativeMin,nativeMax,isInverted:false }] });
const inputs = [input("vdem","democratic_quality","v2x_libdem",0.7,0,1), input("worldbank_wgi","rule_of_law","rl.est",1,-2.5,2.5), input("freedom_house","freedom_rights","pr_cl_total",5,2,14), input("transparency_intl","corruption_control","score",70,0,100)];

test("clean-room reproduction is byte-stable across repeated runs", () => assert.deepEqual(reproduceCurrentCiRelease(spine, inputs), reproduceCurrentCiRelease(spine, inputs)));
test("input order cannot change dimensions, score, or rank", () => assert.deepEqual(reproduceCurrentCiRelease(spine, [...inputs].reverse()), reproduceCurrentCiRelease(spine, inputs)));
test("clean-room inputs reproduce PostgreSQL real text-protocol round trips", () => {
  assert.equal(postgresRealRoundTrip(0.5017877817153931), 0.5017878);
  assert.equal(postgresRealRoundTrip(-2.2042741775512695), -2.2042742);
  assert.equal(Math.fround(postgresRealRoundTrip(0.5017877817153931)), Math.fround(0.5017877817153931));
});
