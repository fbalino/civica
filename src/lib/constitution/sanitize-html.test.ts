import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const sanitizerModule = fileURLToPath(
  new URL("./sanitize-html.ts", import.meta.url),
);
const securityCases = fileURLToPath(
  new URL("./sanitize-html.security-cases.ts", import.meta.url),
);

test("the sanitizer is guarded by the server-only module marker", () => {
  const result = spawnSync(
    process.execPath,
    [
      "--import",
      "tsx",
      "--input-type=module",
      "--eval",
      `await import(${JSON.stringify(sanitizerModule)})`,
    ],
    { encoding: "utf8" },
  );

  assert.notEqual(result.status, 0);
  assert.match(
    result.stderr,
    /This module cannot be imported from a Client Component module/,
  );
});

test("constitution-html/v1 exploit fixtures pass under the React server condition", () => {
  const result = spawnSync(
    process.execPath,
    ["--conditions=react-server", "--import", "tsx", "--test", securityCases],
    { encoding: "utf8" },
  );

  assert.equal(
    result.status,
    0,
    [result.stdout, result.stderr].filter(Boolean).join("\n"),
  );
});

test("all constitution HTML egress paths use the server boundary", () => {
  const querySource = readFileSync(
    "src/lib/db/queries-constitution.ts",
    "utf8",
  );
  const readerSource = readFileSync(
    "src/components/constitution/ConstitutionReadingColumn.tsx",
    "utf8",
  );
  const excerptSource = readFileSync(
    "src/components/constitution/ConstitutionCrossReferencePane.tsx",
    "utf8",
  );

  assert.match(querySource, /const html = sanitizeConstitutionHtml\(rawHtml\)/);
  assert.equal(
    querySource.match(
      /const excerptHtml = sanitizeConstitutionHtml\(r[.]excerptHtml\)/g,
    )?.length,
    2,
  );
  assert.doesNotMatch(readerSource, /sanitizeConstitutionHtml/);
  assert.doesNotMatch(excerptSource, /sanitizeConstitutionHtml/);
  assert.match(readerSource, /__html: section[.]html/);
  assert.match(excerptSource, /__html: ex[.]excerptHtml/);
});

test("excerpt routes rethrow read failures as non-cacheable 503 responses", () => {
  for (const routePath of [
    "src/app/api/constitution/excerpts/route.ts",
    "src/app/api/constitution/excerpts/notable/route.ts",
  ]) {
    const source = readFileSync(routePath, "utf8");
    assert.match(source, /throwOnError: true/);
    assert.match(source, /status: 503/);
    assert.match(source, /"Cache-Control": "no-store"/);
    assert.match(source, /error: "data_unavailable"/);
  }
});
