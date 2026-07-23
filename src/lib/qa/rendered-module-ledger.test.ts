import assert from "node:assert/strict";
import test from "node:test";

import {
  buildRenderedModuleLedger,
  validateRenderedModuleLedger,
} from "./rendered-module-ledger";

test("the source-reachable ledger preserves route/module relationships and open evidence gaps", () => {
  const ledger = buildRenderedModuleLedger(
    [{ route: "/atlas", sourcePath: "src/app/atlas/page.tsx", kind: "page" }],
    new Map([
      ["src/app/layout.tsx", 'import { Header } from "@/components/Header";'],
      ["src/app/atlas/page.tsx", 'import { AtlasMap } from "@/components/AtlasMap";'],
      ["src/components/Header.tsx", "export function Header() { return null; }"],
      ["src/components/AtlasMap.tsx", 'import { Legend } from "./Legend";'],
      ["src/components/Legend.tsx", "export function Legend() { return null; }"],
    ]),
  );

  assert.deepEqual(
    ledger.entries.map(({ moduleSource, role }) => ({ moduleSource, role })),
    [
      { moduleSource: "src/app/atlas/page.tsx", role: "page" },
      { moduleSource: "src/app/layout.tsx", role: "layout" },
      { moduleSource: "src/components/AtlasMap.tsx", role: "component" },
      { moduleSource: "src/components/Header.tsx", role: "component" },
      { moduleSource: "src/components/Legend.tsx", role: "component" },
    ],
  );
  assert.equal(validateRenderedModuleLedger(ledger).length, 0);
  assert.equal(ledger.entries[0].visual.desktop_light.disposition, "not_observed");
});

test("a clean disposition without a screenshot fails closed", () => {
  const ledger = buildRenderedModuleLedger(
    [{ route: "/", sourcePath: "src/app/page.tsx", kind: "page" }],
    new Map([["src/app/page.tsx", "export default function Page() { return null; }"]]),
  );
  ledger.entries[0].visual.desktop_dark = {
    disposition: "clean",
    screenshot: null,
    findingId: null,
  };
  assert.match(validateRenderedModuleLedger(ledger).join("\n"), /clean requires a screenshot/);
});
