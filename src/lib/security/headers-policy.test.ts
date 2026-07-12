import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

/**
 * PLT-013 — the production header policy is enforced from `next.config.ts`.
 * This guards that the documented headers stay present and that framing stays
 * locked except for the embed widget.
 */
const config = readFileSync("next.config.ts", "utf8");

test("base security headers are present", () => {
  for (const header of [
    "X-Content-Type-Options",
    "Referrer-Policy",
    "Permissions-Policy",
    "Strict-Transport-Security",
    "Content-Security-Policy-Report-Only",
  ]) {
    assert.ok(config.includes(header), `missing ${header}`);
  }
});

test("HSTS is a strong, preload-eligible value", () => {
  assert.match(config, /max-age=63072000; includeSubDomains; preload/);
});

test("the report-only CSP locks defaults and allowlists only map origins", () => {
  for (const directive of [
    "default-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'self'",
    "https://tiles.openfreemap.org",
    "https://*.blob.vercel-storage.com",
  ]) {
    assert.ok(config.includes(directive), `CSP missing: ${directive}`);
  }
  // No wildcard resource origins.
  assert.ok(!/img-src[^;]*\*[^.]/.test(config), "img-src has a bare wildcard");
});

test("framing is locked everywhere except the embed widget", () => {
  assert.match(config, /X-Frame-Options.*SAMEORIGIN/s);
  // The frame-protection block is applied via a negative-lookahead source that
  // excludes embed/ so /embed/[slug] stays cross-origin framable.
  assert.match(config, /\(\?!embed\/\)/);
});
