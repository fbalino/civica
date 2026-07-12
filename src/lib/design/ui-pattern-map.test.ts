/**
 * EXP-002 — the UI pattern → canonical-binding map validates against the real
 * codebase, and the validator fails closed on each defect class.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  UI_PATTERN_MAP,
  REQUIRED_FAMILIES,
  validateUiPatternMap,
  unmatchedPatterns,
  type UiPatternFamily,
  type UiPatternMapDeps,
} from "./ui-pattern-map";

test("the real UI pattern map is internally consistent against the codebase", () => {
  const errors = validateUiPatternMap();
  assert.deepEqual(errors, [], `unexpected errors:\n${errors.join("\n")}`);
});

test("the map covers exactly the fourteen required families", () => {
  const families = UI_PATTERN_MAP.map((f) => f.family).sort();
  assert.deepEqual(families, [...REQUIRED_FAMILIES].sort());
});

test("every non-unmatched pattern names at least one real binding", () => {
  for (const family of UI_PATTERN_MAP) {
    for (const p of family.patterns) {
      if (p.unmatched) continue;
      const n =
        (p.tokens?.length ?? 0) +
        (p.primitives?.length ?? 0) +
        (p.classes?.length ?? 0);
      assert.ok(n > 0, `${family.family} › ${p.pattern} has no binding`);
    }
  }
});

test("any unmatched pattern names a follow-up task", () => {
  for (const u of unmatchedPatterns()) {
    assert.ok(
      u.followUpTaskId,
      `unmatched ${u.family} › ${u.pattern} must name a follow-up task`,
    );
  }
});

/* ── Negative controls: the validator must catch each defect class ── */

// A stub filesystem: real token sources, but a controllable file-exists map.
const stubDeps = (existing: Record<string, boolean>): UiPatternMapDeps => ({
  readFile: (path) => {
    // Minimal token corpus + a class so the happy paths in a seeded map pass.
    if (path.endsWith(".css"))
      return ":root{--font-heading:x;--space-1:x;--color-bg:x} .editorial-page{}";
    throw new Error(`no read stub for ${path}`);
  },
  fileExists: (path) => existing[path] ?? false,
});

test("a missing required family fails", () => {
  const map = UI_PATTERN_MAP.filter((f) => f.family !== "maps");
  const errors = validateUiPatternMap(map);
  assert.ok(errors.some((e) => e.includes("missing required family: maps")));
});

test("a phantom token fails", () => {
  const map: UiPatternFamily[] = [
    {
      family: "typography",
      patterns: [
        {
          pattern: "phantom",
          kind: "token",
          tokens: ["--totally-not-a-real-token"],
          note: "seeded",
        },
      ],
    },
  ];
  const errors = validateUiPatternMap(map);
  assert.ok(
    errors.some((e) => e.includes("--totally-not-a-real-token")),
    errors.join("\n"),
  );
});

test("a phantom primitive file fails", () => {
  const map: UiPatternFamily[] = [
    {
      family: "typography",
      patterns: [
        {
          pattern: "phantom",
          kind: "primitive",
          primitives: ["src/components/DoesNotExist.tsx"],
          note: "seeded",
        },
      ],
    },
  ];
  const errors = validateUiPatternMap(map, stubDeps({}));
  assert.ok(errors.some((e) => e.includes("DoesNotExist.tsx")));
});

test("a phantom class fails", () => {
  const map: UiPatternFamily[] = [
    {
      family: "typography",
      patterns: [
        {
          pattern: "phantom",
          kind: "class",
          classes: ["not-a-real-class-xyz"],
          note: "seeded",
        },
      ],
    },
  ];
  const errors = validateUiPatternMap(map, stubDeps({}));
  assert.ok(errors.some((e) => e.includes("not-a-real-class-xyz")));
});

test("an approved-exception with no follow-up task fails", () => {
  const map: UiPatternFamily[] = [
    {
      family: "typography",
      patterns: [
        {
          pattern: "exception",
          kind: "approved-exception",
          tokens: ["--font-heading"],
          note: "seeded",
        },
      ],
    },
  ];
  const errors = validateUiPatternMap(map, stubDeps({}));
  assert.ok(errors.some((e) => e.includes("must name a followUpTaskId")));
});

test("a pattern with no binding at all fails", () => {
  const map: UiPatternFamily[] = [
    {
      family: "spacing",
      patterns: [{ pattern: "empty", kind: "token", note: "seeded" }],
    },
  ];
  const errors = validateUiPatternMap(map, stubDeps({}));
  assert.ok(errors.some((e) => e.includes("no canonical binding")));
});
