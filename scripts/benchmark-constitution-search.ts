/** Reproducible ATL-009 live performance gate. Read-only. */
import { performance } from "node:perf_hooks";
import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";
config({ path: ".env.local" });

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required");
const sql = neon(databaseUrl);
const baseUrl = process.argv
  .find((arg) => arg.startsWith("--base-url="))
  ?.slice(11);
const iterations = 10;
const apiIterations = 4;
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
    | Array<Record<string, unknown>>
    | undefined;
  const executionMs = Number(plan?.[0]?.["Execution Time"]);
  if (!Number.isFinite(executionMs)) {
    throw new Error("PostgreSQL did not return an EXPLAIN execution time");
  }
  return { executionMs, roundTripMs };
}

async function main() {
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
    throw new Error(`DB warm p95 ${dbP95.toFixed(1)}ms exceeds 100ms`);

  let api: object | null = null;
  if (baseUrl) {
    const warm: number[] = [];
    const coldSamples: number[] = [];
    let maxBytes = 0;
    for (const fixture of fixtures) {
      const params = new URLSearchParams({ q: fixture.q, limit: "20" });
      if (fixture.jurisdiction)
        params.set("jurisdiction", fixture.jurisdiction);
      if (fixture.topic) params.set("topic", fixture.topic);
      const url = `${baseUrl.replace(/\/$/, "")}/api/constitution/search?${params}`;
      const coldStart = performance.now();
      let response = await fetch(url);
      coldSamples.push(performance.now() - coldStart);
      if (!response.ok)
        throw new Error(`${fixture.id} API returned ${response.status}`);
      maxBytes = Math.max(maxBytes, Buffer.byteLength(await response.text()));
      for (let index = 0; index < apiIterations; index++) {
        const started = performance.now();
        response = await fetch(url);
        const body = await response.arrayBuffer();
        warm.push(performance.now() - started);
        maxBytes = Math.max(maxBytes, body.byteLength);
      }
    }
    const warmP95 = percentile(warm, 0.95);
    const coldP95 = percentile(coldSamples, 0.95);
    if (warmP95 > 300)
      throw new Error(`API warm p95 ${warmP95.toFixed(1)}ms exceeds 300ms`);
    if (coldP95 > 750)
      throw new Error(`API cold p95 ${coldP95.toFixed(1)}ms exceeds 750ms`);
    if (maxBytes > 250_000)
      throw new Error(`API page ${maxBytes} bytes exceeds 250KB`);
    api = { warmP95Ms: warmP95, coldP95Ms: coldP95, maxBytes };
  }
  console.log(
    JSON.stringify(
      {
        schemaVersion: "constitution-search-benchmark/v1",
        iterations,
        fixtures: fixtures.map((row) => row.id),
        database: {
          executionWarmP95Ms: dbP95,
          neonRoundTripWarmP95Ms: dbRoundTripP95,
        },
        api,
      },
      null,
      2,
    ),
  );
}
main().catch((error) => {
  console.error(error);
  process.exit(1);
});
