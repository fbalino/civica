import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const ROOT = path.join(process.cwd(), "src");
const STACK_TOKENS = [
  "--z-base",
  "--z-rule",
  "--z-sticky",
  "--z-popover",
  "--z-tooltip",
  "--z-overlay-backdrop",
  "--z-overlay",
  "--z-modal-backdrop",
  "--z-modal",
  "--z-toast",
] as const;

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      return target.includes(`${path.sep}lib${path.sep}api`)
        ? []
        : sourceFiles(target);
    }
    return /\.(?:css|ts|tsx)$/.test(entry.name) ? [target] : [];
  });
}

test("EXP-024: the design system documents a strictly ordered shared layer scale", () => {
  const globals = readFileSync(path.join(ROOT, "app/globals.css"), "utf8");
  const designSystem = readFileSync(
    path.join(ROOT, "app/design-system/page.tsx"),
    "utf8",
  );

  const values = STACK_TOKENS.map((token) => {
    const match = globals.match(new RegExp(`${token}:\\s*(\\d+)`));
    assert.ok(match, `missing ${token} in globals.css`);
    assert.match(designSystem, new RegExp(`token: "${token}"`));
    return Number(match[1]);
  });

  assert.deepEqual([...values].sort((a, b) => a - b), values);
});

test("EXP-024: document-level stacking uses named tokens instead of raw high z-index values", () => {
  const rawLayers: string[] = [];
  const rawZIndex = /(?:z-index|zIndex)\s*:\s*(\d+)/g;

  for (const file of sourceFiles(ROOT)) {
    const source = readFileSync(file, "utf8");
    for (const match of source.matchAll(rawZIndex)) {
      if (Number(match[1]) > 12) {
        rawLayers.push(`${path.relative(process.cwd(), file)}: ${match[0]}`);
      }
    }
  }

  assert.deepEqual(rawLayers, []);
});

test("EXP-024: representative layers bind to their documented roles", () => {
  const requiredBindings = [
    ["src/components/SiteHeader.tsx", "var(--z-sticky)"],
    ["src/components/editorial/SingleSelectMenu.tsx", "var(--z-popover)"],
    ["src/components/editorial/Tooltip.tsx", "editorial-tooltip"],
    ["src/components/factbook/FactbookLightbox.tsx", "var(--z-modal)"],
    ["src/components/factbook/FactValueDot.tsx", "var(--z-overlay)"],
    ["src/app/factbook.css", "z-index: var(--z-modal)"],
  ] as const;

  for (const [relativePath, binding] of requiredBindings) {
    const source = readFileSync(path.join(process.cwd(), relativePath), "utf8");
    assert.match(source, new RegExp(binding.replaceAll("(", "\\(").replaceAll(")", "\\)")));
  }

  const tooltipStyles = readFileSync(
    path.join(ROOT, "app/editorial.css"),
    "utf8",
  );
  assert.match(
    tooltipStyles,
    /\.editorial-tooltip\s*\{[^}]*z-index:\s*var\(--z-tooltip\)/,
  );
});
