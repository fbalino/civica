import { writeFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";

import {
  QUERY_BUDGETS,
  QUERY_BUDGET_CONTRACT_VERSION,
  type QueryBudget,
} from "@/lib/platform/query-budget";

config({ path: ".env.local" });

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required");

const sql = neon(databaseUrl);
const arg = (prefix: string) =>
  process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length);
const iterations = Number(arg("--iterations=") ?? 10);
const write = process.argv.includes("--write");
const outputPath = arg("--out=") ?? "plan/evidence/PLT-015/live-query-budget.json";

if (!Number.isInteger(iterations) || iterations < 3 || iterations > 50) {
  throw new Error("--iterations must be an integer between 3 and 50");
}

type SqlFixture = {
  query: string;
  params: readonly unknown[];
  variant:
    | "pointer-selected"
    | "pre-0036-quarter-method"
    | "pre-0036-latest-run"
    | "standard";
};

function fixtureFor(
  id: QueryBudget["id"],
  indexReleasePointersAvailable: boolean,
  pulsePublicationPointerAvailable: boolean,
): SqlFixture {
  switch (id) {
    case "country-facts-high-cardinality":
      return {
        query: `
          SELECT f.id, f.fact_key, f.category, f.fact_group, f.status
          FROM country_facts f
          WHERE f.jurisdiction_id = (
            SELECT id FROM jurisdictions WHERE slug = $1 LIMIT 1
          )
            AND f.status = 'active'
          ORDER BY f.category, f.fact_group, f.fact_key
        `,
        params: ["spain"],
        variant: "standard",
      };
    case "constitution-search-corpus":
      return {
        query: `
          WITH q AS (
            SELECT websearch_to_tsquery('english'::regconfig, $1) AS query
          )
          SELECT p.passage_id
          FROM constitution_passages p
          CROSS JOIN q
          WHERE p.is_current = true AND p.search_vector @@ q.query
          ORDER BY ts_rank_cd(p.search_vector, q.query) DESC, p.passage_id
          LIMIT 21
        `,
        params: ["freedom of expression"],
        variant: "standard",
      };
    case "indicator-history-high-cardinality":
      return {
        query: `
          SELECT h.indicator, h.year, h.source_id, h.value, h.value_status
          FROM indicator_history h
          WHERE h.jurisdiction_id = (
            SELECT id FROM jurisdictions WHERE slug = $1 LIMIT 1
          )
          ORDER BY h.indicator, h.year
        `,
        params: ["afghanistan"],
        variant: "standard",
      };
    case "index-release-rankings":
      return indexReleasePointersAvailable
        ? {
            query: `
              SELECT score.jurisdiction_id, score.rank, score.score
              FROM ci_composite_scores score
              WHERE score.release_id = (
                SELECT release_id
                FROM ci_index_release_pointers
                WHERE product = 'civica_index'
                LIMIT 1
              )
              ORDER BY score.rank
              LIMIT 250
            `,
            params: [],
            variant: "pointer-selected",
          }
        : {
            query: `
              WITH selected AS (
                SELECT score.quarter, score.methodology_version
                FROM ci_composite_scores score
                WHERE score.rank IS NOT NULL
                GROUP BY score.quarter, score.methodology_version
                ORDER BY max(score.calculated_at) DESC NULLS LAST, score.quarter DESC
                LIMIT 1
              )
              SELECT score.jurisdiction_id, score.rank, score.score
              FROM ci_composite_scores score
              CROSS JOIN selected
              WHERE score.quarter = selected.quarter
                AND score.methodology_version = selected.methodology_version
              ORDER BY score.rank
              LIMIT 250
            `,
            params: [],
            variant: "pre-0036-quarter-method",
          };
    case "pulse-publication-panel":
      return pulsePublicationPointerAvailable
        ? {
            query: `
              SELECT history.jurisdiction_id, history.dimension, history.delta_value
              FROM pulse_dimensional_delta_history history
              WHERE history.computation_run_id = (
                SELECT computation_run_id
                FROM pulse_score_publication_pointers
                WHERE product = 'pulse_dimensions'
                LIMIT 1
              )
              ORDER BY history.jurisdiction_id, history.dimension
            `,
            params: [],
            variant: "pointer-selected",
          }
        : {
            query: `
              WITH selected AS (
                SELECT history.computation_run_id
                FROM pulse_dimensional_delta_history history
                GROUP BY history.computation_run_id
                ORDER BY max(history.created_at) DESC
                LIMIT 1
              )
              SELECT history.jurisdiction_id, history.dimension, history.delta_value
              FROM pulse_dimensional_delta_history history
              CROSS JOIN selected
              WHERE history.computation_run_id = selected.computation_run_id
              ORDER BY history.jurisdiction_id, history.dimension
            `,
            params: [],
            variant: "pre-0036-latest-run",
          };
    case "pulse-country-events-high-cardinality":
      return {
        query: `
          SELECT event.id, event.event_date, event.dimension, event.severity_value
          FROM pulse_events_v2 event
          WHERE event.jurisdiction_id = (
            SELECT id FROM jurisdictions WHERE slug = $1 LIMIT 1
          )
            AND event.projection_status = 'current'
          ORDER BY event.event_date DESC, event.created_at DESC
          LIMIT 251
        `,
        params: ["turkey"],
        variant: "standard",
      };
    default:
      throw new Error(`Unknown query-budget fixture: ${id}`);
  }
}

function percentile(values: readonly number[], p: number): number {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.ceil(sorted.length * p) - 1] ?? 0;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("PostgreSQL returned an unexpected EXPLAIN JSON shape");
  }
  return value as Record<string, unknown>;
}

function parsePlan(result: unknown): Record<string, unknown> {
  const first = Array.isArray(result)
    ? result[0]
    : (result as { rows?: unknown[] }).rows?.[0];
  const queryPlan = asRecord(first)["QUERY PLAN"];
  const parsed = typeof queryPlan === "string" ? JSON.parse(queryPlan) : queryPlan;
  const top = Array.isArray(parsed) ? parsed[0] : parsed;
  return asRecord(asRecord(top).Plan);
}

function summarizePlan(plan: Record<string, unknown>): {
  nodeTypes: string[];
  indexesUsed: string[];
  sharedHitBlocks: number;
} {
  const nodeTypes = new Set<string>();
  const indexesUsed = new Set<string>();
  let sharedHitBlocks = 0;

  const visit = (node: Record<string, unknown>) => {
    const nodeType = node["Node Type"];
    if (typeof nodeType === "string") nodeTypes.add(nodeType);
    const indexName = node["Index Name"];
    if (typeof indexName === "string") indexesUsed.add(indexName);
    const hits = node["Shared Hit Blocks"];
    if (typeof hits === "number") sharedHitBlocks += hits;
    const children = node.Plans;
    if (Array.isArray(children)) {
      for (const child of children) visit(asRecord(child));
    }
  };

  visit(plan);
  return {
    nodeTypes: [...nodeTypes].sort(),
    indexesUsed: [...indexesUsed].sort(),
    sharedHitBlocks,
  };
}

async function existingIndexes(requiredIndexes: readonly string[]): Promise<Set<string>> {
  const rows = await sql.query(
    `SELECT indexname FROM pg_indexes
     WHERE schemaname = 'public' AND indexname = ANY($1::text[])`,
    [requiredIndexes],
  );
  return new Set(
    (rows as Array<Record<string, unknown>>).map((row) => String(row.indexname)),
  );
}

async function measure(
  budget: QueryBudget,
  indexReleasePointersAvailable: boolean,
  pulsePublicationPointerAvailable: boolean,
) {
  const fixture = fixtureFor(
    budget.id,
    indexReleasePointersAvailable,
    pulsePublicationPointerAvailable,
  );
  if (!/^\s*SELECT\b/i.test(fixture.query) && !/^\s*WITH\b/i.test(fixture.query)) {
    throw new Error(`${budget.id}: query must be a SELECT or WITH SELECT`);
  }
  const samples: Array<{
    executionMs: number;
    roundTripMs: number;
    returnedRows: number;
    nodeTypes: string[];
    indexesUsed: string[];
    sharedHitBlocks: number;
  }> = [];

  for (let index = 0; index < iterations; index += 1) {
    const startedAt = performance.now();
    const result = await sql.query(
      `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${fixture.query}`,
      [...fixture.params],
    );
    const roundTripMs = performance.now() - startedAt;
    const plan = parsePlan(result);
    const executionMs = Number(parsePlan(result)["Actual Total Time"]);
    const returnedRows = Number(plan["Actual Rows"]);
    if (!Number.isFinite(executionMs) || !Number.isFinite(returnedRows)) {
      throw new Error(`${budget.id}: EXPLAIN did not return execution metrics`);
    }
    samples.push({
      executionMs,
      roundTripMs,
      returnedRows,
      ...summarizePlan(plan),
    });
  }

  const executionP95Ms = percentile(
    samples.map((sample) => sample.executionMs),
    0.95,
  );
  const roundTripP95Ms = percentile(
    samples.map((sample) => sample.roundTripMs),
    0.95,
  );
  const maxReturnedRows = Math.max(
    ...samples.map((sample) => sample.returnedRows),
  );
  const nodeTypes = [...new Set(samples.flatMap((sample) => sample.nodeTypes))].sort();
  const indexesUsed = [...new Set(samples.flatMap((sample) => sample.indexesUsed))].sort();
  const maxSharedHitBlocks = Math.max(
    ...samples.map((sample) => sample.sharedHitBlocks),
  );

  return {
    ...budget,
    queryVariant: fixture.variant,
    samples,
    executionP95Ms,
    roundTripP95Ms,
    maxObservedReturnedRows: maxReturnedRows,
    nodeTypes,
    indexesUsed,
    maxSharedHitBlocks,
  };
}

async function main(): Promise<void> {
  const requiredIndexNames = [
    ...new Set(QUERY_BUDGETS.flatMap((budget) => budget.requiredIndexes)),
  ];
  const presentIndexes = await existingIndexes(requiredIndexNames);
  const [releasePointerRelation] = (await sql.query(
    `SELECT
      to_regclass('public.ci_index_release_pointers') IS NOT NULL AS index_available,
      to_regclass('public.pulse_score_publication_pointers') IS NOT NULL AS pulse_available`,
  )) as Array<Record<string, unknown>>;
  const indexReleasePointersAvailable = releasePointerRelation?.index_available === true;
  const pulsePublicationPointerAvailable = releasePointerRelation?.pulse_available === true;
  const profiles = await Promise.all(
    QUERY_BUDGETS.map((budget) =>
      measure(
        budget,
        indexReleasePointersAvailable,
        pulsePublicationPointerAvailable,
      ),
    ),
  );
  const violations: string[] = [];

  for (const profile of profiles) {
    for (const indexName of profile.requiredIndexes) {
      if (!presentIndexes.has(indexName)) {
        violations.push(`${profile.id}: required index ${indexName} is absent`);
      }
    }
    if (profile.executionP95Ms > profile.executionP95BudgetMs) {
      violations.push(
        `${profile.id}: execution p95 ${profile.executionP95Ms.toFixed(3)}ms exceeds ${profile.executionP95BudgetMs}ms`,
      );
    }
    if (profile.maxObservedReturnedRows > profile.maxReturnedRows) {
      violations.push(`${profile.id}: response exceeded ${profile.maxReturnedRows} rows`);
    }
  }

  const report = {
    schemaVersion: QUERY_BUDGET_CONTRACT_VERSION,
    generatedAt: new Date().toISOString(),
    mode: "read-only-live-database",
    indexReleaseSchema:
      indexReleasePointersAvailable ? "0036-or-newer" : "pre-0036",
    pulsePublicationSchema:
      pulsePublicationPointerAvailable ? "0036-or-newer" : "pre-0036",
    iterations,
    profiles: profiles.map(({ samples, ...profile }) => ({
      ...profile,
      samples: samples.map((sample) => ({
        executionMs: sample.executionMs,
        roundTripMs: sample.roundTripMs,
        returnedRows: sample.returnedRows,
        nodeTypes: sample.nodeTypes,
        indexesUsed: sample.indexesUsed,
        sharedHitBlocks: sample.sharedHitBlocks,
      })),
    })),
    status: violations.length === 0 ? "pass" : "fail",
    violations,
  };

  if (write) writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
  if (violations.length > 0) process.exitCode = 1;
}

void main();
