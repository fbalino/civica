import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { LegislatureChamber } from "@/lib/factbook/legislature";
import {
  attributeSeats,
  UNATTRIBUTED_SEAT_LABEL,
} from "@/lib/legislatures/seat-attribution";
import { FactbookLegislatureChart } from "./FactbookLegislatureChart";

function chamber(
  id: string,
  total: number,
  parties: Array<[string, string, number]>,
): LegislatureChamber {
  return {
    id,
    slot: "upper",
    name: `Test chamber ${total}`,
    total,
    sub: `${total} seats`,
    parties: parties.map(([partyId, name, seats]) => ({
      id: partyId,
      name,
      seats,
      color: `var(--test-${partyId})`,
    })),
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

function count(markup: string, pattern: RegExp): number {
  return markup.match(new RegExp(pattern.source, "g"))?.length ?? 0;
}

// Counted by the painted colour, so a seat painted in a party's colour counts
// for that party whatever other attributes it carries.
const partySeats = (markup: string, partyId: string) =>
  count(markup, new RegExp(`<circle [^>]*fill="var\\(--test-${partyId}\\)"`));
const unattributedSeats = (markup: string) =>
  count(markup, /data-seat-state="unattributed"/);
const allSeats = (markup: string) =>
  count(markup, /<circle [^>]*class="factbook-legislature-seat/);

function description(markup: string): string {
  return markup.match(/<desc [^>]*>([^<]*)<\/desc>/)?.[1] ?? "";
}

// Uruguay's Senate shape: 30 party seats in a 31-seat chamber; the 31st seat
// (the Vice President, who presides) has no party row.
const uruguaySenate = chamber("uy-senate", 31, [
  ["frente-amplio", "Frente Amplio", 16],
  ["partido-nacional", "Partido Nacional", 9],
  ["partido-colorado", "Partido Colorado", 5],
]);

test("an unreported seat is drawn unattributed, not in the smallest party's colour", () => {
  const markup = renderChart(uruguaySenate);
  assert.equal(allSeats(markup), 31);
  assert.equal(partySeats(markup, "frente-amplio"), 16);
  assert.equal(partySeats(markup, "partido-nacional"), 9);
  assert.equal(partySeats(markup, "partido-colorado"), 5);
  assert.equal(unattributedSeats(markup), 1);
  // The unattributed seat takes the design-system state class, not a colour.
  assert.match(
    markup,
    /class="factbook-legislature-seat factbook-legislature-seat--unattributed"/,
  );
});

test("the key and accessible description count unattributed seats", () => {
  const markup = renderChart(uruguaySenate);
  assert.match(
    markup,
    /<p class="factbook-legislature-key">.*No party reported · 1 seat<\/p>/,
  );
  assert.match(description(markup), /Partido Colorado, 5 seats; No party reported, 1 seat\./);
});

test("a chamber whose party rows fill every seat has no unattributed state", () => {
  const markup = renderChart(
    chamber("full", 99, [
      ["alpha", "Alpha", 48],
      ["beta", "Beta", 42],
      ["gamma", "Gamma", 9],
    ]),
  );
  assert.equal(allSeats(markup), 99);
  assert.equal(partySeats(markup, "gamma"), 9);
  assert.equal(unattributedSeats(markup), 0);
  assert.doesNotMatch(markup, /No party reported/);
  assert.doesNotMatch(markup, /factbook-legislature-key/);
});

test("party rows above the chamber total draw no extra seats and say so", () => {
  // Solomon Islands shape: party rows add up to 54 in a 50-seat chamber.
  const over = chamber("over", 50, [
    ["alpha", "Alpha", 30],
    ["beta", "Beta", 20],
    ["gamma", "Gamma", 4],
  ]);
  const markup = renderChart(over);
  assert.equal(allSeats(markup), 50);
  assert.equal(partySeats(markup, "alpha"), 30);
  assert.equal(partySeats(markup, "beta"), 20);
  assert.equal(partySeats(markup, "gamma"), 0);
  assert.equal(unattributedSeats(markup), 0);
  assert.doesNotMatch(markup, /factbook-legislature-key/);
  assert.match(
    description(markup),
    /The party rows add up to 54 seats, more than the chamber&#x27;s 50; the drawing shows 50 seats\./,
  );
});

test("a chamber with no party rows is drawn fully unattributed", () => {
  const markup = renderChart(chamber("no-parties", 46, []));
  assert.equal(allSeats(markup), 46);
  assert.equal(unattributedSeats(markup), 46);
  assert.match(markup, /No party reported · 46 seats/);
});

test("attributeSeats never invents or drops seats", () => {
  const parties = [
    { id: "a", name: "A", color: "var(--a)", seats: 16 },
    { id: "b", name: "B", color: "var(--b)", seats: 9 },
    { id: "c", name: "C", color: "var(--c)", seats: 5 },
  ];
  const under = attributeSeats(31, parties);
  assert.equal(under.seats.length, 31);
  assert.equal(under.attributedSeats, 30);
  assert.equal(under.unattributedSeats, 1);
  assert.equal(under.excessPartySeats, 0);
  assert.deepEqual(under.seats[30], { kind: "unattributed" });

  const exact = attributeSeats(30, parties);
  assert.equal(exact.unattributedSeats, 0);
  assert.equal(exact.excessPartySeats, 0);

  const over = attributeSeats(25, parties);
  assert.equal(over.seats.length, 25);
  assert.equal(over.unattributedSeats, 0);
  assert.equal(over.reportedPartySeats, 30);
  assert.equal(over.excessPartySeats, 5);
  assert.equal(over.seats.filter((s) => s.kind === "party" && s.id === "c").length, 0);

  const malformed = attributeSeats(4.8, [
    { id: "a", name: "A", color: "var(--a)", seats: -3 },
    { id: "b", name: "B", color: "var(--b)", seats: Number.NaN },
    { id: "c", name: "C", color: "var(--c)", seats: 2.9 },
  ]);
  assert.equal(malformed.seats.length, 4);
  assert.equal(malformed.attributedSeats, 2);
  assert.equal(malformed.unattributedSeats, 2);

  assert.equal(attributeSeats(0, parties).seats.length, 0);
  assert.equal(UNATTRIBUTED_SEAT_LABEL, "No party reported");
});
