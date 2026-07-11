/**
 * validate-metadata — DB-free, build-safe guard for the public metadata
 * contract (CLM-013 slice A).
 *
 *   Run with:  npm run validate:metadata
 *   Companions: src/lib/site.ts (single canonical host + release date),
 *               src/lib/seo/metadata-contract.ts (shared pure parsing/
 *               validation, also used by scripts/crawl-public-metadata.ts
 *               and src/lib/seo/__tests__/metadata-contract.test.ts)
 *
 * Checks, all static/pure — no network, no database:
 *
 *   1. No forbidden host literal (www, *.vercel.app, localhost, 127.0.0.1,
 *      a preview host, or a non-https apex URL) is hardcoded anywhere in the
 *      core SEO surfaces, or in any `src/app` file that exports `metadata`/
 *      `generateMetadata` (discovered recursively — arbitrary app code that
 *      emits no metadata is never scanned). Those surfaces must derive the
 *      host from `@/lib/site`.
 *   2. `src/app/sitemap.ts` contains zero argument-less `new Date()` calls
 *      (every `lastModified` must come from a stored or checked-in value).
 *   3. A representative `buildDataset()` node (mirroring the real
 *      `/civica-index` call site) satisfies `validateDatasetNode()`.
 *   4. The shared constants (`SITE_URL`, `absoluteUrl`) resolve correctly,
 *      and the root layout's OG contract (`metadataBase` + relative
 *      `openGraph.url: "./"`) is present in source.
 *   5. `src/app/sitemap.ts` still declares every required direct static route
 *      (`/constitution`, `/about/advisory-board/apply`), excludes the
 *      redirect-only `/organizations` landing,
 *      and still emits all three per-country tabs (base, Civica Data,
 *      Constitution) — removing an indexable route family is a regression.
 *
 * Exit 0 + summary on success; exit 1 + a listed failure per line on
 * failure.
 */

import { promises as fs } from "node:fs";
import path from "node:path";

import { SITE_URL, absoluteUrl } from "../src/lib/site";
import { RIGHTS_REGISTRY_URL } from "../src/lib/claims/reuse-rights";
import { buildDataset } from "../src/lib/seo/jsonld";
import {
  hasArgumentlessNewDate,
  findArgumentlessNewDateCalls,
  findForbiddenHostPatternsInSource,
  validateDatasetNode,
} from "../src/lib/seo/metadata-contract";

const REPO_ROOT = path.resolve(__dirname, "..");

// ─────────────────────────────────────────────────────────────────────────
// Check 1 — forbidden host literals in metadata-emitting surfaces
// ─────────────────────────────────────────────────────────────────────────

// Core SEO surfaces that always ship metadata but may not literally contain
// `export const metadata`/`generateMetadata` (e.g. shared JSON-LD builders).
const CORE_METADATA_SURFACE_FILES = [
  "src/app/layout.tsx",
  "src/app/sitemap.ts",
  "src/app/robots.ts",
  "src/lib/og.ts",
  "src/lib/seo/jsonld.ts",
  "src/lib/site.ts",
];

const METADATA_EXPORT_RE = /export\s+const\s+metadata\b|\bgenerateMetadata\b/;

/** Recursively find every `.ts`/`.tsx` file under `src/app` whose source
 *  declares `export const metadata` or `generateMetadata` — i.e. every page/
 *  layout that actually emits metadata, never arbitrary app code. */
async function findAppMetadataFiles(): Promise<string[]> {
  const appRoot = path.join(REPO_ROOT, "src/app");
  const out: string[] = [];

  async function walk(dir: string): Promise<void> {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(abs);
        continue;
      }
      if (!/\.(ts|tsx)$/.test(entry.name)) continue;
      const content = await fs.readFile(abs, "utf8");
      if (METADATA_EXPORT_RE.test(content)) {
        out.push(path.relative(REPO_ROOT, abs));
      }
    }
  }

  await walk(appRoot);
  return out;
}

async function checkForbiddenHostLiterals(): Promise<string[]> {
  const failures: string[] = [];

  const appMetadataFiles = await findAppMetadataFiles();
  const files = Array.from(new Set([...CORE_METADATA_SURFACE_FILES, ...appMetadataFiles]));

  for (const rel of files) {
    const abs = path.join(REPO_ROOT, rel);
    let content: string;
    try {
      content = await fs.readFile(abs, "utf8");
    } catch {
      failures.push(`${rel}: expected metadata surface file is missing`);
      continue;
    }
    for (const label of findForbiddenHostPatternsInSource(content)) {
      failures.push(`${rel}: contains forbidden host pattern "${label}"`);
    }
  }
  return failures;
}

// ─────────────────────────────────────────────────────────────────────────
// Check 2 — argument-less new Date() in sitemap.ts
// ─────────────────────────────────────────────────────────────────────────

async function checkSitemapHasNoArgumentlessDate(): Promise<string[]> {
  const rel = "src/app/sitemap.ts";
  const abs = path.join(REPO_ROOT, rel);
  const content = await fs.readFile(abs, "utf8");
  if (!hasArgumentlessNewDate(content)) return [];
  const offsets = findArgumentlessNewDateCalls(content);
  return offsets.map((offset) => {
    const line = content.slice(0, offset).split("\n").length;
    return `${rel}:${line}: argument-less \`new Date()\` — derive lastModified from a stored/checked-in value instead`;
  });
}

// ─────────────────────────────────────────────────────────────────────────
// Check 3 — a representative buildDataset() node satisfies the contract
// ─────────────────────────────────────────────────────────────────────────

function checkSampleDatasetNode(): string[] {
  const canonical = absoluteUrl("/civica-index");
  const node = buildDataset({
    name: "Civica Index",
    description:
      "A research-beta composite across four governance dimensions, with fixed-bound normalization and no published composite uncertainty band. The methodology has not completed independent review.",
    url: canonical,
    license: RIGHTS_REGISTRY_URL,
    distributionUrl: absoluteUrl("/api/v1/index/rankings"),
    keywords: ["governance", "democracy", "rule of law"],
  });

  const result = validateDatasetNode({ nodes: [node], canonical, siteUrl: SITE_URL });
  return result.errors.map((e) => `sample buildDataset() node: ${e}`);
}

// ─────────────────────────────────────────────────────────────────────────
// Check 4 — shared constants + root OG contract
// ─────────────────────────────────────────────────────────────────────────

async function checkSharedConstantsAndRootOg(): Promise<string[]> {
  const failures: string[] = [];

  if (SITE_URL !== "https://civicaatlas.org") {
    failures.push(`SITE_URL resolved to "${SITE_URL}", expected the checked-in apex literal`);
  }
  if (absoluteUrl("/civica-index") !== `${SITE_URL}/civica-index`) {
    failures.push("absoluteUrl() did not resolve a root-relative path against SITE_URL");
  }
  if (absoluteUrl("/") !== SITE_URL || absoluteUrl("") !== SITE_URL) {
    failures.push('absoluteUrl("/") and absoluteUrl("") must both resolve to the bare SITE_URL');
  }

  const rel = "src/app/layout.tsx";
  const abs = path.join(REPO_ROOT, rel);
  const content = await fs.readFile(abs, "utf8");

  if (!/from\s+["']@\/lib\/site["']/.test(content)) {
    failures.push(`${rel}: must import the canonical host from "@/lib/site"`);
  }
  if (!/metadataBase:\s*new URL\(SITE_URL\)/.test(content)) {
    failures.push(`${rel}: metadataBase must be built from the imported SITE_URL`);
  }
  if (!/openGraph:\s*\{[\s\S]{0,800}?url:\s*["']\.\/["']/.test(content)) {
    failures.push(
      `${rel}: root openGraph must declare a relative url: "./" so inherited pages emit a route-real og:url`,
    );
  }

  return failures;
}

// ─────────────────────────────────────────────────────────────────────────
// Check 5 — required indexable route families still present in sitemap.ts
// ─────────────────────────────────────────────────────────────────────────

// Static routes whose removal from PUBLIC_STATIC_ROUTES would silently drop
// an entire indexable family from the sitemap.
const REQUIRED_STATIC_ROUTES = ["/constitution", "/about/advisory-board/apply"];

// The three per-country tabs sitemap.ts must keep emitting per jurisdiction —
// matched as the exact template-literal fragments in the source.
const REQUIRED_COUNTRY_SITEMAP_FRAGMENTS = [
  "`/country/${country.slug}`",
  "`/country/${country.slug}/civica-data`",
  "`/country/${country.slug}/constitution`",
];

async function checkRequiredSitemapRoutes(): Promise<string[]> {
  const rel = "src/app/sitemap.ts";
  const abs = path.join(REPO_ROOT, rel);
  const content = await fs.readFile(abs, "utf8");
  const failures: string[] = [];

  for (const route of REQUIRED_STATIC_ROUTES) {
    const escaped = route.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`path:\\s*["']${escaped}["']`);
    if (!re.test(content)) {
      failures.push(`${rel}: missing required static route "${route}" in PUBLIC_STATIC_ROUTES`);
    }
  }

  if (/path:\s*["']\/organizations["']/.test(content)) {
    failures.push(
      `${rel}: redirect-only "/organizations" must not appear in PUBLIC_STATIC_ROUTES; index its canonical organization pages instead`,
    );
  }

  for (const fragment of REQUIRED_COUNTRY_SITEMAP_FRAGMENTS) {
    if (!content.includes(fragment)) {
      failures.push(
        `${rel}: country sitemap entries must still include ${fragment} — removing an indexable family is a regression`,
      );
    }
  }

  return failures;
}

// ─────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log("=== Civica public metadata contract validation ===\n");

  const results = await Promise.all([
    checkForbiddenHostLiterals(),
    checkSitemapHasNoArgumentlessDate(),
    Promise.resolve(checkSampleDatasetNode()),
    checkSharedConstantsAndRootOg(),
    checkRequiredSitemapRoutes(),
  ]);

  const labels = [
    "forbidden host literals",
    "argument-less new Date() in sitemap.ts",
    "sample buildDataset() node",
    "shared constants + root OG contract",
    "required sitemap route families",
  ];

  let totalFailures = 0;
  results.forEach((failures, i) => {
    if (failures.length === 0) {
      console.log(`✓ ${labels[i]}`);
    } else {
      console.log(`✗ ${labels[i]}`);
      for (const f of failures) {
        console.error(`  - ${f}`);
        totalFailures++;
      }
    }
  });

  console.log("");
  if (totalFailures > 0) {
    console.error(`✗ Validation failed: ${totalFailures} issue(s).`);
    process.exit(1);
  }

  console.log("✓ All metadata contract checks passed.");
  process.exit(0);
}

main().catch((err) => {
  console.error("validate-metadata threw:", err);
  process.exit(1);
});
