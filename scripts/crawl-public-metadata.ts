/**
 * crawl-public-metadata — live crawl of every route in `sitemap.xml`
 * against the public metadata contract (CLM-013 slice A).
 *
 *   Run with:  npm run crawl:metadata [-- --base-url=http://localhost:3000]
 *   Companion: src/lib/seo/metadata-contract.ts (the shared pure parsing/
 *              validation this script and the test suite both call)
 *
 * `--base-url` (default: the canonical apex, `SITE_URL` from `@/lib/site`)
 * is where HTTP requests actually go — the sitemap XML is fetched from
 * `${baseUrl}/sitemap.xml`, and each discovered `<loc>` (always an absolute
 * apex URL — `sitemap.ts` never emits anything else) is re-mapped onto
 * `baseUrl` before being fetched, so a local dev server's OWN sitemap can be
 * crawled while every page is still validated against its real apex
 * canonical/og:url expectation.
 *
 * For each crawled route:
 *   - HTTP 200
 *   - exactly one canonical == the sitemap loc, exactly one og:url == loc
 *   - absolute apex og:image; twitter:card=summary_large_image + absolute
 *     apex twitter:image
 *   - no noindex, no forbidden (www/preview/vercel/localhost/http) host in
 *     canonical/og:url metadata
 *   - every JSON-LD block on the page parses
 *   - Index-facing routes (`/civica-index*`) disclose beta/research-
 *     experiment status; Pulse-facing routes
 *     (`/civica-index/pulse-changelog`, `/civica-index/methodology/pulse*`)
 *     disclose experimental/archived-diagnostic status
 *   - `/civica-index` exactly carries one valid Dataset JSON-LD node
 *
 * Bounded concurrency (`--concurrency`, default 8). Reports pass/fail
 * counts and every collected error, then exits nonzero on any failure.
 */

import { SITE_URL } from "../src/lib/site";
import {
  extractSitemapLocs,
  extractJsonLdNodes,
  validatePageMetadata,
  validateDatasetNode,
  classifyRouteStatus,
  routeStatusSatisfied,
} from "../src/lib/seo/metadata-contract";

// Re-exported so fixtures/consumers of this CLI can import the same
// route-status predicate the crawl itself enforces, without reaching into
// the shared module directly.
export { classifyRouteStatus, routeStatusSatisfied };

interface CliArgs {
  baseUrl: string;
  concurrency: number;
}

function parseArgs(argv: string[]): CliArgs {
  let baseUrl = SITE_URL;
  let concurrency = 8;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--base-url") {
      baseUrl = argv[++i] ?? baseUrl;
    } else if (arg.startsWith("--base-url=")) {
      baseUrl = arg.slice("--base-url=".length);
    } else if (arg === "--concurrency") {
      concurrency = Number(argv[++i]) || concurrency;
    } else if (arg.startsWith("--concurrency=")) {
      concurrency = Number(arg.slice("--concurrency=".length)) || concurrency;
    } else if (arg === "--help" || arg === "-h") {
      console.log(
        [
          "crawl-public-metadata — crawl sitemap.xml against the public metadata contract",
          "",
          "Usage:",
          "  npm run crawl:metadata -- [--base-url=<url>] [--concurrency=<n>]",
          "",
          `  --base-url      Where to fetch pages from (default: ${SITE_URL})`,
          "  --concurrency   Max in-flight requests (default: 8)",
        ].join("\n"),
      );
      process.exit(0);
    }
  }

  return { baseUrl: baseUrl.replace(/\/$/, ""), concurrency };
}

/** Re-target an absolute apex `loc` onto `baseUrl`, keeping path/search/hash. */
function mapLocToBase(loc: string, baseUrl: string): string {
  const locUrl = new URL(loc);
  const target = new URL(baseUrl);
  target.pathname = locUrl.pathname;
  target.search = locUrl.search;
  target.hash = locUrl.hash;
  return target.toString();
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker(): Promise<void> {
    for (;;) {
      const i = next++;
      if (i >= items.length) return;
      results[i] = await fn(items[i], i);
    }
  }
  const workerCount = Math.max(1, Math.min(limit, items.length));
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}

interface CrawlResult {
  loc: string;
  errors: string[];
}

async function crawlOne(loc: string, baseUrl: string): Promise<CrawlResult> {
  const fetchUrl = mapLocToBase(loc, baseUrl);

  let status = 0;
  let html = "";
  try {
    const res = await fetch(fetchUrl, { redirect: "manual" });
    status = res.status;
    html = await res.text();
  } catch (err) {
    return {
      loc,
      errors: [`fetch failed for ${fetchUrl}: ${err instanceof Error ? err.message : String(err)}`],
    };
  }

  const errors: string[] = [];
  errors.push(...validatePageMetadata({ loc, siteUrl: SITE_URL, status, html }).errors);

  if (status === 200) {
    const pathname = new URL(loc).pathname;

    const statusClass = classifyRouteStatus(pathname);
    if (statusClass !== "none" && !routeStatusSatisfied(pathname, html)) {
      errors.push(
        statusClass === "pulse"
          ? "Pulse-facing route must disclose experimental/archived-diagnostic status in its content"
          : "Index-facing route must disclose beta/research-experiment status in its content",
      );
    }

    if (pathname === "/civica-index") {
      const datasetResult = validateDatasetNode({
        nodes: extractJsonLdNodes(html),
        canonical: loc,
        siteUrl: SITE_URL,
      });
      errors.push(...datasetResult.errors.map((e) => `[Dataset] ${e}`));
    }
  }

  return { loc, errors };
}

async function main(): Promise<void> {
  const { baseUrl, concurrency } = parseArgs(process.argv.slice(2));

  console.log(`=== Civica public metadata crawl (base: ${baseUrl}) ===\n`);

  const sitemapUrl = new URL("/sitemap.xml", baseUrl).toString();
  let sitemapXml: string;
  try {
    const res = await fetch(sitemapUrl);
    if (!res.ok) {
      console.error(`✗ failed to fetch sitemap: ${sitemapUrl} -> HTTP ${res.status}`);
      process.exit(1);
    }
    sitemapXml = await res.text();
  } catch (err) {
    console.error(
      `✗ failed to fetch sitemap: ${sitemapUrl} -> ${err instanceof Error ? err.message : String(err)}`,
    );
    process.exit(1);
  }

  const locs = extractSitemapLocs(sitemapXml);
  if (locs.length === 0) {
    console.error(`✗ sitemap at ${sitemapUrl} contained zero <loc> entries`);
    process.exit(1);
  }

  const seenLocs = new Set<string>();
  const duplicateLocs = new Set<string>();
  for (const loc of locs) {
    if (seenLocs.has(loc)) duplicateLocs.add(loc);
    seenLocs.add(loc);
  }
  if (duplicateLocs.size > 0) {
    console.error(`✗ sitemap.xml contains ${duplicateLocs.size} duplicate <loc> value(s):`);
    for (const loc of duplicateLocs) console.error(`  - ${loc}`);
    process.exit(1);
  }

  console.log(`Discovered ${locs.length} route(s) in sitemap.xml. Crawling with concurrency ${concurrency}...\n`);

  const results = await mapWithConcurrency(locs, concurrency, (loc) => crawlOne(loc, baseUrl));

  let okCount = 0;
  const allErrors: string[] = [];
  for (const r of results) {
    if (r.errors.length === 0) {
      okCount++;
    } else {
      for (const e of r.errors) allErrors.push(`${r.loc} — ${e}`);
    }
  }

  console.log(`Summary: ${okCount}/${locs.length} route(s) passed the public metadata contract.\n`);

  if (allErrors.length > 0) {
    console.error("Errors:");
    for (const e of allErrors) console.error(`  ✗ ${e}`);
    console.error(`\n✗ Crawl failed: ${allErrors.length} issue(s) across ${locs.length - okCount} route(s).`);
    process.exit(1);
  }

  console.log("✓ Every crawled route satisfies the public metadata contract.");
  process.exit(0);
}

main().catch((err) => {
  console.error("crawl-public-metadata threw:", err);
  process.exit(1);
});
