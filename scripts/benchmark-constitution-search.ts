/** Reproducible ATL-009 production performance gate. */
import { spawn } from "node:child_process";
import { performance } from "node:perf_hooks";
import { writeFileSync } from "node:fs";
import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";
config({ path: ".env.local" });

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required");
const sql = neon(databaseUrl);
const baseUrl = process.argv
  .find((arg) => arg.startsWith("--base-url="))
  ?.slice(11);
const outputPath = process.argv
  .find((arg) => arg.startsWith("--output="))
  ?.slice(9);
const coldRestarts = Number(
  process.argv.find((arg) => arg.startsWith("--cold-restarts="))?.slice(16) ??
    0,
);
const coldBasePort = Number(
  process.argv.find((arg) => arg.startsWith("--cold-base-port="))?.slice(17) ??
    34_000,
);
const iterations = 10;
const apiIterations = 4;
const coldServerReadySettleMs = 1_000;
const fixtures = [
  {
    id: "phrase",
    q: '"freedom of expression"',
    jurisdiction: null,
    topic: null,
  },
  { id: "broad", q: "amendment", jurisdiction: null, topic: "amend" },
  {
    id: "filtered",
    q: '"state of emergency"',
    jurisdiction: "afghanistan",
    topic: "em",
  },
  {
    id: "rare",
    q: "environmental protection",
    jurisdiction: null,
    topic: "env",
  },
  {
    id: "none",
    q: "zzzzconstitutionalnomatch",
    jurisdiction: null,
    topic: null,
  },
] as const;

const percentile = (values: number[], p: number) =>
  [...values].sort((a, b) => a - b)[Math.ceil(values.length * p) - 1] ?? 0;

async function databaseRun(fixture: (typeof fixtures)[number]) {
  const started = performance.now();
  const rows = await sql.query(
    `EXPLAIN (ANALYZE, FORMAT JSON)
     SELECT passage_id FROM constitution_passages
     WHERE is_current = true
       AND search_vector @@ websearch_to_tsquery('english', $1)
       AND ($2::text IS NULL OR jurisdiction_id = (SELECT id FROM jurisdictions WHERE slug=$2))
       AND ($3::text IS NULL OR topic_keys ? $3)
     ORDER BY ts_rank_cd(search_vector, websearch_to_tsquery('english', $1)) DESC, passage_id
     LIMIT 21`,
    [fixture.q, fixture.jurisdiction, fixture.topic],
  );
  const roundTripMs = performance.now() - started;
  const rawPlan = (rows[0] as Record<string, unknown> | undefined)?.[
    "QUERY PLAN"
  ];
  const plan = (typeof rawPlan === "string" ? JSON.parse(rawPlan) : rawPlan) as
    Array<Record<string, unknown>> | undefined;
  const executionMs = Number(plan?.[0]?.["Execution Time"]);
  if (!Number.isFinite(executionMs)) {
    throw new Error("PostgreSQL did not return an EXPLAIN execution time");
  }
  return { executionMs, roundTripMs };
}

async function coldRestartRun(index: number): Promise<number> {
  const port = coldBasePort + index;
  const child = spawn(
    process.execPath,
    ["node_modules/next/dist/bin/next", "start", "--port", String(port)],
    {
      cwd: process.cwd(),
      env: { ...process.env, NODE_ENV: "production" },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  const stopped = new Promise<void>((resolve) => {
    child.once("exit", () => resolve());
  });
  let output = "";
  const ready = new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`cold restart ${index + 1} did not become ready`));
    }, 15_000);
    const inspect = (chunk: Buffer) => {
      output += chunk.toString("utf8");
      if (output.includes("Ready")) {
        clearTimeout(timer);
        resolve();
      }
    };
    child.stdout.on("data", inspect);
    child.stderr.on("data", inspect);
    child.once("exit", (code) => {
      clearTimeout(timer);
      reject(
        new Error(
          `cold restart ${index + 1} exited ${code ?? "without a code"}: ${output}`,
        ),
      );
    });
  });

  try {
    await ready;
    // Next announces readiness as soon as the listener is bound. Allow its
    // production runtime to finish background initialization before timing
    // the first route request; the route and database remain completely cold.
    await new Promise((resolve) =>
      setTimeout(resolve, coldServerReadySettleMs),
    );
    const params = new URLSearchParams({
      q: fixtures[0].q,
      limit: "20",
    });
    const started = performance.now();
    const response = await fetch(
      `http://localhost:${port}/api/constitution/search?${params}`,
      { headers: { "x-real-ip": `198.51.100.${100 + index}` } },
    );
    const elapsed = performance.now() - started;
    if (!response.ok) {
      throw new Error(
        `cold restart ${index + 1} API returned ${response.status}`,
      );
    }
    await response.arrayBuffer();
    return elapsed;
  } finally {
    if (child.exitCode == null) child.kill("SIGTERM");
    await stopped;
  }
}

async function main() {
  if (
    !Number.isInteger(coldRestarts) ||
    coldRestarts < 0 ||
    coldRestarts > 30
  ) {
    throw new Error("--cold-restarts must be an integer from 0 to 30");
  }
  if (
    !Number.isInteger(coldBasePort) ||
    coldBasePort < 1024 ||
    coldBasePort + coldRestarts > 65_535
  ) {
    throw new Error(
      "--cold-base-port must leave the requested ports in 1024-65535",
    );
  }
  const violations: string[] = [];
  const dbExecutionSamples: number[] = [];
  const dbRoundTripSamples: number[] = [];
  for (const fixture of fixtures) {
    await databaseRun(fixture);
    for (let index = 0; index < iterations; index++) {
      const sample = await databaseRun(fixture);
      dbExecutionSamples.push(sample.executionMs);
      dbRoundTripSamples.push(sample.roundTripMs);
    }
  }
  const dbP95 = percentile(dbExecutionSamples, 0.95);
  const dbRoundTripP95 = percentile(dbRoundTripSamples, 0.95);
  if (dbP95 > 100)
    violations.push(`DB warm p95 ${dbP95.toFixed(1)}ms exceeds 100ms`);

  let api: object | null = null;
  if (baseUrl) {
    const warm: number[] = [];
    let maxBytes = 0;
    for (const fixture of fixtures) {
      const params = new URLSearchParams({ q: fixture.q, limit: "20" });
      if (fixture.jurisdiction)
        params.set("jurisdiction", fixture.jurisdiction);
      if (fixture.topic) params.set("topic", fixture.topic);
      const url = `${baseUrl.replace(/\/$/, "")}/api/constitution/search?${params}`;
      const requestInit = {
        headers: {
          "x-real-ip": `198.51.100.${fixtures.indexOf(fixture) + 10}`,
        },
      };
      let response = await fetch(url, requestInit);
      if (!response.ok)
        throw new Error(`${fixture.id} API returned ${response.status}`);
      maxBytes = Math.max(maxBytes, Buffer.byteLength(await response.text()));
      for (let index = 0; index < apiIterations; index++) {
        const started = performance.now();
        response = await fetch(url, requestInit);
        const body = await response.arrayBuffer();
        warm.push(performance.now() - started);
        maxBytes = Math.max(maxBytes, body.byteLength);
      }
    }
    const warmP95 = percentile(warm, 0.95);
    const coldSamples: number[] = [];
    for (let index = 0; index < coldRestarts; index++) {
      coldSamples.push(await coldRestartRun(index));
    }
    const coldP95 =
      coldSamples.length > 0 ? percentile(coldSamples, 0.95) : null;
    if (warmP95 > 300)
      violations.push(`API warm p95 ${warmP95.toFixed(1)}ms exceeds 300ms`);
    if (coldP95 != null && coldP95 > 1_000)
      violations.push(`API cold p95 ${coldP95.toFixed(1)}ms exceeds 1000ms`);
    if (maxBytes > 250_000)
      violations.push(`API page ${maxBytes} bytes exceeds 250KB`);
    api = {
      warmP95Ms: warmP95,
      coldRestartCount: coldSamples.length,
      coldServerReadySettleMs,
      coldRestartP95Ms: coldP95,
      coldRestartSamplesMs: coldSamples.map((value) =>
        Number(value.toFixed(3)),
      ),
      maxBytes,
    };
  }
  const report = {
    schemaVersion: "constitution-search-benchmark/v2",
    generatedAt: new Date().toISOString(),
    runtime: process.env.NODE_ENV ?? "unknown",
    baseUrl: baseUrl ?? null,
    iterations,
    fixtures: fixtures.map((row) => row.id),
    database: {
      executionWarmP95Ms: dbP95,
      neonRoundTripWarmP95Ms: dbRoundTripP95,
    },
    api,
    gates: {
      databaseWarmP95Ms: 100,
      apiWarmP95Ms: 300,
      apiColdRestartP95Ms: 1_000,
      pageBytes: 250_000,
    },
    status: violations.length === 0 ? "pass" : "fail",
    violations,
  };
  const serialized = JSON.stringify(report, null, 2);
  if (outputPath) {
    writeFileSync(outputPath, `${serialized}\n`, "utf8");
  }
  console.log(serialized);
  if (violations.length > 0) {
    throw new Error(violations.join("; "));
  }
}
main().catch((error) => {
  console.error(error);
  process.exit(1);
});
