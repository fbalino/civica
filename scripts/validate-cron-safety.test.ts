import assert from "node:assert/strict";
import test from "node:test";

import { inspectRouteSource } from "./validate-cron-safety";

const validRoute = `
  import { withCronJob } from "@/lib/api/cron-job";
  export const runtime = "nodejs";
  export const dynamic = "force-dynamic";
  export const maxDuration = 300;
  async function handler() { return new Response("ok"); }
  const cronHandler = withCronJob("pulse.v2.ingest", handler);
  export { cronHandler as GET, cronHandler as POST };
`;

test("the syntax-tree scanner recognizes only the sanctioned wrapper shape", () => {
  const facts = inspectRouteSource("valid.ts", validRoute);
  assert.equal(facts.hasSanctionedWrapperImport, true);
  assert.equal(facts.hasDirectCronAuthIdentifier, false);
  assert.equal(facts.wrapperCallCount, 1);
  assert.deepEqual(facts.wrapperAssignments, [
    { variable: "cronHandler", jobId: "pulse.v2.ingest" },
  ]);
  assert.deepEqual(facts.aliases.get("GET"), ["cronHandler"]);
  assert.deepEqual(facts.aliases.get("POST"), ["cronHandler"]);
  assert.deepEqual(facts.directMethods, []);
  assert.equal(facts.maxDuration, 300);
  assert.equal(facts.runtime, "nodejs");
  assert.equal(facts.dynamic, "force-dynamic");
});

test("comments and strings cannot impersonate a cron wrapper or export", () => {
  const facts = inspectRouteSource(
    "decoy.ts",
    `
      // import { withCronJob } from "@/lib/api/cron-job";
      // const cronHandler = withCronJob("pulse.v2.ingest", handler);
      const decoy = 'export { cronHandler as GET, cronHandler as POST }';
    `,
  );
  assert.equal(facts.hasSanctionedWrapperImport, false);
  assert.equal(facts.wrapperCallCount, 0);
  assert.equal(facts.aliases.size, 0);
});

test("a local spoof, wrong id, or raw export remains visible to the contract", () => {
  const facts = inspectRouteSource(
    "spoof.ts",
    `
      function withCronJob(id: string, handler: unknown) { return handler; }
      async function handler() { return new Response("ok"); }
      const wrapped = withCronJob("wrong.job", handler);
      export async function GET() { return new Response("raw"); }
      export { wrapped as POST };
    `,
  );
  assert.equal(facts.hasSanctionedWrapperImport, false);
  assert.deepEqual(facts.wrapperAssignments, [
    { variable: "wrapped", jobId: "wrong.job" },
  ]);
  assert.deepEqual(facts.directMethods, ["GET"]);
  assert.deepEqual(facts.aliases.get("POST"), ["wrapped"]);
});

test("direct auth remnants and nonliteral route configuration fail closed", () => {
  const facts = inspectRouteSource(
    "invalid.ts",
    `
      import { requireCronAuth } from "@/lib/api/cron-auth";
      export let runtime = "nodejs";
      export const dynamic = process.env.DYNAMIC;
      export const maxDuration = Number(process.env.MAX_DURATION);
    `,
  );
  assert.equal(facts.hasDirectCronAuthIdentifier, true);
  assert.equal(facts.runtime, "invalid");
  assert.equal(facts.dynamic, "invalid");
  assert.equal(facts.maxDuration, "invalid");
});
