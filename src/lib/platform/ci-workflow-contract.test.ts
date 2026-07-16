import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

import { CLAIMS_DOCS_GATE_MANIFEST } from "../ci/claims-docs-gate";
import {
  BUILD_CORE_SHA256,
  CANONICAL_CI_WORKFLOW,
  CANONICAL_CI_WORKFLOW_SOURCE,
  REQUIRED_CI_COMMANDS,
  RETIRED_CLAIMS_WORKFLOW,
  ciScriptGraphErrors,
  ciTransitiveGateErrors,
  ciWorkflowCommandListing,
  ciWorkflowErrors,
} from "./ci-workflow-contract";

const workflow = readFileSync(CANONICAL_CI_WORKFLOW, "utf8");
const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as {
  scripts: Record<string, string>;
};

function replaceOnce(source: string, from: string, to: string): string {
  assert.ok(source.includes(from), `fixture source not found: ${from}`);
  const seeded = source.replace(from, to);
  assert.notEqual(seeded, source);
  return seeded;
}

function assertRejected(label: string, seeded: string): void {
  const errors = ciWorkflowErrors(seeded);
  assert.ok(errors.length > 0, `${label} unexpectedly passed`);
}

test("the checked workflow is byte-canonical and semantically valid", () => {
  assert.equal(workflow, CANONICAL_CI_WORKFLOW_SOURCE);
  assert.deepEqual(ciWorkflowErrors(workflow), []);
  assert.deepEqual(ciWorkflowCommandListing(workflow), REQUIRED_CI_COMMANDS);
});

test("the canonical workflow is the only workflow and the retired duplicate is absent", () => {
  assert.equal(existsSync(RETIRED_CLAIMS_WORKFLOW), false);
});

test("the package graph shares one build core and retains claims, unit, and Index gates", () => {
  assert.deepEqual(ciScriptGraphErrors(packageJson.scripts), []);
  assert.deepEqual(
    ciTransitiveGateErrors(CLAIMS_DOCS_GATE_MANIFEST.checks),
    [],
  );
  assert.ok(
    CLAIMS_DOCS_GATE_MANIFEST.checks.some(
      (check) => check.npmScript === "test",
    ),
    "validate:claims-docs must transitively execute the unit-test script",
  );
});

test("the transitive unit gate cannot be removed or duplicated", () => {
  const withoutUnit = CLAIMS_DOCS_GATE_MANIFEST.checks.filter(
    (check) => check.npmScript !== "test",
  );
  const unit = CLAIMS_DOCS_GATE_MANIFEST.checks.find(
    (check) => check.npmScript === "test",
  );
  assert.ok(unit);
  assert.ok(ciTransitiveGateErrors(withoutUnit).length > 0);
  assert.ok(ciTransitiveGateErrors([...withoutUnit, unit, unit]).length > 0);
});

test("the complete pre-refactor production build body is hash-bound", () => {
  assert.match(BUILD_CORE_SHA256, /^[a-f0-9]{64}$/);
  const scripts = {
    ...packageJson.scripts,
    "build:core": packageJson.scripts["build:core"].replace(
      "npm run validate:statement-provenance && ",
      "",
    ),
  };
  assert.notEqual(scripts["build:core"], packageJson.scripts["build:core"]);
  assert.ok(ciScriptGraphErrors(scripts).length > 0);
});

test("removing or changing any required command fails closed", () => {
  for (const command of REQUIRED_CI_COMMANDS) {
    assertRejected(
      `missing ${command}`,
      replaceOnce(
        workflow,
        `        run: ${command}`,
        "        run: node --version",
      ),
    );
  }
});

test("reordered, duplicated, extra, multiline, and wrong-job commands fail", () => {
  const first = REQUIRED_CI_COMMANDS[0];
  const second = REQUIRED_CI_COMMANDS[1];
  const reordered = workflow
    .replace(`        run: ${first}`, "        run: __FIRST__")
    .replace(`        run: ${second}`, `        run: ${first}`)
    .replace("        run: __FIRST__", `        run: ${second}`);

  const duplicated = replaceOnce(
    workflow,
    `        run: ${REQUIRED_CI_COMMANDS[2]}`,
    `        run: ${REQUIRED_CI_COMMANDS[1]}`,
  );
  const extra = replaceOnce(
    workflow,
    "      - name: Type-check\n",
    "      - name: Unexpected bypass\n        run: node --version\n      - name: Type-check\n",
  );
  const multiline = replaceOnce(
    workflow,
    "        run: npm run validate:secrets",
    "        run: |\n          npm run validate:secrets",
  );
  const wrongJob = replaceOnce(
    workflow,
    "        run: npm run validate:secrets",
    "        run: node --version",
  ).replace(
    /\n$/,
    "\n  decoy:\n    runs-on: ubuntu-latest\n    steps:\n      - run: npm run validate:secrets\n",
  );

  for (const [label, seeded] of [
    ["reordered", reordered],
    ["duplicated", duplicated],
    ["extra", extra],
    ["multiline", multiline],
    ["wrong job", wrongJob],
  ] as const) {
    assertRejected(label, seeded);
  }
});

test("comments, names, and indentation cannot impersonate a required run step", () => {
  const comment = replaceOnce(
    workflow,
    "        run: npm run validate:secrets",
    "        # run: npm run validate:secrets",
  );
  const name = replaceOnce(
    workflow,
    "        run: npm run validate:secrets",
    "        name: run: npm run validate:secrets",
  );
  const wrongIndent = replaceOnce(
    workflow,
    "        run: npm run validate:secrets",
    "      run: npm run validate:secrets",
  );

  assertRejected("comment impersonation", comment);
  assertRejected("name impersonation", name);
  assertRejected("wrong indentation", wrongIndent);
});

test("trigger and fork-safety bypasses fail closed", () => {
  const fixtures = [
    [
      "branch changed",
      replaceOnce(workflow, "      - main", "      - develop"),
    ],
    ["pull request removed", replaceOnce(workflow, "  pull_request:\n", "")],
    [
      "pull request target",
      replaceOnce(workflow, "  pull_request:", "  pull_request_target:"),
    ],
    [
      "filtered pull request",
      replaceOnce(
        workflow,
        "  pull_request:\n",
        "  pull_request:\n    branches:\n      - main\n",
      ),
    ],
    [
      "extra trigger",
      replaceOnce(
        workflow,
        "  pull_request:\n",
        "  pull_request:\n  workflow_dispatch:\n",
      ),
    ],
    [
      "secret expression",
      replaceOnce(
        workflow,
        "    timeout-minutes: 60\n",
        "    timeout-minutes: 60\n    env:\n      TOKEN: ${{ secrets.ADMIN_TOKEN }}\n",
      ),
    ],
    [
      "bracket secret expression",
      replaceOnce(
        workflow,
        "    timeout-minutes: 60\n",
        "    timeout-minutes: 60\n    env:\n      TOKEN: ${{ secrets['ADMIN_TOKEN'] }}\n",
      ),
    ],
    [
      "plain secret reference",
      replaceOnce(
        workflow,
        "    timeout-minutes: 60\n",
        "    timeout-minutes: 60\n    env:\n      TOKEN: secrets.ADMIN_TOKEN\n",
      ),
    ],
    [
      "job database env",
      replaceOnce(
        workflow,
        "    timeout-minutes: 60\n",
        "    timeout-minutes: 60\n    env:\n      DATABASE_URL: postgresql://invalid:invalid@127.0.0.1:1/invalid\n",
      ),
    ],
  ] as const;

  for (const [label, seeded] of fixtures) assertRejected(label, seeded);
});

test("all conditional and permissive failure forms fail closed", () => {
  const anchor = "      - name: Type-check\n";
  const fixtures = [
    [
      "continue true",
      replaceOnce(
        workflow,
        anchor,
        `${anchor}        continue-on-error: true\n`,
      ),
    ],
    [
      "continue false",
      replaceOnce(
        workflow,
        anchor,
        `${anchor}        continue-on-error: false\n`,
      ),
    ],
    ["if false", replaceOnce(workflow, anchor, `${anchor}        if: false\n`)],
    [
      "if false without whitespace",
      replaceOnce(workflow, anchor, `${anchor}        if:false\n`),
    ],
    [
      "if expression",
      replaceOnce(
        workflow,
        anchor,
        `${anchor}        if: \${{ github.event_name == 'push' }}\n`,
      ),
    ],
    [
      "shell neutralization",
      replaceOnce(
        workflow,
        "        run: npm run typecheck",
        "        run: npm run typecheck || true",
      ),
    ],
  ] as const;

  for (const [label, seeded] of fixtures) assertRejected(label, seeded);
});

test("runtime, permissions, timeout, action, and production-server drift fails", () => {
  const fixtures = [
    replaceOnce(workflow, "  contents: read", "  contents: write"),
    replaceOnce(
      workflow,
      "cancel-in-progress: true",
      "cancel-in-progress: false",
    ),
    replaceOnce(workflow, "timeout-minutes: 60", "timeout-minutes: 0"),
    replaceOnce(workflow, "actions/checkout@v6", "actions/checkout@main"),
    replaceOnce(workflow, "actions/setup-node@v6", "actions/setup-node@v5"),
    replaceOnce(workflow, "node-version: 22", "node-version: 20"),
    replaceOnce(workflow, "cache: npm", "cache: yarn"),
    replaceOnce(
      workflow,
      "E2E_WEBSERVER_CMD: npm run start",
      "E2E_WEBSERVER_CMD: npm run dev",
    ),
    replaceOnce(workflow, "run: npm run build:ci", "run: npm run build"),
  ];
  for (const seeded of fixtures)
    assertRejected("runtime/security drift", seeded);
});

test("script graph rejects credential, context, core, cache/release, claims, and Index bypasses", () => {
  const fixtures: Array<Record<string, string>> = [
    { ...packageJson.scripts, "build:ci": "DATABASE_URL=x npm run build" },
    {
      ...packageJson.scripts,
      "prebuild:ci": packageJson.scripts["prebuild:ci"].replace(
        "--context=ci",
        "--context=build",
      ),
    },
    { ...packageJson.scripts, build: "next build" },
    {
      ...packageJson.scripts,
      "validate:cache-consistency": "node -e process.exit(0)",
    },
    {
      ...packageJson.scripts,
      "validate:release-consistency": "node -e process.exit(0)",
    },
    {
      ...packageJson.scripts,
      "build:core": packageJson.scripts["build:core"].replace(
        "npm run validate:claims-docs && ",
        "",
      ),
    },
    {
      ...packageJson.scripts,
      "build:core": packageJson.scripts["build:core"].replace(
        "npm run validate:index-change-control && ",
        "",
      ),
    },
  ];

  for (const scripts of fixtures) {
    assert.ok(ciScriptGraphErrors(scripts).length > 0);
  }
});
