import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

import {
  ONTOLOGY_EFFECT_DIRECTIONS,
  ONTOLOGY_SEVERITY_DESCRIPTORS,
  PULSE_EVENT_ONTOLOGY,
  PULSE_ONTOLOGY_FIXTURES,
  validatePulseOntologyAnnotation,
} from "../src/lib/pulse/v2/event-ontology";
import { EVENT_CATEGORIES } from "../src/lib/pulse/v2/taxonomy";
import { PULSE_DIMENSIONS } from "../src/lib/pulse/v2/types";

const ROOT = process.cwd();

function read(relativePath: string): string {
  return readFileSync(path.join(ROOT, relativePath), "utf8");
}

function requireFragments(
  relativePath: string,
  fragments: readonly string[],
): void {
  const source = read(relativePath);
  for (const fragment of fragments) {
    assert.ok(
      source.includes(fragment),
      `${relativePath} is missing ontology fragment: ${fragment}`,
    );
  }
}

assert.equal(PULSE_EVENT_ONTOLOGY.id, "pulse-event-ontology/v3.0");
assert.equal(PULSE_EVENT_ONTOLOGY.status, "adopted_research_codebook");
assert.equal(PULSE_EVENT_ONTOLOGY.categories.length, EVENT_CATEGORIES.length);
assert.deepEqual(
  PULSE_EVENT_ONTOLOGY.dimensions.map(({ id }) => id),
  PULSE_DIMENSIONS,
);
assert.equal(Object.keys(ONTOLOGY_SEVERITY_DESCRIPTORS).length, 5);
assert.equal(ONTOLOGY_EFFECT_DIRECTIONS.length, 5);
assert.equal(
  new Set(PULSE_EVENT_ONTOLOGY.categories.map(({ id }) => id)).size,
  EVENT_CATEGORIES.length,
);
assert.equal(PULSE_EVENT_ONTOLOGY.annotationContract.evidenceRequiredPerLabel, true);
assert.equal(PULSE_EVENT_ONTOLOGY.annotationContract.dimensionDerivedFromCategory, true);
assert.equal(PULSE_EVENT_ONTOLOGY.annotationContract.severitySeparateFromNumericDelta, true);
assert.ok(PULSE_EVENT_ONTOLOGY.compatibilityRules.length >= 5);
assert.ok(PULSE_EVENT_ONTOLOGY.ambiguityGuidance.length >= 5);

for (const fixture of PULSE_ONTOLOGY_FIXTURES) {
  assert.equal(
    validatePulseOntologyAnnotation(fixture.annotation).length,
    fixture.expectedErrors,
    `fixture ${fixture.id} does not close as declared`,
  );
}
assert.ok(
  PULSE_ONTOLOGY_FIXTURES.some(
    ({ annotation }) =>
      new Set(
        annotation.labels.map(
          ({ categoryId }) =>
            EVENT_CATEGORIES.find(({ id }) => id === categoryId)?.dimension,
        ),
      ).size >= 3,
  ),
  "fixtures need a known multi-dimensional event",
);
assert.ok(
  PULSE_ONTOLOGY_FIXTURES.some(
    ({ kind, annotation }) =>
      kind === "ambiguous_legitimate_event" &&
      annotation.disposition === "insufficient_evidence" &&
      annotation.candidateLabels.length >= 2,
  ),
  "fixtures need a normatively ambiguous event",
);

requireFragments("content/methodology-pulse.md", [
  "## Event ontology — {{ctx.ontologyVersion}} {#event-categories}",
  "{{ctx.ontologyCategoryCount}} event categories",
  "permits several labels on one real-world event",
  "### Severity descriptors",
  "A lawful institutional act can qualify as an event",
  "Additional consequences are never inferred",
  "Changes are versioned",
]);
requireFragments("plan/research/pulse-event-ontology-v3.md", [
  "**Resolution:** `pulse-event-ontology/v3.0`",
  "## Annotation contract",
  "## Severity descriptors",
  "## Compatibility and ambiguity",
  "## Examples and counterexamples",
  "## Change policy",
]);
requireFragments(
  "src/app/(reader)/civica-index/methodology/pulse/page.tsx",
  [
    "PULSE_EVENT_ONTOLOGY.id",
    "PULSE_EVENT_ONTOLOGY.categories.length",
    '{ id: "event-categories", label: "Event ontology" }',
  ],
);

const publicMethodology = read("content/methodology-pulse.md");
assert.doesNotMatch(
  publicMethodology,
  /classifies every event into exactly one category/i,
);
assert.doesNotMatch(
  publicMethodology,
  /classifier picks exactly one category per event/i,
);

console.log(
  `PASS — ${PULSE_EVENT_ONTOLOGY.id} publishes ${PULSE_EVENT_ONTOLOGY.categories.length} multi-label concepts, five dimensions, five severity descriptors, compatibility and ambiguity rules, version policy, and ${PULSE_ONTOLOGY_FIXTURES.length} executable examples/counterexamples while keeping the v2 production runtime explicit.`,
);
