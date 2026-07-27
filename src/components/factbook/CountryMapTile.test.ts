import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const tileSource = readFileSync(
  new URL("./CountryMapTile.tsx", import.meta.url),
  "utf8",
);
const mapSource = readFileSync(new URL("./CountryMap.tsx", import.meta.url), "utf8");

function auditTileSource(source: string): string[] {
  const issues: string[] = [];
  const activationClass = source.indexOf('className="country-map-activation"');
  const activationStart = source.lastIndexOf("<button", activationClass);
  const activationEnd = source.indexOf("</button>", activationStart);
  const attributionStart = source.indexOf(
    '<span className="country-map-attribution"',
  );

  if (activationStart === -1 || activationEnd === -1) {
    issues.push("missing map activation button");
    return issues;
  }
  const activation = source.slice(activationStart, activationEnd);
  if (/<a\b/.test(activation)) {
    issues.push("map activation button contains an attribution link");
  }
  if (attributionStart < activationEnd) {
    issues.push("map attribution is not a sibling after the activation button");
  }
  if (!/aria-label={`Explore the interactive map of \$\{countryName\}`}/.test(activation)) {
    issues.push("map activation lacks its country-specific accessible name");
  }
  if (!/OpenStreetMap map-data attribution/.test(source)) {
    issues.push("OpenStreetMap attribution lacks an independent accessible name");
  }
  if (!/map-provider attribution/.test(source)) {
    issues.push("map-provider attribution lacks an independent accessible name");
  }
  if (
    !/type="button"/.test(activation) ||
    !/onClick=/.test(activation) ||
    !/onKeyDown=/.test(activation)
  ) {
    issues.push("map activation does not use native button keyboard semantics");
  }
  if (!/requestAnimationFrame\(\(\) => activationRef\.current\?\.focus\(\)\)/.test(source)) {
    issues.push("map activation does not regain focus after the modal closes");
  }
  return issues;
}

test("masthead map activation and attribution are independently focusable siblings", () => {
  assert.deepEqual(auditTileSource(tileSource), []);
  assert.match(
    mapSource,
    /attributionControl: interactive \? \{ compact: true \} : false/,
    "the non-interactive preview must not inject MapLibre links inside the activation button",
  );
});

test("the accessibility contract rejects a nested attribution link", () => {
  const invalid = tileSource.replace(
    "</button>\n        <span className=\"country-map-attribution\"",
    '<a href="https://example.test">Map data</a></button>\n        <span className="country-map-attribution"',
  );
  assert.deepEqual(auditTileSource(invalid), [
    "map activation button contains an attribution link",
  ]);
});
