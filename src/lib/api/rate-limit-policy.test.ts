import assert from "node:assert/strict";
import test from "node:test";

import { ROUTE_INVENTORY } from "./route-inventory/registry";
import {
  RATE_LIMIT_POLICIES,
  RATE_LIMIT_ROUTE_POLICIES,
  findProcessLocalRateLimitMarkers,
  matchesPlatformWafEvidence,
  summarizeRateLimitPolicyImplementations,
  validateRateLimitPolicyRegistry,
  type BoundedPublicReadExemptionDisposition,
  type DurableDbDisposition,
  type DurableDbPolicyDefinition,
  type PlatformWafDisposition,
  type PlatformWafEvidence,
  type PlatformWafPolicyDefinition,
  type RateLimitInventoryEntry,
  type RateLimitPolicyIssueCode,
  type RateLimitRoutePolicyMapping,
} from "./rate-limit-policy";

const TEST_DURABLE_POLICY: DurableDbPolicyDefinition = {
  id: "test-durable",
  kind: "durable-db",
  algorithm: "fixed-window",
  storage: "neon-postgres",
  limit: 5,
  windowMs: 60_000,
  bucketScope: "test-durable",
  scope: "trusted-client-ip",
  keyDerivation: "hmac-sha256-trusted-client-ip-v1",
  storeUnavailable: "deny-request-with-503",
};

const TEST_WAF_POLICY: PlatformWafPolicyDefinition = {
  id: "test-waf",
  kind: "platform-waf",
  algorithm: "fixed-window",
  limit: 10,
  windowMs: 60_000,
  bucketScope: "test-waf",
  scope: "trusted-client-ip",
  verification: "external-required",
};

const DURABLE: DurableDbDisposition = {
  kind: "durable-db",
  policyIds: [TEST_DURABLE_POLICY.id],
  implementation: "planned",
  implementationNote: "Synthetic fixture requires durable integration.",
};

const WAF: PlatformWafDisposition = {
  kind: "platform-waf",
  policyId: TEST_WAF_POLICY.id,
  implementation: "external-required",
  implementationNote: "Synthetic fixture requires external verification.",
};

const EXEMPT: BoundedPublicReadExemptionDisposition = {
  kind: "bounded-public-read-exemption",
  bound: "checked-static-artifact",
  maxDatabaseQueries: 0,
  maxUpstreamCalls: 0,
  implementation: "source-confirmed",
  justification: "Synthetic checked artifact.",
  implementationNote: "Synthetic source confirmation.",
};

function issueCodes(
  issues: ReturnType<typeof validateRateLimitPolicyRegistry>,
): Set<RateLimitPolicyIssueCode> {
  return new Set(issues.map((issue) => issue.code));
}

function validateFixture(
  routeInventory: readonly RateLimitInventoryEntry[],
  mappings: readonly RateLimitRoutePolicyMapping[],
) {
  return validateRateLimitPolicyRegistry({
    routeInventory,
    policies: [TEST_DURABLE_POLICY, TEST_WAF_POLICY],
    mappings,
  });
}

test("the real registry covers every canonical route+method without structural or semantic errors", () => {
  const issues = validateRateLimitPolicyRegistry({
    routeInventory: ROUTE_INVENTORY,
    policies: RATE_LIMIT_POLICIES,
    mappings: RATE_LIMIT_ROUTE_POLICIES,
  });
  assert.deepEqual(issues, []);

  const canonicalMethodCount = ROUTE_INVENTORY.reduce(
    (total, entry) => total + entry.methods.length,
    0,
  );
  const mappedMethodCount = RATE_LIMIT_ROUTE_POLICIES.reduce(
    (total, mapping) => total + mapping.methods.length,
    0,
  );
  assert.equal(ROUTE_INVENTORY.length, 109);
  assert.equal(canonicalMethodCount, 173);
  assert.equal(mappedMethodCount, canonicalMethodCount);
});

test("every durable policy has a concrete shared scope, window, limit, HMAC key, and fail-closed store behavior", () => {
  const durablePolicies = RATE_LIMIT_POLICIES.filter(
    (policy): policy is DurableDbPolicyDefinition =>
      policy.kind === "durable-db",
  );
  assert.ok(durablePolicies.length > 0);
  for (const policy of durablePolicies) {
    assert.ok(policy.limit > 0);
    assert.ok(policy.windowMs > 0);
    assert.ok(policy.bucketScope.length > 0);
    assert.equal(policy.scope, "trusted-client-ip");
    assert.equal(policy.keyDerivation, "hmac-sha256-trusted-client-ip-v1");
    assert.equal(policy.storeUnavailable, "deny-request-with-503");
  }
});

test("the real registry has no planned, partial, or unverified route method", () => {
  const summary = summarizeRateLimitPolicyImplementations(
    RATE_LIMIT_ROUTE_POLICIES,
  );
  assert.equal(summary.planned, 0);
  assert.equal(summary.partial, 0);
  assert.equal(summary["external-required"], 0);
  assert.equal(summary["external-verified"], 6);
  assert.equal(summary["source-confirmed"], 167);
});

test("real platform policies match the checked all-path Vercel rule", () => {
  const policies = RATE_LIMIT_POLICIES.filter(
    (policy): policy is PlatformWafPolicyDefinition =>
      policy.kind === "platform-waf",
  );
  assert.equal(policies.length, 4);
  for (const policy of policies) {
    assert.equal(policy.limit, 600);
    assert.equal(policy.windowMs, 60_000);
    assert.equal(policy.bucketScope, "vercel-global-ip");
    assert.equal(policy.verification, "external-verified");
    assert.equal(policy.verifiedAt, "2026-07-14");
    assert.equal(
      policy.evidencePath,
      "plan/evidence/PLT-011/vercel-firewall-live.json",
    );
  }
});

test("negative fixture: WAF evidence must prove an all-path challenge rule", () => {
  const policy: PlatformWafPolicyDefinition = {
    ...TEST_WAF_POLICY,
    verification: "external-verified",
    verifiedAt: "2026-07-14",
    evidencePath: "plan/evidence/test-waf.json",
  };
  const rule: NonNullable<PlatformWafEvidence["rule"]> = {
    active: true,
    valid: true,
    condition: { type: "path", operator: "starts_with", value: "/" },
    action: "rate_limit",
    algorithm: "fixed_window",
    windowSeconds: 60,
    limit: 10,
    keys: ["ip"],
    onExceed: "challenge",
  };
  const evidence: PlatformWafEvidence = {
    overview: { firewall: "enabled", pendingDraftChanges: 0 },
    rule,
  };

  assert.equal(matchesPlatformWafEvidence(policy, evidence), true);
  for (const invalidRule of [
    { ...rule, condition: { ...rule.condition, type: "host" } },
    { ...rule, condition: { ...rule.condition, operator: "equals" } },
    { ...rule, condition: { ...rule.condition, value: "/api" } },
    { ...rule, keys: ["ip", "path"] },
    { ...rule, keys: ["path"] },
    { ...rule, onExceed: "deny" },
  ]) {
    assert.equal(
      matchesPlatformWafEvidence(policy, { ...evidence, rule: invalidRule }),
      false,
    );
  }
});

test("negative fixture: a public API gap fails", () => {
  const route: RateLimitInventoryEntry = {
    filePath: "api/v1/unregistered/route.ts",
    exposure: "public-read",
    methods: ["GET"],
    mutation: false,
    controls: ["public"],
  };
  const codes = issueCodes(validateFixture([route], []));
  assert.ok(codes.has("missing-policy-mapping"));
  assert.ok(codes.has("public-api-protection-gap"));
});

test("negative fixture: a dynamic export cannot use a bounded-read exemption", () => {
  const route: RateLimitInventoryEntry = {
    filePath: "api/countries/[slug]/export/route.ts",
    exposure: "export",
    methods: ["GET"],
    mutation: false,
    controls: ["public"],
  };
  const codes = issueCodes(
    validateFixture(
      [route],
      [{ filePath: route.filePath, methods: ["GET"], disposition: EXEMPT }],
    ),
  );
  assert.ok(codes.has("export-protection-gap"));
});

test("negative fixture: an embed must use the platform-WAF disposition", () => {
  const route: RateLimitInventoryEntry = {
    filePath: "embed/[slug]/route.ts",
    exposure: "embed",
    methods: ["GET"],
    mutation: false,
    controls: ["public"],
  };
  const codes = issueCodes(
    validateFixture(
      [route],
      [{ filePath: route.filePath, methods: ["GET"], disposition: DURABLE }],
    ),
  );
  assert.ok(codes.has("embed-protection-gap"));
});

test("negative fixture: a public form gap fails", () => {
  const route: RateLimitInventoryEntry = {
    filePath: "api/public-form/route.ts",
    exposure: "public-mutation",
    methods: ["POST"],
    mutation: true,
    controls: ["input-validation"],
  };
  const codes = issueCodes(validateFixture([route], []));
  assert.ok(codes.has("form-protection-gap"));
});

test("negative fixture: a credential or OAuth bootstrap gap fails", () => {
  const route: RateLimitInventoryEntry = {
    filePath: "api/admin/oauth/start/route.ts",
    exposure: "admin",
    methods: ["GET"],
    mutation: false,
    controls: ["oauth-bootstrap"],
  };
  const codes = issueCodes(validateFixture([route], []));
  assert.ok(codes.has("credential-bootstrap-protection-gap"));
});

test("negative fixture: any unauthenticated mutation gap fails", () => {
  const route: RateLimitInventoryEntry = {
    filePath: "api/open-mutation/route.ts",
    exposure: "internal",
    methods: ["POST"],
    mutation: true,
    controls: ["input-validation"],
  };
  const codes = issueCodes(validateFixture([route], []));
  assert.ok(codes.has("unauthenticated-mutation-protection-gap"));
});

test("negative fixture: duplicate and stale route-method mappings fail", () => {
  const route: RateLimitInventoryEntry = {
    filePath: "api/v1/known/route.ts",
    exposure: "public-read",
    methods: ["GET"],
    mutation: false,
    controls: ["public"],
  };
  const mappings: RateLimitRoutePolicyMapping[] = [
    { filePath: route.filePath, methods: ["GET"], disposition: DURABLE },
    { filePath: route.filePath, methods: ["GET"], disposition: DURABLE },
    {
      filePath: "api/v1/deleted/route.ts",
      methods: ["GET"],
      disposition: DURABLE,
    },
  ];
  const codes = issueCodes(validateFixture([route], mappings));
  assert.ok(codes.has("duplicate-policy-mapping"));
  assert.ok(codes.has("stale-policy-mapping"));
});

test("negative fixture: duplicate and unused policy definitions fail", () => {
  const issues = validateRateLimitPolicyRegistry({
    routeInventory: [],
    policies: [TEST_DURABLE_POLICY, TEST_DURABLE_POLICY, TEST_WAF_POLICY],
    mappings: [],
  });
  const codes = issueCodes(issues);
  assert.ok(codes.has("duplicate-policy-id"));
  assert.ok(codes.has("unused-policy-definition"));
});

test("negative fixture: source-confirmed durable integration requires an executable source marker", () => {
  const route: RateLimitInventoryEntry = {
    filePath: "api/v1/confirmed/route.ts",
    exposure: "public-read",
    methods: ["GET"],
    mutation: false,
    controls: ["rate-limit", "public"],
  };
  const disposition: DurableDbDisposition = {
    ...DURABLE,
    implementation: "source-confirmed",
  };
  const codes = issueCodes(
    validateFixture(
      [route],
      [{ filePath: route.filePath, methods: ["GET"], disposition }],
    ),
  );
  assert.ok(codes.has("invalid-integration-status"));
});

test("platform fixture is structurally valid only while verification remains external-required", () => {
  const route: RateLimitInventoryEntry = {
    filePath: "downloads/static.json/route.ts",
    exposure: "export",
    methods: ["GET"],
    mutation: false,
    controls: ["public"],
  };
  const issues = validateFixture(
    [route],
    [{ filePath: route.filePath, methods: ["GET"], disposition: WAF }],
  );
  assert.deepEqual(
    issues.filter((issue) => issue.code !== "unused-policy-definition"),
    [],
  );
});

test("negative fixture: process-local production protection markers fail", () => {
  assert.deepEqual(
    findProcessLocalRateLimitMarkers({
      "src/app/api/example/route.ts":
        "const result = checkInMemoryRateLimit(options);",
      "src/lib/api/rate-limit.ts":
        'const failureMode = "deny"; // no legacy fallback',
    }),
    ["src/app/api/example/route.ts: checkInMemoryRateLimit"],
  );
});
