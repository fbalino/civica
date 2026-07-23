import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import {
  PARAM_CONTRACT_SCHEMAS,
  QUERY_CONTRACT_SCHEMAS,
  parsePathContract,
  parseQueryContract,
} from "./request-contract";
import { REQUEST_BODY_LIMITS } from "./request-body-schemas";
import {
  inspectBoundedBodyParserInvocation,
  inspectSafeParseInvocation,
  inspectSchemaParserInvocation,
} from "./route-io-policy/checks";
import { REQUEST_CONTRACT_MAPPINGS } from "./route-io-policy/registry";

function request(query = "") {
  return new Request(`https://civicaatlas.org/test${query}`);
}

async function assertGenericFailure(result: {
  ok: boolean;
  response?: Response;
}) {
  assert.equal(result.ok, false);
  assert.ok(result.response);
  assert.equal(result.response.status, 400);
  assert.equal(result.response.headers.get("Cache-Control"), "no-store");
  assert.deepEqual(await result.response.json(), {
    error: "Invalid query parameters.",
    code: "INVALID_QUERY",
  });
}

test("query contracts apply defaults and typed transformations", () => {
  const admin = parseQueryContract(request(), "admin-advisory-queue-query/v1");
  assert.deepEqual(admin, {
    ok: true,
    data: { limit: 50, offset: 0 },
  });

  const metric = parseQueryContract(
    request(
      "?year=2024&govTypes=Parliamentary%20republic,Constitutional%20monarchy&regions=Europe&taxonomy=structural&country=uruguay",
    ),
    "metric-strip-query/v1",
  );
  assert.deepEqual(metric, {
    ok: true,
    data: {
      year: 2024,
      govTypes: ["Parliamentary republic", "Constitutional monarchy"],
      regions: ["Europe"],
      taxonomy: "structural",
      country: "uruguay",
    },
  });

  const pulse = parseQueryContract(
    request("?published_only=1&limit=12"),
    "v1-pulse-changelog-query/v1",
  );
  assert.deepEqual(pulse, {
    ok: true,
    data: { published_only: true, limit: 12, offset: 0 },
  });

  assert.deepEqual(
    parseQueryContract(request(), "v1-index-methodology-query/v1"),
    {
      ok: true,
      data: {},
    },
  );
  assert.deepEqual(
    parseQueryContract(
      request("?version=beta-r4"),
      "v1-index-methodology-query/v1",
    ),
    {
      ok: true,
      data: { version: "beta-r4" },
    },
  );
  assert.deepEqual(
    parseQueryContract(
      request("?release=conditions-atlas-v1"),
      "v1-conditions-query/v1",
    ),
    {
      ok: true,
      data: { release: "conditions-atlas-v1" },
    },
  );
  assert.deepEqual(
    parseQueryContract(
      request("?format=csv&indicator=rl.est&source=worldbank_wgi"),
      "indicator-history-query/v1",
    ),
    {
      ok: true,
      data: {
        format: "csv",
        indicator: "rl.est",
        source: "worldbank_wgi",
      },
    },
  );
  assert.deepEqual(
    parseQueryContract(
      request("?limit=25&offset=50"),
      "atlas-entity-history-query/v1",
    ),
    { ok: true, data: { limit: 25, offset: 50 } },
  );
});

test("repeatable query keys preserve order but scalar duplicates fail", async () => {
  const repeated = parseQueryContract(
    request("?topic=rights&c=uruguay&c=ghana&c=japan"),
    "constitution-excerpts-query/v1",
  );
  assert.deepEqual(repeated, {
    ok: true,
    data: { topic: "rights", c: ["uruguay", "ghana", "japan"] },
  });

  await assertGenericFailure(
    parseQueryContract(
      request("?limit=10&limit=11"),
      "admin-contact-queue-query/v1",
    ),
  );
  await assertGenericFailure(
    parseQueryContract(
      request("?topic=rights&c=a&c=b&c=c&c=d&c=e"),
      "constitution-excerpts-query/v1",
    ),
  );
  await assertGenericFailure(
    parseQueryContract(
      request("?slug=uruguay&slug=uruguay"),
      "v1-index-compare-query/v1",
    ),
  );
});

test("unknown keys, malformed encodings, invalid types, and ranges fail closed", async () => {
  const cases = [
    ["admin-contact-queue-query/v1", "?unknown=1"],
    ["admin-contact-queue-query/v1", "?limit=01"],
    ["admin-contact-queue-query/v1", "?limit=201"],
    ["admin-contact-queue-query/v1", "?offset=-1"],
    ["admin-contact-queue-query/v1", "?limit=%"],
    ["admin-contact-queue-query/v1", "?limit=%C3%28"],
    ["admin-contact-queue-query/v1", "?__proto__=x"],
    ["admin-contact-queue-query/v1", "?limit=1&&offset=2"],
    ["v1-elections-query/v1", "?from=2025-02-29"],
    ["v1-elections-query/v1", "?from=2025-03-02&to=2025-03-01"],
    ["v1-elections-query/v1", "?has_results=1"],
    ["metric-strip-query/v1", "?year=2024abc"],
    ["v1-index-rankings-query/v1", "?sort=other"],
    ["v1-conditions-query/v1", "?release=conditions-Atlas-v1"],
    [
      "v1-index-methodology-query/v1",
      "?release=ci-beta-r5-2024-Q4&version=beta-r4",
    ],
  ] as const;

  for (const [schemaId, query] of cases) {
    await assertGenericFailure(parseQueryContract(request(query), schemaId));
  }
});

test("OAuth and constitution-search contracts accept their bounded real shapes", () => {
  const oauth = parseQueryContract(
    request(
      "?code=opaque-code&state=0123456789abcdef0123456789abcdef0123456789abcdef&scope=openid+email&authuser=0&prompt=consent",
    ),
    "oauth-callback-query/v1",
  );
  assert.deepEqual(oauth, {
    ok: true,
    data: {
      code: "opaque-code",
      state: "0123456789abcdef0123456789abcdef0123456789abcdef",
      scope: "openid email",
      authuser: 0,
      prompt: "consent",
    },
  });

  const search = parseQueryContract(
    request(
      "?q=freedom+of+speech&jurisdiction=uruguay&jurisdiction=ghana&topic=rights&limit=10",
    ),
    "constitution-search-query/v1",
  );
  assert.deepEqual(search, {
    ok: true,
    data: {
      q: "freedom of speech",
      jurisdiction: ["uruguay", "ghana"],
      topic: ["rights"],
      language: "en",
      limit: 10,
    },
  });
});

test("all declared GET query schemas accept their canonical minimum shape", () => {
  const cases = [
    ["admin-advisory-queue-query/v1", ""],
    ["admin-contact-queue-query/v1", ""],
    ["oauth-callback-query/v1", ""],
    ["oauth-start-query/v1", ""],
    ["constitution-notable-query/v1", "?topic=rights"],
    ["constitution-excerpts-query/v1", "?topic=rights"],
    ["constitution-search-query/v1", "?q=rule+of+law"],
    ["country-export-query/v1", "?as_of=live"],
    ["indicator-history-query/v1", ""],
    ["atlas-entity-history-query/v1", ""],
    ["governance-evidence-query/v1", ""],
    ["metric-strip-query/v1", "?year=2024"],
    ["v1-country-detail-query/v1", "?as_of=live"],
    ["v1-countries-query/v1", "?as_of=live"],
    ["v1-conditions-query/v1", ""],
    ["v1-elections-query/v1", ""],
    ["v1-atlas-query/v1", ""],
    ["v1-index-history-query/v1", ""],
    ["v1-index-country-query/v1", ""],
    ["v1-index-group-query/v1", ""],
    ["v1-index-compare-query/v1", "?slug=uruguay"],
    ["v1-index-methodology-query/v1", ""],
    ["v1-index-rankings-query/v1", ""],
    ["v1-pulse-changelog-query/v1", ""],
  ] as const;

  assert.equal(cases.length, Object.keys(QUERY_CONTRACT_SCHEMAS).length);
  for (const [schemaId, query] of cases) {
    assert.equal(
      parseQueryContract(request(query), schemaId).ok,
      true,
      schemaId,
    );
  }
});

test("path contracts reject malformed and extra fields with a generic response", async () => {
  const valid = await parsePathContract(
    Promise.resolve({ slug: "cote-divoire" }),
    "jurisdiction-slug-params/v1",
  );
  assert.deepEqual(valid, { ok: true, data: { slug: "cote-divoire" } });

  for (const params of [
    { slug: "Cote-Divoire" },
    { slug: "../uruguay" },
    { slug: "uruguay", extra: "1" },
  ]) {
    const result = await parsePathContract(
      Promise.resolve(params),
      "jurisdiction-slug-params/v1",
    );
    assert.equal(result.ok, false);
    if (result.ok) continue;
    assert.equal(result.response.status, 400);
    assert.equal(result.response.headers.get("Cache-Control"), "no-store");
    assert.deepEqual(await result.response.json(), {
      error: "Invalid path parameters.",
      code: "INVALID_PATH",
    });
  }
});

test("all path schemas accept their canonical identifier form", async () => {
  const uuid = "123e4567-e89b-42d3-a456-426614174000";
  const cases = [
    ["entity-citation-params/v1", { entityType: "fact", id: uuid }],
    ["constitution-passage-params/v1", { digest: `sha256:${"a".repeat(64)}` }],
    ["jurisdiction-slug-params/v1", { slug: "cote-divoire" }],
    ["pulse-study-uuid-params/v1", { studyId: uuid }],
    ["pulse-country-slug-params/v1", { country_slug: "uruguay" }],
    ["embed-slug-params/v1", { slug: "ghana" }],
    ["metric-id-params/v1", { metricId: "wgi.rl-est" }],
    ["v1-country-code-params/v1", { code: "URY" }],
  ] as const;

  assert.equal(cases.length, Object.keys(PARAM_CONTRACT_SCHEMAS).length);
  for (const [schemaId, params] of cases) {
    assert.equal(
      (await parsePathContract(Promise.resolve(params), schemaId)).ok,
      true,
      schemaId,
    );
  }
});

test("query decoder fuzz cases never throw or reflect input", async () => {
  const malformed = [
    "%",
    "%0",
    "%GG",
    "%ED%A0%80",
    "%F4%90%80%80",
    "constructor",
    "__proto__",
    "prototype",
    "\0",
    "a".repeat(9_000),
  ];

  for (const value of malformed) {
    const encoded = value.includes("%") ? value : encodeURIComponent(value);
    const result = parseQueryContract(
      request(`?limit=${encoded}`),
      "admin-contact-queue-query/v1",
    );
    await assertGenericFailure(result);
  }
});

// Cron request parsing is runtime-proven by cron-routes-integration.test.ts
// and cron-job.test.ts because each route exports a preconfigured wrapper.
const SPECIALIZED_CRON_QUERY_GATES = new Set([
  "cron-dry-run-query/v1",
  "cron-auto-resolve-query/v1",
  "cron-snapshot-vintage-query/v1",
  "cron-cia-shard-query/v1",
  "cron-verify-reconciliation-query/v1",
]);

const PARAM_EQUIVALENTS: Readonly<Record<string, string>> = {
  "pulse-study-uuid-params/v1": "requestUuidSchema",
};

type RequestBodyLimitKey = keyof typeof REQUEST_BODY_LIMITS;

const BODY_SCHEMA_EXPECTATIONS: Readonly<
  Record<
    string,
    {
      media: ReadonlyArray<{ mediaType: string; schema: string }>;
      limit: RequestBodyLimitKey;
    }
  >
> = {
  "admin-advisory-mutation-body/v1": {
    media: [
      {
        mediaType: "JSON_MEDIA_TYPE",
        schema: "adminAdvisoryMutationBodySchema",
      },
      {
        mediaType: "FORM_MEDIA_TYPE",
        schema: "adminAdvisoryMutationFormSchema",
      },
    ],
    limit: "adminAdvisoryMutation",
  },
  "admin-dispute-review-body/v1": {
    media: [
      { mediaType: "JSON_MEDIA_TYPE", schema: "adminDataDisputeBodySchema" },
      { mediaType: "FORM_MEDIA_TYPE", schema: "adminDataDisputeFormSchema" },
    ],
    limit: "adminDataDispute",
  },
  "admin-message-status-body/v1": {
    media: [
      { mediaType: "JSON_MEDIA_TYPE", schema: "adminMessageStatusBodySchema" },
      { mediaType: "FORM_MEDIA_TYPE", schema: "adminMessageStatusFormSchema" },
    ],
    limit: "adminMessageStatus",
  },
  "admin-pulse-review-body/v1": {
    media: [
      {
        mediaType: "JSON_MEDIA_TYPE",
        schema: "adminPulseReviewJsonBodySchema",
      },
      {
        mediaType: "FORM_MEDIA_TYPE",
        schema: "adminPulseReviewFormBodySchema",
      },
    ],
    limit: "adminPulseReview",
  },
  "admin-pulse-exception-body/v1": {
    media: [
      {
        mediaType: "FORM_MEDIA_TYPE",
        schema: "adminPulseReviewExceptionFormSchema",
      },
    ],
    limit: "adminPulseReviewException",
  },
  "admin-login-body/v1": {
    media: [
      { mediaType: "JSON_MEDIA_TYPE", schema: "adminLoginBodySchema" },
      { mediaType: "FORM_MEDIA_TYPE", schema: "adminLoginBodySchema" },
    ],
    limit: "adminLogin",
  },
  "public-advisory-body/v1": {
    media: [
      {
        mediaType: "JSON_MEDIA_TYPE",
        schema: "advisoryApplicationBodySchema",
      },
    ],
    limit: "advisoryApplication",
  },
  "public-chat-body/v1": {
    media: [{ mediaType: "JSON_MEDIA_TYPE", schema: "chatBodySchema" }],
    limit: "chat",
  },
  "public-correction-body/v1": {
    media: [{ mediaType: "JSON_MEDIA_TYPE", schema: "correctionBodySchema" }],
    limit: "correction",
  },
  "public-contact-body/v1": {
    media: [{ mediaType: "JSON_MEDIA_TYPE", schema: "contactBodySchema" }],
    limit: "contact",
  },
  "client-error-monitoring-body/v1": {
    media: [
      {
        mediaType: "JSON_MEDIA_TYPE",
        schema: "clientErrorMonitoringBodySchema",
      },
    ],
    limit: "clientErrorMonitoring",
  },
  "pulse-adjudication-body/v1": {
    media: [
      {
        mediaType: "JSON_MEDIA_TYPE",
        schema: "pulseCodingAdjudicationBodySchema",
      },
    ],
    limit: "pulseCodingAdjudication",
  },
  "pulse-participant-body/v1": {
    media: [
      {
        mediaType: "JSON_MEDIA_TYPE",
        schema: "pulseCodingParticipantBodySchema",
      },
    ],
    limit: "pulseParticipant",
  },
  "pulse-assignment-body/v1": {
    media: [
      {
        mediaType: "JSON_MEDIA_TYPE",
        schema: "pulseCodingAssignmentBodySchema",
      },
    ],
    limit: "pulseCodingDraft",
  },
  "pulse-login-body/v1": {
    media: [
      { mediaType: "FORM_MEDIA_TYPE", schema: "pulseCodingLoginFormSchema" },
    ],
    limit: "pulseCodingLogin",
  },
};

const BODY_PARAM_EQUIVALENTS: Readonly<Record<string, string>> = {
  "admin-resource-uuid-params/v1": "requestUuidSchema",
  "pulse-assignment-uuid-params/v1": "requestUuidSchema",
};

test("every declared request schema is implemented and invoked", async () => {
  const root = process.cwd();
  const sourceCache = new Map<string, string>();
  const source = async (relativePath: string) => {
    const prior = sourceCache.get(relativePath);
    if (prior !== undefined) return prior;
    const contents = await readFile(path.join(root, relativePath), "utf8");
    sourceCache.set(relativePath, contents);
    return contents;
  };

  for (const mapping of REQUEST_CONTRACT_MAPPINGS) {
    if (mapping.contract.body.kind !== "none") {
      const body = mapping.contract.body;
      const expectation = BODY_SCHEMA_EXPECTATIONS[body.schemaId];
      assert.ok(expectation, `missing body expectation: ${body.schemaId}`);
      assert.equal(
        REQUEST_BODY_LIMITS[expectation.limit],
        body.maxBytes,
        `${body.schemaId} byte limit drifted from route policy`,
      );

      for (const endpoint of mapping.endpoints) {
        const contents = await source(`src/app/${endpoint.filePath}`);
        for (const method of endpoint.methods) {
          assert.deepEqual(
            inspectBoundedBodyParserInvocation(
              contents,
              method,
              { limitKey: expectation.limit, media: expectation.media },
              endpoint.filePath,
            ),
            [],
            `${endpoint.filePath}#${method} body parser contract drifted`,
          );
        }

        const paramsId = mapping.contract.paramsSchemaId;
        if (paramsId !== "none") {
          const marker = BODY_PARAM_EQUIVALENTS[paramsId];
          assert.ok(marker, `missing body path equivalent: ${paramsId}`);
          for (const method of endpoint.methods) {
            assert.deepEqual(
              inspectSafeParseInvocation(
                contents,
                method,
                marker,
                endpoint.filePath,
              ),
              [],
              `${endpoint.filePath}#${method} does not validate ${paramsId}`,
            );
          }
        }
        if (mapping.contract.headerSchemaId === "pulse-idempotency/v1") {
          for (const method of endpoint.methods) {
            assert.deepEqual(
              inspectSafeParseInvocation(
                contents,
                method,
                "optionalIdempotencyKeySchema",
                endpoint.filePath,
              ),
              [],
              `${endpoint.filePath}#${method} does not validate its idempotency header`,
            );
          }
        }
      }
      continue;
    }

    const queryId = mapping.contract.querySchemaId;
    if (queryId !== "none") {
      if (SPECIALIZED_CRON_QUERY_GATES.has(queryId)) {
        assert.match(queryId, /^cron-/);
      } else {
        assert.ok(
          Object.hasOwn(QUERY_CONTRACT_SCHEMAS, queryId),
          `missing query registry entry: ${queryId}`,
        );
        for (const endpoint of mapping.endpoints) {
          const contents = await source(`src/app/${endpoint.filePath}`);
          for (const method of endpoint.methods) {
            assert.deepEqual(
              inspectSchemaParserInvocation(
                contents,
                method,
                "parseQueryContract",
                queryId,
                endpoint.filePath,
              ),
              [],
              `${endpoint.filePath}#${method} does not invoke ${queryId}`,
            );
          }
        }
      }
    }

    const paramsId = mapping.contract.paramsSchemaId;
    if (paramsId !== "none") {
      const equivalent = PARAM_EQUIVALENTS[paramsId];
      if (equivalent) {
        for (const endpoint of mapping.endpoints) {
          const contents = await source(`src/app/${endpoint.filePath}`);
          for (const method of endpoint.methods) {
            assert.deepEqual(
              inspectSafeParseInvocation(
                contents,
                method,
                equivalent,
                endpoint.filePath,
              ),
              [],
              `${endpoint.filePath}#${method} does not validate ${paramsId}`,
            );
          }
        }
      } else {
        assert.ok(
          Object.hasOwn(PARAM_CONTRACT_SCHEMAS, paramsId),
          `missing path registry entry: ${paramsId}`,
        );
        for (const endpoint of mapping.endpoints) {
          const contents = await source(`src/app/${endpoint.filePath}`);
          for (const method of endpoint.methods) {
            assert.deepEqual(
              inspectSchemaParserInvocation(
                contents,
                method,
                "parsePathContract",
                paramsId,
                endpoint.filePath,
              ),
              [],
              `${endpoint.filePath}#${method} does not invoke ${paramsId}`,
            );
          }
        }
      }
    }
  }
});
