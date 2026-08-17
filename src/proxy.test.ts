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
  "/",
  "/country/japan",
  "/country/japan/civica-data",
  "/country/japan/constitution",
  "/country/japan.rsc",
  "/api/v1/countries/france",
  "/api/v1/index",
  "/api/rights-manifest",
  "/api/cron/pulse-v2",
  "/embed/usa",
  "/methodology/source-coverage",
  "/methodology/provenance-coverage",
  "/civica-index/methodology/pulse",
  "/compare",
  "/atlas",
  "/rankings",
  "/elections",
  "/organizations",
  "/blog/the-record-launch",
  "/admin/pulse-coding",
  "/design-system",
  "/licensing",
  "/api-docs",
  // Release downloads are real routes. Their extensions are deliberately not
  // in the asset list, so they must keep reporting timing.
  "/downloads/civica-atlas-2026-07-11.json.gz",
  "/downloads/civica-atlas-2026-07-11.manifest.json",
];

const MUST_NOT_MATCH = [
  "/_next/static/chunks/main-abc123.js",
  "/_next/static/css/app.css",
  "/_next/static/media/font.woff2",
  "/_next/image",
  "/_next/data/build-id/country/japan.json",
  "/favicon.ico",
  "/robots.txt",
  "/sitemap.xml",
  // Served straight from `public/`, so they never sit under `_next/`.
  "/engravings/countries/japan.webp",
  "/blog/the-record-launch/cover.webp",
  "/og-default.png",
  "/civica-logo.svg",
  "/fonts/archivo/archivo-normal-latin.woff2",
  "/fonts/newsreader/newsreader-italic-latin.woff",
  "/image-trials/sample.avif",
  "/sample.jpg",
  "/sample.jpeg",
  "/sample.gif",
  "/sample.ttf",
  "/sample.otf",
  "/sample.eot",
];

test("the proxy matcher keeps every application and API route", () => {
  const missed = MUST_MATCH.filter((pathname) => !matchesProxy(pathname));
  assert.deepEqual(missed, []);
});

test("the proxy matcher drops the _next tree and static image and font assets", () => {
  const leaked = MUST_NOT_MATCH.filter((pathname) => matchesProxy(pathname));
  assert.deepEqual(leaked, []);
});

test("the matcher exclusion is anchored to a trailing extension", () => {
  // A path segment that merely contains an asset extension is still a route.
  assert.equal(matchesProxy("/country/webp"), true);
  assert.equal(matchesProxy("/blog/svg-rendering-notes"), true);
  assert.equal(matchesProxy("/api/v1/countries/png"), true);
  assert.equal(matchesProxy("/engravings/japan.webp.html"), true);
  assert.equal(matchesProxy("/engravings/japan.webp"), false);
});
