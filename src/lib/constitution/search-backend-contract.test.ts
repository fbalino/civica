import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  evaluateInteractiveDisplay,
  PRODUCT_RIGHTS,
  sourceRights,
} from "@/lib/rights/manifest";
import {
  CONSTITUTION_DISPLAY_RIGHTS,
  evaluateConstitutionInteractiveDisplay,
} from "@/lib/rights/constitution-display";

test("Constitute rights permit only noncommercial interactive display", () => {
  const rights = sourceRights("constitute_project");
  const product = PRODUCT_RIGHTS.find(
    (row) => row.productId === "constitution-search-display-v1",
  );
  assert.equal(rights?.reviewStatus, "verified");
  assert.equal(rights?.licenseId, "CC-BY-NC-3.0");
  assert.equal(rights?.publicExport, "non-commercial-only");
  assert.equal(rights?.reviewedAt, "2026-07-12");
  assert.equal(
    CONSTITUTION_DISPLAY_RIGHTS.licenseId,
    rights?.licenseId,
    "the edge-safe rights contract must match the canonical manifest",
  );
  assert.equal(CONSTITUTION_DISPLAY_RIGHTS.termsUrl, rights?.termsUrl);
  assert.equal(CONSTITUTION_DISPLAY_RIGHTS.reviewedAt, rights?.reviewedAt);
  assert.equal(CONSTITUTION_DISPLAY_RIGHTS.publicExport, rights?.publicExport);
  assert.equal(
    CONSTITUTION_DISPLAY_RIGHTS.interactiveDisplay,
    product?.interactiveDisplay,
  );
  assert.equal(
    evaluateInteractiveDisplay(
      "constitution-search-display-v1",
      "constitute_project",
      { commercial: false, feeBearing: false },
    ).allowed,
    true,
  );
  assert.equal(
    evaluateInteractiveDisplay(
      "constitution-search-display-v1",
      "constitute_project",
      { commercial: true, feeBearing: false },
    ).allowed,
    false,
  );
  assert.deepEqual(
    evaluateConstitutionInteractiveDisplay(
      "constitution-search-display-v1",
      "constitute_project",
      { commercial: false, feeBearing: false },
    ),
    evaluateInteractiveDisplay(
      "constitution-search-display-v1",
      "constitute_project",
      { commercial: false, feeBearing: false },
    ),
  );
});

test("Neon HTTP paths use one atomic request and the legacy API cannot leak full text", () => {
  const writer = readFileSync(
    "src/lib/constitute/sync-constitutions.ts",
    "utf8",
  );
  const query = readFileSync(
    "src/lib/db/queries-constitution-search.ts",
    "utf8",
  );
  const legacy = readFileSync(
    "src/app/api/countries/[slug]/constitution/route.ts",
    "utf8",
  );
  const apiRoute = readFileSync(
    "src/app/api/constitution/search/route.ts",
    "utf8",
  );
  const readerPage = readFileSync(
    "src/app/constitution/search/page.tsx",
    "utf8",
  );
  assert.doesNotMatch(writer, /\.transaction\s*\(/);
  assert.match(writer, /db\.batch\(/);
  assert.match(query, /query\.transaction\(\(txn\) =>/);
  assert.doesNotMatch(query, /from "\.\/index"/);
  const deactivate = writer.indexOf(".set({ isCurrent: false");
  const insert = writer.indexOf(".insert(constitutionPassages)");
  const activate = writer.indexOf(".set({ isCurrent: true");
  assert.ok(deactivate >= 0 && deactivate < insert && insert < activate);
  assert.ok(
    query.indexOf("SET LOCAL statement_timeout") < query.indexOf("WITH q AS"),
  );
  assert.ok(
    query.indexOf("INSERT INTO rate_limits") < query.indexOf("WITH q AS"),
  );
  assert.match(query, /SELECT count <= \$\{rateLimit\.limit\}/);
  assert.match(query, /await incrementSearchRateLimit\(/);
  assert.doesNotMatch(apiRoute, /checkDurableRateLimit/);
  assert.doesNotMatch(readerPage, /checkDurableRateLimit/);
  assert.match(
    apiRoute,
    /searchConstitutionPassages\([\s\S]*scope: "constitution-search"/,
  );
  assert.match(readerPage, /searchConstitutionPassages\(input, \{/);
  assert.doesNotMatch(legacy, /fullTextHtml\s*:/);
  const migration = readFileSync(
    "drizzle/authoritative/0030_cute_namora.sql",
    "utf8",
  );
  assert.match(
    migration,
    /evidence_id text := COALESCE\(after_row->>'passage_id', before_row->>'passage_id'\)/,
  );
  assert.match(query, /jurisdiction_not_covered/);
});

test("stable citation routes use a slash-safe digest segment", () => {
  const query = readFileSync(
    "src/lib/db/queries-constitution-search.ts",
    "utf8",
  );
  const resolver = readFileSync(
    "src/app/api/constitution/passages/[digest]/route.ts",
    "utf8",
  );
  assert.match(query, /passageId\.slice\("constitution-passage\/"\.length\)/);
  assert.match(resolver, /\^sha256:\(\[a-f0-9\]\{64\}\)\$/);
});
