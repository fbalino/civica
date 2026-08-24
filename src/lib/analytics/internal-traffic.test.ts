/**
 * Internal-traffic exclusion can only ever SUPPRESS analytics. These fixtures
 * lock that direction, the parameter grammar, and the precedence between an
 * explicit mark and the host default.
 *
 * Pure: no DB, no network, no browser. Runs under `npm test`.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  internalTrafficParamDecision,
  isNonProductionHost,
  resolveInternalTraffic,
  stripInternalTrafficParam,
} from "./internal-traffic";

test("?internal marks the browser, with or without a value", () => {
  for (const search of [
    "?internal",
    "?internal=",
    "?internal=1",
    "?internal=on",
    "?internal=true",
    "?internal=YES",
    "?foo=1&internal",
  ]) {
    assert.equal(internalTrafficParamDecision(search), "on", search);
  }
});

test("?internal=off clears the mark", () => {
  for (const search of ["?internal=off", "?internal=0", "?internal=false", "?internal=NO"]) {
    assert.equal(internalTrafficParamDecision(search), "off", search);
  }
});

test("an absent or unrecognized value changes nothing", () => {
  // A typo must never be guessed at in either direction.
  for (const search of ["", "?", "?other=1", "?internal=maybe", "?internal=onn"]) {
    assert.equal(internalTrafficParamDecision(search), null, search);
  }
});

test("stripping the parameter preserves every other one", () => {
  assert.equal(stripInternalTrafficParam("?internal"), "");
  assert.equal(stripInternalTrafficParam("?internal=off"), "");
  assert.equal(stripInternalTrafficParam("?house=upper&internal"), "?house=upper");
  assert.equal(stripInternalTrafficParam("?a=1&internal=on&b=2"), "?a=1&b=2");
  assert.equal(stripInternalTrafficParam("?a=1"), "?a=1");
});

test("development and deployment hosts are not real readers", () => {
  for (const host of [
    "localhost",
    "app.localhost",
    "127.0.0.1",
    "[::1]",
    "civica.local",
    "civica-226sheslq-fbalinos-projects.vercel.app",
  ]) {
    assert.equal(isNonProductionHost(host), true, host);
  }
});

test("the production domain is a real reader origin", () => {
  for (const host of ["civicaatlas.org", "www.civicaatlas.org", "CIVICAATLAS.ORG"]) {
    assert.equal(isNonProductionHost(host), false, host);
  }
});

test("an explicit mark outranks the host default in both directions", () => {
  // Marked internal on production.
  assert.equal(resolveInternalTraffic("on", "civicaatlas.org"), true);
  // Explicitly un-excluded on localhost, so the full consent flow can be
  // exercised in development.
  assert.equal(resolveInternalTraffic("off", "localhost"), false);
});

test("with no stored mark, only non-production origins are excluded", () => {
  assert.equal(resolveInternalTraffic(null, "civicaatlas.org"), false);
  assert.equal(resolveInternalTraffic(null, "localhost"), true);
  // A junk stored value falls back to the host rule rather than excluding
  // production traffic on the strength of unreadable storage.
  assert.equal(resolveInternalTraffic("garbage", "civicaatlas.org"), false);
  assert.equal(resolveInternalTraffic("garbage", "localhost"), true);
});
