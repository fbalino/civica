import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { promisify } from "node:util";
import { resolve } from "node:path";

const execFileAsync = promisify(execFile);
const sample = JSON.parse(readFileSync(resolve("data/research/pulse-country-day-sample-v1.json"), "utf8"));
const rawDir = resolve(".firecrawl/pulse-country-day-v1");
const output = resolve("data/research/pulse-country-day-search-traces-v1.json");
const setOutput = resolve("data/research/pulse-country-day-evaluation-set-v1.json");
const concurrency = Number(process.env.PULSE_SEARCH_CONCURRENCY ?? 4);
const max = Number(process.argv.find((arg) => arg.startsWith("--max="))?.split("=")[1] ?? sample.rows.length);
let cliVersion = "";
mkdirSync(rawDir, { recursive: true });

interface SampleRow {
  id: string;
  protocolVersion: string;
  analysisStatus: string;
  evidenceRefs: string[];
  searchQueries: Record<string, string>;
}

interface SearchResult {
  rank: number;
  title: string;
  url: string;
  publishedDate: string | null;
}

interface QueryTrace {
  schemaVersion: string;
  sampleId?: string;
  family: string;
  query: string;
  provider: string;
  cliVersion: string;
  capturedAt: string;
  resultLimit: number;
  resultCount: number;
  results: SearchResult[];
  queryTraceSha256: string;
}

interface CombinedTrace {
  schemaVersion: string;
  sampleId: string;
  queryTraces: QueryTrace[];
  totalResultCount: number;
  contentPolicy: string;
  traceSha256: string;
}

function hash(value: string) { return createHash("sha256").update(value).digest("hex"); }
function tracePath(id: string, family: string) { return resolve(rawDir, `${hash(family === "institutions" ? id : `${id}|${family}`)}.json`); }

async function searchQuery(row: SampleRow, family: string, query: string): Promise<QueryTrace> {
  const path = tracePath(String(row.id), family);
  let fallback = false;
  try {
    const cached = JSON.parse(readFileSync(path, "utf8")) as QueryTrace;
    const matchesCurrentWrapper = cached.schemaVersion === "pulse-country-day-search-query-trace/v1" && cached.family === family && cached.query === query;
    const matchesLegacyInstitutionWrapper = cached.schemaVersion === "pulse-country-day-search-trace/v1" && family === "institutions" && cached.sampleId === row.id && cached.query === query;
    const matchesFrozenQuery = matchesCurrentWrapper || matchesLegacyInstitutionWrapper;
    const hasUsableResults = Array.isArray(cached.results) && cached.results.every((result) => /^https?:\/\//.test(result.url) && result.title.trim());
    if (matchesFrozenQuery && hasUsableResults) {
      const cachedBody = { schemaVersion: "pulse-country-day-search-query-trace/v1", family, query, provider: cached.provider, cliVersion: cached.cliVersion, capturedAt: cached.capturedAt, resultLimit: cached.resultLimit, resultCount: cached.resultCount, results: cached.results };
      return { ...cachedBody, queryTraceSha256: hash(JSON.stringify(cachedBody)) };
    }
    fallback = matchesFrozenQuery;
  } catch { /* issue the frozen search */ }
  const temp = `${path}.raw.json`;
  let lastError = "search produced no output";
  for (let attempt = 1; attempt <= 5 && !existsSync(temp); attempt++) {
    try {
      const result = await execFileAsync("firecrawl", ["search", query, "--sources", fallback ? "web" : "news", "--limit", "5", "-o", temp, "--json"], { maxBuffer: 20_000_000 });
      lastError = result.stderr || result.stdout || lastError;
    } catch (error) {
      lastError = String(error);
    }
    if (/No results found/i.test(lastError)) break;
    if (!existsSync(temp)) await new Promise((resolve) => setTimeout(resolve, attempt * 1500));
  }
  if (!existsSync(temp) && !/No results found/i.test(lastError)) throw new Error(`${row.id}: ${lastError}`);
  const raw = existsSync(temp) ? JSON.parse(readFileSync(temp, "utf8")) : { data: { news: [] } };
  if (existsSync(temp)) unlinkSync(temp);
  const results = (fallback ? raw.data?.web ?? [] : raw.data?.news ?? raw.data?.web ?? []).map((result: Record<string, unknown>, index: number) => ({
    rank: index + 1,
    title: String(result.title ?? ""),
    url: String(result.url ?? ""),
    publishedDate: result.date ? String(result.date) : null,
  }));
  const body = {
    schemaVersion: "pulse-country-day-search-query-trace/v1",
    family,
    query,
    provider: fallback ? "firecrawl-search/web-fallback" : "firecrawl-search/news",
    cliVersion,
    capturedAt: new Date().toISOString(),
    resultLimit: 5,
    resultCount: results.length,
    results,
  };
  const trace = { ...body, queryTraceSha256: hash(JSON.stringify(body)) };
  writeFileSync(path, `${JSON.stringify(trace, null, 2)}\n`);
  const hasMalformedResult = results.some((result: SearchResult) => !/^https?:\/\//.test(result.url) || !result.title.trim());
  if (hasMalformedResult && !fallback) return searchQuery(row, family, query);
  if (hasMalformedResult) throw new Error(`${row.id}/${family}: web fallback returned an unusable result`);
  return trace;
}

async function search(row: SampleRow): Promise<CombinedTrace> {
  const queryTraces: QueryTrace[] = [];
  for (const [family, query] of Object.entries(row.searchQueries as Record<string, string>)) queryTraces.push(await searchQuery(row, family, query));
  const body = {
    schemaVersion: "pulse-country-day-search-trace/v2",
    sampleId: row.id,
    queryTraces,
    totalResultCount: queryTraces.reduce((sum, trace) => sum + trace.resultCount, 0),
    contentPolicy: "url_title_date_only_no_snippet_or_page_body",
  };
  return { ...body, traceSha256: hash(JSON.stringify(body)) };
}

async function main() {
  cliVersion = (await execFileAsync("firecrawl", ["--version"])).stdout.trim();
  if (!cliVersion) throw new Error("Firecrawl CLI version could not be recorded");
  const rows = (sample.rows as SampleRow[]).slice(0, max);
  const traces: unknown[] = new Array(rows.length);
  let cursor = 0;
  async function worker() {
    while (cursor < rows.length) {
      const index = cursor++;
      traces[index] = await search(rows[index]);
      if ((index + 1) % 25 === 0) console.log(`Captured ${index + 1}/${rows.length}`);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, rows.length) }, worker));
  const body = {
    schemaVersion: "pulse-country-day-search-trace-set/v1",
    sampleVersion: sample.schemaVersion,
    sampleSha256: sample.semanticSha256,
    completed: traces.length === sample.rows.length,
    traceCount: traces.length,
    traces,
  };
  const artifact = { ...body, semanticSha256: hash(JSON.stringify(body)) };
  writeFileSync(output, `${JSON.stringify(artifact, null, 2)}\n`);
  if (artifact.completed) {
    const completedTraces = traces as CombinedTrace[];
    const traceById = new Map(completedTraces.map((trace) => [trace.sampleId, trace]));
    const setBody = {
      schemaVersion: "pulse-country-day-evaluation-set/v1",
      protocolVersion: sample.protocolVersion,
      sampleSha256: sample.semanticSha256,
      traceSetSha256: artifact.semanticSha256,
      labelStatus: "unlabeled",
      allowedCoderOutcomes: ["qualifying_event", "true_negative", "retrieval_miss", "insufficient_observation", "out_of_scope"],
      rows: (sample.rows as SampleRow[]).map((row) => {
        const trace = traceById.get(row.id);
        if (!trace) throw new Error(`${row.id}: completed trace missing`);
        return { sampleId: row.id, analysisStatus: row.analysisStatus, evidenceRefs: row.evidenceRefs, searchTraceSha256: trace.traceSha256 };
      }),
    };
    writeFileSync(setOutput, `${JSON.stringify({ ...setBody, semanticSha256: hash(JSON.stringify(setBody)) }, null, 2)}\n`);
  }
  console.log(`Wrote ${output}: ${traces.length} traces; complete=${artifact.completed}`);
}

main().catch((error) => { console.error(error); process.exit(1); });
