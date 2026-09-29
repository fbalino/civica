import assert from "node:assert/strict";
import test from "node:test";

import {
  classifyPosition,
  parseCountryHtml,
} from "../cia-cabinets-sync";

type FixturePosition = readonly [title: string, holder: string];

const BOSNIA_NATIONAL_POSITIONS: readonly FixturePosition[] = [
  ["Presidency Member (Bosniak)", "Person ONE"],
  ["Presidency Member (Croat)", "Person TWO"],
  ["Presidency Member (Serb)", "Person THREE"],
  ["Chmn., Council of Ministers", "Person FOUR"],
  ["Dep. Chmn., Council of Ministers, and Min. of Defense", "Person FIVE"],
  [
    "Dep. Chmn., Council of Ministers, and Min. of Foreign Trade & Economic Relations",
    "Person SIX",
  ],
  ["Min. of Civil Affairs", "Person SEVEN"],
  ["Min. of Defense", "Person EIGHT"],
  ["Min. of Finance", "Person NINE"],
  ["Min. of Foreign Affairs", "Person TEN"],
  ["Min. of Foreign Trade & Economic Relations", "Person ELEVEN"],
  ["Min. of Human Rights & Refugees", "Person TWELVE"],
  ["Min. of Justice", "Person THIRTEEN"],
  ["Min. of Security", "Person FOURTEEN"],
  ["Min. of Transport & Communication", "Person FIFTEEN"],
  ["Governor, Central Bank", "Person SIXTEEN"],
  ["Ambassador to the US", "Person SEVENTEEN"],
  ["Permanent Representative to the UN, New York", "Person EIGHTEEN"],
];

function blocks(positions: readonly FixturePosition[]) {
  return positions
    .map(
      ([title, holder]) =>
        `<div class="leader-info"><h4>${title}</h4><p>${holder}</p></div>`,
    )
    .join("\n");
}

function sectionedPage(
  sections: readonly (readonly [string, readonly FixturePosition[]])[],
) {
  return `<html>
    <h1>Bosnia and Herzegovina</h1>
    <h2>Leaders and Cabinet Members</h2>
    <div class="last-updated"><b>Last Updated</b>: <span>12/5/2023</span></div>
    ${sections
      .map(
        ([heading, positions]) =>
          `<h3 class="leaders-section">${heading}</h3>${blocks(positions)}`,
      )
      .join("\n")}
    <h2>Explore Foreign Governments</h2>
  </html>`;
}

test("Bosnia parses only its explicit national-government section", () => {
  const parsed = parseCountryHtml(
    "bosnia-and-herzegovina",
    sectionedPage([
      ["National Govt.", BOSNIA_NATIONAL_POSITIONS],
      ["Federation Govt.", [["Regional Premier", "Person NINETEEN"]]],
      ["Republika Srpska Govt.", [["Regional President", "Person TWENTY"]]],
    ]),
  );

  assert.equal(parsed.parseFailed, false);
  assert.equal(parsed.lastUpdated, "12/5/2023");
  assert.equal(parsed.positions.length, 18);
  assert.deepEqual(
    parsed.positions.map(({ title }) => title),
    BOSNIA_NATIONAL_POSITIONS.map(([title]) => title),
  );
  assert.deepEqual(
    parsed.positions.map(({ order }) => order),
    Array.from({ length: 18 }, (_, index) => index),
  );
  assert.deepEqual(
    parsed.positions.map(({ category }) => category),
    [
      "head",
      "head",
      "head",
      "head",
      "deputy",
      "deputy",
      "cabinet",
      "cabinet",
      "cabinet",
      "cabinet",
      "cabinet",
      "cabinet",
      "cabinet",
      "cabinet",
      "cabinet",
      "central_bank",
      "diplomatic",
      "diplomatic",
    ],
  );
  assert.equal(
    parsed.positions.filter(
      ({ category }) => category !== "head" && category !== "diplomatic",
    ).length,
    12,
  );
});

test("a leading unknown or ambiguous section fails closed", () => {
  const unknown = parseCountryHtml(
    "bosnia-and-herzegovina",
    sectionedPage([["Federation Govt.", [["Min. of Finance", "Person ONE"]]]]),
  );
  const duplicateNational = parseCountryHtml(
    "bosnia-and-herzegovina",
    sectionedPage([
      ["National Govt.", [["Min. of Finance", "Person ONE"]]],
      ["National Govt.", [["Min. of Justice", "Person TWO"]]],
    ]),
  );
  const otherCountry = parseCountryHtml(
    "elsewhere",
    sectionedPage([["National Govt.", [["Min. of Finance", "Person ONE"]]]]),
  );

  for (const parsed of [unknown, duplicateNational, otherCountry]) {
    assert.equal(parsed.parseFailed, true);
    assert.deepEqual(parsed.positions, []);
  }
});

test("China-style trailing regional sections remain outside the sovereign roster", () => {
  const html = `<html>
    <h1>China</h1>
    <h2>Leaders and Cabinet Members</h2>
    <div class="last-updated"><b>Last Updated</b>: <span>9/29/2026</span></div>
    ${blocks([
      ["President", "Person ONE"],
      ["Min. of Finance", "Person TWO"],
    ])}
    <h3 class="leaders-section">Hong Kong</h3>
    ${blocks([["Chief Executive", "Person THREE"]])}
    <h3 class="leaders-section">Macau</h3>
    ${blocks([["Chief Executive", "Person FOUR"]])}
    <h2>Explore Foreign Governments</h2>
  </html>`;

  const parsed = parseCountryHtml("china", html);
  assert.equal(parsed.parseFailed, false);
  assert.equal(parsed.lastUpdated, "9/29/2026");
  assert.deepEqual(
    parsed.positions.map(({ title, order }) => [title, order]),
    [
      ["President", 0],
      ["Min. of Finance", 1],
    ],
  );
});

test("Bosnia-only title rules do not reclassify matching titles elsewhere", () => {
  assert.equal(
    classifyPosition("Presidency Member (Bosniak)", "elsewhere"),
    "other",
  );
  assert.equal(
    classifyPosition("Chmn., Council of Ministers", "elsewhere"),
    "cabinet",
  );
});
