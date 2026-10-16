/**
 * The Chip carries all of its styling in `.ui-chip*` classes (editorial.css),
 * never in inline style objects, so repeated chips stay small in cached page
 * HTML and the React payload.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { BetaChip } from "@/components/editorial/BetaChip";
import { Chip, Pill } from "@/components/editorial/Pill";

const css = readFileSync(new URL("../../app/editorial.css", import.meta.url), "utf8");

test("every tone and legacy variant renders classes only", () => {
  const cases: Array<[Parameters<typeof Chip>[0]["variant"], string]> = [
    ["neutral", "neutral"],
    ["default", "neutral"],
    ["sage", "sage"],
    ["success", "sage"],
    ["sand", "sand"],
    ["warn", "sand"],
    ["rose", "rose"],
    ["danger", "rose"],
    ["blue", "blue"],
    ["info", "blue"],
    ["accent", "accent"],
  ];
  for (const [variant, tone] of cases) {
    const html = renderToStaticMarkup(Chip({ variant, children: "x" }));
    assert.equal(html, `<span class="ui-chip ui-chip--${tone}">x</span>`);
    if (tone !== "neutral") {
      assert.match(css, new RegExp(`\\.ui-chip--${tone}\\b`), `${tone} is styled in editorial.css`);
    }
  }
});

test("medium size, custom class, and accessible props are forwarded", () => {
  const html = renderToStaticMarkup(
    Pill({
      size: "md",
      className: "extra",
      title: "t",
      "aria-label": "a",
      children: "x",
    }),
  );
  assert.equal(
    html,
    '<span class="ui-chip ui-chip--neutral ui-chip--md extra" aria-label="a" title="t">x</span>',
  );
});

test("BetaChip uses modifiers instead of style overrides", () => {
  assert.equal(
    renderToStaticMarkup(BetaChip({ inHeading: true })),
    '<span class="ui-chip ui-chip--sand ui-chip--heading-inline">Beta</span>',
  );
  assert.equal(
    renderToStaticMarkup(BetaChip({ className: "ui-chip--header-tag" })),
    '<span class="ui-chip ui-chip--sand ui-chip--header-tag">Beta</span>',
  );
});
