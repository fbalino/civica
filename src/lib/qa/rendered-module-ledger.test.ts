import assert from "node:assert/strict";
import test from "node:test";

import {
  applyRenderedModuleEvidence,
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

test("a rendered HTML route handler is represented as a document", () => {
  const ledger = buildRenderedModuleLedger(
    [{
      route: "/embed/[slug]",
      sourcePath: "src/app/embed/[slug]/route.ts",
      kind: "document",
    }],
    new Map([
      [
        "src/app/embed/[slug]/route.ts",
        "export function GET() { return new Response('<main>Retired</main>'); }",
      ],
    ]),
  );
  assert.equal(ledger.entries.length, 1);
  assert.equal(ledger.entries[0].role, "document");
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

test("durable evidence overlays survive discovery without broad clean claims", () => {
  const ledger = buildRenderedModuleLedger(
    [{ route: "/atlas", sourcePath: "src/app/atlas/page.tsx", kind: "page" }],
    new Map([
      ["src/app/atlas/page.tsx", 'import { AtlasMap } from "@/components/AtlasMap";'],
      ["src/components/AtlasMap.tsx", "export function AtlasMap() { return null; }"],
    ]),
  );
  const withContext = applyRenderedModuleEvidence(ledger, {
    schemaVersion: "civica-rendered-module-evidence/v1",
    records: [{
      route: "/atlas",
      moduleSource: "*",
      variant: "desktop_light",
      evidence: {
        disposition: "not_observed",
        screenshot: "candidate.png",
        findingId: "EXP-001-CANDIDATE-NOT-REVIEWED",
      },
    }],
  });
  assert.equal(
    withContext.entries.every(
      (entry) => entry.visual.desktop_light.screenshot === "candidate.png",
    ),
    true,
  );
  assert.throws(
    () =>
      applyRenderedModuleEvidence(ledger, {
        schemaVersion: "civica-rendered-module-evidence/v1",
        records: [{
          route: "/atlas",
          moduleSource: "*",
          variant: "desktop_light",
          evidence: {
            disposition: "clean",
            screenshot: "candidate.png",
            findingId: null,
          },
        }],
      }),
    /cannot mark a whole route clean/,
  );
});

test("duplicate and stale evidence records fail closed", () => {
  const ledger = buildRenderedModuleLedger(
    [{ route: "/", sourcePath: "src/app/page.tsx", kind: "page" }],
    new Map([["src/app/page.tsx", "export default function Page() { return null; }"]]),
  );
  const record = {
    route: "/",
    moduleSource: "src/app/page.tsx",
    variant: "desktop_light" as const,
    evidence: {
      disposition: "clean" as const,
      screenshot: "approved.png",
      findingId: null,
    },
  };
  assert.throws(
    () =>
      applyRenderedModuleEvidence(ledger, {
        schemaVersion: "civica-rendered-module-evidence/v1",
        records: [record, record],
      }),
    /Duplicate rendered-module evidence record/,
  );
  assert.throws(
    () =>
      applyRenderedModuleEvidence(ledger, {
        schemaVersion: "civica-rendered-module-evidence/v1",
        records: [{ ...record, route: "/missing" }],
      }),
    /is stale/,
  );
});
