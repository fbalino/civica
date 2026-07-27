import assert from "node:assert/strict";
import { test } from "node:test";

import {
  formatValue,
  parseRef,
  resolvePath,
  substitute,
  type SubstitutionContext,
} from "./substitute";

function ctx(overrides: Partial<SubstitutionContext> = {}): SubstitutionContext {
  return {
    state: { siteName: "Civica Atlas", countries: ["Uruguay", "Japan", "Chile"] },
    stats: { totalCountries: 194 },
    ctx: { joinedRegions: "Americas, Asia, Europe" },
    ...overrides,
  };
}

// ─── resolvePath ─────────────────────────────────────────────────────────

test("resolvePath resolves each of the three allowed root prefixes", () => {
  const c = ctx();
  assert.deepEqual(resolvePath(c, "state.siteName"), {
    found: true,
    value: "Civica Atlas",
  });
  assert.deepEqual(resolvePath(c, "stats.totalCountries"), {
    found: true,
    value: 194,
  });
  assert.deepEqual(resolvePath(c, "ctx.joinedRegions"), {
    found: true,
    value: "Americas, Asia, Europe",
  });
});

test("resolvePath rejects any root other than state/stats/ctx", () => {
  const c = ctx();
  assert.deepEqual(resolvePath(c, "process.env"), {
    found: false,
    value: undefined,
  });
  assert.deepEqual(resolvePath(c, "constructor.name"), {
    found: false,
    value: undefined,
  });
  assert.deepEqual(resolvePath(c, "__proto__.polluted"), {
    found: false,
    value: undefined,
  });
});

test("resolvePath exposes .length on arrays and strings", () => {
  const c = ctx();
  assert.deepEqual(resolvePath(c, "state.countries.length"), {
    found: true,
    value: 3,
  });
  assert.deepEqual(resolvePath(c, "state.siteName.length"), {
    found: true,
    value: "Civica Atlas".length,
  });
});

test("resolvePath returns not-found for a missing intermediate or leaf segment", () => {
  const c = ctx();
  assert.deepEqual(resolvePath(c, "state.doesNotExist"), {
    found: false,
    value: undefined,
  });
  assert.deepEqual(resolvePath(c, "state.siteName.nested.tooDeep"), {
    found: false,
    value: undefined,
  });
});

test("resolvePath short-circuits every stats.* lookup when stats is null (soft-fail)", () => {
  const c = ctx({ stats: null });
  assert.deepEqual(resolvePath(c, "stats.totalCountries"), {
    found: false,
    value: undefined,
  });
  assert.deepEqual(resolvePath(c, "stats.anything.deep"), {
    found: false,
    value: undefined,
  });
  // state/ctx are unaffected by stats being null.
  assert.deepEqual(resolvePath(c, "state.siteName"), {
    found: true,
    value: "Civica Atlas",
  });
});

test("resolvePath treats a null/undefined intermediate value as not-found rather than throwing", () => {
  const c = ctx({ state: { nested: null } });
  assert.deepEqual(resolvePath(c, "state.nested.field"), {
    found: false,
    value: undefined,
  });
});

test("resolvePath treats a primitive intermediate (non-object, non-length) as not-found", () => {
  const c = ctx({ state: { count: 42 } });
  assert.deepEqual(resolvePath(c, "state.count.somethingElse"), {
    found: false,
    value: undefined,
  });
});

// ─── parseRef ────────────────────────────────────────────────────────────

test("parseRef parses the plain dot-path form", () => {
  assert.deepEqual(parseRef("state.siteName"), {
    path: "state.siteName",
    fallback: null,
  });
  assert.deepEqual(parseRef("  state.siteName  "), {
    path: "state.siteName",
    fallback: null,
  });
});

test("parseRef parses the pipe-fallback form with double or single quotes", () => {
  assert.deepEqual(parseRef('stats.total | "N/A"'), {
    path: "stats.total",
    fallback: "N/A",
  });
  assert.deepEqual(parseRef("stats.total | 'N/A'"), {
    path: "stats.total",
    fallback: "N/A",
  });
});

test("parseRef tolerates extra whitespace around the pipe", () => {
  assert.deepEqual(parseRef('stats.total    |    "N/A"'), {
    path: "stats.total",
    fallback: "N/A",
  });
});

test("parseRef unescapes nothing but preserves escaped-quote content literally", () => {
  const parsed = parseRef('stats.total | "say \\"hi\\""');
  assert.ok(parsed);
  assert.equal(parsed!.path, "stats.total");
  assert.equal(parsed!.fallback, 'say \\"hi\\"');
});

test("parseRef allows an empty-string fallback", () => {
  assert.deepEqual(parseRef('stats.total | ""'), {
    path: "stats.total",
    fallback: "",
  });
});

test("parseRef returns null for malformed marker bodies", () => {
  assert.equal(parseRef(""), null);
  assert.equal(parseRef("   "), null);
  assert.equal(parseRef("1.leading.digit"), null); // path can't start with a digit
  assert.equal(parseRef("state.x |"), null); // pipe with no fallback
  assert.equal(parseRef("state.x | unquoted"), null); // fallback must be quoted
  assert.equal(parseRef("state.x | 'mismatched\""), null);
});

// ─── formatValue ─────────────────────────────────────────────────────────

test("formatValue renders primitives as-is", () => {
  assert.equal(formatValue("hello"), "hello");
  assert.equal(formatValue(42), "42");
  assert.equal(formatValue(0), "0");
  assert.equal(formatValue(true), "true");
  assert.equal(formatValue(false), "false");
});

test("formatValue renders null/undefined as an empty string", () => {
  assert.equal(formatValue(null), "");
  assert.equal(formatValue(undefined), "");
});

test("formatValue joins arrays with ', ' and recurses on elements", () => {
  assert.equal(formatValue(["a", "b", "c"]), "a, b, c");
  assert.equal(formatValue([1, 2, 3]), "1, 2, 3");
  assert.equal(formatValue([]), "");
});

test("formatValue falls back to JSON for plain objects (an authoring mistake)", () => {
  assert.equal(formatValue({ a: 1 }), JSON.stringify({ a: 1 }));
});

// ─── substitute (integration over the whole marker grammar) ────────────

test("substitute replaces plain and pipe-fallback markers in the same template", () => {
  const result = substitute(
    "Site: {{state.siteName}}. Countries tracked: {{stats.totalCountries | \"unknown\"}}.",
    ctx(),
  );
  assert.equal(
    result.output,
    "Site: Civica Atlas. Countries tracked: 194.",
  );
  assert.deepEqual(result.unresolvedPaths, []);
  assert.deepEqual(result.fallbacksUsed, []);
});

test("substitute uses the fallback and records it when stats is null", () => {
  const result = substitute(
    "Countries tracked: {{stats.totalCountries | \"unknown\"}}.",
    ctx({ stats: null }),
  );
  assert.equal(result.output, "Countries tracked: unknown.");
  assert.equal(result.fallbacksUsed.length, 1);
  assert.equal(result.fallbacksUsed[0].path, "stats.totalCountries");
  assert.equal(result.fallbacksUsed[0].fallback, "unknown");
  assert.deepEqual(result.unresolvedPaths, []);
});

test("substitute leaves an unresolvable, fallback-less marker in place and records it", () => {
  const result = substitute("Value: {{state.doesNotExist}}.", ctx());
  assert.equal(result.output, "Value: {{state.doesNotExist}}.");
  assert.equal(result.unresolvedPaths.length, 1);
  assert.equal(result.unresolvedPaths[0].path, "state.doesNotExist");
  assert.deepEqual(result.fallbacksUsed, []);
});

test("substitute records the correct 1-based line number for a marker", () => {
  const result = substitute("line one\nline two {{state.missing}}\nline three", ctx());
  assert.equal(result.unresolvedPaths.length, 1);
  assert.equal(result.unresolvedPaths[0].line, 2);
});

test("substitute leaves a malformed marker body untouched and reports it", () => {
  const result = substitute("Bad: {{1.not.a.path}}.", ctx());
  assert.equal(result.output, "Bad: {{1.not.a.path}}.");
  assert.equal(result.unresolvedPaths.length, 1);
  assert.equal(result.unresolvedPaths[0].path, "1.not.a.path");
});

test("substitute never throws on adversarial input", () => {
  assert.doesNotThrow(() => substitute("{{}} {{ }} {{state.}} {{{{nested}}}}", ctx()));
});

test("substitute renders array values joined and objects as JSON in-place", () => {
  const result = substitute("Countries: {{state.countries}}.", ctx());
  assert.equal(result.output, "Countries: Uruguay, Japan, Chile.");
});
