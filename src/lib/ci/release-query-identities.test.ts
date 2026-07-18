import assert from "node:assert/strict";
import test from "node:test";

import { CI_RELEASE_QUERY_IDENTITIES } from "./release-query-identities";
import { CI_RELEASE_CONTRACTS } from "./release-selection";

test("edge-safe release query identities match the frozen release registry", () => {
  assert.deepEqual(
    CI_RELEASE_QUERY_IDENTITIES,
    CI_RELEASE_CONTRACTS.map(({ releaseId, methodologyVersion }) => ({
      releaseId,
      methodologyVersion,
    })),
  );
});
