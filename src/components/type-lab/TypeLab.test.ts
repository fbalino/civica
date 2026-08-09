import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const component = readFileSync(
  "src/components/type-lab/TypeLab.tsx",
  "utf8",
);
const route = readFileSync(
  "src/app/api/type-lab-font/[font]/route.ts",
  "utf8",
);
const gitignore = readFileSync(".gitignore", "utf8");

function optionBlock(name: "SERIF_ITEMS" | "SANS_ITEMS" | "PRESET_ITEMS") {
  const match = component.match(
    new RegExp(`const ${name} = \\[([\\s\\S]*?)\\] satisfies`),
  );
  assert.ok(match, `${name} configuration block is missing`);
  return match[1];
}

function stringProperties(block: string, property: "label" | "value") {
  return [...block.matchAll(new RegExp(`${property}:\\s*"([^"]+)"`, "g"))].map(
    (match) => match[1],
  );
}

test("every serif and sans option states whether it is free or paid", () => {
  for (const [name, expectedCount] of [
    ["SERIF_ITEMS", 11],
    ["SANS_ITEMS", 13],
  ] as const) {
    const block = optionBlock(name);
    const labels = stringProperties(block, "label");
    const values = stringProperties(block, "value");

    assert.equal(labels.length, expectedCount, `${name} label count drifted`);
    assert.equal(values.length, expectedCount, `${name} value count drifted`);
    assert.equal(
      new Set(values).size,
      values.length,
      `${name} contains duplicate values`,
    );

    for (const label of labels) {
      assert.match(
        label,
        /^(?:Free|Paid) · /,
        `${label} is missing its Free/Paid marker`,
      );
    }
  }
});

test("pair presets distinguish the paid favorite from free substitutes", () => {
  const labels = stringProperties(optionBlock("PRESET_ITEMS"), "label");

  for (const expected of [
    "Current · Free · Source Serif + Inter",
    "Favorite · Paid · Lyon + Diatype",
    "Closest free · Free · Cormorant + Instrument",
    "Low-risk free · Free · Source Serif + Instrument",
    "Civic free · Free · Newsreader + Public Sans",
  ]) {
    assert.ok(labels.includes(expected), `missing preset: ${expected}`);
  }

  assert.match(
    component,
    /label: `Custom combination · \$\{customAccess\}`/,
    "custom pairs must derive their Free/Paid marker from both selected fonts",
  );
});

test("every OFL alternative has a closed local route mapping", () => {
  for (const key of [
    "open-instrument-serif-regular",
    "open-instrument-serif-italic",
    "open-newsreader-variable",
    "open-newsreader-italic-variable",
    "open-eb-garamond-variable",
    "open-eb-garamond-italic-variable",
    "open-cormorant-garamond-variable",
    "open-cormorant-garamond-italic-variable",
    "open-instrument-sans-variable",
    "open-instrument-sans-italic-variable",
    "open-work-sans-variable",
    "open-work-sans-italic-variable",
    "open-public-sans-variable",
    "open-public-sans-italic-variable",
    "open-source-sans-3-variable",
    "open-source-sans-3-italic-variable",
    "open-archivo-variable",
    "open-archivo-italic-variable",
    "open-manrope-variable",
  ]) {
    assert.ok(route.includes(`"${key}"`), `missing local route key: ${key}`);
    assert.ok(component.includes(`"${key}"`), `missing client key: ${key}`);
  }

  assert.match(route, /process\.env\.NODE_ENV !== "development"/);
  assert.match(route, /path\.endsWith\("\.ttf"\) \? "font\/ttf"/);
  assert.match(gitignore, /\/local\/type-lab-fonts\//);
});

test("installed paid desktop fonts are loaded through explicit local names", () => {
  for (const postScriptName of [
    "LyonDisplayTrial-",
    "ABCDiatypeTrial-Regular",
    "ArbeitPro-Regular",
    "CentraNo2-Book",
  ]) {
    assert.ok(
      component.includes(postScriptName),
      `missing installed face alias: ${postScriptName}`,
    );
  }
});
