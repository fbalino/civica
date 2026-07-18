import assert from "node:assert/strict";
import test from "node:test";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";

function walkFiles(dir: string, exts: string[]): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkFiles(full, exts));
    else if (exts.some((ext) => entry.name.endsWith(ext))) out.push(full);
  }
  return out;
}

const NATIVE_CLICKABLE = new Set([
  "a",
  "button",
  "input",
  "select",
  "summary",
  "textarea",
]);

const KEYBOARD_ROLES = new Set([
  "button",
  "checkbox",
  "menuitem",
  "option",
  "radio",
  "switch",
  "tab",
]);

/**
 * These graphics are intentionally pointer-enhanced, never the only control:
 * the Atlas owns a synchronized native country list and MetricStripPlot owns
 * one labelled, keyboard-operable container that moves between its circles.
 */
const KEYBOARD_EQUIVALENT_GRAPHICS = new Set([
  "src/components/atlas/AtlasWorldMap.tsx:path",
  "src/components/outcomes/MetricStripPlot.tsx:circle",
]);

function jsxAttribute(
  attributes: ts.JsxAttributes,
  name: string,
): ts.JsxAttribute | undefined {
  return attributes.properties.find(
    (property): property is ts.JsxAttribute =>
      ts.isJsxAttribute(property) && property.name.getText() === name,
  );
}

function stringAttribute(attribute: ts.JsxAttribute | undefined): string | null {
  if (!attribute?.initializer) return null;
  if (ts.isStringLiteral(attribute.initializer)) return attribute.initializer.text;
  if (
    ts.isJsxExpression(attribute.initializer) &&
    attribute.initializer.expression &&
    ts.isStringLiteral(attribute.initializer.expression)
  ) {
    return attribute.initializer.expression.text;
  }
  return null;
}

function hasKeyboardHandler(attributes: ts.JsxAttributes): boolean {
  return ["onKeyDown", "onKeyPress", "onKeyUp"].some((name) =>
    Boolean(jsxAttribute(attributes, name)),
  );
}

/**
 * EXP-020 — native controls are required whenever a click introduces an
 * action. These are reviewed passive delegates: backdrops merely dismiss a
 * dialog that also has Escape/a real close button, and the search wrapper
 * forwards a pointer click to its native input. Tooltip owns an explicit
 * keyboard contract but receives role/tabIndex through a conditional spread.
 */
const PASSIVE_CLICK_SURFACES = new Set([
  "src/components/CountrySearchCombobox.tsx:div:country-search__field",
  "src/components/editorial/Tooltip.tsx:span:<dynamic>",
  "src/components/factbook/MapExplorerModal.tsx:div:map-explorer-overlay",
  "src/components/factbook/MapExplorerModal.tsx:div:map-explorer-panel",
]);

function isPassiveClickSurface(
  file: string,
  tag: string,
  attributes: ts.JsxAttributes,
): boolean {
  // Screen-reader-hidden backdrops must not introduce a keyboard-only action.
  if (jsxAttribute(attributes, "aria-hidden")) return true;
  const className = stringAttribute(jsxAttribute(attributes, "className"));
  const key = `${file}:${tag}:${className ?? "<dynamic>"}`;
  return PASSIVE_CLICK_SURFACES.has(key);
}

test("onClick uses a native control or a reviewed keyboard/passive contract", () => {
  const files = [
    ...walkFiles("src/app", [".tsx"]),
    ...walkFiles("src/components", [".tsx"]),
  ].filter((file) => !file.endsWith(".test.tsx"));
  const offenders: string[] = [];

  for (const file of files) {
    const sourceText = readFileSync(file, "utf8");
    const source = ts.createSourceFile(
      file,
      sourceText,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );
    const sourcePath = relative(process.cwd(), file).replaceAll("\\", "/");

    const visit = (node: ts.Node) => {
      const opening = ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)
        ? node
        : null;
      if (opening && ts.isIdentifier(opening.tagName)) {
        const attributes = opening.attributes;
        const tag = opening.tagName.text;
        // Custom components own their rendered primitive. This guard audits
        // only direct DOM nodes, where an onClick could otherwise bypass
        // semantics unnoticed.
        if (tag === tag.toLowerCase() && jsxAttribute(attributes, "onClick")) {
          const role = stringAttribute(jsxAttribute(attributes, "role"));
          const line = source.getLineAndCharacterOfPosition(opening.getStart(source)).line + 1;
          const keyboardRole = role ? KEYBOARD_ROLES.has(role) : false;
          const valid =
            NATIVE_CLICKABLE.has(tag) ||
            (keyboardRole && hasKeyboardHandler(attributes)) ||
            role === "dialog" ||
            KEYBOARD_EQUIVALENT_GRAPHICS.has(`${sourcePath}:${tag}`) ||
            isPassiveClickSurface(sourcePath, tag, attributes);
          if (!valid) {
            offenders.push(`${sourcePath}:${line} <${tag}> with onClick`);
          }
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }

  assert.deepEqual(offenders, []);
});
