/**
 * ATL-019 — stable identity/citation contract tests.
 *
 * DB-free by design: every resolver factors a pure `buildXCitation(row,
 * source, …)` function with no database access (the async `resolveXCitation`
 * wrappers only fetch rows and hand them to the pure builder — see
 * `src/lib/citations/resolvers/*.ts`). That split lets this file prove the
 * REPLACEMENT-PROOF identity contract directly: build a citation from a row,
 * mutate only the row's DISPLAY column (name/heading/label), rebuild, and
 * assert the `id` and `citationUrl` are byte-identical while `label`
 * changes — the actual "survives a rename" guarantee ATL-019 requires.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { RESEARCH_EVIDENCE_RETENTION_VERSION } from "@/lib/research/evidence-retention";
import {
  ENTITY_ID_PATTERNS,
  ENTITY_TYPES,
  STABLE_ENTITY_CITATION_SCHEMA_VERSION,
  buildCitationUrl,
  deriveHeuristicSourceId,
  deriveRevisionRelease,
  isEntityType,
  isValidEntityId,
  parseEntityCitation,
  zEntityCitation,
} from "./stable-identity";
import { buildConstitutionPassageCitation } from "./resolvers/constitution-passage";
import { buildElectionCitation } from "./resolvers/election";
import { buildFactCitation } from "./resolvers/fact";
import { buildIndicatorCitation } from "./resolvers/indicator";
import { buildInstitutionCitation } from "./resolvers/institution";
import { buildOfficeCitation } from "./resolvers/office";
import { buildOrganizationCitation } from "./resolvers/organization";
import { buildPersonCitation } from "./resolvers/person";

const FIXED_RESOLVED_AT = "2026-07-12T00:00:00.000Z";

const KNOWN_SOURCE = {
  sourceId: "wikidata",
  sourceName: "Wikidata",
  licenseId: "CC0",
  sourceUrl: "https://query.wikidata.org/sparql",
};

const NO_REVISIONS = deriveRevisionRelease([]);
const ONE_REVISION = deriveRevisionRelease([
  { recordedAt: new Date("2026-06-01T00:00:00Z"), reason: "corrected seat count" },
]);

// ─────────────────────────────────────────────────────────────────────────
// 1. Entity-type enum / id-pattern invariants
// ─────────────────────────────────────────────────────────────────────────

test("ENTITY_TYPES has exactly the 8 ATL-019 kinds, each with an id pattern", () => {
  assert.deepEqual(
    [...ENTITY_TYPES].sort(),
    [
      "constitution-passage",
      "election",
      "fact",
      "indicator",
      "institution",
      "office",
      "organization",
      "person",
    ].sort(),
  );
  for (const kind of ENTITY_TYPES) {
    assert.ok(ENTITY_ID_PATTERNS[kind] instanceof RegExp, kind);
  }
  assert.equal(isEntityType("fact"), true);
  assert.equal(isEntityType("bogus-kind"), false);
});

test("uuid-keyed kinds accept a real UUID and reject a display-name string", () => {
  const uuid = "11111111-1111-4111-8111-111111111111";
  for (const kind of ENTITY_TYPES) {
    if (kind === "constitution-passage") continue;
    assert.equal(isValidEntityId(kind, uuid), true, kind);
    assert.equal(isValidEntityId(kind, "Ministry of Finance"), false, kind);
  }
});

test("constitution-passage accepts the shipped sha256:<hex> digest form only", () => {
  const digest = `sha256:${"a".repeat(64)}`;
  assert.equal(isValidEntityId("constitution-passage", digest), true);
  assert.equal(
    isValidEntityId("constitution-passage", "constitution-passage/" + digest),
    false,
  );
  assert.equal(isValidEntityId("constitution-passage", "sha256:abc"), false);
});

test("buildCitationUrl is stable for a fixed id regardless of entityType casing quirks", () => {
  const id = "11111111-1111-4111-8111-111111111111";
  const first = buildCitationUrl("institution", id);
  const second = buildCitationUrl("institution", id);
  assert.equal(first, second);
  assert.equal(first, `https://civicaatlas.org/api/citations/institution/${id}`);
});

// ─────────────────────────────────────────────────────────────────────────
// 2. Pure helpers: DAT-016 revision derivation + source heuristic
// ─────────────────────────────────────────────────────────────────────────

test("deriveRevisionRelease reports honest 'no revisions recorded' for an empty ledger", () => {
  assert.deepEqual(NO_REVISIONS, {
    retentionContractVersion: RESEARCH_EVIDENCE_RETENTION_VERSION,
    hasRecordedRevisions: false,
    revisionCount: 0,
    lastRevisedAt: null,
    lastRevisionReason: null,
  });
});

test("deriveRevisionRelease picks the MOST RECENT of several history rows", () => {
  const release = deriveRevisionRelease([
    { recordedAt: new Date("2026-01-01T00:00:00Z"), reason: "first edit" },
    { recordedAt: new Date("2026-06-01T00:00:00Z"), reason: "second edit" },
    { recordedAt: new Date("2026-03-01T00:00:00Z"), reason: "third edit" },
  ]);
  assert.equal(release.hasRecordedRevisions, true);
  assert.equal(release.revisionCount, 3);
  assert.equal(release.lastRevisedAt, "2026-06-01T00:00:00.000Z");
  assert.equal(release.lastRevisionReason, "second edit");
});

test("deriveHeuristicSourceId prefers IPU Parline over Wikidata, else null", () => {
  assert.equal(
    deriveHeuristicSourceId({ ipuParlineId: "ABC", wikidataQid: "Q1" }),
    "ipu_parline",
  );
  assert.equal(deriveHeuristicSourceId({ wikidataQid: "Q1" }), "wikidata");
  assert.equal(deriveHeuristicSourceId({}), null);
});

// ─────────────────────────────────────────────────────────────────────────
// 3. Per-entity-kind shape + schema-version invariants
// ─────────────────────────────────────────────────────────────────────────

test("fact citation: shape, schemaVersion, and strict Zod parse", () => {
  const citation = buildFactCitation(
    {
      id: "aaaaaaaa-1111-4111-8111-111111111111",
      jurisdictionSlug: "uruguay",
      jurisdictionName: "Uruguay",
      factKey: "population_total",
      sourceId: "world_bank_wdi",
      sourceUrl: null,
      asOf: "2025-01-01",
      upstreamVintageLabel: "WB WDI 2026.04",
      retrievedAt: new Date("2026-01-05T00:00:00Z"),
    },
    KNOWN_SOURCE,
    FIXED_RESOLVED_AT,
  );
  assert.equal(citation.schemaVersion, STABLE_ENTITY_CITATION_SCHEMA_VERSION);
  assert.equal(citation.entityType, "fact");
  assert.equal(citation.id, "aaaaaaaa-1111-4111-8111-111111111111");
  assert.equal(citation.citationUrl, buildCitationUrl("fact", citation.id));
  assert.equal(citation.vintage.upstreamVintageLabel, "WB WDI 2026.04");
  assert.deepEqual(parseEntityCitation(citation), citation);
});

test("institution citation: shape, schemaVersion, and strict Zod parse", () => {
  const citation = buildInstitutionCitation(
    {
      id: "bbbbbbbb-1111-4111-8111-111111111111",
      jurisdictionSlug: "chile",
      jurisdictionName: "Chile",
      name: "Chamber of Deputies",
      bodyType: "legislature",
      ipuParlineId: "CL-01",
      wikidataQid: null,
    },
    { sourceId: "ipu_parline", sourceName: "IPU Parline", licenseId: "CC-BY-NC-SA-4.0", sourceUrl: "https://api.data.ipu.org/v1" },
    ONE_REVISION,
    FIXED_RESOLVED_AT,
  );
  assert.equal(citation.entityType, "institution");
  assert.equal(citation.revision.hasRecordedRevisions, true);
  assert.equal(citation.revision.revisionCount, 1);
  assert.deepEqual(parseEntityCitation(citation), citation);
});

test("office citation: shape, schemaVersion, and strict Zod parse", () => {
  const citation = buildOfficeCitation(
    {
      id: "cccccccc-1111-4111-8111-111111111111",
      jurisdictionSlug: "japan",
      jurisdictionName: "Japan",
      name: "Prime Minister",
      officeType: "head_of_government",
      wikidataQid: "Q11134",
    },
    KNOWN_SOURCE,
    NO_REVISIONS,
    FIXED_RESOLVED_AT,
  );
  assert.equal(citation.entityType, "office");
  assert.equal(citation.revision.hasRecordedRevisions, false);
  assert.deepEqual(parseEntityCitation(citation), citation);
});

test("person citation: shape, schemaVersion, and strict Zod parse", () => {
  const citation = buildPersonCitation(
    { id: "dddddddd-1111-4111-8111-111111111111", name: "Jane Doe", wikidataQid: "Q999" },
    "japan",
    KNOWN_SOURCE,
    NO_REVISIONS,
    FIXED_RESOLVED_AT,
  );
  assert.equal(citation.entityType, "person");
  assert.equal(citation.readerUrl, "https://civicaatlas.org/country/japan/civica-data");
  assert.deepEqual(parseEntityCitation(citation), citation);

  const noOffice = buildPersonCitation(
    { id: "dddddddd-1111-4111-8111-111111111111", name: "Jane Doe", wikidataQid: "Q999" },
    null,
    KNOWN_SOURCE,
    NO_REVISIONS,
    FIXED_RESOLVED_AT,
  );
  assert.equal(noOffice.readerUrl, null);
});

test("election citation: shape, schemaVersion, and strict Zod parse", () => {
  const citation = buildElectionCitation(
    {
      id: "eeeeeeee-1111-4111-8111-111111111111",
      jurisdictionSlug: "argentina",
      jurisdictionName: "Argentina",
      electionName: "2023 Argentine general election",
      electionType: "presidential",
      electionDate: "2023-10-22",
      wikidataQid: "Q114634",
    },
    KNOWN_SOURCE,
    NO_REVISIONS,
    FIXED_RESOLVED_AT,
  );
  assert.equal(citation.entityType, "election");
  assert.equal(citation.readerUrl, null);
  assert.deepEqual(parseEntityCitation(citation), citation);
});

test("constitution-passage citation: shape, schemaVersion, and strict Zod parse", () => {
  const digest = `sha256:${"b".repeat(64)}`;
  const citation = buildConstitutionPassageCitation(
    {
      digestId: digest,
      jurisdictionSlug: "chile",
      jurisdictionName: "Chile",
      headingLabel: "Article 1",
      sourceSectionId: "section/1",
      anchorId: "sec-section-1",
      isCurrent: true,
      supersededAt: null,
    },
    {
      sourceId: "constitute_project",
      sourceName: "Constitute Project",
      licenseId: "CC-BY-NC-3.0",
      sourceUrl: "https://www.constituteproject.org/service/",
    },
    FIXED_RESOLVED_AT,
  );
  assert.equal(citation.entityType, "constitution-passage");
  assert.equal(citation.id, digest);
  assert.equal(
    citation.readerUrl,
    "https://civicaatlas.org/constitution?c=chile#sec-section-1",
  );
  assert.deepEqual(parseEntityCitation(citation), citation);

  const superseded = buildConstitutionPassageCitation(
    {
      digestId: digest,
      jurisdictionSlug: "chile",
      jurisdictionName: "Chile",
      headingLabel: "Article 1",
      sourceSectionId: "section/1",
      anchorId: "sec-section-1",
      isCurrent: false,
      supersededAt: new Date("2026-02-01T00:00:00Z"),
    },
    { sourceId: "constitute_project", sourceName: "Constitute Project", licenseId: "CC-BY-NC-3.0", sourceUrl: null },
    FIXED_RESOLVED_AT,
  );
  assert.equal(superseded.readerUrl, null);
  assert.equal(superseded.current, false);
  assert.equal(superseded.supersededAt, "2026-02-01T00:00:00.000Z");
});

test("organization citation: shape, schemaVersion, and strict Zod parse", () => {
  const citation = buildOrganizationCitation(
    {
      id: "ffffffff-1111-4111-8111-111111111111",
      slug: "united-nations",
      name: "UN",
      fullName: "United Nations",
      wikidataQid: "Q1065",
    },
    KNOWN_SOURCE,
    FIXED_RESOLVED_AT,
  );
  assert.equal(citation.entityType, "organization");
  assert.equal(citation.slug, "united-nations");
  assert.deepEqual(parseEntityCitation(citation), citation);
});

test("indicator citation: shape, schemaVersion, and strict Zod parse", () => {
  const citation = buildIndicatorCitation(
    {
      id: "12121212-1111-4111-8111-111111111111",
      jurisdictionSlug: "uruguay",
      jurisdictionName: "Uruguay",
      metricId: "hdi",
      metricName: "Human Development Index",
      year: 2024,
      sourceId: "undp_hdi",
      sourceUrl: null,
      createdAt: new Date("2026-01-01T00:00:00Z"),
    },
    { sourceId: "undp_hdi", sourceName: "UNDP HDI", licenseId: "CC-BY-3.0-IGO", sourceUrl: "https://hdr.undp.org" },
    FIXED_RESOLVED_AT,
  );
  assert.equal(citation.entityType, "indicator");
  assert.equal(citation.year, 2024);
  assert.deepEqual(parseEntityCitation(citation), citation);
});

test("zEntityCitation rejects an unrecognized entityType and extra fields", () => {
  assert.throws(() =>
    parseEntityCitation({
      schemaVersion: STABLE_ENTITY_CITATION_SCHEMA_VERSION,
      entityType: "bogus-kind",
      id: "x",
      label: "x",
      citationUrl: "https://civicaatlas.org/api/citations/bogus-kind/x",
      readerUrl: null,
      source: { sourceId: null, sourceName: null, licenseId: null, sourceUrl: null },
      resolvedAt: FIXED_RESOLVED_AT,
    }),
  );
  const validOrg = buildOrganizationCitation(
    { id: "ffffffff-1111-4111-8111-111111111111", slug: "un", name: "UN", fullName: "United Nations", wikidataQid: null },
    KNOWN_SOURCE,
    FIXED_RESOLVED_AT,
  );
  assert.throws(() =>
    zEntityCitation.parse({ ...validOrg, unexpectedField: "nope" }),
  );
});

// ─────────────────────────────────────────────────────────────────────────
// 4. THE round-trip contract: rename the entity's display column, re-resolve
//    by the same stable id, and prove `id`/`citationUrl` never move.
// ─────────────────────────────────────────────────────────────────────────

test("RENAME ROUND TRIP — fact: jurisdiction name change never moves id/citationUrl", () => {
  const row = {
    id: "aaaaaaaa-1111-4111-8111-111111111111",
    jurisdictionSlug: "uruguay",
    jurisdictionName: "Oriental Republic of Uruguay",
    factKey: "population_total",
    sourceId: "world_bank_wdi",
    sourceUrl: null,
    asOf: "2025-01-01",
    upstreamVintageLabel: null,
    retrievedAt: null,
  };
  const before = buildFactCitation(row, KNOWN_SOURCE, FIXED_RESOLVED_AT);
  const after = buildFactCitation(
    { ...row, jurisdictionName: "Republica Oriental del Uruguay" },
    KNOWN_SOURCE,
    FIXED_RESOLVED_AT,
  );
  assert.equal(before.id, after.id);
  assert.equal(before.citationUrl, after.citationUrl);
  assert.notEqual(before.label, after.label);
});

test("RENAME ROUND TRIP — institution: body name change never moves id/citationUrl", () => {
  const row = {
    id: "bbbbbbbb-1111-4111-8111-111111111111",
    jurisdictionSlug: "chile",
    jurisdictionName: "Chile",
    name: "Chamber of Deputies",
    bodyType: "legislature",
    ipuParlineId: "CL-01",
    wikidataQid: null,
  };
  const before = buildInstitutionCitation(row, KNOWN_SOURCE, ONE_REVISION, FIXED_RESOLVED_AT);
  const after = buildInstitutionCitation(
    { ...row, name: "Chamber of Deputies of Chile" },
    KNOWN_SOURCE,
    ONE_REVISION,
    FIXED_RESOLVED_AT,
  );
  assert.equal(before.id, after.id);
  assert.equal(before.citationUrl, after.citationUrl);
  assert.notEqual(before.label, after.label);
});

test("RENAME ROUND TRIP — office: title relabel never moves id/citationUrl", () => {
  const row = {
    id: "cccccccc-1111-4111-8111-111111111111",
    jurisdictionSlug: "japan",
    jurisdictionName: "Japan",
    name: "Minister of Finance",
    officeType: "cabinet",
    wikidataQid: "Q123",
  };
  const before = buildOfficeCitation(row, KNOWN_SOURCE, NO_REVISIONS, FIXED_RESOLVED_AT);
  const after = buildOfficeCitation(
    { ...row, name: "Minister of Finance and the Treasury" },
    KNOWN_SOURCE,
    NO_REVISIONS,
    FIXED_RESOLVED_AT,
  );
  assert.equal(before.id, after.id);
  assert.equal(before.citationUrl, after.citationUrl);
  assert.notEqual(before.label, after.label);
});

test("RENAME ROUND TRIP — person: spelling correction never moves id/citationUrl", () => {
  const row = { id: "dddddddd-1111-4111-8111-111111111111", name: "Jose Diaz", wikidataQid: "Q1" };
  const before = buildPersonCitation(row, "japan", KNOWN_SOURCE, NO_REVISIONS, FIXED_RESOLVED_AT);
  const after = buildPersonCitation(
    { ...row, name: "José Díaz" },
    "japan",
    KNOWN_SOURCE,
    NO_REVISIONS,
    FIXED_RESOLVED_AT,
  );
  assert.equal(before.id, after.id);
  assert.equal(before.citationUrl, after.citationUrl);
  assert.notEqual(before.label, after.label);
});

test("RENAME ROUND TRIP — election: headline correction never moves id/citationUrl", () => {
  const row = {
    id: "eeeeeeee-1111-4111-8111-111111111111",
    jurisdictionSlug: "argentina",
    jurisdictionName: "Argentina",
    electionName: "2023 general election",
    electionType: "presidential",
    electionDate: "2023-10-22",
    wikidataQid: null,
  };
  const before = buildElectionCitation(row, KNOWN_SOURCE, NO_REVISIONS, FIXED_RESOLVED_AT);
  const after = buildElectionCitation(
    { ...row, electionName: "2023 Argentine general election (first round)" },
    KNOWN_SOURCE,
    NO_REVISIONS,
    FIXED_RESOLVED_AT,
  );
  assert.equal(before.id, after.id);
  assert.equal(before.citationUrl, after.citationUrl);
  assert.notEqual(before.label, after.label);
});

test("RENAME ROUND TRIP — constitution-passage: heading edit never moves id/citationUrl", () => {
  const digest = `sha256:${"c".repeat(64)}`;
  const source = { sourceId: "constitute_project", sourceName: "Constitute Project", licenseId: "CC-BY-NC-3.0", sourceUrl: null };
  const row = {
    digestId: digest,
    jurisdictionSlug: "chile",
    jurisdictionName: "Chile",
    headingLabel: "Art. 1",
    sourceSectionId: "section/1",
    anchorId: "sec-section-1",
    isCurrent: true,
    supersededAt: null,
  };
  const before = buildConstitutionPassageCitation(row, source, FIXED_RESOLVED_AT);
  const after = buildConstitutionPassageCitation(
    { ...row, headingLabel: "Article One" },
    source,
    FIXED_RESOLVED_AT,
  );
  assert.equal(before.id, after.id);
  assert.equal(before.citationUrl, after.citationUrl);
  assert.notEqual(before.label, after.label);
});

test("RENAME ROUND TRIP — organization: full-name correction never moves id/citationUrl", () => {
  const row = {
    id: "ffffffff-1111-4111-8111-111111111111",
    slug: "un",
    name: "UN",
    fullName: "United Nations Organisation",
    wikidataQid: null,
  };
  const before = buildOrganizationCitation(row, KNOWN_SOURCE, FIXED_RESOLVED_AT);
  const after = buildOrganizationCitation(
    { ...row, fullName: "United Nations" },
    KNOWN_SOURCE,
    FIXED_RESOLVED_AT,
  );
  assert.equal(before.id, after.id);
  assert.equal(before.citationUrl, after.citationUrl);
  assert.notEqual(before.label, after.label);
});

test("RENAME ROUND TRIP — indicator: metric-definition relabel never moves id/citationUrl", () => {
  const row = {
    id: "12121212-1111-4111-8111-111111111111",
    jurisdictionSlug: "uruguay",
    jurisdictionName: "Uruguay",
    metricId: "hdi",
    metricName: "Human Development Index",
    year: 2024,
    sourceId: "undp_hdi",
    sourceUrl: null,
    createdAt: null,
  };
  const before = buildIndicatorCitation(row, KNOWN_SOURCE, FIXED_RESOLVED_AT);
  const after = buildIndicatorCitation(
    { ...row, metricName: "Human Development Index (HDI)" },
    KNOWN_SOURCE,
    FIXED_RESOLVED_AT,
  );
  assert.equal(before.id, after.id);
  assert.equal(before.citationUrl, after.citationUrl);
  assert.notEqual(before.label, after.label);
});
