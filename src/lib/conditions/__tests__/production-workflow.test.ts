import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  WORLD_BANK_ECONOMIC_CAPTURE_SCHEMA_VERSION,
  WORLD_BANK_ECONOMIC_DATE_RANGE,
  WORLD_BANK_ECONOMIC_INDICATORS,
  buildWorldBankEconomicCapture,
  captureWorldBankEconomicInputs,
  readWorldBankEconomicCapture,
  runCombinedConditionsIngestion,
  validateWorldBankEconomicCapture,
  worldBankEconomicObservationsFromCapture,
  writeWorldBankEconomicCapture,
  type PreparedConditionsDimension,
  type WorldBankEconomicCaptureResponse,
} from "../production-workflow";

const jurisdiction = {
  id: "11111111-1111-4111-8111-111111111111",
  iso2: "UY",
};

function response(
  indicatorId: string,
  value: number | null,
): WorldBankEconomicCaptureResponse {
  const responseBody = JSON.stringify([
    { page: 1 },
    [{ date: "2024", value }],
  ]);
  return {
    jurisdictionId: jurisdiction.id,
    iso2: jurisdiction.iso2,
    indicatorId,
    requestUrl:
      `https://api.worldbank.org/v2/country/UY/indicator/${indicatorId}?format=json&date=${WORLD_BANK_ECONOMIC_DATE_RANGE}&per_page=10`,
    retrievedAt: "2026-07-25T12:00:00.000Z",
    responseBodySha256: createHash("sha256").update(responseBody).digest("hex"),
    responseBody,
  };
}

test("combined Conditions workflow forwards one explicit release and dry-run to one writer", async () => {
  const calls: string[] = [];
  const prepared = (dimension: string): PreparedConditionsDimension => ({
    rows: [{ dimension }] as never,
    referenceSets: [{ dimension }] as never,
  });
  let writeArgs: unknown[] | null = null;
  const result = await runCombinedConditionsIngestion({} as never, {
    releaseId: "conditions-forwarding-fixture-v1",
    dryRun: true,
    inputFile: "/tmp/economic-capture.json",
    dependencies: {
      prepareHdi: async (_db, releaseId) => {
        calls.push(`hdi:${releaseId}`);
        return prepared("human_development");
      },
      prepareGpi: async (_db, releaseId) => {
        calls.push(`gpi:${releaseId}`);
        return prepared("peace_security");
      },
      prepareEconomic: async (_db, releaseId, options) => {
        calls.push(`economic:${releaseId}:${options.inputFile}`);
        return prepared("economic_stability");
      },
      writeRelease: (async (...args: unknown[]) => {
        writeArgs = args;
        return {
          proposed: 3,
          written: 0,
          calculationsWritten: 0,
          componentsWritten: 0,
        };
      }) as never,
    },
  });

  assert.deepEqual(calls.sort(), [
    "economic:conditions-forwarding-fixture-v1:/tmp/economic-capture.json",
    "gpi:conditions-forwarding-fixture-v1",
    "hdi:conditions-forwarding-fixture-v1",
  ]);
  assert.ok(writeArgs);
  assert.equal((writeArgs![1] as { releaseId: string }).releaseId, "conditions-forwarding-fixture-v1");
  assert.equal((writeArgs![2] as unknown[]).length, 3);
  assert.deepEqual(writeArgs![3], { dryRun: true });
  assert.equal(result.summary.proposed, 3);
});

test("World Bank transport, HTTP, and malformed payload failures fail closed", async () => {
  await assert.rejects(
    captureWorldBankEconomicInputs({
      jurisdictions: [jurisdiction],
      fetchImpl: async () => {
        throw new Error("network down");
      },
    }),
    /transport failed/,
  );
  await assert.rejects(
    captureWorldBankEconomicInputs({
      jurisdictions: [jurisdiction],
      fetchImpl: async () => new Response("unavailable", { status: 503 }),
    }),
    /HTTP 503/,
  );
  await assert.rejects(
    captureWorldBankEconomicInputs({
      jurisdictions: [jurisdiction],
      fetchImpl: async () => new Response("{}", { status: 200 }),
    }),
    /invalid indicator payload/,
  );
});

test("World Bank capture uses bounded concurrent requests", async () => {
  let active = 0;
  let maxActive = 0;
  const capture = await captureWorldBankEconomicInputs({
    jurisdictions: [jurisdiction],
    now: () => new Date("2026-07-25T12:00:00.000Z"),
    fetchImpl: async () => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, 2));
      active -= 1;
      return new Response(
        JSON.stringify([{ page: 1 }, [{ date: "2024", value: 1 }]]),
        { status: 200 },
      );
    },
  });
  assert.equal(capture.responses.length, 3);
  assert.ok(maxActive > 1);
  assert.ok(maxActive <= 8);
});

test("World Bank capture refuses zero indicator coverage", () => {
  const capture = buildWorldBankEconomicCapture(
    Object.values(WORLD_BANK_ECONOMIC_INDICATORS).map((indicatorId) =>
      response(indicatorId, null),
    ),
  );
  assert.throws(
    () => worldBankEconomicObservationsFromCapture(capture, [jurisdiction]),
    /coverage failed closed: inflation has zero observed jurisdictions/,
  );
});

test("World Bank capture replay is hash-verified, immutable, and payload-sensitive", async () => {
  const capture = buildWorldBankEconomicCapture([
    response(WORLD_BANK_ECONOMIC_INDICATORS.inflation, 5),
    response(WORLD_BANK_ECONOMIC_INDICATORS.unemployment, 8),
    response(WORLD_BANK_ECONOMIC_INDICATORS.gdpGrowth, 2),
  ]);
  assert.equal(capture.schemaVersion, WORLD_BANK_ECONOMIC_CAPTURE_SCHEMA_VERSION);
  assert.deepEqual(validateWorldBankEconomicCapture(capture, [jurisdiction]), []);
  assert.equal(
    worldBankEconomicObservationsFromCapture(capture, [jurisdiction])[0]
      .inflation.value,
    5,
  );

  const directory = await mkdtemp(join(tmpdir(), "conditions-capture-"));
  const path = join(directory, "capture.json");
  await writeWorldBankEconomicCapture(path, capture);
  const replay = await readWorldBankEconomicCapture(path);
  assert.deepEqual(replay, capture);
  await assert.rejects(writeWorldBankEconomicCapture(path, capture), /EEXIST/);
  assert.match(await readFile(path, "utf8"), new RegExp(capture.captureSha256));

  const changed = buildWorldBankEconomicCapture([
    response(WORLD_BANK_ECONOMIC_INDICATORS.inflation, 6),
    response(WORLD_BANK_ECONOMIC_INDICATORS.unemployment, 8),
    response(WORLD_BANK_ECONOMIC_INDICATORS.gdpGrowth, 2),
  ]);
  assert.notEqual(changed.captureSha256, capture.captureSha256);
});
