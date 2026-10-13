/**
 * A legend-scoped SourceDot must expose exactly the provenance a
 * self-contained SourceDot carries: the shared description holds the same
 * accessible text and the same tooltip attributes, and every dot resolves to
 * a description rendered beside it.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { createElement, Fragment } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { parse } from "node-html-parser";

import { SourceDot, SourceDotLegend } from "@/components/SourceDot";

const TOOLTIP_ATTRIBUTES = [
  "data-source",
  "data-state",
  "data-date",
  "data-vintage",
  "data-rights",
];

test("legend-scoped dots carry the same provenance as self-contained dots", () => {
  const input = { source: "cia_factbook", retrievedAt: "2026-01-23" };
  const standalone = parse(
    renderToStaticMarkup(createElement(SourceDot, input)),
  ).querySelector(".source-dot")!;

  const html = renderToStaticMarkup(
    createElement(
      Fragment,
      null,
      createElement(SourceDotLegend, { scope: "geography", dots: [input, input] }),
      createElement(SourceDot, { ...input, legendScope: "geography" }),
      createElement(SourceDot, { ...input, legendScope: "geography" }),
    ),
  );
  const root = parse(html);
  const dots = root.querySelectorAll(".source-dot");
  const descriptions = root.querySelectorAll("[hidden]");

  assert.equal(descriptions.length, 1, "one description per distinct disclosure");
  assert.equal(dots.length, 2);
  for (const dot of dots) {
    assert.equal(dot.getAttribute("class"), standalone.getAttribute("class"));
    assert.equal(dot.getAttribute("role"), "img");
    assert.equal(dot.getAttribute("tabindex"), "0");
    const id = dot.getAttribute("aria-labelledby");
    assert.ok(id, "dot references its shared description");
    const description = root.querySelector(`[id="${id}"]`);
    assert.ok(description, "the referenced description is rendered");
    assert.equal(description.textContent, standalone.getAttribute("aria-label"));
    for (const name of TOOLTIP_ATTRIBUTES) {
      assert.equal(description.getAttribute(name), standalone.getAttribute(name), name);
    }
  }
});

test("distinct disclosures and scopes get distinct descriptions", () => {
  const html = renderToStaticMarkup(
    createElement(
      Fragment,
      null,
      createElement(SourceDotLegend, {
        scope: "a",
        dots: [
          { source: "cia_factbook", retrievedAt: "2026-01-23" },
          { source: "world_bank", retrievedAt: "2026-06-01" },
        ],
      }),
      createElement(SourceDotLegend, {
        scope: "b",
        dots: [{ source: "cia_factbook", retrievedAt: "2026-01-23" }],
      }),
    ),
  );
  const ids = parse(html)
    .querySelectorAll("[hidden]")
    .map((node) => node.getAttribute("id"));
  assert.equal(ids.length, 3);
  assert.equal(new Set(ids).size, 3);
});
