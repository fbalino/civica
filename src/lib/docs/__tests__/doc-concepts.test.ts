/**
 * Documentation-source registry — negative-fixture test suite
 * (CLM-009 §8). Pure and in-memory: no repo fixtures are mutated, no
 * DB/network access. Every fixture below is constructed inline.
 *
 * Runs under `npm test` (glob: src/**\/*.test.ts).
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  checkRegistryInvariants,
  checkSurfaceCoverage,
  checkPublicClaimIds,
  deferredConcepts,
  DOC_CONCEPTS,
  DOC_SURFACE_KINDS,
  SCANNABLE_KINDS,
  type DocConcept,
} from "../doc-concepts";
import { extractGenBlock, replaceGenBlock, stripAllGenBlocks } from "../gen-markers";
import { scanForFingerprints, type ScanTarget } from "../formula-scan";
import {
  extractHeadingAnchorIds,
  extractInternalLinks,
  extractStaticTsxLinks,
  extractTsxSectionAnchorIds,
  checkSameDocumentAnchorLink,
  checkCrossDocumentLink,
} from "../links";
import {
  routeMatchesDestinationSegments,
  destinationResolves,
  pathSegments,
  type AppRoute,
} from "../routes";
import { getPcaAnalysisSummary } from "../../ci/pca-analysis";
import { civicaIndex } from "../../content/site-state";

// ─────────────────────────────────────────────────────────────────────
// The real registry passes its own invariant checks.
// ─────────────────────────────────────────────────────────────────────

test("real DOC_CONCEPTS registry has no invariant violations", () => {
  const issues = checkRegistryInvariants(DOC_CONCEPTS);
  assert.deepEqual(issues, []);
});

test("real DOC_CONCEPTS registry has unique concept ids and canonical locations", () => {
  const ids = DOC_CONCEPTS.map((c) => c.id);
  assert.equal(new Set(ids).size, ids.length, "concept ids must be unique");

  const canonicalKeys = DOC_CONCEPTS.map(
    (c) => `${c.canonical.kind}::${c.canonical.path}::${c.canonical.symbol ?? ""}`,
  );
  assert.equal(
    new Set(canonicalKeys).size,
    canonicalKeys.length,
    "canonical path+symbol pairs must be unique",
  );
});

// ─────────────────────────────────────────────────────────────────────
// Negative fixture: duplicate concept id
// ─────────────────────────────────────────────────────────────────────

function baseConcept(overrides: Partial<DocConcept> = {}): DocConcept {
  return {
    id: "fixture-concept",
    title: "Fixture concept",
    canonical: { kind: "source", path: "src/fixture/canonical.ts", symbol: "X" },
    relations: [],
    ...overrides,
  };
}

test("negative fixture: duplicate concept id is caught", () => {
  const concepts = [
    baseConcept({ id: "dup", canonical: { kind: "source", path: "a.ts" } }),
    baseConcept({ id: "dup", canonical: { kind: "source", path: "b.ts" } }),
  ];
  const issues = checkRegistryInvariants(concepts);
  assert.ok(
    issues.some((i) => i.message.includes('Duplicate concept id "dup"')),
    "expected a duplicate-id issue",
  );
});

// ─────────────────────────────────────────────────────────────────────
// Negative fixture: duplicate canonical (two concepts, same
// path+symbol) — never a mirror canonical.
// ─────────────────────────────────────────────────────────────────────

test("negative fixture: duplicate canonical path+symbol is caught", () => {
  const concepts = [
    baseConcept({
      id: "one",
      canonical: { kind: "source", path: "shared.ts", symbol: "X" },
    }),
    baseConcept({
      id: "two",
      canonical: { kind: "source", path: "shared.ts", symbol: "X" },
    }),
  ];
  const issues = checkRegistryInvariants(concepts);
  assert.ok(
    issues.some((i) => i.message.includes("Duplicate canonical path+symbol")),
    "expected a duplicate-canonical issue",
  );
});

// ─────────────────────────────────────────────────────────────────────
// Negative fixture: missing path
// ─────────────────────────────────────────────────────────────────────

test("negative fixture: missing canonical.path is caught", () => {
  const concepts = [
    baseConcept({ id: "no-path", canonical: { kind: "source", path: "" } }),
  ];
  const issues = checkRegistryInvariants(concepts);
  assert.ok(
    issues.some((i) => i.message.includes("canonical.path is required")),
    "expected a missing-path issue",
  );
});

test("negative fixture: missing relation.path is caught", () => {
  const concepts = [
    baseConcept({
      id: "bad-relation",
      relations: [{ kind: "reader-markdown", path: "", relationship: "link-only" }],
    }),
  ];
  const issues = checkRegistryInvariants(concepts);
  assert.ok(
    issues.some((i) => i.message.includes("relation.path is required")),
  );
});

test("negative fixture: a relation duplicating the canonical location is caught", () => {
  const concepts = [
    baseConcept({
      id: "self-relation",
      canonical: { kind: "source", path: "same.ts", symbol: "X" },
      relations: [{ kind: "source", path: "same.ts", symbol: "X", relationship: "interpolated" }],
    }),
  ];
  const issues = checkRegistryInvariants(concepts);
  assert.ok(
    issues.some((i) => i.message.includes("must not duplicate the canonical location")),
  );
});

// ─────────────────────────────────────────────────────────────────────
// GEN marker extraction + drift detection
// ─────────────────────────────────────────────────────────────────────

test("extractGenBlock finds a marker block by name and ignores an arbitrary START suffix", () => {
  const content = [
    "prose before",
    "",
    '[//]: # "GEN:START widget-table (source: scripts/generate-widget.ts)"',
    "",
    "| a | b |",
    "|---|---|",
    "",
    '[//]: # "GEN:END widget-table"',
    "",
    "prose after",
  ].join("\n");
  const block = extractGenBlock(content, "widget-table");
  assert.ok(block);
  assert.equal(block?.body, "| a | b |\n|---|---|");
});

test("negative fixture: generated drift — regenerated body differs from checked-in block", () => {
  const checkedIn = [
    '[//]: # "GEN:START widget-table (source: scripts/generate-widget.ts)"',
    "",
    "| stale | value |",
    "",
    '[//]: # "GEN:END widget-table"',
  ].join("\n");
  const freshlyGenerated = "| fresh | value |";

  const block = extractGenBlock(checkedIn, "widget-table");
  assert.ok(block);
  assert.notEqual(block?.body, freshlyGenerated, "drift should be detected");

  // Positive control: regenerating with the SAME body produces
  // byte-identical output (this is what a passing --check looks like).
  const regenerated = replaceGenBlock(checkedIn, "widget-table", block!.body);
  assert.equal(regenerated, checkedIn);
});

test("stripAllGenBlocks preserves line count so reported line numbers stay accurate", () => {
  const content = [
    "line1",
    '[//]: # "GEN:START t (source: x)"',
    "line3-generated",
    "line4-generated",
    '[//]: # "GEN:END t"',
    "line6",
  ].join("\n");
  const stripped = stripAllGenBlocks(content);
  assert.equal(stripped.split("\n").length, content.split("\n").length);
  assert.ok(!stripped.includes("line3-generated"));
  assert.ok(stripped.includes("line6"));
});

// ─────────────────────────────────────────────────────────────────────
// Formula-fingerprint scanning: memory passes (scan-exempt), reader-
// markdown fails (scanned) — for the SAME duplicated text.
// ─────────────────────────────────────────────────────────────────────

test("proof: a formula fingerprint outside its generated block passes for memory but fails for reader-markdown", () => {
  const fingerprint = { conceptId: "fixture-formula", text: "((score + 2.5) / 5.0) × 100" };

  const targets: ScanTarget[] = [
    {
      path: ".claude/rules/memory-decisions.md",
      kind: "memory",
      content: `Some note that happens to mention ${fingerprint.text} in passing.`,
    },
    {
      path: "content/fixture.md",
      kind: "reader-markdown",
      content: `Retyped by hand: ${fingerprint.text}`,
    },
  ];

  const violations = scanForFingerprints(targets, [fingerprint]);

  assert.ok(
    !violations.some((v) => v.path === ".claude/rules/memory-decisions.md"),
    "memory is scan-exempt and must never be flagged",
  );
  assert.ok(
    violations.some((v) => v.path === "content/fixture.md"),
    "reader-markdown is scanned and the duplicated formula must be flagged",
  );
});

test("negative fixture: formula copy outside generated block is caught even in the same file", () => {
  const fingerprint = { conceptId: "fixture-formula", text: "((14 − score) / 12) × 100" };
  const content = [
    '[//]: # "GEN:START normalization-table (source: x)"',
    "",
    `generated row uses ${fingerprint.text} correctly`,
    "",
    '[//]: # "GEN:END normalization-table"',
    "",
    `Some prose elsewhere retypes ${fingerprint.text} again — a duplication bug.`,
  ].join("\n");

  const violations = scanForFingerprints(
    [{ path: "content/fixture.md", kind: "reader-markdown", content }],
    [fingerprint],
  );

  // Exactly one violation: the occurrence inside the GEN block is
  // exempt (that's what generated blocks are for); the prose copy
  // outside it is the bug.
  assert.equal(violations.length, 1);
  assert.ok(violations[0].line > 3);
});

test("positive control: a fingerprint that only appears inside its declared generated block produces no violations", () => {
  const fingerprint = { conceptId: "fixture-formula", text: "score × 100" };
  const content = [
    '[//]: # "GEN:START normalization-table (source: x)"',
    "",
    `| Democratic quality | ... | ${fingerprint.text} |`,
    "",
    '[//]: # "GEN:END normalization-table"',
  ].join("\n");

  const violations = scanForFingerprints(
    [{ path: "content/fixture.md", kind: "reader-markdown", content }],
    [fingerprint],
  );
  assert.deepEqual(violations, []);
});

test("SCANNABLE_KINDS excludes memory and runbook", () => {
  assert.ok(!SCANNABLE_KINDS.includes("memory"));
  assert.ok(!SCANNABLE_KINDS.includes("runbook"));
  assert.ok(SCANNABLE_KINDS.includes("reader-markdown"));
  assert.ok(SCANNABLE_KINDS.includes("reader-tsx"));
  assert.ok(SCANNABLE_KINDS.includes("readme"));
  assert.ok(SCANNABLE_KINDS.includes("api-example"));
});

// ─────────────────────────────────────────────────────────────────────
// Bad anchor
// ─────────────────────────────────────────────────────────────────────

test("negative fixture: bad anchor — link references a heading id that doesn't exist", () => {
  const content = [
    "## Real heading {#real-heading}",
    "",
    "See [the other section](#does-not-exist) for more.",
  ].join("\n");

  const anchorIds = extractHeadingAnchorIds(content);
  assert.deepEqual([...anchorIds], ["real-heading"]);

  const links = extractInternalLinks(content);
  assert.equal(links.length, 1);

  const check = checkSameDocumentAnchorLink(links[0], anchorIds);
  assert.equal(check.ok, false);
  assert.match(check.reason ?? "", /does-not-exist/);
});

test("positive control: a link to an anchor that exists passes", () => {
  const content = [
    "## Real heading {#real-heading}",
    "",
    "See [the section above](#real-heading) for more.",
  ].join("\n");
  const anchorIds = extractHeadingAnchorIds(content);
  const links = extractInternalLinks(content);
  const check = checkSameDocumentAnchorLink(links[0], anchorIds);
  assert.equal(check.ok, true);
});

// ─────────────────────────────────────────────────────────────────────
// Bad route + dynamic/redirect positive controls
// ─────────────────────────────────────────────────────────────────────

const FIXTURE_ROUTES: AppRoute[] = [
  { segments: ["country", "[slug]"], file: "src/app/(reader)/country/[slug]/page.tsx", type: "page" },
  { segments: ["country", "[slug]", "civica-data"], file: "src/app/(reader)/country/[slug]/civica-data/page.tsx", type: "page" },
  { segments: ["organizations", "[slug]"], file: "src/app/(reader)/organizations/[slug]/page.tsx", type: "page" },
  { segments: ["compare"], file: "src/app/compare/page.tsx", type: "page" },
  { segments: ["blog", "[slug]"], file: "src/app/blog/[slug]/page.tsx", type: "page" },
];

test("negative fixture: bad route — a destination with no matching app route is stale", () => {
  const result = destinationResolves("/this/path/does-not-exist", FIXTURE_ROUTES);
  assert.equal(result, false);
});

test("positive control: static destination matching a static route resolves", () => {
  assert.equal(destinationResolves("/compare", FIXTURE_ROUTES), true);
});

test("positive control: dynamic destination (:slug) matching a [slug] route resolves", () => {
  assert.equal(destinationResolves("/organizations/:slug", FIXTURE_ROUTES), true);
});

test("positive control: static value passed into a [slug] dynamic route resolves", () => {
  // e.g. a redirect like /atlas/organizations/un -> /organizations/un
  assert.equal(destinationResolves("/organizations/un", FIXTURE_ROUTES), true);
});

test("positive control: a nested static+dynamic destination with a fragment resolves, ignoring the fragment", () => {
  assert.equal(
    destinationResolves("/country/:slug/civica-data#leaders", FIXTURE_ROUTES),
    true,
  );
});

test("dynamic/redirect control: a :param destination that has no corresponding dynamic route segment is skipped, not failed", () => {
  // /country/[slug] has no third dynamic segment — only literal
  // children (civica-data). A :tab passthrough can't be resolved
  // without knowing the captured value, so it must be "skipped", not
  // treated as a stale-route failure.
  const result = destinationResolves("/country/:slug/:tab", FIXTURE_ROUTES);
  assert.equal(result, "skipped");
});

test("routeMatchesDestinationSegments: static route segment rejects a :param destination segment", () => {
  assert.equal(
    routeMatchesDestinationSegments(["compare"], pathSegments("/:slug")),
    false,
  );
});

test("routeMatchesDestinationSegments: segment-count mismatch fails", () => {
  assert.equal(
    routeMatchesDestinationSegments(["country", "[slug]"], pathSegments("/country")),
    false,
  );
});

// ─────────────────────────────────────────────────────────────────────
// pathSegments strips query strings and hash fragments
// ─────────────────────────────────────────────────────────────────────

test("pathSegments strips query strings and hash fragments", () => {
  assert.deepEqual(pathSegments("/compare?c=:a&c=:b"), ["compare"]);
  assert.deepEqual(pathSegments("/country/:slug/civica-data#leaders"), [
    "country",
    ":slug",
    "civica-data",
  ]);
  assert.deepEqual(pathSegments("/"), []);
});

// ─────────────────────────────────────────────────────────────────────
// Bounded-repair B1 — mandatory surface coverage + deferred registry rows
// ─────────────────────────────────────────────────────────────────────

test("real DOC_CONCEPTS registry covers all 6 mandated surface kinds", () => {
  assert.deepEqual(checkSurfaceCoverage(DOC_CONCEPTS), []);
});

test("negative fixture: missing a mandated surface kind is caught", () => {
  const concepts = [
    baseConcept({
      id: "no-readme",
      relations: [
        { kind: "reader-markdown", path: "content/x.md", relationship: "link-only" },
        { kind: "reader-tsx", path: "src/app/x/page.tsx", relationship: "link-only" },
        { kind: "api-example", path: "src/app/api-docs/page.tsx", relationship: "link-only" },
        { kind: "runbook", path: "AGENTS.md", relationship: "link-only" },
        { kind: "memory", path: ".claude/rules/memory-decisions.md", relationship: "link-only" },
        // "readme" is deliberately absent.
      ],
    }),
  ];
  const issues = checkSurfaceCoverage(concepts);
  assert.equal(issues.length, 1);
  assert.match(issues[0].message, /"readme"/);
});

test("positive control: DOC_SURFACE_KINDS has exactly the six mandated kinds", () => {
  assert.deepEqual(
    [...DOC_SURFACE_KINDS].sort(),
    ["api-example", "memory", "reader-markdown", "reader-tsx", "readme", "runbook"].sort(),
  );
});

test("real DOC_CONCEPTS has zero deferred concepts left after CLM-012 resolved the last one", () => {
  // CLM-011 repaired `reconciliation.material-error` and
  // `docs.schema-table-count` (both formerly deferredTo: "CLM-011") and
  // bound them to automated contract-test/validator assertions, so they
  // no longer carry a `deferredTo`. `api.v1-examples` (deferredTo:
  // "CLM-012") was the last remaining deferred concept; CLM-012 promoted
  // it to CLM_012_RESOLVED_CONCEPTS, bound to
  // src/lib/api/contract/examples.ts as its canonical source.
  const deferred = deferredConcepts(DOC_CONCEPTS);
  assert.deepEqual(deferred, []);
});

test("negative fixture: a deferred concept declaring a 'generated' relation is caught (deferred rows are excluded from CLM-009 enforcement)", () => {
  const concepts = [
    baseConcept({
      id: "wrongly-enforced-deferred",
      deferredTo: "CLM-011",
      relations: [
        { kind: "reader-markdown", path: "content/x.md", relationship: "generated" },
      ],
    }),
  ];
  const issues = checkRegistryInvariants(concepts);
  assert.ok(
    issues.some((i) => i.message.includes("must not declare a 'generated' relation")),
  );
});

test("positive control: a deferred concept with only link-only relations is structurally valid", () => {
  const concepts = [
    baseConcept({
      id: "correctly-deferred",
      deferredTo: "CLM-012",
      relations: [
        { kind: "reader-markdown", path: "content/x.md", relationship: "link-only" },
      ],
    }),
  ];
  assert.deepEqual(checkRegistryInvariants(concepts), []);
});

test("negative fixture: an unknown publicClaimIds entry is caught, without importing claim content", () => {
  const concepts = [
    baseConcept({ id: "bad-claim-link", publicClaimIds: ["home.reference-scope", "totally-made-up-id"] }),
  ];
  const knownIds = new Set(["home.reference-scope", "home.visible-positioning"]);
  const issues = checkPublicClaimIds(concepts, knownIds);
  assert.equal(issues.length, 1);
  assert.match(issues[0].message, /totally-made-up-id/);
});

test("positive control: real DOC_CONCEPTS publicClaimIds all resolve against a fixture claim-id set matching the known real ids", () => {
  const knownIds = new Set(["home.reference-scope", "home.visible-positioning"]);
  assert.deepEqual(checkPublicClaimIds(DOC_CONCEPTS, knownIds), []);
});

test("bounded-repair F4: no relation in the real registry is mislabeled 'runbook' when it is actually code (source)", () => {
  // A runbook surface must be an actual operational instruction/
  // document (e.g. AGENTS.md), never test/validator CODE.
  const runbookRelations = DOC_CONCEPTS.flatMap((c) => c.relations).filter(
    (r) => r.kind === "runbook",
  );
  assert.ok(runbookRelations.length > 0, "expected at least one genuine runbook relation");
  for (const relation of runbookRelations) {
    assert.ok(
      !relation.path.endsWith(".ts") && !relation.path.endsWith(".tsx"),
      `runbook relation "${relation.path}" looks like code, not a document`,
    );
  }
});

// ─────────────────────────────────────────────────────────────────────
// Bounded-repair F1 — PCA site-state duplicate eliminated via a pure
// wrapper over the generated snapshot; drift cannot recur.
// ─────────────────────────────────────────────────────────────────────

test("site-state.civicaIndex.pca derives from getPcaAnalysisSummary(), never a second hardcoded literal", () => {
  const summary = getPcaAnalysisSummary();
  assert.equal(civicaIndex.pca.panelSize, summary.panelSize);
  assert.equal(civicaIndex.pca.pc1VarianceExplained, summary.pc1VarianceExplained);
  assert.deepEqual(civicaIndex.pca.pc1LoadingRange, summary.pc1LoadingRange);
  assert.deepEqual(civicaIndex.pca.correlationRange, summary.correlationRange);
});

test("getPcaAnalysisSummary reproduces the previously-hardcoded published values exactly", () => {
  // Pins the historical published numbers so a change in the generated
  // snapshot's rounding/derivation is visible here, not just silently
  // absorbed by site-state re-deriving from it.
  const summary = getPcaAnalysisSummary();
  assert.equal(summary.panelSize, 46);
  assert.equal(summary.pc1VarianceExplained, 0.907);
  assert.deepEqual(summary.pc1LoadingRange, [0.479, 0.516]);
  assert.deepEqual(summary.correlationRange, [0.74, 0.98]);
});

// ─────────────────────────────────────────────────────────────────────
// Bounded-repair F2 — cross-document reader links
// ─────────────────────────────────────────────────────────────────────

const CROSS_LINK_FIXTURE_ROUTES: AppRoute[] = FIXTURE_ROUTES;

test("extractStaticTsxLinks finds static hrefs and SKIPS dynamic JSX expressions entirely", () => {
  const content = [
    '<Link href="/compare">Compare</Link>',
    "<Link href={dynamicHref}>Dynamic</Link>",
    '<Link href={`/country/${slug}`}>Template</Link>',
    '<a href="/organizations/un">UN</a>',
  ].join("\n");
  const links = extractStaticTsxLinks(content);
  assert.deepEqual(
    links.map((l) => l.href),
    ["/compare", "/organizations/un"],
  );
});

test("extractTsxSectionAnchorIds finds static id attributes and skips dynamic ones", () => {
  const content = [
    '<Reveal as="section" id="summary">',
    "<Reveal as=\"section\" id={dynamicId}>",
    '<div id="eigenvalues">',
  ].join("\n");
  const ids = extractTsxSectionAnchorIds(content);
  assert.deepEqual([...ids].sort(), ["eigenvalues", "summary"]);
});

test("negative fixture: stale cross-document route — a link to a route that doesn't exist fails", () => {
  const resolver = (p: string) => destinationResolves(p, CROSS_LINK_FIXTURE_ROUTES);
  const check = checkCrossDocumentLink(
    { href: "/this/path/does-not-exist", line: 1 },
    resolver,
    new Set(),
  );
  assert.equal(check.ok, false);
  assert.match(check.reason ?? "", /does not resolve/);
});

test("positive control: a valid cross-document route + anchor link passes", () => {
  const resolver = (p: string) => destinationResolves(p, CROSS_LINK_FIXTURE_ROUTES);
  const knownAnchorIds = new Set(["leaders"]);
  const check = checkCrossDocumentLink(
    { href: "/country/us/civica-data#leaders", line: 1 },
    resolver,
    knownAnchorIds,
  );
  assert.equal(check.ok, true);
});

test("negative fixture: a valid route but an unknown pooled anchor fails", () => {
  const resolver = (p: string) => destinationResolves(p, CROSS_LINK_FIXTURE_ROUTES);
  const check = checkCrossDocumentLink(
    { href: "/compare#no-such-anchor", line: 1 },
    resolver,
    new Set(["some-other-anchor"]),
  );
  assert.equal(check.ok, false);
  assert.match(check.reason ?? "", /no-such-anchor/);
});

test("dynamic JSX expressions are never treated as valid static links: a skipped href={...} produces no extracted link at all", () => {
  const content = '<Link href={`/country/${slug}`}>Country</Link>';
  const links = extractStaticTsxLinks(content);
  assert.deepEqual(links, [], "a dynamic href must not be extracted as a checkable link");
  // Since nothing was extracted, nothing is ever asserted "ok: true" —
  // a skip is a skip, not a pass.
});

// ─────────────────────────────────────────────────────────────────────
// Bounded-repair F3 — redirect skip blind spot closed
// ─────────────────────────────────────────────────────────────────────

test("negative fixture: stale wildcard — a :param*/:.param destination whose static prefix matches NO route fails, not skips", () => {
  const wildcard = destinationResolves("/totally-fake-route/:path*", FIXTURE_ROUTES);
  assert.equal(wildcard, false);
  const dynamic = destinationResolves("/totally-fake-route/:slug", FIXTURE_ROUTES);
  assert.equal(dynamic, false);
});

test("positive control: a :param*/:param destination whose static prefix DOES match a route family is still skipped, not failed", () => {
  assert.equal(destinationResolves("/compare/:path*", FIXTURE_ROUTES), "skipped");
  assert.equal(destinationResolves("/country/:slug/:tab", FIXTURE_ROUTES), "skipped");
});

test("all 33 real Civica redirects remain truthfully classified after the F3 tightening (0 stale)", async () => {
  const { scanAppRoutes } = await import("../routes");
  const { REDIRECTS } = await import("../../routing/redirects");
  const routes = await scanAppRoutes();
  let ok = 0;
  let skipped = 0;
  let bad = 0;
  for (const r of REDIRECTS) {
    const result = destinationResolves(r.destination, routes);
    if (result === true) ok++;
    else if (result === "skipped") skipped++;
    else bad++;
  }
  assert.equal(bad, 0, "no real redirect should be stale");
  assert.equal(ok, 28);
  assert.equal(skipped, 5);
});
