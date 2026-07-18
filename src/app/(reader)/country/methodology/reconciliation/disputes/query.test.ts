import assert from "node:assert/strict";
import test from "node:test";
import {
  DISPUTES_PAGE_SIZE,
  parsePublicDisputesPageQuery,
  publicDisputesPageOffset,
  publicDisputesSearch,
  requireBoundedPublicDisputePage,
} from "./query";

test("public dispute filters and page have a canonical URL round-trip", () => {
  const parsed = parsePublicDisputesPageQuery({
    status: "open",
    kind: "material_error",
    factKey: "population_total",
    severity: "hi",
    group: "B",
    sourcePair: "cia_factbook|world_bank",
    age: "7-30d",
    sort: "oldest",
    page: "3",
  });

  assert.deepEqual(parsed, {
    status: "open",
    kind: "material_error",
    factKey: "population_total",
    severity: "hi",
    group: "B",
    sourcePair: "cia_factbook|world_bank",
    age: "7-30d",
    sort: "oldest",
    page: 3,
  });
  assert.equal(
    publicDisputesSearch(parsed),
    "?status=open&kind=material_error&factKey=population_total&severity=hi&group=B&sourcePair=cia_factbook%7Cworld_bank&age=7-30d&sort=oldest&page=3",
  );
  assert.equal(publicDisputesPageOffset(parsed), DISPUTES_PAGE_SIZE * 2);
});

test("malformed public dispute URL values close to defaults", () => {
  assert.deepEqual(
    parsePublicDisputesPageQuery({
      status: "unreviewed",
      kind: "not allowed!",
      factKey: "<invalid>",
      severity: "critical",
      group: "D",
      sourcePair: "bad pair",
      age: "forever",
      sort: "custom",
      page: "0",
    }),
    { sort: "severity", page: 1 },
  );
});

test("a 5,000-conflict fixture cannot pass the server page boundary", () => {
  const fixture = Array.from({ length: 5_000 }, (_, index) => index);
  assert.throws(
    () => requireBoundedPublicDisputePage(fixture),
    /refuse to serialize an oversized response/,
  );
  assert.equal(
    requireBoundedPublicDisputePage(fixture.slice(0, DISPUTES_PAGE_SIZE)).length,
    DISPUTES_PAGE_SIZE,
  );
});
