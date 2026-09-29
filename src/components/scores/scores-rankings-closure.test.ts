/**
 * Closure test for the country Rankings table (CLM-020,
 * publisher-attribution/v1). `scores-rankings.test.ts` checks what the
 * current rows look like; this file checks that the rendered view holds those
 * rows and nothing else. A row, cell, caption, sibling, attribute, or number
 * added to the view fails here even when it prints no "/100" and reads no
 * registered field, which the static scan cannot see.
 *
 * Every string a reader sees or hears must come from a checked score row:
 *   - one table, holding the header row group and one body row per score
 *     row, each with exactly the Measure, Value, and Observation-year cells;
 *   - the Measure cell reads the row's label plus the row's release Chip;
 *   - the Value cell reads exactly `row.scoreFormatted`, which must pass the
 *     publisher-attribution value check against the publisher's own figure,
 *     plus the row's ValueOriginNote;
 *   - the Observation-year cell reads exactly `row.observationPeriod` plus
 *     the row's SourceDot;
 *   - nothing outside the table carries text or an accessible name.
 * The ValueOriginNote and SourceDot must render exactly as they do with the
 * row's own props, and the Chip may carry only the row's release label and
 * its accessible name.
 *
 * The checker proves itself first: seeded edits of the rendered markup,
 * including the unmarked "Freedom House score 83" row a review added, must
 * each fail. Not Index change-control evidence: this file can change without
 * a new record.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { HTMLElement, NodeType, parse, type Node } from "node-html-parser";

import { SourceDot } from "@/components/SourceDot";
import { ValueOriginNote } from "@/components/provenance/ValueOriginNote";
import {
  shapeFreedomHouseScoreRow,
  shapeVdemScoreRow,
  type ScoreRow,
} from "@/lib/ci/publisher-scores";
import {
  numericTokens,
  publisherAttributionErrors,
  scoreRowAttributionErrors,
} from "@/lib/provenance/publisher-attribution-check";

import { ScoresAndRankingsView } from "./ScoresAndRankings";
import { scoreFreshnessPresentation } from "./freshness-label";

interface CheckedRow {
  row: ScoreRow;
  /** The publisher's own figure: V-Dem's value, or Freedom House's PR+CL sum. */
  publisherFigure: number;
}

const vdem = (value: number): CheckedRow => ({
  row: shapeVdemScoreRow(value),
  publisherFigure: value,
});
const freedomHouse = (sum: number): CheckedRow => ({
  row: shapeFreedomHouseScoreRow(sum),
  publisherFigure: sum,
});

const HEADERS = ["Measure", "Value", "Observation year"];

/** Attributes that carry no text a reader sees or hears. */
const SILENT_ATTRIBUTES = new Set(["class", "style", "scope"]);

function renderView(rows: readonly ScoreRow[], countryName: string): string {
  return renderToStaticMarkup(createElement(ScoresAndRankingsView, { rows, countryName }));
}

function isElement(node: Node): node is HTMLElement {
  return node.nodeType === NodeType.ELEMENT_NODE;
}

/** Child nodes, without whitespace-only text. */
function significantChildren(node: HTMLElement): Node[] {
  return node.childNodes.filter((child) => isElement(child) || child.text.trim() !== "");
}

function tagOf(node: Node): string {
  return isElement(node) ? node.rawTagName.toLowerCase() : `text "${node.text.trim()}"`;
}

function collapse(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/**
 * Expected attributes must carry their values; any other attribute must be
 * silent (class, style, scope).
 */
function attributeErrors(
  element: HTMLElement,
  where: string,
  expected: Readonly<Record<string, string>> = {},
): string[] {
  const errors: string[] = [];
  const attributes = element.attributes;
  for (const [name, value] of Object.entries(attributes)) {
    if (name in expected) {
      if (value !== expected[name]) {
        errors.push(`${where} ${name} reads "${value}"; expected "${expected[name]}"`);
      }
    } else if (!SILENT_ATTRIBUTES.has(name)) {
      errors.push(`${where} carries ${name}="${value}"`);
    }
  }
  for (const name of Object.keys(expected)) {
    if (!(name in attributes)) errors.push(`${where} lost its ${name}`);
  }
  return errors;
}

/**
 * A primitive a cell must hold: the exact markup the primitive renders with
 * the row's props, or a check that returns errors.
 */
type ExpectedPrimitive = string | ((element: HTMLElement) => string[]);

/**
 * A cell holds text plus its primitives, in order, and nothing else.
 * Returns the cell's own text, without the primitives' text.
 */
function cellErrors(
  markup: string,
  cell: HTMLElement,
  where: string,
  expectedText: string,
  expectedPrimitives: readonly ExpectedPrimitive[],
  expectedAttributes: Readonly<Record<string, string>> = {},
): { errors: string[]; text: string } {
  const errors = attributeErrors(cell, where, expectedAttributes);
  let text = "";
  let next = 0;
  for (const child of cell.childNodes) {
    if (!isElement(child)) {
      text += child.text;
      continue;
    }
    const expected = expectedPrimitives[next];
    next += 1;
    const childMarkup = markup.slice(child.range[0], child.range[1]);
    if (typeof expected === "function") {
      errors.push(...expected(child));
    } else if (childMarkup !== expected) {
      errors.push(`${where} holds markup its checked row does not produce: ${childMarkup.slice(0, 160)}`);
    }
  }
  if (next < expectedPrimitives.length) {
    errors.push(`${where} is missing ${expectedPrimitives.length - next} of its primitives`);
  }
  text = collapse(text);
  if (text !== expectedText) errors.push(`${where} reads "${text}"; expected "${expectedText}"`);
  return { errors, text };
}

function rowErrors(markup: string, tr: HTMLElement, checked: CheckedRow): string[] {
  const { row, publisherFigure } = checked;
  const where = `row ${row.id}`;
  const errors = attributeErrors(tr, where);
  const cells = significantChildren(tr);
  const tags = cells.map(tagOf);
  if (tags.join(",") !== "th,td,td") {
    errors.push(`${where} has cells ${tags.join(", ")}; expected th, td, td`);
    return errors;
  }
  const [measure, value, observation] = cells as HTMLElement[];
  const freshness = scoreFreshnessPresentation(row);
  // The Chip's styling is silent; its words and accessible name must be the
  // row's Civica-release clock and nothing else.
  const chip = (element: HTMLElement): string[] => {
    const errors = attributeErrors(element, `${where} release chip`, {
      "aria-label": freshness.ariaLabel,
    });
    if (element.rawTagName !== "span" || element.childNodes.some(isElement)) {
      errors.push(`${where} release chip is not a plain Chip`);
    }
    if (collapse(element.text) !== freshness.label) {
      errors.push(`${where} release chip reads "${collapse(element.text)}"; expected "${freshness.label}"`);
    }
    return errors;
  };
  const note = renderToStaticMarkup(createElement(ValueOriginNote, { origin: row.valueOrigin }));
  const dot = renderToStaticMarkup(
    createElement(SourceDot, {
      source: row.source,
      retrievedAt: row.retrievedAt,
      upstreamVintage: `${row.publisherEdition}, ${row.observationPeriodLabel}`,
    }),
  );

  errors.push(
    ...cellErrors(markup, measure, `${where} Measure cell`, row.label, [chip], { scope: "row" })
      .errors,
  );
  const valueCell = cellErrors(
    markup,
    value,
    `${where} Value cell`,
    row.scoreFormatted,
    note ? [note] : [],
  );
  errors.push(...valueCell.errors);
  // The rendered value, not the row field, goes through the value check, so
  // the report names any number the cell added.
  errors.push(
    ...publisherAttributionErrors({
      surfaceId: `${where} Value cell`,
      valueText: valueCell.text.replace(row.publisherEdition, ""),
      origin: row.valueOrigin,
      publisherFigures: [publisherFigure],
      markerRendered: value.querySelector('[data-value-origin="civica_calculation"]') !== null,
    }),
    ...scoreRowAttributionErrors(row, publisherFigure),
  );
  errors.push(
    ...cellErrors(markup, observation, `${where} Observation-year cell`, row.observationPeriod, [
      dot,
    ]).errors,
  );
  return errors;
}

/** Everything the view renders must come from `checked`; [] is a pass. */
function rankingsClosureErrors(
  markup: string,
  checked: readonly CheckedRow[],
  countryName: string,
): string[] {
  const root = parse(markup);
  const tables = root.querySelectorAll("table");
  if (tables.length !== 1) return [`the view renders ${tables.length} tables; expected 1`];
  const [table] = tables;
  const errors: string[] = [];

  const outside = (node: Node): void => {
    if (node === table) return;
    if (!isElement(node)) {
      if (node.text.trim()) errors.push(`text outside the table: "${collapse(node.text)}"`);
      return;
    }
    if (node !== root) errors.push(...attributeErrors(node, `<${node.rawTagName}> outside the table`));
    for (const child of node.childNodes) outside(child);
  };
  outside(root);

  errors.push(
    ...attributeErrors(table, "the table", {
      "aria-label": `Publisher measures for ${countryName}`,
    }),
  );
  const groups = significantChildren(table);
  if (groups.map(tagOf).join(",") !== "thead,tbody") {
    errors.push(`the table holds ${groups.map(tagOf).join(", ")}; expected thead, tbody`);
    return errors;
  }
  const [thead, tbody] = groups as HTMLElement[];
  errors.push(...attributeErrors(thead, "the table head"), ...attributeErrors(tbody, "the table body"));

  const headRows = significantChildren(thead);
  const headerCells = headRows.length === 1 && isElement(headRows[0]) ? significantChildren(headRows[0]) : [];
  const headers = headerCells.map((cell) => (isElement(cell) ? collapse(cell.text) : tagOf(cell)));
  if (
    headRows.length !== 1 ||
    headerCells.some((cell) => !isElement(cell) || cell.rawTagName !== "th") ||
    headers.join("|") !== HEADERS.join("|")
  ) {
    errors.push(`the header row reads ${headers.join(" | ") || "nothing"}; expected ${HEADERS.join(" | ")}`);
  }
  for (const cell of headerCells) {
    if (isElement(cell)) {
      errors.push(...attributeErrors(cell, `header "${collapse(cell.text)}"`, { scope: "col" }));
    }
  }

  const bodyRows = significantChildren(tbody);
  if (bodyRows.length !== checked.length) {
    errors.push(
      `the table body has ${bodyRows.length} rows; expected one per score row (${checked.length})`,
    );
  }
  bodyRows.forEach((tr, index) => {
    if (!isElement(tr) || tr.rawTagName !== "tr") {
      errors.push(`the table body holds ${tagOf(tr)}`);
      return;
    }
    const expected = checked[index];
    if (!expected) {
      const cells = significantChildren(tr).map((cell) => collapse(cell.text));
      errors.push(`body row ${index + 1} has no checked score row: ${cells.join(" | ")}`);
      return;
    }
    errors.push(...rowErrors(markup, tr, expected));
  });
  return errors;
}

const ROW_SETS: ReadonlyArray<{ countryName: string; checked: CheckedRow[] }> = [
  { countryName: "Uruguay", checked: [vdem(0.769), freedomHouse(2)] },
  { countryName: "Hungary", checked: [vdem(0.318), freedomHouse(7)] },
  { countryName: "China", checked: [vdem(0.036), freedomHouse(14)] },
  // Monaco's release row uses the WGI fallback, so it has no V-Dem row.
  { countryName: "Monaco", checked: [freedomHouse(3)] },
  { countryName: "Côte d'Ivoire", checked: [vdem(0), freedomHouse(8)] },
  { countryName: "Fixture", checked: [vdem(1)] },
  // Every Freedom House sum, including each status-rule boundary.
  ...Array.from({ length: 13 }, (_, index) => ({
    countryName: `Sum ${index + 2}`,
    checked: [vdem(index / 12), freedomHouse(index + 2)],
  })),
];

const URUGUAY = ROW_SETS[0];
const URUGUAY_RULE_NOTE = renderToStaticMarkup(
  createElement(ValueOriginNote, { origin: shapeFreedomHouseScoreRow(2).valueOrigin }),
);

/** Edits a reviewer or a regression could make; each must fail the check. */
const SEEDED_EDITS: ReadonlyArray<{ label: string; edit: (markup: string) => string }> = [
  {
    label: "an unmarked Freedom House score row with no scale (the review regression)",
    edit: (markup) =>
      markup.replace(
        "</tbody>",
        '<tr><th scope="row">Freedom House score</th><td>83</td><td class="num">2023</td></tr></tbody>',
      ),
  },
  {
    label: "a fourth cell with a Civica rank",
    edit: (markup) => markup.replace("</td></tr>", "</td><td>17 / 170</td></tr>"),
  },
  {
    label: "a Civica rank beside the V-Dem value",
    edit: (markup) => markup.replace("<td>0.769</td>", "<td>0.769 (rank 17 of 170)</td>"),
  },
  {
    label: "a Civica position beside the Freedom House status",
    edit: (markup) =>
      markup.replace(
        "Free · Freedom in the World 2024<span",
        "Free · Freedom in the World 2024 (100/100)<span",
      ),
  },
  {
    label: "a number in a measure label",
    edit: (markup) =>
      markup.replace("V-Dem Liberal Democracy Index <span", "V-Dem Liberal Democracy Index (17th) <span"),
  },
  {
    label: "a Civica rank in a release chip",
    edit: (markup) =>
      markup.replace(">Civica release · 2024 Q4</span>", ">Civica release · 2024 Q4 · rank 17</span>"),
  },
  {
    label: "a caption with a Civica rank",
    edit: (markup) => markup.replace("<thead>", "<caption>Global rank 17 / 170</caption><thead>"),
  },
  {
    label: "a second body row group",
    edit: (markup) =>
      markup.replace(
        "</tbody>",
        '</tbody><tbody><tr><th scope="row">Rank</th><td>17</td><td class="num">2024</td></tr></tbody>',
      ),
  },
  {
    label: "a paragraph beside the table",
    edit: (markup) => markup.replace("</table>", "</table><p>Freedom House: 83</p>"),
  },
  {
    label: "a sibling after the view",
    edit: (markup) => `${markup}<p>Freedom House: 83</p>`,
  },
  {
    label: "a tooltip on the Freedom House value",
    edit: (markup) => markup.replace("<td>Free ·", '<td title="100/100">Free ·'),
  },
  {
    label: "a number in the table's accessible name",
    edit: (markup) =>
      markup.replace(
        'aria-label="Publisher measures for Uruguay"',
        'aria-label="Publisher measures for Uruguay, ranked 17 of 170"',
      ),
  },
  {
    label: "a SourceDot naming a different coverage year",
    edit: (markup) => markup.replace("covering calendar year 2023;", "covering 2024;"),
  },
  {
    label: "a Civica-calculation marker in place of the rule note",
    edit: (markup) =>
      markup.replace(
        'data-value-origin="publisher_rule_applied"',
        'data-value-origin="civica_calculation"',
      ),
  },
  {
    label: "the rule note removed from the Freedom House value",
    edit: (markup) => markup.replace(URUGUAY_RULE_NOTE, ""),
  },
];

test("the closure check fails on every seeded edit of the Rankings table", () => {
  const markup = renderView(
    URUGUAY.checked.map(({ row }) => row),
    URUGUAY.countryName,
  );
  assert.deepEqual(rankingsClosureErrors(markup, URUGUAY.checked, URUGUAY.countryName), []);
  for (const { label, edit } of SEEDED_EDITS) {
    const edited = edit(markup);
    assert.notEqual(edited, markup, `seeded edit "${label}" did not change the markup`);
    const errors = rankingsClosureErrors(edited, URUGUAY.checked, URUGUAY.countryName);
    assert.ok(errors.length > 0, `seeded edit "${label}" passed the closure check`);
  }
  const regression = rankingsClosureErrors(
    SEEDED_EDITS[0].edit(markup),
    URUGUAY.checked,
    URUGUAY.countryName,
  );
  assert.ok(
    regression.includes("the table body has 3 rows; expected one per score row (2)"),
    regression.join("\n"),
  );
  assert.match(
    rankingsClosureErrors(SEEDED_EDITS[2].edit(markup), URUGUAY.checked, URUGUAY.countryName).join(
      "\n",
    ),
    /shows 17, which is not the publisher's own figure \(0\.769\)/,
  );
});

test("the Rankings table renders its checked rows and nothing else", () => {
  for (const { countryName, checked } of ROW_SETS) {
    const markup = renderView(
      checked.map(({ row }) => row),
      countryName,
    );
    assert.deepEqual(rankingsClosureErrors(markup, checked, countryName), [], countryName);
  }
});

test("the empty Rankings state prints no number", () => {
  const markup = renderView([], "Kosovo");
  const root = parse(markup);
  const nodes = significantChildren(root);
  assert.equal(nodes.length, 1);
  const [paragraph] = nodes;
  assert.ok(isElement(paragraph));
  assert.equal(paragraph.rawTagName, "p");
  assert.deepEqual(attributeErrors(paragraph, "the empty state"), []);
  assert.equal(
    collapse(paragraph.text),
    "Civica's frozen release holds no V-Dem or Freedom House row for Kosovo. This is a coverage state, not a judgment about the country.",
  );
  assert.deepEqual(numericTokens(paragraph.text), []);
});
