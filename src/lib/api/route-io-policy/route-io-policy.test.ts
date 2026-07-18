import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { ROUTE_INVENTORY } from "@/lib/api/route-inventory/registry";
import {
  handlerReturnsApprovedErrorBoundary,
  handlerInvokesImportedCall,
  inspectBoundedBodyParserInvocation,
  inspectHandlerErrorProfiles,
  inspectSchemaParserInvocation,
  policyDefinitionErrors,
  scanRouteSourceSafety,
  validatePolicyCoverage,
} from "./checks";
import {
  OPERATIONAL_ERROR_BOUNDARY_ROUTES,
  P1_ERROR_PROFILE_ROUTES,
  ROUTE_IO_POLICY,
} from "./registry";

function readRouteSource(filePath: string): string {
  return readFileSync(path.join(process.cwd(), "src/app", filePath), "utf8");
}

test("route I/O policy covers exactly every registered route-method", () => {
  assert.deepEqual(validatePolicyCoverage(ROUTE_INVENTORY, ROUTE_IO_POLICY), {
    missing: [],
    stale: [],
    duplicates: [],
  });
  assert.equal(ROUTE_IO_POLICY.length, 169);
  assert.deepEqual(policyDefinitionErrors(ROUTE_IO_POLICY), []);
});

test("route I/O coverage rejects missing, phantom, and duplicate tuples", () => {
  const inventory = [
    {
      filePath: "api/example/route.ts",
      methods: ["GET", "POST"] as const,
    },
  ];
  const policy = [
    { filePath: "api/example/route.ts", method: "GET" as const },
    { filePath: "api/example/route.ts", method: "GET" as const },
    { filePath: "api/phantom/route.ts", method: "GET" as const },
  ];
  assert.deepEqual(validatePolicyCoverage(inventory, policy), {
    missing: ["api/example/route.ts#POST"],
    stale: ["api/phantom/route.ts#GET"],
    duplicates: ["api/example/route.ts#GET"],
  });
});

test("source scanner rejects raw body reads, response spreads, and error leaks", () => {
  const findings = scanRouteSourceSafety(`
    export async function POST(request: Request) {
      const body = await request.json();
      try {
        return Response.json({ ...body });
      } catch (error) {
        return Response.json({ error: error instanceof Error ? error.message : String(error) });
      }
    }
  `);
  assert.deepEqual(findings.map(({ kind }) => kind).sort(), [
    "raw-error-detail",
    "raw-request-reader",
    "response-object-spread",
  ]);
});

test("source scanner rejects exception details hidden behind a local alias", () => {
  const findings = scanRouteSourceSafety(`
    export async function POST() {
      try {
        throw new Error("secret");
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return Response.json({ error: message });
      }
    }
  `);
  assert.deepEqual(
    findings.map(({ kind }) => kind),
    ["raw-error-detail"],
  );
});

test("source scanner permits spread only behind a strict projection adapter", () => {
  assert.deepEqual(
    scanRouteSourceSafety(`
      import { shapeCountryListItem } from "@/lib/api/contract/shapes";
      export function GET() {
        const row = { public: true, secret: "sentinel" };
        return Response.json(shapeCountryListItem({ ...row }));
      }
    `),
    [],
  );
});

test("source scanner rejects aliases, fake projectors, parser laundering, and arbitrary catch names", () => {
  const findings = scanRouteSourceSafety(`
    export async function POST(request: Request) {
      const read = request.json;
      const input = request;
      await input.formData();
      const { text: rawText } = request;
      const row = { public: true, secret: "sentinel" };
      function shapeFuture(value: unknown) { return value; }
      try {
        return Response.json(shapeFuture(JSON.parse(JSON.stringify({ ...row }))));
      } catch (failure) {
        return Response.json({ error: failure.message });
      }
    }
  `);
  assert.deepEqual(findings.map(({ kind }) => kind).sort(), [
    "raw-error-detail",
    "raw-request-reader",
    "raw-request-reader",
    "raw-request-reader",
    "response-object-spread",
  ]);
});

test("source scanner rejects every common exception-coercion form", () => {
  for (const expression of [
    'failure["message"]',
    "String(failure)",
    "`${failure}`",
    "failure.toString()",
  ]) {
    const findings = scanRouteSourceSafety(`
      export function GET() {
        try { throw new Error("secret"); }
        catch (failure) {
          return Response.json({ error: ${expression}, code: "INTERNAL_ERROR" });
        }
      }
    `);
    assert.ok(
      findings.some(({ kind }) => kind === "raw-error-detail"),
      expression,
    );
  }
});

test("approved projector imports cannot be shadowed", () => {
  const findings = scanRouteSourceSafety(`
    import { shapeCountryListItem } from "@/lib/api/contract/shapes";
    export function GET() {
      function shapeCountryListItem(value: unknown) { return value; }
      const row = { public: true, secret: "sentinel" };
      return Response.json(shapeCountryListItem({ ...row }));
    }
  `);
  assert.deepEqual(
    findings.map(({ kind }) => kind),
    ["response-object-spread"],
  );
});

test("raw request-reader proof derives the exported handler parameter", () => {
  const findings = scanRouteSourceSafety(`
    export async function POST(input: Request) {
      return Response.json(await input.json());
    }
  `);
  assert.deepEqual(
    findings.map(({ kind }) => kind),
    ["raw-request-reader"],
  );
});

test("request parser proof rejects comments, unused imports, and dead helpers", () => {
  const fake = `
    import { parseQueryContract } from "@/lib/api/request-contract";
    // parseQueryContract(request, "v1-countries-query/v1")
    function dead(request: Request) {
      return parseQueryContract(request, "v1-countries-query/v1");
    }
    export function GET() {
      return Response.json({ ok: true });
    }
  `;
  assert.equal(
    handlerInvokesImportedCall(
      fake,
      "GET",
      "parseQueryContract",
      "@/lib/api/request-contract",
      "v1-countries-query/v1",
    ),
    false,
  );
  assert.equal(
    handlerInvokesImportedCall(
      fake.replace(
        "return Response.json({ ok: true });",
        "return Response.json(dead(new Request('https://example.test')));",
      ),
      "GET",
      "parseQueryContract",
      "@/lib/api/request-contract",
      "v1-countries-query/v1",
    ),
    true,
  );
});

test("declared parser proof binds live IDs, byte limits, schemas, and media", () => {
  const query = `
    import { parseQueryContract } from "@/lib/api/request-contract";
    export function GET(request: Request) {
      // parseQueryContract(request, "expected-query/v1");
      return Response.json(parseQueryContract(request, "wrong-query/v1"));
    }
  `;
  assert.notDeepEqual(
    inspectSchemaParserInvocation(
      query,
      "GET",
      "parseQueryContract",
      "expected-query/v1",
    ),
    [],
  );

  const body = `
    import {
      FORM_MEDIA_TYPE,
      JSON_MEDIA_TYPE,
      parseBoundedRequestBody,
    } from "@/lib/api/request-body";
    import {
      REQUEST_BODY_LIMITS,
      contactBodySchema,
      correctionBodySchema,
    } from "@/lib/api/request-body-schemas";
    async function mutate(request: Request) {
      return parseBoundedRequestBody(request, {
        maxBytes: REQUEST_BODY_LIMITS.contact,
        media: [
          { mediaType: JSON_MEDIA_TYPE, schema: contactBodySchema },
          { mediaType: FORM_MEDIA_TYPE, schema: correctionBodySchema },
        ],
      });
    }
    export function POST(request: Request) {
      return withMutation(request, () => mutate(request));
    }
  `;
  const exact = {
    limitKey: "contact",
    media: [
      { mediaType: "JSON_MEDIA_TYPE", schema: "contactBodySchema" },
      { mediaType: "FORM_MEDIA_TYPE", schema: "correctionBodySchema" },
    ],
  };
  assert.deepEqual(inspectBoundedBodyParserInvocation(body, "POST", exact), []);
  assert.notDeepEqual(
    inspectBoundedBodyParserInvocation(body, "POST", {
      ...exact,
      limitKey: "correction",
    }),
    [],
  );
  assert.notDeepEqual(
    inspectBoundedBodyParserInvocation(body, "POST", {
      ...exact,
      media: exact.media.slice(0, 1),
    }),
    [],
  );
  assert.notDeepEqual(
    inspectBoundedBodyParserInvocation(body, "POST", {
      ...exact,
      media: [
        { mediaType: "JSON_MEDIA_TYPE", schema: "correctionBodySchema" },
        exact.media[1],
      ],
    }),
    [],
  );
  assert.notDeepEqual(
    inspectBoundedBodyParserInvocation(
      `${body}\nfunction parseBoundedRequestBody() { return null; }`,
      "POST",
      exact,
    ),
    [],
  );
});

test("registered operational handlers return the approved real error boundary", () => {
  const missing = OPERATIONAL_ERROR_BOUNDARY_ROUTES.filter(
    ({ filePath, method }) =>
      !handlerReturnsApprovedErrorBoundary(
        readRouteSource(filePath),
        method,
        filePath,
      ),
  ).map(({ filePath, method }) => `${filePath}#${method}`);
  assert.deepEqual(missing, []);
});

test("operational boundary proof rejects a shadowed helper", () => {
  assert.equal(
    handlerReturnsApprovedErrorBoundary(
      `
        import { withSafeJsonErrors } from "@/lib/api/problem-response";
        export function GET() {
          return withSafeJsonErrors("fixture", async () => Response.json({ ok: true }));
        }
        function withSafeJsonErrors(_operation: string, handler: () => Response) {
          return handler();
        }
      `,
      "GET",
    ),
    false,
  );
});

test("operational boundary proof accepts the canonical private cache variant", () => {
  assert.equal(
    handlerReturnsApprovedErrorBoundary(
      `
        import { withPrivateSafeJsonErrors } from "@/lib/api/problem-response";
        export function POST() {
          return withPrivateSafeJsonErrors("fixture", async () => Response.json({ ok: true }));
        }
      `,
      "POST",
    ),
    true,
  );
});

test("P1 routes have actual stable, non-cacheable error response sites", () => {
  const failures: string[] = [];
  for (const { filePath, method } of P1_ERROR_PROFILE_ROUTES) {
    const report = inspectHandlerErrorProfiles(
      readRouteSource(filePath),
      method,
      filePath,
    );
    if (!report.handlerFound) failures.push(`${filePath}#${method}: missing`);
    if (report.sites === 0) {
      failures.push(`${filePath}#${method}: no actual error response calls`);
    }
    for (const finding of report.findings) {
      failures.push(
        `${filePath}:${finding.line} [${finding.kind}] ${finding.detail}`,
      );
    }
  }
  assert.deepEqual(failures, []);
});

test("all directly declared handlers use stable non-cacheable JSON errors", () => {
  const failures: string[] = [];
  for (const { filePath, method } of ROUTE_IO_POLICY) {
    const report = inspectHandlerErrorProfiles(
      readRouteSource(filePath),
      method,
      filePath,
    );
    for (const finding of report.findings) {
      failures.push(
        `${filePath}:${finding.line} [${finding.kind}] ${finding.detail}`,
      );
    }
  }
  assert.deepEqual(failures, []);
});

test("error-boundary proof rejects an import-only declaration", () => {
  assert.equal(
    handlerReturnsApprovedErrorBoundary(
      `
        import { withSafeJsonErrors } from "@/lib/api/problem-response";
        export async function GET() {
          return Response.json({ ok: true });
        }
      `,
      "GET",
    ),
    false,
  );
  assert.equal(
    handlerReturnsApprovedErrorBoundary(
      `
        import { withSafeJsonErrors } from "@/lib/api/problem-response";
        export async function GET() {
          return withSafeJsonErrors("fixture", async () => Response.json({ ok: true }));
        }
      `,
      "GET",
    ),
    true,
  );

  assert.equal(
    handlerReturnsApprovedErrorBoundary(
      `
        import { withSafeJsonErrors as approvedBoundary } from "@/lib/api/problem-response";
        const withSafeJsonErrors = approvedBoundary;
        export async function GET() {
          return withSafeJsonErrors("fixture", async () => Response.json({ ok: true }));
        }
      `,
      "GET",
    ),
    false,
  );
  assert.equal(
    handlerReturnsApprovedErrorBoundary(
      `
        import { withSafeJsonErrors } from "@/lib/api/problem-response";
        export async function GET() {
          await Promise.resolve();
          return withSafeJsonErrors("fixture", async () => Response.json({ ok: true }));
        }
      `,
      "GET",
    ),
    false,
  );
});

test("error-profile proof rejects missing codes and no-store headers", () => {
  const unsafe = inspectHandlerErrorProfiles(
    `
      import { apiProblem } from "@/lib/api/problem-response";
      export function GET() {
        if (Date.now() > 0) {
          return Response.json({ error: "Not found." }, { status: 404 });
        }
        return apiProblem("DATA_UNAVAILABLE");
      }
    `,
    "GET",
  );
  assert.equal(unsafe.sites, 2);
  assert.deepEqual(unsafe.findings.map(({ kind }) => kind).sort(), [
    "missing-error-code",
    "missing-no-store",
  ]);

  const safe = inspectHandlerErrorProfiles(
    `
      import { apiProblem } from "@/lib/api/problem-response";
      export function GET() {
        if (Date.now() > 0) {
          return Response.json(
            { error: "Not found.", code: "NOT_FOUND" },
            { status: 404, headers: { "Cache-Control": "no-store" } },
          );
        }
        return apiProblem("DATA_UNAVAILABLE");
      }
    `,
    "GET",
  );
  assert.equal(safe.sites, 2);
  assert.deepEqual(safe.findings, []);

  const variablePayload = inspectHandlerErrorProfiles(
    `
      export function GET() {
        const body = { error: "Not found." };
        return Response.json(body, {
          status: 404,
          headers: { "Cache-Control": "no-store", ...laterHeaders },
        });
      }
    `,
    "GET",
  );
  assert.deepEqual(variablePayload.findings.map(({ kind }) => kind).sort(), [
    "missing-error-code",
    "missing-no-store",
  ]);

  const dynamic = inspectHandlerErrorProfiles(
    `
      export function GET(request: Request) {
        return Response.json(
          { error: request.url, code: request.url },
          { status: 500, headers: { "Cache-Control": "no-store" } },
        );
      }
    `,
    "GET",
  );
  assert.deepEqual(dynamic.findings.map(({ kind }) => kind).sort(), [
    "dynamic-error-code",
    "dynamic-error-copy",
  ]);

  const shadowedProblem = inspectHandlerErrorProfiles(
    `
      import { apiProblem } from "@/lib/api/problem-response";
      export function GET() { return apiProblem("NOT_FOUND"); }
      function apiProblem() { return Response.json({ secret: true }); }
    `,
    "GET",
  );
  assert.deepEqual(
    shadowedProblem.findings.map(({ kind }) => kind),
    ["unapproved-problem-helper"],
  );
});
