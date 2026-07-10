/**
 * Unit tests for `src/lib/docs/doc-references.ts` (CLM-011).
 *
 * No test runner is wired into the project (no jest, no vitest). The
 * suite is a runnable script using Node's built-in `assert/strict`.
 * Run via:
 *     npx tsx src/lib/docs/__tests__/doc-references.test.ts
 * Throws on first failure; exits 0 on success.
 */

import assert from "node:assert/strict";
import {
  extractNpmScriptMentions,
  findUnknownNpmScripts,
  extractRouteMentions,
  routeMentionResolves,
  extractRepoFilePointers,
  countPgTableDeclarations,
  extractDocumentedTableCount,
  hasStaleCronSecretScopeClaim,
  mentionsCronSecret,
  mentionsBroadCronScope,
  extractEmbeddedTemplateHash,
  extractEmbeddedGeneratedBodyHash,
  computeGeneratedReadmeBodyHash,
  hasStaleAtlasRedirectMemoryClaim,
  mentionsCurrentAtlasRedirectTarget,
} from "../doc-references";
import type { AppRoute } from "../routes";

let passed = 0;
function test(name: string, fn: () => void): void {
  try {
    fn();
    passed += 1;
    console.log(`  ok   ${name}`);
  } catch (err) {
    console.error(`  FAIL ${name}`);
    throw err;
  }
}

console.log("doc-references.test.ts");

/* ── npm script mentions ── */

test("extracts an exact npm script mention", () => {
  const mentions = extractNpmScriptMentions("Run `npm run validate:doc-sources` first.");
  assert.equal(mentions.length, 1);
  assert.equal(mentions[0].kind, "exact");
  assert.deepEqual(mentions[0].scripts, ["validate:doc-sources"]);
});

test("expands a {a,b,c} brace mention into multiple scripts", () => {
  const mentions = extractNpmScriptMentions(
    "`npm run pulse:v2:{ingest,cluster,classify,score}` — run one Pulse v2 stage",
  );
  assert.equal(mentions.length, 1);
  assert.equal(mentions[0].kind, "expanded");
  assert.deepEqual(mentions[0].scripts, [
    "pulse:v2:ingest",
    "pulse:v2:cluster",
    "pulse:v2:classify",
    "pulse:v2:score",
  ]);
});

test("a trailing :* mention is a wildcard family", () => {
  const mentions = extractNpmScriptMentions("Do NOT ship `npm run sync:*` changes that drop stamps.");
  assert.equal(mentions.length, 1);
  assert.equal(mentions[0].kind, "wildcard");
  assert.deepEqual(mentions[0].scripts, ["sync"]);
});

test("findUnknownNpmScripts flags a missing exact script", () => {
  const mentions = extractNpmScriptMentions("`npm run sync:factbook:wb-wdi`");
  const unknown = findUnknownNpmScripts(mentions, new Set(["sync:factbook:wdi"]));
  assert.equal(unknown.length, 1);
  assert.deepEqual(unknown[0].scripts, ["sync:factbook:wb-wdi"]);
});

test("findUnknownNpmScripts passes when the exact script exists", () => {
  const mentions = extractNpmScriptMentions("`npm run sync:factbook:wdi`");
  const unknown = findUnknownNpmScripts(mentions, new Set(["sync:factbook:wdi"]));
  assert.equal(unknown.length, 0);
});

test("findUnknownNpmScripts flags a wildcard family with zero matches", () => {
  const mentions = extractNpmScriptMentions("`npm run nonexistent-family:*`");
  const unknown = findUnknownNpmScripts(mentions, new Set(["sync:wikidata"]));
  assert.equal(unknown.length, 1);
});

test("findUnknownNpmScripts passes a wildcard family with at least one match", () => {
  const mentions = extractNpmScriptMentions("`npm run sync:*`");
  const unknown = findUnknownNpmScripts(mentions, new Set(["sync:wikidata", "sync:ipu"]));
  assert.equal(unknown.length, 0);
});

/* ── route mentions ── */

test("extracts a plain backtick-wrapped route", () => {
  const mentions = extractRouteMentions("See `/civica-index/methodology` for details.");
  assert.equal(mentions.length, 1);
  assert.equal(mentions[0].raw, "/civica-index/methodology");
  assert.deepEqual(mentions[0].segments, ["civica-index", "methodology"]);
  assert.equal(mentions[0].isWildcardFamily, false);
});

test("extracts a bracket-dynamic route from an ASCII diagram line", () => {
  const mentions = extractRouteMentions("│   /country/[slug]              │");
  assert.ok(mentions.some((m) => m.raw === "/country/[slug]"));
});

test("extracts a trailing /* wildcard family", () => {
  const mentions = extractRouteMentions("bearer token for any `/api/cron/*` route");
  const m = mentions.find((mm) => mm.raw === "/api/cron/*");
  assert.ok(m);
  assert.equal(m!.isWildcardFamily, true);
  assert.deepEqual(m!.segments, ["api", "cron"]);
});

test("extracts a trailing /... ellipsis as a wildcard family", () => {
  const mentions = extractRouteMentions("│   /api/v1/...                  │");
  const m = mentions.find((mm) => mm.segments.join("/") === "api/v1");
  assert.ok(m, "expected an /api/v1 wildcard mention");
  assert.equal(m!.isWildcardFamily, true);
});

test("extracts an absolute civicaatlas.org link", () => {
  const mentions = extractRouteMentions(
    "Detailed architecture: see [Reconciliation](https://civicaatlas.org/country/methodology/reconciliation).",
  );
  assert.ok(mentions.some((m) => m.raw === "/country/methodology/reconciliation"));
});

test("does NOT extract a repo file path (no leading slash)", () => {
  const mentions = extractRouteMentions("Schema: `src/lib/db/schema.ts` has 49 tables.");
  assert.equal(mentions.length, 0);
});

test("does NOT extract the adjacent-code-span artifact `/`", () => {
  const mentions = extractRouteMentions("the SAME `<FactbookSidebar>`/`ReaderSidebar` component");
  assert.equal(mentions.length, 0);
});

test("does NOT extract a static asset path with a file extension", () => {
  const mentions = extractRouteMentions("the generic fallback is `/engravings/hero.webp`.");
  assert.equal(mentions.length, 0);
});

test("does NOT truncate a hyphenated route before a sentence-ending period", () => {
  const mentions = extractRouteMentions("redirect URIs must include /admin/sign-in. Create the OAuth client.");
  assert.ok(mentions.some((m) => m.raw === "/admin/sign-in"));
  assert.ok(!mentions.some((m) => m.raw === "/admin/sign"));
});

test("does NOT extract 'and/or' or '50/50' as routes", () => {
  const mentions = extractRouteMentions("Report costs as 50/50 splits, and/or flag them.");
  assert.equal(mentions.length, 0);
});

function fakeRoutes(...segmentLists: string[][]): AppRoute[] {
  return segmentLists.map((segments) => ({
    segments,
    file: `src/app/${segments.join("/")}/page.tsx`,
    type: "page" as const,
  }));
}

test("routeMentionResolves: exact static route matches", () => {
  const mentions = extractRouteMentions("`/civica-index/methodology`");
  const routes = fakeRoutes(["civica-index", "methodology"]);
  assert.equal(routeMentionResolves(mentions[0], routes), true);
});

test("routeMentionResolves: a dynamic route segment accepts a concrete example value", () => {
  const mentions = extractRouteMentions("`/country/methodology`");
  const routes = fakeRoutes(["country", "[slug]"]);
  // "methodology" is a concrete stand-in for the dynamic [slug] segment.
  assert.equal(routeMentionResolves(mentions[0], routes), true);
});

test("routeMentionResolves: a REDIRECT-ONLY legacy path fails (not checked against redirects)", () => {
  const mentions = extractRouteMentions("`/civica-index/changelog`");
  // Only the redirect DESTINATION is a real app route; the source itself
  // is never scanned as a route by this checker.
  const routes = fakeRoutes(["civica-index", "pulse-changelog"]);
  assert.equal(routeMentionResolves(mentions[0], routes), false);
});

test("routeMentionResolves: wildcard family matches as a prefix", () => {
  const mentions = extractRouteMentions("`/api/cron/*`");
  const routes = fakeRoutes(["api", "cron", "pulse", "v2", "classify"]);
  assert.equal(routeMentionResolves(mentions[0], routes), true);
});

test("routeMentionResolves: wildcard family with NO matching route fails", () => {
  const mentions = extractRouteMentions("`/totally-fake-family/*`");
  const routes = fakeRoutes(["civica-index", "methodology"]);
  assert.equal(routeMentionResolves(mentions[0], routes), false);
});

/* ── repo file pointers ── */

test("extracts a src/-rooted file pointer", () => {
  const pointers = extractRepoFilePointers("Schema: `src/lib/db/schema.ts` — 49 tables");
  assert.deepEqual(pointers, ["src/lib/db/schema.ts"]);
});

test("extracts an allowlisted root file pointer", () => {
  const pointers = extractRepoFilePointers("Fill in `.env.example` and see `AGENTS.md`.");
  assert.deepEqual(new Set(pointers), new Set([".env.example", "AGENTS.md"]));
});

test("does NOT extract a ~/civica/plan reference (out of scanner scope)", () => {
  const pointers = extractRepoFilePointers(
    "Full architecture documented at `~/civica/plan/content-templating-implementation-v1.md`.",
  );
  assert.equal(pointers.length, 0);
});

test("does NOT extract an unrecognized bare word as a root file", () => {
  const pointers = extractRepoFilePointers("Use `neutral` tonal chips.");
  assert.equal(pointers.length, 0);
});

/* ── schema table count ── */

test("countPgTableDeclarations counts pgTable( calls", () => {
  const src = `
    export const foo = pgTable("foo", {});
    export const bar = pgTable("bar", {});
    export const baz = pgTable("baz", {});
  `;
  assert.equal(countPgTableDeclarations(src), 3);
});

test("countPgTableDeclarations returns 0 for no matches", () => {
  assert.equal(countPgTableDeclarations("export const x = 1;"), 0);
});

test("extractDocumentedTableCount reads the bolded literal", () => {
  assert.equal(
    extractDocumentedTableCount("Schema: `src/lib/db/schema.ts` — **49 tables** across ..."),
    49,
  );
});

test("extractDocumentedTableCount returns null when absent", () => {
  assert.equal(extractDocumentedTableCount("no count here"), null);
});

/* ── CRON_SECRET scope wording ── */

test("hasStaleCronSecretScopeClaim detects the narrow pulse-only phrasing", () => {
  assert.equal(
    hasStaleCronSecretScopeClaim("bearer token for Vercel cron endpoints at `/api/cron/pulse/*`"),
    true,
  );
});

test("hasStaleCronSecretScopeClaim passes broad /api/cron/* phrasing", () => {
  assert.equal(
    hasStaleCronSecretScopeClaim("bearer token Vercel Cron sends to every scheduled /api/cron/* route"),
    false,
  );
});

test("mentionsCronSecret / mentionsBroadCronScope", () => {
  const text = "CRON_SECRET — bearer token for any /api/cron/* route";
  assert.equal(mentionsCronSecret(text), true);
  assert.equal(mentionsBroadCronScope(text), true);
  assert.equal(mentionsCronSecret("no mention here"), false);
});

/* ── README template freshness hash ── */

test("extractEmbeddedTemplateHash reads a 64-hex-char hash from the banner", () => {
  const hash = "a".repeat(64);
  const readme = `<!--\n  This file is GENERATED...\n  Template SHA-256: ${hash}\n-->\n# Civica Atlas\n`;
  assert.equal(extractEmbeddedTemplateHash(readme), hash);
});

test("extractEmbeddedTemplateHash returns null when absent", () => {
  assert.equal(extractEmbeddedTemplateHash("# Civica Atlas\nno hash here\n"), null);
});

test("generated README body hash passes unchanged and fails after a direct edit", () => {
  const body = "# Civica Atlas\n\nCanonical generated content.\n";
  const bodyHash = computeGeneratedReadmeBodyHash(body);
  const readme = `<!--\n  Template SHA-256: ${"a".repeat(64)}\n  Generated body SHA-256: ${bodyHash}\n-->\n${body}`;

  assert.equal(extractEmbeddedGeneratedBodyHash(readme), bodyHash);
  assert.equal(computeGeneratedReadmeBodyHash(readme), bodyHash);
  assert.notEqual(
    computeGeneratedReadmeBodyHash(readme.replace("Canonical", "Hand-edited")),
    bodyHash,
  );
});

test("project-memory Atlas redirect guard rejects /factbook and accepts /country", () => {
  const stale = "`/atlas/:slug(/:tab)`→`/factbook/:slug`, `/atlas/compare`→`/compare`";
  const current = "`/atlas/:slug(/:tab)`→`/country/:slug`, `/atlas/compare`→`/compare`";
  assert.equal(hasStaleAtlasRedirectMemoryClaim(stale), true);
  assert.equal(mentionsCurrentAtlasRedirectTarget(stale), false);
  assert.equal(hasStaleAtlasRedirectMemoryClaim(current), false);
  assert.equal(mentionsCurrentAtlasRedirectTarget(current), true);
});

console.log(`\n  ${passed} test(s) passed.`);
