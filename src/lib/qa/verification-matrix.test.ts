import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  buildVerificationMatrix,
  renderVerificationMatrix,
  verificationMatrixErrors,
} from "./verification-matrix";
import { verificationMatrixInputs } from "../../../scripts/verification-matrix-source";

test("every discovered critical surface has a closed five-layer verification posture", () => {
  const inputs = verificationMatrixInputs();
  const matrix = buildVerificationMatrix(inputs);
  assert.deepEqual(verificationMatrixErrors(matrix, inputs), []);
  assert.equal(
    readFileSync("data/verification-matrix.v1.json", "utf8"),
    renderVerificationMatrix(inputs),
  );
});

test("a missing production route cannot disappear from the matrix", () => {
  const inputs = verificationMatrixInputs();
  const matrix = buildVerificationMatrix(inputs);
  const missing = matrix.entries.find(({ kind }) => kind === "route")!;
  const damaged = { ...matrix, entries: matrix.entries.filter((entry) => entry.id !== missing.id) };
  assert.ok(
    verificationMatrixErrors(damaged, inputs).some((error) =>
      error.includes(`unregistered critical surface: ${missing.id}`),
    ),
  );
});

test("an API handler missing from the security inventory fails the matrix", () => {
  const inputs = verificationMatrixInputs();
  const unregisteredInputs = {
    ...inputs,
    productionRoutes: [
      ...inputs.productionRoutes,
      {
        sourcePath: "src/app/api/unregistered/route.ts",
        route: "/api/unregistered",
        kind: "handler" as const,
      },
    ],
  };
  const matrix = buildVerificationMatrix(unregisteredInputs);
  assert.ok(
    verificationMatrixErrors(matrix, unregisteredInputs).includes(
      "unregistered API handler: src/app/api/unregistered/route.ts",
    ),
  );
});
