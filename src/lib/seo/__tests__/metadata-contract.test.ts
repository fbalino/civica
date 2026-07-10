/**
 * Fixture coverage for `../metadata-contract` (CLM-013 slice A). Pure,
 * DB-free — every fixture is an inline HTML/JSON-LD string; no network.
 * `npm run crawl:metadata` exercises the exact same functions against a
 * real running site.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  extractCanonicals,
  extractMetaByProperty,
  extractJsonLdBlocks,
  extractJsonLdNodes,
  extractSitemapLocs,
  extractTitleText,
  extractStructuredMetadataText,
  hasForbiddenHost,
  isAbsoluteApexUrl,
  validatePageMetadata,
  findDatasetNode,
  validateDatasetNode,
  classifyRouteStatus,
  routeStatusSatisfied,
  findArgumentlessNewDateCalls,
  hasArgumentlessNewDate,
  findForbiddenHostPatternsInSource,
} from "../metadata-contract";

const SITE_URL = "https://civicaatlas.org";
const LOC = `${SITE_URL}/civica-index`;

function pageHtml(opts: {
  canonicals?: string[];
  ogUrls?: string[];
  ogImage?: string | null;
  twitterCard?: string | null;
  twitterImage?: string | null;
  robots?: string | null;
  jsonLd?: string[];
}): string {
  const {
    canonicals = [LOC],
    ogUrls = [LOC],
    ogImage = `${SITE_URL}/og-default.png`,
    twitterCard = "summary_large_image",
    twitterImage = `${SITE_URL}/og-default.png`,
    robots = null,
    jsonLd = [],
  } = opts;

  const parts: string[] = ["<html><head>"];
  for (const href of canonicals) parts.push(`<link rel="canonical" href="${href}">`);
  for (const url of ogUrls) parts.push(`<meta property="og:url" content="${url}">`);
  if (ogImage) parts.push(`<meta property="og:image" content="${ogImage}">`);
  if (twitterCard) parts.push(`<meta name="twitter:card" content="${twitterCard}">`);
  if (twitterImage) parts.push(`<meta name="twitter:image" content="${twitterImage}">`);
  if (robots) parts.push(`<meta name="robots" content="${robots}">`);
  for (const block of jsonLd) {
    parts.push(`<script type="application/ld+json">${block}</script>`);
  }
  parts.push("</head><body>research-beta content</body></html>");
  return parts.join("\n");
}

/** Minimal HTML builder for route-status tests — puts each candidate
 *  disclosure surface (title, meta description, og:*, twitter:*) under
 *  independent control, plus an arbitrary `body` string, so tests can prove
 *  `routeStatusSatisfied` reads ONLY structured metadata. */
function metaTagsHtml(opts: {
  title?: string;
  description?: string;
  ogTitle?: string;
  ogDescription?: string;
  twitterTitle?: string;
  twitterDescription?: string;
  body?: string;
}): string {
  const parts: string[] = ["<html><head>"];
  if (opts.title !== undefined) parts.push(`<title>${opts.title}</title>`);
  if (opts.description !== undefined) {
    parts.push(`<meta name="description" content="${opts.description}">`);
  }
  if (opts.ogTitle !== undefined) parts.push(`<meta property="og:title" content="${opts.ogTitle}">`);
  if (opts.ogDescription !== undefined) {
    parts.push(`<meta property="og:description" content="${opts.ogDescription}">`);
  }
  if (opts.twitterTitle !== undefined) {
    parts.push(`<meta name="twitter:title" content="${opts.twitterTitle}">`);
  }
  if (opts.twitterDescription !== undefined) {
    parts.push(`<meta name="twitter:description" content="${opts.twitterDescription}">`);
  }
  parts.push("</head><body>");
  if (opts.body !== undefined) parts.push(opts.body);
  parts.push("</body></html>");
  return parts.join("\n");
}

// ── Generic tag/meta extraction ─────────────────────────────────────────

test("extractCanonicals reads a single link[rel=canonical]", () => {
  const html = pageHtml({});
  assert.deepEqual(extractCanonicals(html), [LOC]);
});

test("extractCanonicals returns every duplicate canonical in document order", () => {
  const html = pageHtml({ canonicals: [LOC, `${SITE_URL}/civica-index/`] });
  assert.deepEqual(extractCanonicals(html), [LOC, `${SITE_URL}/civica-index/`]);
});

test("extractMetaByProperty matches on property or name, case-insensitively", () => {
  const html = `<meta PROPERTY="OG:URL" content="${LOC}">`;
  assert.deepEqual(extractMetaByProperty(html, "og:url"), [LOC]);
});

test("attribute parsing decodes HTML entities in query-string canonical metadata", () => {
  const expected = `${SITE_URL}/compare?c=france&c=germany`;
  const html = `<link rel="canonical" href="${SITE_URL}/compare?c=france&amp;c=germany" />`;
  assert.deepEqual(extractCanonicals(html), [expected]);
});

test("extractSitemapLocs pulls every <loc> and decodes XML entities", () => {
  const xml = `<urlset><url><loc>${SITE_URL}/compare?c=a&amp;c=b</loc></url><url><loc>${SITE_URL}/about</loc></url></urlset>`;
  assert.deepEqual(extractSitemapLocs(xml), [
    `${SITE_URL}/compare?c=a&c=b`,
    `${SITE_URL}/about`,
  ]);
});

// ── Host allowlisting ───────────────────────────────────────────────────

test("hasForbiddenHost accepts the production apex", () => {
  assert.equal(hasForbiddenHost(`${SITE_URL}/civica-index`), false);
});

test("hasForbiddenHost rejects www, vercel.app, localhost, preview, and http", () => {
  assert.equal(hasForbiddenHost("https://www.civicaatlas.org/civica-index"), true);
  assert.equal(hasForbiddenHost("https://civica-atlas.vercel.app/civica-index"), true);
  assert.equal(hasForbiddenHost("http://localhost:3000/civica-index"), true);
  assert.equal(hasForbiddenHost("https://preview.civicaatlas.org/civica-index"), true);
  assert.equal(hasForbiddenHost("http://civicaatlas.org/civica-index"), true);
  assert.equal(hasForbiddenHost(""), true);
  assert.equal(hasForbiddenHost("not a url"), true);
});

test("isAbsoluteApexUrl", () => {
  assert.equal(isAbsoluteApexUrl(SITE_URL, SITE_URL), true);
  assert.equal(isAbsoluteApexUrl(`${SITE_URL}/api/v1/index`, SITE_URL), true);
  assert.equal(isAbsoluteApexUrl("/api/v1/index", SITE_URL), false);
  assert.equal(isAbsoluteApexUrl(undefined, SITE_URL), false);
});

// ── findForbiddenHostPatternsInSource (TS/TSX source scan, not HTML) ────

test("findForbiddenHostPatternsInSource flags each forbidden host category in real code", () => {
  assert.deepEqual(
    findForbiddenHostPatternsInSource('const url = "https://www.civicaatlas.org/x";'),
    ["www.civicaatlas.org"],
  );
  assert.deepEqual(
    findForbiddenHostPatternsInSource('const url = "https://civica-atlas.vercel.app";'),
    ["*.vercel.app"],
  );
  assert.deepEqual(findForbiddenHostPatternsInSource('const url = "http://localhost:3000";'), [
    "localhost",
  ]);
  assert.deepEqual(findForbiddenHostPatternsInSource('const url = "http://127.0.0.1:3000";'), [
    "127.0.0.1",
  ]);
  assert.deepEqual(
    findForbiddenHostPatternsInSource('const url = "https://preview.civicaatlas.org";'),
    ["preview host"],
  );
  assert.deepEqual(findForbiddenHostPatternsInSource('const url = "http://civicaatlas.org";'), [
    "http://civicaatlas",
  ]);
});

test("findForbiddenHostPatternsInSource returns nothing for clean source", () => {
  assert.deepEqual(
    findForbiddenHostPatternsInSource('import { SITE_URL } from "@/lib/site";\nconst x = SITE_URL;'),
    [],
  );
});

test("findForbiddenHostPatternsInSource ignores forbidden-host mentions that only appear in comments", () => {
  const source = [
    "// Reject www.civicaatlas.org, *.vercel.app, localhost, 127.0.0.1, and preview.civicaatlas.org.",
    "/* Also reject http://civicaatlas.org (non-https apex). */",
    'const url = SITE_URL;',
  ].join("\n");
  assert.deepEqual(findForbiddenHostPatternsInSource(source), []);
});

// ── validatePageMetadata ────────────────────────────────────────────────

test("validatePageMetadata passes a fully-compliant page", () => {
  const result = validatePageMetadata({ loc: LOC, siteUrl: SITE_URL, status: 200, html: pageHtml({}) });
  assert.deepEqual(result.errors, []);
  assert.equal(result.ok, true);
});

test("validatePageMetadata fails a non-200 status without parsing further", () => {
  const result = validatePageMetadata({ loc: LOC, siteUrl: SITE_URL, status: 404, html: "" });
  assert.equal(result.ok, false);
  assert.match(result.errors[0], /HTTP 200/);
});

test("validatePageMetadata fails on a missing canonical", () => {
  const html = pageHtml({ canonicals: [] });
  const result = validatePageMetadata({ loc: LOC, siteUrl: SITE_URL, status: 200, html });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => /exactly one canonical/.test(e)));
});

test("validatePageMetadata fails on a duplicate canonical", () => {
  const html = pageHtml({ canonicals: [LOC, LOC] });
  const result = validatePageMetadata({ loc: LOC, siteUrl: SITE_URL, status: 200, html });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => /exactly one canonical/.test(e)));
});

test("validatePageMetadata fails a wrong-host canonical (www) even when count is 1", () => {
  const wrongHost = "https://www.civicaatlas.org/civica-index";
  const html = pageHtml({ canonicals: [wrongHost] });
  const result = validatePageMetadata({ loc: LOC, siteUrl: SITE_URL, status: 200, html });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => /does not equal sitemap loc/.test(e)));
  assert.ok(result.errors.some((e) => /forbidden host/.test(e)));
});

test("validatePageMetadata rejects a non-apex sitemap loc even when canonical and og:url match it", () => {
  const loc = "https://example.org/civica-index";
  const html = pageHtml({ canonicals: [loc], ogUrls: [loc] });
  const result = validatePageMetadata({ loc, siteUrl: SITE_URL, status: 200, html });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => /sitemap loc .* not an absolute apex URL/.test(e)));
});

test("validatePageMetadata fails a wrong-path canonical", () => {
  const html = pageHtml({ canonicals: [`${SITE_URL}/about`] });
  const result = validatePageMetadata({ loc: LOC, siteUrl: SITE_URL, status: 200, html });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => /does not equal sitemap loc/.test(e)));
});

test("validatePageMetadata fails a missing og:url", () => {
  const html = pageHtml({ ogUrls: [] });
  const result = validatePageMetadata({ loc: LOC, siteUrl: SITE_URL, status: 200, html });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => /exactly one og:url/.test(e)));
});

test("validatePageMetadata fails a duplicate og:url", () => {
  const html = pageHtml({ ogUrls: [LOC, `${SITE_URL}/about`] });
  const result = validatePageMetadata({ loc: LOC, siteUrl: SITE_URL, status: 200, html });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => /exactly one og:url/.test(e)));
});

test("validatePageMetadata fails a wrong-host og:url", () => {
  const html = pageHtml({ ogUrls: ["https://civica-atlas.vercel.app/civica-index"] });
  const result = validatePageMetadata({ loc: LOC, siteUrl: SITE_URL, status: 200, html });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => /forbidden host/.test(e)));
});

test("validatePageMetadata fails a wrong-path og:url", () => {
  const html = pageHtml({ ogUrls: [`${SITE_URL}/rankings`] });
  const result = validatePageMetadata({ loc: LOC, siteUrl: SITE_URL, status: 200, html });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => /og:url .* does not equal sitemap loc/.test(e)));
});

test("validatePageMetadata fails a missing/relative og:image", () => {
  const html = pageHtml({ ogImage: null });
  const result = validatePageMetadata({ loc: LOC, siteUrl: SITE_URL, status: 200, html });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => /missing og:image/.test(e)));
});

test("validatePageMetadata fails a non-summary_large_image twitter:card", () => {
  const html = pageHtml({ twitterCard: "summary" });
  const result = validatePageMetadata({ loc: LOC, siteUrl: SITE_URL, status: 200, html });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => /twitter:card/.test(e)));
});

test("validatePageMetadata fails a noindex robots meta", () => {
  const html = pageHtml({ robots: "noindex, nofollow" });
  const result = validatePageMetadata({ loc: LOC, siteUrl: SITE_URL, status: 200, html });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => /noindex/.test(e)));
});

test("validatePageMetadata fails on malformed JSON-LD", () => {
  const html = pageHtml({ jsonLd: ["{ this is not valid json"] });
  const result = validatePageMetadata({ loc: LOC, siteUrl: SITE_URL, status: 200, html });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => /unparseable JSON-LD/.test(e)));
});

test("extractJsonLdBlocks/extractJsonLdNodes: a malformed block never blocks a valid sibling", () => {
  const html = pageHtml({
    jsonLd: ['{ "@type": "Dataset", "url": "x" }', "{ broken"],
  });
  const blocks = extractJsonLdBlocks(html);
  assert.equal(blocks.length, 2);
  assert.equal(blocks[0].error, null);
  assert.ok(blocks[1].error);
  assert.deepEqual(extractJsonLdNodes(html), [{ "@type": "Dataset", url: "x" }]);
});

// ── Dataset validation ──────────────────────────────────────────────────

function validDatasetNode(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: "Civica Index",
    description:
      "A research-beta composite across four governance dimensions. The methodology has not completed independent review.",
    url: LOC,
    creator: { "@id": `${SITE_URL}/#organization` },
    publisher: { "@id": `${SITE_URL}/#organization` },
    license: `${SITE_URL}/licensing`,
    isAccessibleForFree: true,
    distribution: [
      {
        "@type": "DataDownload",
        encodingFormat: "application/json",
        contentUrl: `${SITE_URL}/api/v1/index/rankings`,
      },
    ],
    ...overrides,
  };
}

test("validateDatasetNode passes the canonical published shape", () => {
  const result = validateDatasetNode({ nodes: [validDatasetNode()], canonical: LOC, siteUrl: SITE_URL });
  assert.deepEqual(result.errors, []);
  assert.equal(result.ok, true);
});

test("validateDatasetNode passes with a nonempty temporalCoverage and fails with an empty one", () => {
  const withVintage = validateDatasetNode({
    nodes: [validDatasetNode({ temporalCoverage: "2026-Q1" })],
    canonical: LOC,
    siteUrl: SITE_URL,
  });
  assert.equal(withVintage.ok, true);

  const emptyVintage = validateDatasetNode({
    nodes: [validDatasetNode({ temporalCoverage: "  " })],
    canonical: LOC,
    siteUrl: SITE_URL,
  });
  assert.equal(emptyVintage.ok, false);
  assert.ok(emptyVintage.errors.some((e) => /temporalCoverage/.test(e)));
});

test("findDatasetNode/validateDatasetNode fail when zero or multiple Dataset nodes are present", () => {
  assert.equal(findDatasetNode([]), null);
  assert.equal(findDatasetNode([validDatasetNode(), validDatasetNode()]), null);

  const none = validateDatasetNode({ nodes: [], canonical: LOC, siteUrl: SITE_URL });
  assert.equal(none.ok, false);
  assert.ok(none.errors.some((e) => /exactly one Dataset node/.test(e)));

  const duplicate = validateDatasetNode({
    nodes: [validDatasetNode(), validDatasetNode()],
    canonical: LOC,
    siteUrl: SITE_URL,
  });
  assert.equal(duplicate.ok, false);
  assert.ok(duplicate.errors.some((e) => /exactly one Dataset node/.test(e)));
});

test("validateDatasetNode fails when Dataset.url does not match the canonical", () => {
  const result = validateDatasetNode({
    nodes: [validDatasetNode({ url: `${SITE_URL}/rankings` })],
    canonical: LOC,
    siteUrl: SITE_URL,
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => /does not match canonical/.test(e)));
});

test("validateDatasetNode fails when the description omits research-beta framing", () => {
  const result = validateDatasetNode({
    nodes: [validDatasetNode({ description: "A governance composite. Not independently reviewed." })],
    canonical: LOC,
    siteUrl: SITE_URL,
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => /research-beta/.test(e)));
});

test("validateDatasetNode fails when the description omits the independent-review disclosure", () => {
  const result = validateDatasetNode({
    nodes: [validDatasetNode({ description: "A research-beta composite across four governance dimensions." })],
    canonical: LOC,
    siteUrl: SITE_URL,
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => /not independently reviewed/.test(e)));
});

test("validateDatasetNode fails when creator/publisher/license/distribution are missing or off-apex", () => {
  const result = validateDatasetNode({
    nodes: [
      validDatasetNode({
        creator: { "@id": "https://example.com/#organization" },
        publisher: undefined,
        license: "https://example.com/licensing",
        distribution: [{ "@type": "DataDownload", contentUrl: "https://example.com/api" }],
      }),
    ],
    canonical: LOC,
    siteUrl: SITE_URL,
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => /Dataset\.creator/.test(e)));
  assert.ok(result.errors.some((e) => /Dataset\.publisher/.test(e)));
  assert.ok(result.errors.some((e) => /Dataset\.license/.test(e)));
  assert.ok(result.errors.some((e) => /Dataset\.distribution/.test(e)));
});

test("validateDatasetNode fails when @context is missing or not https://schema.org", () => {
  const missing = validateDatasetNode({
    nodes: [validDatasetNode({ "@context": undefined })],
    canonical: LOC,
    siteUrl: SITE_URL,
  });
  assert.equal(missing.ok, false);
  assert.ok(missing.errors.some((e) => /Dataset\.@context/.test(e)));

  const wrong = validateDatasetNode({
    nodes: [validDatasetNode({ "@context": "http://schema.org" })],
    canonical: LOC,
    siteUrl: SITE_URL,
  });
  assert.equal(wrong.ok, false);
  assert.ok(wrong.errors.some((e) => /Dataset\.@context/.test(e)));
});

test("validateDatasetNode fails when name is missing or empty", () => {
  const missing = validateDatasetNode({
    nodes: [validDatasetNode({ name: undefined })],
    canonical: LOC,
    siteUrl: SITE_URL,
  });
  assert.equal(missing.ok, false);
  assert.ok(missing.errors.some((e) => /Dataset\.name/.test(e)));

  const empty = validateDatasetNode({
    nodes: [validDatasetNode({ name: "   " })],
    canonical: LOC,
    siteUrl: SITE_URL,
  });
  assert.equal(empty.ok, false);
  assert.ok(empty.errors.some((e) => /Dataset\.name/.test(e)));
});

test("validateDatasetNode fails when description is missing or empty", () => {
  const result = validateDatasetNode({
    nodes: [validDatasetNode({ description: "" })],
    canonical: LOC,
    siteUrl: SITE_URL,
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => /Dataset\.description must be a nonempty string/.test(e)));
});

test("validateDatasetNode fails when Dataset.url does not resolve to the apex host", () => {
  const result = validateDatasetNode({
    nodes: [validDatasetNode({ url: "https://civica-atlas.vercel.app/civica-index" })],
    canonical: "https://civica-atlas.vercel.app/civica-index",
    siteUrl: SITE_URL,
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => /Dataset\.url .* is not an apex URL/.test(e)));
});

test("validateDatasetNode rejects a matching canonical on an unrelated HTTPS host", () => {
  const canonical = "https://example.org/civica-index";
  const result = validateDatasetNode({
    nodes: [validDatasetNode({ url: canonical })],
    canonical,
    siteUrl: SITE_URL,
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => /Dataset\.url .* is not an apex URL/.test(e)));
});

test("validateDatasetNode fails when isAccessibleForFree is missing or not a boolean", () => {
  const missing = validateDatasetNode({
    nodes: [validDatasetNode({ isAccessibleForFree: undefined })],
    canonical: LOC,
    siteUrl: SITE_URL,
  });
  assert.equal(missing.ok, false);
  assert.ok(missing.errors.some((e) => /Dataset\.isAccessibleForFree/.test(e)));

  const wrongType = validateDatasetNode({
    nodes: [validDatasetNode({ isAccessibleForFree: "true" })],
    canonical: LOC,
    siteUrl: SITE_URL,
  });
  assert.equal(wrongType.ok, false);
  assert.ok(wrongType.errors.some((e) => /Dataset\.isAccessibleForFree/.test(e)));
});

test("validateDatasetNode fails when the distribution's @type is not DataDownload", () => {
  const result = validateDatasetNode({
    nodes: [
      validDatasetNode({
        distribution: [
          {
            "@type": "MediaObject",
            encodingFormat: "application/json",
            contentUrl: `${SITE_URL}/api/v1/index/rankings`,
          },
        ],
      }),
    ],
    canonical: LOC,
    siteUrl: SITE_URL,
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => /Dataset\.distribution/.test(e)));
});

test("validateDatasetNode fails when the distribution's encodingFormat is missing or empty", () => {
  const missing = validateDatasetNode({
    nodes: [
      validDatasetNode({
        distribution: [{ "@type": "DataDownload", contentUrl: `${SITE_URL}/api/v1/index/rankings` }],
      }),
    ],
    canonical: LOC,
    siteUrl: SITE_URL,
  });
  assert.equal(missing.ok, false);
  assert.ok(missing.errors.some((e) => /Dataset\.distribution/.test(e)));

  const empty = validateDatasetNode({
    nodes: [
      validDatasetNode({
        distribution: [
          { "@type": "DataDownload", encodingFormat: "  ", contentUrl: `${SITE_URL}/api/v1/index/rankings` },
        ],
      }),
    ],
    canonical: LOC,
    siteUrl: SITE_URL,
  });
  assert.equal(empty.ok, false);
  assert.ok(empty.errors.some((e) => /Dataset\.distribution/.test(e)));
});

// ── Route-status predicate (Index-facing / Pulse-facing) ────────────────

test("classifyRouteStatus: pulse paths are a stricter subset of index paths", () => {
  assert.equal(classifyRouteStatus("/civica-index"), "index");
  assert.equal(classifyRouteStatus("/civica-index/government-types"), "index");
  assert.equal(classifyRouteStatus("/civica-index/methodology/pulse"), "pulse");
  assert.equal(classifyRouteStatus("/civica-index/methodology/pulse/backtest"), "pulse");
  assert.equal(classifyRouteStatus("/civica-index/pulse-changelog"), "pulse");
  assert.equal(classifyRouteStatus("/about"), "none");
});

test("classifyRouteStatus: Index-facing also covers /rankings, /compare, and /country/:slug/civica-data", () => {
  assert.equal(classifyRouteStatus("/rankings"), "index");
  assert.equal(classifyRouteStatus("/compare"), "index");
  assert.equal(classifyRouteStatus("/country/usa/civica-data"), "index");
  // Other country tabs and unrelated near-matches are NOT index-facing.
  assert.equal(classifyRouteStatus("/country/usa"), "none");
  assert.equal(classifyRouteStatus("/country/usa/constitution"), "none");
  assert.equal(classifyRouteStatus("/rankings-archive"), "none");
  assert.equal(classifyRouteStatus("/comparee"), "none");
});

test("extractTitleText reads the first <title> element", () => {
  assert.equal(extractTitleText(metaTagsHtml({ title: "Civica Index — Beta" })), "Civica Index — Beta");
  assert.equal(extractTitleText(metaTagsHtml({})), null);
});

test("extractStructuredMetadataText concatenates title/description/og/twitter text and never includes body text", () => {
  const html = metaTagsHtml({
    title: "T-marker",
    description: "D-marker",
    ogTitle: "OGT-marker",
    ogDescription: "OGD-marker",
    twitterTitle: "TT-marker",
    twitterDescription: "TD-marker",
    body: "BODY-ONLY-MARKER",
  });
  const text = extractStructuredMetadataText(html);
  for (const marker of ["T-marker", "D-marker", "OGT-marker", "OGD-marker", "TT-marker", "TD-marker"]) {
    assert.ok(text.includes(marker), `expected structured text to include "${marker}"`);
  }
  assert.ok(!text.includes("BODY-ONLY-MARKER"));
});

test("routeStatusSatisfied requires beta/research-experiment language on index-facing routes", () => {
  assert.equal(
    routeStatusSatisfied("/civica-index", metaTagsHtml({ title: "This is a Beta composite." })),
    true,
  );
  assert.equal(
    routeStatusSatisfied("/civica-index", metaTagsHtml({ ogDescription: "research-experiment status" })),
    true,
  );
  assert.equal(
    routeStatusSatisfied("/civica-index", metaTagsHtml({ title: "no disclosure here" })),
    false,
  );
});

test("routeStatusSatisfied requires experimental/archived-diagnostic language on pulse-facing routes", () => {
  assert.equal(
    routeStatusSatisfied(
      "/civica-index/pulse-changelog",
      metaTagsHtml({ description: "experimental deltas" }),
    ),
    true,
  );
  assert.equal(
    routeStatusSatisfied(
      "/civica-index/methodology/pulse",
      metaTagsHtml({ twitterDescription: "an archived-diagnostic signal" }),
    ),
    true,
  );
  assert.equal(
    routeStatusSatisfied("/civica-index/pulse-changelog", metaTagsHtml({ title: "just a Beta label" })),
    false,
  );
});

test("routeStatusSatisfied is trivially true off the Index/Pulse namespace", () => {
  assert.equal(routeStatusSatisfied("/about", metaTagsHtml({ body: "nothing relevant" })), true);
});

test("routeStatusSatisfied ignores a status disclosure that only appears in body text (never in structured metadata)", () => {
  const bodyOnlyBetaChip = metaTagsHtml({
    title: "Civica Index",
    description: "A comparative governance reference.",
    ogTitle: "Civica Index",
    ogDescription: "A comparative governance reference.",
    body: '<span class="chip">Beta</span> experimental archived-diagnostic research-experiment',
  });
  assert.equal(routeStatusSatisfied("/civica-index", bodyOnlyBetaChip), false);
  assert.equal(routeStatusSatisfied("/civica-index/pulse-changelog", bodyOnlyBetaChip), false);
  assert.equal(routeStatusSatisfied("/rankings", bodyOnlyBetaChip), false);
});

// ── Argument-less new Date() detection ──────────────────────────────────

test("findArgumentlessNewDateCalls flags new Date() with or without internal whitespace", () => {
  assert.equal(findArgumentlessNewDateCalls("const x = new Date();").length, 1);
  assert.equal(findArgumentlessNewDateCalls("const x = new   Date (  );").length, 1);
  assert.equal(hasArgumentlessNewDate("const x = new Date();"), true);
});

test("findArgumentlessNewDateCalls never flags a new Date(arg) call", () => {
  assert.equal(hasArgumentlessNewDate('const x = new Date("2026-07-10");'), false);
  assert.equal(hasArgumentlessNewDate("const x = new Date(post.date);"), false);
  assert.equal(hasArgumentlessNewDate("const x = new URL(SITE_URL);"), false);
});

test("findArgumentlessNewDateCalls ignores mentions inside comments", () => {
  const source = [
    "// never write new Date() here",
    "/* also not here: new Date() */",
    'const x = new Date("2026-07-10");',
  ].join("\n");
  assert.equal(hasArgumentlessNewDate(source), false);
});
