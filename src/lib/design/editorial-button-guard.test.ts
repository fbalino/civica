import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * EXP-040 regression guard. `.editorial-section a` is a class+type selector,
 * so without an explicit `:not(.btn)` exclusion it outspecifies `.btn--primary`
 * and recolors canonical button text to the accent (red text on the navy
 * primary). The token ratchet cannot catch this class of drift because every
 * value involved is a token; this source-level check can.
 */
const css = readFileSync(join(process.cwd(), "src/app/editorial.css"), "utf8");

test("editorial prose anchor rules exclude .btn", () => {
  // Every `.editorial-section a…` selector must carry the :not(.btn) guard.
  const selectors = css.match(/\.editorial-section a[^{,]*(?=[,{])/g) ?? [];
  assert.ok(selectors.length >= 2, "expected the prose anchor rules to exist");
  for (const selector of selectors) {
    assert.match(
      selector,
      /:not\(\s*\.btn\s*\)/,
      `unguarded prose anchor selector recolors buttons: "${selector.trim()}"`,
    );
  }
});

test("no other shared editorial scope colors bare anchors", () => {
  // New prose scopes must not reintroduce the same leak under another name.
  // Link-only components (breadcrumbs, pagination, warnings, empty states)
  // are allowlisted: anchors there ARE the component and buttons never nest
  // inside them. A new scope must either carry :not(.btn) or be consciously
  // added here.
  const LINK_ONLY_SCOPES =
    /breadcrumbs|pagination|warning|empty|caption-link|footer-nav/;
  const offenders = (
    css.match(/\.(editorial|methodology)[\w-]* a(?![\w-])[^{,]*(?=[,{])/g) ?? []
  ).filter(
    (selector) =>
      !/:not\(\s*\.btn\s*\)/.test(selector) && !LINK_ONLY_SCOPES.test(selector),
  );
  assert.deepEqual(
    offenders.map((selector) => selector.trim()),
    [],
    "guard these selectors with :not(.btn) or allowlist them as link-only",
  );
});
