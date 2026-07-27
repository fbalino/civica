/**
 * Design-system composition guard.
 *
 * Token scanning cannot detect a hand-built hero, a fifth page width, CSS
 * multi-column reading-order drift, or a row header that sits above the table
 * hover surface. These source-level contracts keep those known failure modes
 * mechanical while visual baselines remain an explicit human-review gate.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

function source(path: string): string {
  return readFileSync(path, "utf8");
}

test("four canonical outer widths and named structural tracks drive layouts", () => {
  const globals = source("src/app/globals.css");
  const editorial = source("src/app/editorial.css");
  const factbook = source("src/app/factbook.css");
  const civicaData = source("src/app/civica-data.css");

  const expectedOuterWidths = [
    ["--width-page-reading", "760px"],
    ["--width-page-wide", "960px"],
    ["--width-page-standard", "1200px"],
    ["--width-reference-content", "1280px"],
  ] as const;
  const declaredOuterWidthTokens = [
    ...globals.matchAll(
      /^\s*(--width-(?:page-[a-z-]+|reference-content))\s*:/gm,
    ),
  ].map((match) => match[1]);
  assert.deepEqual(
    declaredOuterWidthTokens.sort(),
    expectedOuterWidths.map(([token]) => token).sort(),
    "outer page widths must remain the exact four canonical roles",
  );
  for (const [token, value] of expectedOuterWidths) {
    assert.match(
      globals,
      new RegExp(`${token}:\\s*${value};`),
      `${token} must retain its canonical value`,
    );
  }

  for (const token of [
    "--width-reference-shell",
    "--width-document-rail",
    "--width-document-body",
    "--width-rail-compact",
    "--width-country-rail",
    "--width-country-context",
    "--width-constitution-outline",
    "--width-constitution-context",
    "--width-record-rail",
    "--width-record-body",
  ]) {
    assert.match(globals, new RegExp(`${token}:`), `${token} is not defined`);
  }

  assert.match(
    editorial,
    /\.editorial-page\s*\{[^}]*max-width:\s*var\(--width-page-reading\)/,
  );
  assert.match(
    editorial,
    /\.editorial-page--wide\s*\{[^}]*max-width:\s*var\(--width-page-wide\)/,
  );
  assert.match(
    editorial,
    /\.editorial-page--full\s*\{[^}]*max-width:\s*var\(--width-page-standard\)/,
  );
  assert.match(
    editorial,
    /\.editorial-page--reference\s*\{[^}]*max-width:\s*var\(--width-reference-shell\)/,
  );
  assert.match(
    editorial,
    /\.methodology-layout\s*\{[^}]*grid-template-columns:\s*var\(--width-document-rail\)/,
  );
  assert.match(
    editorial,
    /\.methodology-content\s*\{[^}]*max-width:\s*var\(--width-document-body\)/,
  );
  assert.match(
    editorial,
    /\.constitution-explorer\s*\{[^}]*var\(--width-constitution-context\)/,
  );
  assert.match(
    editorial,
    /\.constitution-reader-layout\s*\{[^}]*var\(--width-constitution-outline\)/,
  );
  assert.match(
    globals,
    /\.post-body-grid\s*\{[^}]*var\(--width-record-rail\)[^}]*var\(--width-record-body\)/,
  );

  for (const css of [factbook, civicaData]) {
    assert.match(
      css,
      /grid-template-columns:\s*var\(--width-country-rail\)\s*minmax\(0,\s*1fr\)/,
      "country tabs must share the country navigation track",
    );
    assert.match(
      css,
      /@media \(max-width: 1100px\)[\s\S]*grid-template-columns:\s*var\(--width-rail-compact\)\s*minmax\(0,\s*1fr\)/,
      "country tabs must share the compact tablet navigation track",
    );
  }
  assert.match(factbook, /var\(--width-country-context\)/);
});

test("country landing composes PageHero and keeps its centered variant", () => {
  const almanac = source("src/components/factbook/FactbookAlmanac.tsx");
  const factbook = source("src/app/factbook.css");

  assert.match(almanac, /import \{ PageHero \}/);
  assert.match(
    almanac,
    /<PageHero[\s\S]*className="factbook-landing-hero--centered"/,
  );
  assert.doesNotMatch(almanac, /<section[^>]+factbook-landing-hero/);
  assert.match(
    factbook,
    /\.factbook-landing-hero--centered \.factbook-hero-inner\s*\{[^}]*text-align:\s*center/,
  );
});

test("country directory is sequential and does not use CSS multi-column flow", () => {
  const component = source("src/components/country/CountryDirectory.tsx");
  const editorial = source("src/app/editorial.css");

  assert.match(component, /className="country-directory__entries"/);
  assert.match(component, /className="country-directory__status-separator"/);
  assert.doesNotMatch(
    editorial,
    /\.country-directory\s*\{[^}]*column-count:/,
  );
  assert.match(
    editorial,
    /\.country-directory__entries\s*\{[^}]*display:\s*grid/,
  );
});

test("DataTable row headers share cell alignment, borders, and hover surface", () => {
  const editorial = source("src/app/editorial.css");

  assert.match(
    editorial,
    /\.editorial-data-table tbody > tr > :is\(th, td\)/,
  );
  assert.match(
    editorial,
    /\.editorial-data-table tbody > tr > th\[scope="row"\]\s*\{[^}]*text-align:\s*left/,
  );
  assert.match(
    editorial,
    /\.editorial-data-table tbody tr:hover > :is\(th, td\)/,
  );
});
