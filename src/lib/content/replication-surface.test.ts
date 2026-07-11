import { test } from "node:test";
import assert from "node:assert/strict";

import {
  findProhibitedReplicationLanguage,
  REQUIRED_REPLICATION_COMPONENT_IDS,
  validateReplicationPackage,
} from "./replication-surface";
import { replicationPackage } from "./site-state";
import type {
  ReplicationComponent,
  ReplicationPackageState,
} from "./site-state";

function component(
  overrides: Partial<ReplicationComponent> & Pick<ReplicationComponent, "id">,
): ReplicationComponent {
  return {
    label: overrides.id,
    status: "planned",
    owner: "DAT-022",
    whatRemains: "Fixture component.",
    ...overrides,
  };
}

function packageWithComponents(
  components: readonly ReplicationComponent[],
  pageStatus: ReplicationPackageState["pageStatus"] = "unpublished-pre-g2",
): ReplicationPackageState {
  return { pageStatus, components };
}

test("current replicationPackage state passes every invariant", () => {
  assert.deepEqual(validateReplicationPackage(replicationPackage), []);
});

test("the current tournament package exposes only components that have stable links", () => {
  assert.equal(replicationPackage.pageStatus, "tournament-package-available");
  for (const c of replicationPackage.components) {
    assert.equal(c.status === "available", Boolean(c.href), c.id);
  }
});

test("the current state's required inventory is complete and ordered", () => {
  assert.deepEqual(
    replicationPackage.components.map((c) => c.id),
    [...REQUIRED_REPLICATION_COMPONENT_IDS],
  );
});

test("rejects an available component with no href", () => {
  const pkg = packageWithComponents(
    REQUIRED_REPLICATION_COMPONENT_IDS.map((id) =>
      id === "versioned-code"
        ? component({ id, status: "available" })
        : component({ id }),
    ),
  );

  const issues = validateReplicationPackage(pkg);
  assert.ok(
    issues.some(
      (issue) =>
        issue.code === "available-without-href" &&
        issue.componentId === "versioned-code",
    ),
  );
});

test("rejects an available component before G2 even with an href set", () => {
  const pkg = packageWithComponents(
    REQUIRED_REPLICATION_COMPONENT_IDS.map((id) =>
      id === "versioned-code"
        ? component({ id, status: "available", href: "/civica-index/replication/code" })
        : component({ id }),
    ),
    "unpublished-pre-g2",
  );

  const issues = validateReplicationPackage(pkg);
  assert.ok(
    issues.some(
      (issue) =>
        issue.code === "available-before-g2" &&
        issue.componentId === "versioned-code",
    ),
  );
  assert.ok(
    issues.some(
      (issue) =>
        issue.code === "href-before-g2" && issue.componentId === "versioned-code",
    ),
  );
});

test("rejects an href on a non-available component", () => {
  const pkg = packageWithComponents(
    REQUIRED_REPLICATION_COMPONENT_IDS.map((id) =>
      id === "codebook"
        ? component({ id, status: "planned", href: "/somewhere" })
        : component({ id }),
    ),
  );

  const issues = validateReplicationPackage(pkg);
  assert.ok(
    issues.some(
      (issue) =>
        issue.code === "href-without-available" && issue.componentId === "codebook",
    ),
  );
});

test("rejects a duplicate component id", () => {
  const pkg = packageWithComponents([
    component({ id: "versioned-code" }),
    component({ id: "versioned-code" }),
  ]);

  const issues = validateReplicationPackage(pkg);
  assert.ok(
    issues.some(
      (issue) =>
        issue.code === "duplicate-component-id" &&
        issue.componentId === "versioned-code",
    ),
  );
});

test("rejects a missing required component", () => {
  const incomplete = REQUIRED_REPLICATION_COMPONENT_IDS.filter(
    (id) => id !== "doi-archive",
  ).map((id) => component({ id }));
  const pkg = packageWithComponents(incomplete);

  const issues = validateReplicationPackage(pkg);
  assert.ok(
    issues.some(
      (issue) =>
        issue.code === "missing-required-component" &&
        issue.componentId === "doi-archive",
    ),
  );
});

test("rejects a published page while any required component is incomplete", () => {
  const pkg = packageWithComponents(
    REQUIRED_REPLICATION_COMPONENT_IDS.map((id) =>
      component({ id, status: "planned" }),
    ),
    "published",
  );

  const issues = validateReplicationPackage(pkg);
  assert.ok(
    issues.some(
      (issue) => issue.code === "published-with-incomplete-component",
    ),
  );
});

test("accepts a published page when every required component has an available href", () => {
  const pkg = packageWithComponents(
    REQUIRED_REPLICATION_COMPONENT_IDS.map((id) =>
      component({ id, status: "available", href: `/releases/${id}` }),
    ),
    "published",
  );

  assert.deepEqual(validateReplicationPackage(pkg), []);
});

test("prohibited-availability scanner catches every listed phrase", () => {
  const fixture = [
    "Downloadable outputs are ready.",
    "The package has shipped.",
    "Available now for every country.",
    "Get the CSV from the link below.",
    "Reproduce every score from source data.",
    "Everything needed to reproduce a score is included.",
  ].join(" ");

  const matches = findProhibitedReplicationLanguage(fixture);
  const phrases = new Set(matches.map((match) => match.phrase));
  assert.deepEqual(
    [...phrases].sort(),
    [
      "Available now",
      "Download",
      "Everything needed to reproduce",
      "Get the CSV",
      "Reproduce every",
      "Shipped",
    ].sort(),
  );
});

test("prohibited-availability scanner finds nothing in truthful status copy", () => {
  const fixture =
    "No replication package is currently published. The components below " +
    "are individually marked with their build status. Versioned code and " +
    "reproduction commands are in progress; the rest are planned or " +
    "deferred until the frozen G2 release exists.";

  assert.deepEqual(findProhibitedReplicationLanguage(fixture), []);
});
