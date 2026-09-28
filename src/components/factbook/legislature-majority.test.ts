import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { ChamberCoalition } from "@/lib/db/queries-legislature";
import type { LegislatureChamber } from "@/lib/factbook/legislature";
import { ChamberComposition } from "./ChamberComposition";
import { FactbookLegislatureChart } from "./FactbookLegislatureChart";

function chamber(
  id: string,
  total: number,
  parties: Array<[string, number]>,
): LegislatureChamber {
  return {
    id,
    slot: "lower",
    name: `Test chamber ${total}`,
    total,
    sub: `${total} seats`,
    parties: parties.map(([name, seats], index) => ({
      id: `${id}-party-${index}`,
      name,
      seats,
      color: "var(--color-accent)",
    })),
  };
}

function coalition(bodyId: string, seats: number): ChamberCoalition {
  return {
    bodyId,
    coalitionSeats: seats,
    coalitionPartyCount: 1,
    coalitionPartyNames: ["alpha"],
  };
}

function renderChart(target: LegislatureChamber): string {
  return renderToStaticMarkup(
    createElement(FactbookLegislatureChart, {
      chamber: target,
      houseLabel: "Upper house",
      countryName: "Testland",
    }),
  );
}

function statValue(markup: string, key: string): string | null {
  const match = markup.match(
    new RegExp(
      `factbook-legislature-stat-key">${key}</div><div class="factbook-legislature-stat-val">([^<]*)</div>`,
    ),
  );
  return match?.[1] ?? null;
}

function compositionCell(markup: string, key: string): string | null {
  const match = markup.match(
    new RegExp(
      `chamber-comp-conc-key">${key}</span><span class="chamber-comp-conc-val">([^<]*)</span>`,
    ),
  );
  return match?.[1] ?? null;
}

const senate31 = chamber("senate-31", 31, [
  ["Alpha", 16],
  ["Beta", 13],
  ["Gamma", 2],
]);
const house99 = chamber("house-99", 99, [
  ["Alpha", 48],
  ["Beta", 42],
  ["Gamma", 9],
]);

test("the hemicycle renders the absolute majority for an odd 31-seat chamber", () => {
  const markup = renderChart(senate31);
  assert.equal(statValue(markup, "Majority line"), "16");
  assert.match(markup, />MAJORITY 16<\/text>/);
  assert.equal(compositionCell(markup, "Majority line"), "16");
});

test("the hemicycle renders the absolute majority for an odd 99-seat chamber", () => {
  const markup = renderChart(house99);
  assert.equal(statValue(markup, "Majority line"), "50");
  assert.match(markup, />MAJORITY 50<\/text>/);
  assert.equal(compositionCell(markup, "Majority line"), "50");
});

test("a coalition at exactly the absolute majority holds a working majority", () => {
  const markup = renderToStaticMarkup(
    createElement(ChamberComposition, {
      chamber: senate31,
      coalition: coalition(senate31.id, 16),
    }),
  );
  assert.match(markup, /Majority line at 16\./);
  assert.match(markup, />Working majority</);
  assert.doesNotMatch(markup, /No single-bloc majority/);
  // The tick sits at 16 / 31 of the bar.
  assert.match(markup, /chamber-comp-bar-maj" style="left:51\.61%"/);
  assert.equal(compositionCell(markup, "Majority line"), "16");
});

test("a coalition one seat short of the absolute majority has no majority", () => {
  const markup = renderToStaticMarkup(
    createElement(ChamberComposition, {
      chamber: senate31,
      coalition: coalition(senate31.id, 15),
    }),
  );
  assert.match(markup, /Majority line at 16\./);
  assert.match(markup, />No single-bloc majority</);
  assert.doesNotMatch(markup, /Working majority/);
});

test("an empty chamber total shows the missing-value fallback, not a threshold", () => {
  const markup = renderChart(chamber("empty", 0, []));
  assert.equal(statValue(markup, "Majority line"), "—");
  assert.doesNotMatch(markup, /MAJORITY/);
});

test("a non-integer chamber total omits the composition majority line", () => {
  // Only ChamberComposition is rendered here: the hemicycle seat layout
  // assumes an integer total and is never given a fractional one.
  const markup = renderToStaticMarkup(
    createElement(ChamberComposition, {
      chamber: chamber("fractional", 30.5, [["Alpha", 16]]),
      coalition: coalition("fractional", 16),
    }),
  );
  assert.equal(compositionCell(markup, "Majority line"), "—");
  assert.doesNotMatch(markup, /Majority line at/);
  assert.doesNotMatch(markup, /chamber-comp-bar-maj/);
});
