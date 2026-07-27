import assert from "node:assert/strict";
import test from "node:test";

import { spreadsheetSafeCsvCell } from "./csv";

test("CSV cells neutralize spreadsheet formula prefixes", () => {
  for (const fixture of [
    '=HYPERLINK("https://attacker.test")',
    "+cmd|' /C calc'!A0",
    "-cmd",
    "@SUM(1,2)",
    "\t=1+1",
    "\r=1+1",
    "\n=1+1",
    "  =1+1",
    "\uFEFF=1+1",
    "＝1+1",
    "＋1+1",
    "－1+1",
    "＠SUM(1,2)",
  ]) {
    const cell = spreadsheetSafeCsvCell(fixture);
    const unquoted = cell.startsWith('"')
      ? cell.slice(1, -1).replaceAll('""', '"')
      : cell;
    assert.ok(unquoted.startsWith("'"), fixture);
  }
});

test("CSV cells retain real numeric negatives and quote delimiters", () => {
  assert.equal(spreadsheetSafeCsvCell(-12.5), "-12.5");
  assert.equal(spreadsheetSafeCsvCell("ordinary"), "ordinary");
  assert.equal(spreadsheetSafeCsvCell("a,b"), '"a,b"');
  assert.equal(spreadsheetSafeCsvCell('a"b'), '"a""b"');
});

test("alternate spreadsheet delimiters cannot expose a later formula cell", () => {
  for (const fixture of [
    "label;=1+1",
    "label\t+2+2",
    "label,@SUM(1,2)",
    "label;  ＝1+1",
  ]) {
    const encoded = spreadsheetSafeCsvCell(fixture);
    const unquoted = encoded.startsWith('"')
      ? encoded.slice(1, -1).replaceAll('""', '"')
      : encoded;
    assert.doesNotMatch(
      unquoted,
      /(^|[,;\t])[\uFEFF\u0009\u000A\u000D ]*[=+\-@\uFF1D\uFF0B\uFF0D\uFF20]/u,
      fixture,
    );
  }
});
