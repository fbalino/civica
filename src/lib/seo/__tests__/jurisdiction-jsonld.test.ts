import assert from "node:assert/strict";
import test from "node:test";

import { buildJurisdiction } from "../jsonld";

test("closed sovereign-state entries emit schema.org Country", () => {
  const node = buildJurisdiction({
    name: "Japan",
    path: "/country/japan",
    wikidataQid: "Q17",
    sovereignState: true,
    statusLabel: "UN member state",
    statusNote: "Listed in the closed UN member-state inventory.",
  });

  assert.equal(node?.["@type"], "Country");
  assert.match(String(node?.description), /UN member state/);
});

test("other reference identities emit neutral schema.org Place nodes", () => {
  const node = buildJurisdiction({
    name: "Cook Islands",
    path: "/country/cook-islands",
    wikidataQid: "Q26988",
    sovereignState: false,
    statusLabel: "State in free association",
    statusNote: "Civica records the sourced constitutional relationship.",
  });

  assert.equal(node?.["@type"], "Place");
  assert.match(String(node?.description), /free association/i);
  assert.match(String(node?.["@id"]), /#jurisdiction$/);
});

test("a route without a sourced identity link does not manufacture a node", () => {
  assert.equal(
    buildJurisdiction({
      name: "Example",
      path: "/country/example",
      wikidataQid: null,
      sovereignState: false,
      statusLabel: "Special entry",
      statusNote: "No linked identity is available.",
    }),
    null,
  );
});
