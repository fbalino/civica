import assert from "node:assert/strict";
import { test } from "node:test";

import {
  CURRENT_PULSE_NUMERIC_PUBLICATION_POLICY,
  buildPulseNumericPublicationPolicy,
} from "./public-numeric-policy";

const METHOD = "pulse-test-method-v1";

test("omit policy snapshot keeps research rows off every public numeric surface", () => {
  assert.deepEqual(buildPulseNumericPublicationPolicy("omit", METHOD), {
    id: "pulse-numeric-publication/omit-v1",
    mode: "omit",
    methodVersion: METHOD,
    publicStatus: "omitted_pending_validation",
    label: "Not publicly displayed",
    surfaces: { ui: false, api: false, bulkExport: false },
    limitations: [
      "Not a validated measure of governance change.",
      "Not comparable across countries as a score or ranking.",
      "Coverage, calibration, and independent review remain incomplete.",
    ],
    reconsiderationGate:
      "A new versioned policy may expose numeric effects only after the Pulse validation and disposition gates are resolved.",
  });
});

test("API-only policy snapshot exposes only versioned experimental heuristics", () => {
  assert.deepEqual(
    buildPulseNumericPublicationPolicy("api_only_experimental", METHOD),
    {
      id: "pulse-numeric-publication/api-only-experimental-v1",
      mode: "api_only_experimental",
      methodVersion: METHOD,
      publicStatus: "public_experimental",
      label: "Experimental heuristic",
      surfaces: { ui: false, api: true, bulkExport: false },
      limitations: [
        "Not a validated measure of governance change.",
        "Not comparable across countries as a score or ranking.",
        "Coverage, calibration, and independent review remain incomplete.",
      ],
      reconsiderationGate:
        "No stronger measurement, comparison, or validation claim is permitted before the Pulse validation and disposition gates are resolved.",
    },
  );
});

test("current policy is method-bound and API-only", () => {
  assert.equal(
    CURRENT_PULSE_NUMERIC_PUBLICATION_POLICY.mode,
    "api_only_experimental",
  );
  assert.equal(
    CURRENT_PULSE_NUMERIC_PUBLICATION_POLICY.publicStatus,
    "public_experimental",
  );
  assert.match(
    CURRENT_PULSE_NUMERIC_PUBLICATION_POLICY.methodVersion,
    /^pulse-v\d/,
  );
  assert.equal(
    CURRENT_PULSE_NUMERIC_PUBLICATION_POLICY.surfaces.ui,
    false,
  );
  assert.equal(
    CURRENT_PULSE_NUMERIC_PUBLICATION_POLICY.surfaces.api,
    true,
  );
  assert.equal(
    CURRENT_PULSE_NUMERIC_PUBLICATION_POLICY.surfaces.bulkExport,
    false,
  );
});
