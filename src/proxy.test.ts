import assert from "node:assert/strict";
import { test } from "node:test";

import { tryToParsePath } from "next/dist/lib/try-to-parse-path";

import { config } from "./proxy";

/**
 * Compile the shipped matcher with the same `path-to-regexp` entry point the
 * Next build uses, so these assertions describe production behaviour rather
 * than a hand-written approximation of it.
 */
function matchesProxy(pathname: string): boolean {
  return config.matcher.some((source) => {
    const parsed = tryToParsePath(source);
    assert.equal(parsed.error, undefined, `matcher failed to parse: ${source}`);
    assert.ok(parsed.regexStr, `matcher produced no regex: ${source}`);
    return new RegExp(parsed.regexStr).test(pathname);
  });
}

const MUST_MATCH = [
  "/api/v1/countries/france",
  "/api/v1/index",
  "/api/rights-manifest",
  "/api/cron/pulse/v2/ingest",
  "/api/health",
  "/api/countries/japan/scores",
];

// PLT-033: cached page documents, assets, and release downloads never invoke
// the proxy, so a crawler reading cached pages cannot cause a database write.
const MUST_NOT_MATCH = [
  "/",
  "/country/japan",
  "/country/japan/civica-data",
  "/country/japan/constitution",
  "/country/japan.rsc",
  "/methodology/source-coverage",
  "/civica-index/methodology/pulse",
  "/compare",
  "/atlas",
  "/rankings",
  "/elections",
  "/organizations",
  "/blog/the-record-launch",
  "/admin/pulse-coding",
  "/embed/usa",
  "/api-docs",
  "/apiary",
  "/downloads/civica-atlas-2026-07-11.json.gz",
  "/downloads/civica-atlas-2026-07-11.manifest.json",
  "/_next/static/chunks/main-abc123.js",
  "/_next/image",
  "/_next/data/build-id/country/japan.json",
  "/favicon.ico",
  "/robots.txt",
  "/sitemap.xml",
  "/engravings/countries/japan.webp",
  "/fonts/archivo/archivo-normal-latin.woff2",
];

test("the proxy matcher keeps every API route", () => {
  const missed = MUST_MATCH.filter((pathname) => !matchesProxy(pathname));
  assert.deepEqual(missed, []);
});

test("the proxy matcher never runs for page documents, assets, or downloads", () => {
  const leaked = MUST_NOT_MATCH.filter((pathname) => matchesProxy(pathname));
  assert.deepEqual(leaked, []);
});
