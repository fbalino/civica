import assert from "node:assert/strict";
import test from "node:test";

import {
  buildTemporalMetadataAuditReport,
  temporalMetadataAuditErrors,
  temporalMetadataAuditSemanticSha256,
  type TemporalMetadataAuditReportBody,
} from "./temporal-metadata-audit";

const BODY: TemporalMetadataAuditReportBody = {
  schemaVersion: "temporal-metadata-audit/v1",
  checkedAt: "2026-07-11",
  contract: "temporal-metadata/v1",
  auditSource: "production_neon_read_only_aggregate",
  readOnly: true,
  atlasVintage: {
    rows: 100,
    observationReferenceYearPresent: 90,
    upstreamDatasetReleasePresent: 80,
    sourceRetrievedAtPresent: 80,
    civicaPublicationVersionPresent: 100,
    publicationVersionMismatches: 0,
    postCutRetrievalsRetained: 0,
  },
  bjornskovRodeCgv: {
    rows: 10,
    observationReferenceYear: 2022,
    sourceDatasetRelease: "Bjørnskov-Rode regime data v6.1",
    distributionRelease: "QoG Standard Jan26",
    retrievedAt: "2026-04-22T04:01:13.289Z",
    civicaPublicationVersion: "2026_v1",
    temporalMismatches: 0,
  },
  writesPerformedByAudit: 0,
};

test("a dated read-only temporal audit report passes strict validation", () => {
  assert.deepEqual(
    temporalMetadataAuditErrors(buildTemporalMetadataAuditReport(BODY)),
    [],
  );
});

test("a seeded count edit breaks the checked report semantic hash", () => {
  const report = buildTemporalMetadataAuditReport(BODY);
  report.atlasVintage.rows += 1;
  assert.match(
    temporalMetadataAuditErrors(report).join("; "),
    /semantic hash drifted/,
  );
});

test("seeded invariant corruption fails even when its semantic hash is recomputed", () => {
  const corruptions: Array<[string, TemporalMetadataAuditReportBody, RegExp]> =
    [
      [
        "publication mismatch",
        {
          ...BODY,
          atlasVintage: {
            ...BODY.atlasVintage,
            publicationVersionMismatches: 1,
          },
        },
        /publication-version mismatches/,
      ],
      [
        "wrong BR reference year",
        {
          ...BODY,
          bjornskovRodeCgv: {
            ...BODY.bjornskovRodeCgv,
            observationReferenceYear: 2025,
          },
        },
        /reference year must remain 2022/,
      ],
      [
        "write-bearing audit",
        { ...BODY, writesPerformedByAudit: 1 },
        /must not perform writes/,
      ],
    ];

  for (const [label, body, expected] of corruptions) {
    assert.match(
      temporalMetadataAuditErrors(buildTemporalMetadataAuditReport(body)).join(
        "; ",
      ),
      expected,
      label,
    );
  }
});

test("strict schema rejects an unexpected field even with a matching hash", () => {
  const body = { ...BODY, inventedClock: "current-year" };
  const report = {
    ...body,
    semanticSha256: temporalMetadataAuditSemanticSha256(body),
  };
  assert.match(
    temporalMetadataAuditErrors(report).join("; "),
    /unexpected field inventedClock/,
  );
});

test("strict date parsing reports impossible audit dates without throwing", () => {
  const report = buildTemporalMetadataAuditReport({
    ...BODY,
    checkedAt: "2026-99-99",
  });
  assert.match(
    temporalMetadataAuditErrors(report).join("; "),
    /checkedAt must be an ISO calendar date/,
  );
});
