import assert from "node:assert/strict";
import { test } from "node:test";

import { EVENT_CATEGORIES } from "./taxonomy";
import {
  ONTOLOGY_SEVERITY_DESCRIPTORS,
  PULSE_EVENT_ONTOLOGY,
  PULSE_EVENT_ONTOLOGY_VERSION,
  PULSE_ONTOLOGY_FIXTURES,
  labelAssertionsAreCompatible,
  ontologyCategoryDimension,
  validatePulseOntologyAnnotation,
} from "./event-ontology";

test("v3 carries every v2 category into a versioned multi-label codebook", () => {
  assert.equal(PULSE_EVENT_ONTOLOGY.id, "pulse-event-ontology/v3.0");
  assert.equal(PULSE_EVENT_ONTOLOGY.categories.length, EVENT_CATEGORIES.length);
  assert.equal(new Set(PULSE_EVENT_ONTOLOGY.categories.map((row) => row.id)).size, EVENT_CATEGORIES.length);
  assert.equal(PULSE_EVENT_ONTOLOGY.annotationContract.maximumAssignedLabels, 5);
  assert.equal(PULSE_EVENT_ONTOLOGY.annotationContract.dimensionDerivedFromCategory, true);
  assert.equal(PULSE_EVENT_ONTOLOGY.annotationContract.severitySeparateFromNumericDelta, true);
  assert.equal(Object.keys(ONTOLOGY_SEVERITY_DESCRIPTORS).length, 5);
});

test("known multi-dimensional and ambiguous fixtures close as declared", () => {
  for (const fixture of PULSE_ONTOLOGY_FIXTURES) {
    assert.equal(
      validatePulseOntologyAnnotation(fixture.annotation).length,
      fixture.expectedErrors,
      fixture.id,
    );
  }
  const coup = PULSE_ONTOLOGY_FIXTURES[0].annotation.labels;
  assert.deepEqual(coup.map((row) => ontologyCategoryDimension(row.categoryId)), [
    "stability",
    "democratic_quality",
    "freedom_rights",
  ]);
});

test("compatibility is facet-specific and prevents double coding", () => {
  const generic = {
    categoryId: "emergency_declaration",
    facetId: "decree-a",
    effectDirection: "not_assessed" as const,
    severity: "not_assessed" as const,
    evidenceIds: ["source-a"],
    rationale: "Generic emergency declaration.",
  };
  const specific = {
    ...generic,
    categoryId: "term_extension",
    rationale: "The decree extends the mandate.",
  };
  assert.equal(labelAssertionsAreCompatible(generic, specific), false);
  assert.equal(
    labelAssertionsAreCompatible(generic, {
      ...specific,
      facetId: "separate-instrument",
    }),
    true,
  );
});

test("a single-label payload remains valid but is no longer the only shape", () => {
  const errors = validatePulseOntologyAnnotation({
    ontologyVersion: PULSE_EVENT_ONTOLOGY_VERSION,
    disposition: "qualifying_event",
    labels: [
      {
        categoryId: "fair_election",
        facetId: "certified-result",
        effectDirection: "expansive",
        severity: "material",
        evidenceIds: ["observer-report"],
        rationale: "Observer evidence supports the certified result label.",
      },
    ],
    candidateLabels: [],
    ambiguityReason: null,
  });
  assert.deepEqual(errors, []);
});
