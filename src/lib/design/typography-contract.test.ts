import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";

const repo = process.cwd();
const read = (path: string) => readFileSync(resolve(repo, path), "utf8");

const globals = read("src/app/globals.css");
const layout = read("src/app/layout.tsx");
const home = read("src/app/home.css");
const factbook = read("src/app/factbook.css");
const editorial = read("src/app/editorial.css");
const designSystem = read("src/app/design-system/design-system.css");
const designSystemPage = read("src/app/design-system/page.tsx");
const designGuide = read("DESIGN.md");

test("production uses calibrated self-hosted Newsreader and Archivo faces", () => {
  assert.doesNotMatch(layout, /next\/font\/google|Source_Serif_4|\bInter\b/);
  assert.match(
    layout,
    /href="\/fonts\/newsreader\/newsreader-normal-latin\.woff2"/,
  );
  assert.match(
    layout,
    /href="\/fonts\/archivo\/archivo-normal-latin\.woff2"/,
  );

  const faceBlocks = [...globals.matchAll(/@font-face\s*\{([^}]+)\}/g)].map(
    (match) => match[1],
  );
  const familyDescriptor = ["font", "family"].join("-");
  const newsreaderFaces = faceBlocks.filter((block) =>
    block.includes(`${familyDescriptor}: "Civica Newsreader"`),
  );
  const archivoFaces = faceBlocks.filter((block) =>
    block.includes(`${familyDescriptor}: "Civica Archivo"`),
  );

  assert.equal(newsreaderFaces.length, 6);
  assert.equal(archivoFaces.length, 6);
  newsreaderFaces.forEach((block) => {
    assert.match(block, /size-adjust:\s*120%/);
    assert.match(block, /font-weight:\s*200 800/);
    assert.match(block, /unicode-range:/);
  });
  archivoFaces.forEach((block) => {
    assert.match(block, /size-adjust:\s*106%/);
    assert.match(block, /font-weight:\s*100 900/);
    assert.match(block, /unicode-range:/);
  });

  assert.match(
    globals,
    /--font-heading:\s*"Civica Newsreader"[^;]+;/,
  );
  assert.match(globals, /--font-body:\s*"Civica Archivo"[^;]+;/);
});

test("every referenced production font asset exists and is WOFF2", () => {
  const urls = [
    ...globals.matchAll(/url\("(\/fonts\/[^"]+\.woff2)"\)/g),
  ].map((match) => match[1]);

  assert.equal(urls.length, 12);
  assert.equal(new Set(urls).size, 12);

  urls.forEach((url) => {
    const bytes = readFileSync(resolve(repo, "public", url.slice(1)));
    assert.equal(bytes.subarray(0, 4).toString("ascii"), "wOF2", url);
  });

  assert.match(
    read("public/fonts/newsreader/OFL.txt"),
    /SIL Open Font License, Version 1\.1/,
  );
  assert.match(
    read("public/fonts/archivo/OFL.txt"),
    /SIL Open Font License, Version 1\.1/,
  );
});

test("the canonical leading scale preserves the approved 120 percent setting", () => {
  const expected = {
    "--leading-none": "1.2",
    "--leading-tight": "1.26",
    "--leading-snug": "1.32",
    "--leading-normal": "1.98",
    "--leading-relaxed": "2.04",
    "--leading-loose": "2.1",
  };

  Object.entries(expected).forEach(([token, value]) => {
    assert.match(globals, new RegExp(`${token}:\\s*${value};`));
  });
});

test("large hero titles are Light while lower headings are Regular", () => {
  assert.match(globals, /--font-weight-light:\s*300;/);
  assert.match(
    home,
    /\.home-hero-title\s*\{[^}]*font-weight:\s*var\(--font-weight-light\)/,
  );
  assert.match(
    factbook,
    /\.factbook-hero-name\s*\{[^}]*font-weight:\s*var\(--font-weight-light\)/,
  );
  assert.match(
    factbook,
    /\.factbook-hero-title\s*\{[^}]*font-weight:\s*var\(--font-weight-light\)/,
  );
  assert.match(
    home,
    /\.home-feature-title\s*\{[^}]*font-weight:\s*var\(--font-weight-regular\)/,
  );
  assert.match(
    factbook,
    /\.factbook-almanac-title\s*\{[^}]*font-weight:\s*var\(--font-weight-regular\)/,
  );
  assert.match(
    editorial,
    /\.constitution-section h1,[^}]*font-weight:\s*var\(--font-weight-regular\)/,
  );
  assert.match(
    designSystem,
    /\.ds-section-head h2\s*\{[^}]*font-weight:\s*var\(--font-weight-regular\)/,
  );
});

test("the canonical documentation and specimen name the active system", () => {
  assert.match(designGuide, /Use Newsreader for display/);
  assert.match(designGuide, /Use Archivo for body\/interface text/);
  assert.match(designSystemPage, /Newsreader, Archivo, mono\./);
  assert.doesNotMatch(designSystemPage, /Source Serif 4|\bInter\b/);
});
