import assert from "node:assert/strict";
import test from "node:test";

import PARTY_COLOR_REGISTRY from "./party-color-registry.json";
import { resolvePartyColor } from "./party-colors";

test("party color resolution preserves registered party-brand metadata", () => {
  assert.equal(
    resolvePartyColor(null, "Democratic Party", 0),
    PARTY_COLOR_REGISTRY.wellKnownParties["democratic party"],
  );
  assert.equal(
    resolvePartyColor("teal", null, 0),
    PARTY_COLOR_REGISTRY.namedColors.teal,
  );
  assert.equal(
    resolvePartyColor(null, null, 3),
    PARTY_COLOR_REGISTRY.fallbackPalette[3],
  );
});
