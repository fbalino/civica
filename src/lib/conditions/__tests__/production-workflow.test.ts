import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  CONDITIONS_COVERAGE_ADMISSION_JURISDICTION_STATUS,
  WORLD_BANK_ECONOMIC_CAPTURE_SCHEMA_VERSION,
  WORLD_BANK_ECONOMIC_DATE_RANGE,
  WORLD_BANK_ECONOMIC_INDICATORS,
  WORLD_BANK_ECONOMIC_MINIMUM_COVERAGE_RATIO,
  buildWorldBankEconomicCapture,
  captureWorldBankEconomicInputs,
  isConditionsCoverageAdmissionEligible,
  prepareGpiConditions,
  prepareHdiConditions,
  readWorldBankEconomicCapture,
  runCombinedConditionsIngestion,
  validateWorldBankEconomicCapture,
  worldBankRequestCountryCode,
  worldBankEconomicObservationsFromCapture,
  writeWorldBankEconomicCapture,
  type PreparedConditionsDimension,
  type WorldBankEconomicCaptureResponse,
} from "../production-workflow";
import type { ConditionsDimension } from "../contract";
import { CONDITIONS_MISSINGNESS_POLICY } from "../release";
import { JURISDICTION_STATUS_TYPES } from "../../jurisdictions/status-taxonomy";

const jurisdiction = {
  id: "11111111-1111-4111-8111-111111111111",
  iso2: "UY",
  requestCountryCode: "URY",
  jurisdictionStatus: "sovereign_state",
};

test("World Bank request codes use the publisher-specific Kosovo identity", () => {
  assert.equal(
    worldBankRequestCountryCode({ iso2: "XK", iso3: "XKS" }),
    "XKX",
  );
  assert.equal(
    worldBankRequestCountryCode({ iso2: "UY", iso3: "URY" }),
    "URY",
  );
  assert.equal(
    worldBankRequestCountryCode({ iso2: "JE", iso3: null }),
    "JE",
  );
});

function preparedConditionsDimension(
  dimension: ConditionsDimension,
  expectedCalculationCount = 1,
): PreparedConditionsDimension {
  const includedComponents =
    dimension === "human_development"
      ? ["hdi"]
      : dimension === "peace_security"
        ? ["global_peace_index"]
        : ["inflation", "unemployment", "gdp_growth"];
  return {
    rows: [
      {
        dimension,
        calculationKey: `fixture:${dimension}`,
      },
    ] as never,
    referenceSets: [
      {
        dimension,
        referencePeriod: "2024",
        jurisdictionIds: [jurisdiction.id],
        candidateCount: 1,
        alignedCount: 1,
        mixedYearRefusedCount: 0,
        missingComponentCount: 0,
        includedComponents,
        missingnessPolicy: CONDITIONS_MISSINGNESS_POLICY,
        parameters: [],
      },
    ] as never,
    expectedCalculationCount,
  };
}

function sourceScoreRow(input: {
  id: string;
  jurisdictionId?: string;
  dimension?: "human_development" | "stability_security";
  quarter: string;
  rawValue: number;
  releaseId: string;
  createdAt: string;
}) {
  const isGpi = input.dimension === "stability_security";
  return {
    id: input.id,
    jurisdictionId: input.jurisdictionId ?? jurisdiction.id,
    dimension: input.dimension ?? "human_development",
    quarter: input.quarter,
    normalizedScore: isGpi
      ? ((5 - input.rawValue) / 4) * 100
      : input.rawValue * 100,
    rawValue: input.rawValue,
    sourceId: isGpi ? "global_peace_index" : "undp_hdi",
    indicatorId: isGpi ? "GPI_SCORE" : "HDI",
    upstreamRelease: isGpi
      ? "Global Peace Index fixture"
      : "UNDP Human Development Report fixture",
    artifactHash: (isGpi ? "b" : "a").repeat(64),
    artifactKind: "normalized_batch",
    temporalCoverage: isGpi ? "2008/2024" : "1990/2023",
    licenseUrl: isGpi
      ? "https://www.visionofhumanity.org"
      : "https://hdr.undp.org",
    transformationId: "source-native-history/v1",
    substitutionReason: null,
    methodVersion: "history-v1",
    ingestionId: null,
    methodologyVersion: "v1.0",
    releaseId: input.releaseId,
    derivationVersionKey: "fixture",
    derivationVersions: {},
    createdAt: new Date(input.createdAt),
  };
}

function capturedResponse(
  targetJurisdiction: {
    id: string;
    iso2: string;
    requestCountryCode: string;
  },
  indicatorId: string,
  responseBody: string,
  httpStatus = 200,
): WorldBankEconomicCaptureResponse {
  return {
    jurisdictionId: targetJurisdiction.id,
    iso2: targetJurisdiction.iso2,
    requestCountryCode: targetJurisdiction.requestCountryCode,
    indicatorId,
    requestUrl:
      `https://api.worldbank.org/v2/country/${targetJurisdiction.requestCountryCode}/indicator/${indicatorId}?format=json&date=${WORLD_BANK_ECONOMIC_DATE_RANGE}&per_page=10`,
    httpStatus,
    retrievedAt: "2026-07-25T12:00:00.000Z",
    responseBodySha256: createHash("sha256").update(responseBody).digest("hex"),
    responseBody,
  };
}

function response(
  indicatorId: string,
  value: number | null,
): WorldBankEconomicCaptureResponse {
  const responseBody = JSON.stringify([
    { page: 1 },
    [{ date: "2024", value }],
  ]);
  return capturedResponse(jurisdiction, indicatorId, responseBody);
}

const coverageJurisdictions = [
  jurisdiction,
  {
    id: "22222222-2222-4222-8222-222222222222",
    iso2: "FR",
    requestCountryCode: "FRA",
    jurisdictionStatus: "sovereign_state",
  },
  {
    id: "33333333-3333-4333-8333-333333333333",
    iso2: "DE",
    requestCountryCode: "DEU",
    jurisdictionStatus: "sovereign_state",
  },
  {
    id: "44444444-4444-4444-8444-444444444444",
    iso2: "JP",
    requestCountryCode: "JPN",
    jurisdictionStatus: "sovereign_state",
  },
] as const;

function coverageCapture(
  observationFor: (
    jurisdictionIndex: number,
    indicatorId: string,
  ) => { value: number | null; year?: string },
) {
  return buildWorldBankEconomicCapture(
    coverageJurisdictions.flatMap((targetJurisdiction, jurisdictionIndex) =>
      Object.values(WORLD_BANK_ECONOMIC_INDICATORS).map((indicatorId) => {
        const observation = observationFor(jurisdictionIndex, indicatorId);
        return capturedResponse(
          targetJurisdiction,
          indicatorId,
          JSON.stringify([
            { page: 1 },
            [
              {
                date: observation.year ?? "2024",
                value: observation.value,
              },
            ],
          ]),
        );
      }),
    ),
  );
}

test("combined Conditions workflow forwards one explicit release and dry-run to one writer", async () => {
  const calls: string[] = [];
  let writeArgs: unknown[] | null = null;
  const result = await runCombinedConditionsIngestion({} as never, {
    releaseId: "conditions-forwarding-fixture-v1",
    dryRun: true,
    inputFile: "/tmp/economic-capture.json",
    dependencies: {
      prepareHdi: async (_db, releaseId) => {
        calls.push(`hdi:${releaseId}`);
        return preparedConditionsDimension("human_development");
      },
      prepareGpi: async (_db, releaseId) => {
        calls.push(`gpi:${releaseId}`);
        return preparedConditionsDimension("peace_security");
      },
      prepareEconomic: async (_db, releaseId, options) => {
        calls.push(`economic:${releaseId}:${options.inputFile}`);
        return preparedConditionsDimension("economic_stability");
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
  assert.deepEqual(result.expectedCalculationCounts, {
    human_development: 1,
    peace_security: 1,
    economic_stability: 1,
  });
});

test("combined Conditions workflow refuses a mismatched expected calculation count before writing", async () => {
  let writerCalled = false;

  await assert.rejects(
    runCombinedConditionsIngestion({} as never, {
      releaseId: "conditions-count-mismatch-fixture-v1",
      dryRun: true,
      inputFile: "/tmp/economic-capture.json",
      dependencies: {
        prepareHdi: async () =>
          preparedConditionsDimension("human_development", 2),
        prepareGpi: async () =>
          preparedConditionsDimension("peace_security"),
        prepareEconomic: async () =>
          preparedConditionsDimension("economic_stability"),
        writeRelease: (async () => {
          writerCalled = true;
          throw new Error("writer must not run");
        }) as never,
      },
    }),
    /human_development produced 1 calculations; expected 2/,
  );
  assert.equal(writerCalled, false);
});

test("combined Conditions workflow refuses apply without a pre-write expectations artifact", async () => {
  let writerCalled = false;
  await assert.rejects(
    runCombinedConditionsIngestion({} as never, {
      releaseId: "conditions-missing-expectations-fixture-v1",
      dryRun: false,
      inputFile: "/tmp/economic-capture.json",
      dependencies: {
        writeRelease: (async () => {
          writerCalled = true;
          throw new Error("writer must not run");
        }) as never,
      },
    }),
    /apply requires a pre-write release expectations artifact/,
  );
  assert.equal(writerCalled, false);
});

test("combined Conditions workflow binds apply to the pre-write manifest expectation", async () => {
  let writerCalled = false;

  await assert.rejects(
    runCombinedConditionsIngestion({} as never, {
      releaseId: "conditions-manifest-mismatch-fixture-v1",
      dryRun: false,
      inputFile: "/tmp/economic-capture.json",
      releaseExpectations: {
        releaseManifestSha256: "f".repeat(64),
        expectedCalculationCounts: {
          human_development: 1,
          peace_security: 1,
          economic_stability: 1,
        },
      },
      dependencies: {
        prepareHdi: async () =>
          preparedConditionsDimension("human_development"),
        prepareGpi: async () =>
          preparedConditionsDimension("peace_security"),
        prepareEconomic: async () =>
          preparedConditionsDimension("economic_stability"),
        writeRelease: (async () => {
          writerCalled = true;
          throw new Error("writer must not run");
        }) as never,
      },
    }),
    /prepared manifest does not match the pre-write expectations artifact/,
  );
  assert.equal(writerCalled, false);
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
  await assert.rejects(
    captureWorldBankEconomicInputs({
      jurisdictions: [jurisdiction],
      fetchImpl: async () =>
        new Response(
          JSON.stringify([
            {
              message: [
                {
                  id: "999",
                  key: "Invalid value",
                  value: "The provided parameter value is not valid",
                },
              ],
            },
          ]),
          { status: 200 },
        ),
    }),
    /invalid indicator payload/,
  );
  await assert.rejects(
    captureWorldBankEconomicInputs({
      jurisdictions: [jurisdiction],
      fetchImpl: async () =>
        new Response(
          JSON.stringify([
            {
              message: [
                {
                  id: "120",
                  key: "Unexpected response",
                  value: "The provided parameter value is not valid",
                },
              ],
            },
          ]),
          { status: 200 },
        ),
    }),
    /invalid indicator payload/,
  );
  await assert.rejects(
    captureWorldBankEconomicInputs({
      jurisdictions: [jurisdiction],
      fetchImpl: async () =>
        new Response(
          JSON.stringify([
            {
              message: [
                {
                  id: "120",
                  key: "Invalid value",
                  value: "Publisher contract changed",
                },
              ],
            },
          ]),
          { status: 200 },
        ),
    }),
    /invalid indicator payload/,
  );
  await assert.rejects(
    captureWorldBankEconomicInputs({
      jurisdictions: [jurisdiction],
      fetchImpl: async () =>
        new Response(
          JSON.stringify([
            {
              message: [
                {
                  key: "Invalid value",
                  value: "The provided parameter value is not valid",
                },
              ],
            },
          ]),
          { status: 200 },
        ),
    }),
    /invalid indicator payload/,
  );
});

test("World Bank capture retains only the exact unsupported-country HTTP 200/400 envelope", async () => {
  const unavailableBody = JSON.stringify([
    {
      message: [
        {
          id: "120",
          key: "Invalid value",
          value: "The provided parameter value is not valid",
        },
      ],
    },
  ]);
  const capture = await captureWorldBankEconomicInputs({
    jurisdictions: [jurisdiction],
    fetchImpl: async () =>
      new Response(unavailableBody, { status: 400 }),
  });
  assert.equal(capture.responses.length, 3);
  assert.ok(
    capture.responses.every(
      (response) =>
        response.requestCountryCode === jurisdiction.requestCountryCode,
    ),
  );
  const http200Capture = await captureWorldBankEconomicInputs({
    jurisdictions: [jurisdiction],
    fetchImpl: async () =>
      new Response(unavailableBody, { status: 200 }),
  });
  assert.ok(
    http200Capture.responses.every(
      (response) => response.httpStatus === 200,
    ),
  );

  await assert.rejects(
    captureWorldBankEconomicInputs({
      jurisdictions: [jurisdiction],
      fetchImpl: async () =>
        new Response(
          JSON.stringify([
            {
              message: [
                {
                  id: "999",
                  key: "Invalid value",
                  value: "The provided parameter value is not valid",
                },
              ],
            },
          ]),
          { status: 400 },
        ),
    }),
    /invalid HTTP status\/body pairing/,
  );
});

test("World Bank capture retains only the exact empty-observation HTTP 200 envelope", async () => {
  const emptyObservationBody = JSON.stringify([
    {
      page: 0,
      pages: 0,
      per_page: 0,
      total: 0,
      sourceid: null,
      lastupdated: null,
    },
    null,
  ]);
  const capture = await captureWorldBankEconomicInputs({
    jurisdictions: [jurisdiction],
    fetchImpl: async () =>
      new Response(emptyObservationBody, { status: 200 }),
  });
  assert.equal(capture.responses.length, 3);

  await assert.rejects(
    captureWorldBankEconomicInputs({
      jurisdictions: [jurisdiction],
      fetchImpl: async () =>
        new Response(
          JSON.stringify([
            {
              page: 1,
              pages: 0,
              per_page: 0,
              total: 0,
              sourceid: null,
              lastupdated: null,
            },
            null,
          ]),
          { status: 200 },
        ),
    }),
    /invalid indicator payload/,
  );
  await assert.rejects(
    captureWorldBankEconomicInputs({
      jurisdictions: [jurisdiction],
      fetchImpl: async () =>
        new Response(emptyObservationBody, { status: 400 }),
    }),
    /invalid HTTP status\/body pairing/,
  );
});

test("World Bank publisher absence envelopes are retained as not observed", () => {
  const unsupportedJurisdiction = {
    id: "22222222-2222-4222-8222-222222222222",
    iso2: "AQ",
    requestCountryCode: "ATA",
    jurisdictionStatus: "dependency_or_territory",
  };
  const observedJurisdictions = [
    {
      id: "33333333-3333-4333-8333-333333333333",
      iso2: "FR",
      requestCountryCode: "FRA",
      jurisdictionStatus: "sovereign_state",
    },
    {
      id: "44444444-4444-4444-8444-444444444444",
      iso2: "DE",
      requestCountryCode: "DEU",
      jurisdictionStatus: "sovereign_state",
    },
    {
      id: "55555555-5555-4555-8555-555555555555",
      iso2: "JP",
      requestCountryCode: "JPN",
      jurisdictionStatus: "sovereign_state",
    },
    {
      id: "66666666-6666-4666-8666-666666666666",
      iso2: "CA",
      requestCountryCode: "CAN",
      jurisdictionStatus: "sovereign_state",
    },
    {
      id: "77777777-7777-4777-8777-777777777777",
      iso2: "AU",
      requestCountryCode: "AUS",
      jurisdictionStatus: "sovereign_state",
    },
    {
      id: "88888888-8888-4888-8888-888888888888",
      iso2: "BR",
      requestCountryCode: "BRA",
      jurisdictionStatus: "sovereign_state",
    },
  ];
  const observedBody = JSON.stringify([
    { page: 1 },
    [{ date: "2024", value: 1 }],
  ]);
  const emptyObservationBody = JSON.stringify([
    {
      page: 0,
      pages: 0,
      per_page: 0,
      total: 0,
      sourceid: null,
      lastupdated: null,
    },
    null,
  ]);
  const responses = [
    ...observedJurisdictions.flatMap((observedJurisdiction) =>
      Object.values(WORLD_BANK_ECONOMIC_INDICATORS).map((indicatorId) =>
        capturedResponse(observedJurisdiction, indicatorId, observedBody),
      ),
    ),
    ...Object.values(WORLD_BANK_ECONOMIC_INDICATORS).map((indicatorId) =>
      capturedResponse(
        jurisdiction,
        indicatorId,
        JSON.stringify([
          {
            message: [
              {
                id: "120",
                key: "Invalid value",
                value: "The provided parameter value is not valid.",
              },
            ],
          },
        ]),
        400,
      ),
    ),
    ...Object.values(WORLD_BANK_ECONOMIC_INDICATORS).map((indicatorId) =>
      capturedResponse(
        unsupportedJurisdiction,
        indicatorId,
        emptyObservationBody,
      ),
    ),
  ];
  const capture = buildWorldBankEconomicCapture(responses);
  const observations = worldBankEconomicObservationsFromCapture(capture, [
    jurisdiction,
    unsupportedJurisdiction,
    ...observedJurisdictions,
  ]);

  for (const unavailable of observations.slice(0, 2)) {
    assert.equal(unavailable.inflation.valueStatus, "not_observed");
    assert.equal(unavailable.unemployment.valueStatus, "not_observed");
    assert.equal(unavailable.gdpGrowth.valueStatus, "not_observed");
    assert.equal(unavailable.inflation.value, null);
    assert.equal(unavailable.inflation.referenceYear, null);
    assert.match(
      unavailable.inflation.valueStatusReason ?? "",
      /World Bank/,
    );
  }
  assert.ok(
    observations
      .slice(2)
      .every((observation) => observation.inflation.valueStatus === "observed"),
  );
  assert.equal(capture.responses.length, 24);
});

test("HDI preparation deterministically keeps one latest-period row per jurisdiction", async () => {
  const secondJurisdictionId = "22222222-2222-4222-8222-222222222222";
  const sourceRows = [
    sourceScoreRow({
      id: "00000000-0000-4000-8000-000000000001",
      quarter: "2022-Q4",
      rawValue: 0.7,
      releaseId: "index-hdi-old-v1",
      createdAt: "2026-07-25T14:00:00.000Z",
    }),
    sourceScoreRow({
      id: "00000000-0000-4000-8000-000000000002",
      quarter: "2023-Q4",
      rawValue: 0.8,
      releaseId: "index-hdi-latest-a-v1",
      createdAt: "2026-07-25T12:00:00.000Z",
    }),
    sourceScoreRow({
      id: "00000000-0000-4000-8000-000000000003",
      quarter: "2023-Q4",
      rawValue: 0.82,
      releaseId: "index-hdi-latest-b-v1",
      createdAt: "2026-07-25T13:00:00.000Z",
    }),
    sourceScoreRow({
      id: "00000000-0000-4000-8000-000000000004",
      jurisdictionId: secondJurisdictionId,
      quarter: "2021-Q4",
      rawValue: 0.6,
      releaseId: "index-hdi-second-v1",
      createdAt: "2026-07-25T11:00:00.000Z",
    }),
  ];
  const fakeDb = (rows: unknown[]) =>
    ({
      select: () => ({
        from: () => ({
          where: async () => rows,
        }),
      }),
    }) as never;

  const releaseId = "conditions-hdi-selection-fixture-v1";
  const forward = await prepareHdiConditions(fakeDb(sourceRows), releaseId);
  const reversed = await prepareHdiConditions(
    fakeDb([...sourceRows].reverse()),
    releaseId,
  );

  assert.equal(forward.rows.length, 2);
  assert.equal(forward.expectedCalculationCount, 2);
  assert.deepEqual(
    forward.rows.map((row) => ({
      jurisdictionId: row.jurisdictionId,
      quarter: row.quarter,
      rawValue: row.rawValue,
    })),
    [
      {
        jurisdictionId: jurisdiction.id,
        quarter: "2023-Q4",
        rawValue: 0.82,
      },
      {
        jurisdictionId: secondJurisdictionId,
        quarter: "2021-Q4",
        rawValue: 0.6,
      },
    ],
  );
  assert.deepEqual(reversed, forward);
  assert.equal(
    new Set(
      forward.rows.map((row) => `${row.jurisdictionId}:${row.dimension}`),
    ).size,
    forward.rows.length,
  );
});

test("GPI preparation deterministically keeps one latest-period row per jurisdiction", async () => {
  const secondJurisdictionId = "22222222-2222-4222-8222-222222222222";
  const sourceRows = [
    sourceScoreRow({
      id: "00000000-0000-4000-8000-000000000011",
      dimension: "stability_security",
      quarter: "2022-Q4",
      rawValue: 3,
      releaseId: "index-gpi-old-v1",
      createdAt: "2026-07-25T14:00:00.000Z",
    }),
    sourceScoreRow({
      id: "00000000-0000-4000-8000-000000000012",
      dimension: "stability_security",
      quarter: "2023-Q4",
      rawValue: 2.2,
      releaseId: "index-gpi-latest-a-v1",
      createdAt: "2026-07-25T13:00:00.000Z",
    }),
    sourceScoreRow({
      id: "00000000-0000-4000-8000-000000000013",
      dimension: "stability_security",
      quarter: "2023-Q4",
      rawValue: 2,
      releaseId: "index-gpi-latest-b-v1",
      createdAt: "2026-07-25T13:00:00.000Z",
    }),
    sourceScoreRow({
      id: "00000000-0000-4000-8000-000000000014",
      jurisdictionId: secondJurisdictionId,
      dimension: "stability_security",
      quarter: "2021-Q4",
      rawValue: 1.5,
      releaseId: "index-gpi-second-v1",
      createdAt: "2026-07-25T11:00:00.000Z",
    }),
  ];
  const fakeDb = (rows: unknown[]) =>
    ({
      select: () => ({
        from: () => ({
          where: async () => rows,
        }),
      }),
    }) as never;

  const releaseId = "conditions-gpi-selection-fixture-v1";
  const forward = await prepareGpiConditions(fakeDb(sourceRows), releaseId);
  const reversed = await prepareGpiConditions(
    fakeDb([...sourceRows].reverse()),
    releaseId,
  );

  assert.equal(forward.expectedCalculationCount, 2);
  assert.deepEqual(
    forward.rows.map((row) => ({
      jurisdictionId: row.jurisdictionId,
      quarter: row.quarter,
      rawValue: row.rawValue,
    })),
    [
      {
        jurisdictionId: jurisdiction.id,
        quarter: "2023-Q4",
        rawValue: 2,
      },
      {
        jurisdictionId: secondJurisdictionId,
        quarter: "2021-Q4",
        rawValue: 1.5,
      },
    ],
  );
  assert.deepEqual(reversed, forward);
  assert.equal(
    new Set(
      forward.rows.map((row) => `${row.jurisdictionId}:${row.dimension}`),
    ).size,
    forward.rows.length,
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
  assert.ok(maxActive <= 2);
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

test("World Bank component and aligned-reference coverage pass exactly at the adopted floor", () => {
  assert.equal(WORLD_BANK_ECONOMIC_MINIMUM_COVERAGE_RATIO, 0.75);
  const capture = coverageCapture((jurisdictionIndex) => ({
    value: jurisdictionIndex < 3 ? 1 : null,
  }));

  const observations = worldBankEconomicObservationsFromCapture(
    capture,
    coverageJurisdictions,
  );

  assert.equal(observations.length, 4);
  assert.equal(observations[3].inflation.valueStatus, "not_observed");
  assert.equal(observations[3].unemployment.valueStatus, "not_observed");
  assert.equal(observations[3].gdpGrowth.valueStatus, "not_observed");
});

test("Conditions coverage admission matches the public sovereign-state eligibility contract", async () => {
  assert.equal(
    CONDITIONS_COVERAGE_ADMISSION_JURISDICTION_STATUS,
    "sovereign_state",
  );
  assert.deepEqual(
    JURISDICTION_STATUS_TYPES.filter((jurisdictionStatus) =>
      isConditionsCoverageAdmissionEligible({ jurisdictionStatus }),
    ),
    ["sovereign_state"],
  );

  const querySource = await readFile("src/lib/db/queries.ts", "utf8");
  const publicReadStart = querySource.indexOf(
    "export async function getConditionsPublicRelease",
  );
  const publicReadEnd = querySource.indexOf(
    "The non-display Conditions ledger",
    publicReadStart,
  );
  assert.ok(publicReadStart >= 0);
  assert.ok(publicReadEnd > publicReadStart);
  const publicReadSource = querySource.slice(publicReadStart, publicReadEnd);
  const publicEligibilityClause =
    `AND jurisdiction.type = '${CONDITIONS_COVERAGE_ADMISSION_JURISDICTION_STATUS}'`;
  assert.equal(
    publicReadSource.split(publicEligibilityClause).length - 1,
    2,
    "public calculation and component reads must use the admission eligibility status",
  );
});

test("non-sovereign capture rows neither help nor harm coverage admission", () => {
  const nonSovereignJurisdictions = [
    {
      id: "55555555-5555-4555-8555-555555555555",
      iso2: "PR",
      requestCountryCode: "PRI",
      jurisdictionStatus: "dependency_or_territory",
    },
    {
      id: "66666666-6666-4666-8666-666666666666",
      iso2: "XK",
      requestCountryCode: "XKX",
      jurisdictionStatus: "disputed_or_limited_recognition",
    },
  ] as const;
  const mixedJurisdictions = [
    ...coverageJurisdictions,
    ...nonSovereignJurisdictions,
  ];
  const mixedCapture = (
    observationFor: (
      jurisdictionIndex: number,
      indicatorId: string,
    ) => { value: number | null; year?: string },
  ) =>
    buildWorldBankEconomicCapture(
      mixedJurisdictions.flatMap((targetJurisdiction, jurisdictionIndex) =>
        Object.values(WORLD_BANK_ECONOMIC_INDICATORS).map((indicatorId) => {
          const observation = observationFor(jurisdictionIndex, indicatorId);
          return capturedResponse(
            targetJurisdiction,
            indicatorId,
            JSON.stringify([
              { page: 1 },
              [
                {
                  date: observation.year ?? "2024",
                  value: observation.value,
                },
              ],
            ]),
          );
        }),
      ),
    );

  const passingCapture = mixedCapture((jurisdictionIndex, indicatorId) => ({
    value:
      jurisdictionIndex < 3 || jurisdictionIndex === 5
        ? 1
        : null,
    year:
      jurisdictionIndex === 5 &&
      indicatorId === WORLD_BANK_ECONOMIC_INDICATORS.gdpGrowth
        ? "2023"
        : "2024",
  }));
  const observations = worldBankEconomicObservationsFromCapture(
    passingCapture,
    mixedJurisdictions,
  );
  assert.equal(observations.length, 6);
  assert.equal(observations[4].inflation.valueStatus, "not_observed");
  assert.equal(observations[5].inflation.valueStatus, "observed");
  assert.equal(observations[5].gdpGrowth.referenceYear, 2023);

  const failingCapture = mixedCapture((jurisdictionIndex) => ({
    value: jurisdictionIndex < 2 || jurisdictionIndex >= 4 ? 1 : null,
  }));
  assert.throws(
    () =>
      worldBankEconomicObservationsFromCapture(
        failingCapture,
        mixedJurisdictions,
      ),
    /inflation has 2 observed jurisdictions; required at least 3 of 4 sovereign_state jurisdictions/,
  );
});

test("World Bank component coverage fails below the adopted floor", () => {
  const capture = coverageCapture((jurisdictionIndex, indicatorId) => ({
    value:
      indicatorId === WORLD_BANK_ECONOMIC_INDICATORS.inflation &&
      jurisdictionIndex >= 1
        ? null
        : 1,
  }));

  assert.throws(
    () =>
      worldBankEconomicObservationsFromCapture(
        capture,
        coverageJurisdictions,
      ),
    /inflation has 1 observed jurisdictions; required at least 3 of 4/,
  );
});

test("World Bank aligned all-component coverage fails below the adopted floor", () => {
  const capture = coverageCapture((jurisdictionIndex, indicatorId) => ({
    value: 1,
    year:
      (jurisdictionIndex === 2 &&
        indicatorId === WORLD_BANK_ECONOMIC_INDICATORS.gdpGrowth) ||
      (jurisdictionIndex === 3 &&
        indicatorId === WORLD_BANK_ECONOMIC_INDICATORS.unemployment)
        ? "2023"
        : "2024",
  }));

  assert.throws(
    () =>
      worldBankEconomicObservationsFromCapture(
        capture,
        coverageJurisdictions,
      ),
    /aligned all-component reference sets cover 2 jurisdictions; required at least 3 of 4/,
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

  const statusMutated = {
    ...capture,
    responses: capture.responses.map((captured, index) =>
      index === 0 ? { ...captured, httpStatus: 400 } : captured,
    ),
  };
  assert.ok(
    validateWorldBankEconomicCapture(statusMutated, [jurisdiction]).some(
      (error) => error.includes("captureSha256"),
    ),
  );

  const unsupportedBody = JSON.stringify([
    {
      message: [
        {
          id: "120",
          key: "Invalid value",
          value: "The provided parameter value is not valid",
        },
      ],
    },
  ]);
  const invalidStatusPairing = buildWorldBankEconomicCapture([
    capturedResponse(
      jurisdiction,
      WORLD_BANK_ECONOMIC_INDICATORS.inflation,
      unsupportedBody,
      201,
    ),
    response(WORLD_BANK_ECONOMIC_INDICATORS.unemployment, 8),
    response(WORLD_BANK_ECONOMIC_INDICATORS.gdpGrowth, 2),
  ]);
  assert.throws(
    () =>
      worldBankEconomicObservationsFromCapture(invalidStatusPairing, [
        jurisdiction,
      ]),
    /invalid response status\/body contract/,
  );
});
