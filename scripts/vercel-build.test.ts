import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  FULL_BUILD_TOKEN,
  FULL_STEPS,
  PREVIEW_STEPS,
  planBuild,
} from "./vercel-build";

const packageScripts = (
  JSON.parse(readFileSync("package.json", "utf8")) as {
    scripts: Record<string, string>;
  }
).scripts;

test("production runs exactly the full build", () => {
  const plan = planBuild({ VERCEL_ENV: "production" });
  assert.equal(plan.mode, "full");
  assert.deepEqual(plan.steps, FULL_STEPS);
  assert.deepEqual(plan.steps, [["npm", "run", "build"]]);
});

test("anything that is not a preview runs the full build", () => {
  for (const VERCEL_ENV of [undefined, "", "development", "staging"]) {
    assert.equal(planBuild({ VERCEL_ENV }).mode, "full");
  }
});

test("a preview runs the reduced path", () => {
  const plan = planBuild({ VERCEL_ENV: "preview", VERCEL_GIT_PULL_REQUEST_ID: "71" });
  assert.equal(plan.mode, "preview");
  assert.deepEqual(plan.steps, PREVIEW_STEPS);
});

test("a preview with no pull request keeps the full build", () => {
  for (const VERCEL_GIT_PULL_REQUEST_ID of [undefined, "", "  "]) {
    const plan = planBuild({ VERCEL_ENV: "preview", VERCEL_GIT_PULL_REQUEST_ID });
    assert.equal(plan.mode, "full");
    assert.deepEqual(plan.steps, FULL_STEPS);
  }
});

test("the full-build token restores the complete chain on a preview", () => {
  const plan = planBuild({
    VERCEL_ENV: "preview",
    VERCEL_GIT_PULL_REQUEST_ID: "71",
    VERCEL_GIT_COMMIT_MESSAGE: `fix: thing ${FULL_BUILD_TOKEN}`,
  });
  assert.equal(plan.mode, "full");
  assert.deepEqual(plan.steps, FULL_STEPS);
});

test("the token has no effect on production planning", () => {
  const plan = planBuild({
    VERCEL_ENV: "production",
    VERCEL_GIT_COMMIT_MESSAGE: "ordinary message",
  });
  assert.deepEqual(plan.steps, FULL_STEPS);
});

test("every preview step is a real package script or next build", () => {
  for (const [command, sub, name] of PREVIEW_STEPS) {
    assert.equal(command, "npm");
    if (sub === "run") {
      assert.ok(packageScripts[name], `missing package script ${name}`);
    } else {
      assert.equal(sub, "exec");
    }
  }
});

test("preview-only live-database validators are part of the full build", () => {
  const buildCore = packageScripts["build:core"];
  const claimsGate = readFileSync("src/lib/ci/claims-docs-gate.ts", "utf8");
  assert.ok(buildCore.includes("npm run validate:jurisdiction-directory"));
  assert.ok(buildCore.includes("npm run validate:claims-docs"));
  assert.ok(claimsGate.includes('npmScript: "validate:content-templates"'));
  assert.ok(buildCore.endsWith("next build"));
  assert.ok(packageScripts.prebuild.includes("validate:env"));
});

test("vercel-build delegates to this planner and never mutates a database", () => {
  assert.equal(packageScripts["vercel-build"], "tsx scripts/vercel-build.ts");
  assert.ok(!packageScripts["vercel-build"].includes("db:migrate"));
  const vercel = JSON.parse(readFileSync("vercel.json", "utf8")) as {
    buildCommand?: string;
  };
  assert.equal(vercel.buildCommand, "npm run vercel-build");
});
