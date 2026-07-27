/**
 * Fixture coverage for `../reuse-rights` (CLM-018). Pure, DB-free — no
 * network, no filesystem beyond static imports.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  RIGHTS_REGISTRY_PATH,
  RIGHTS_REGISTRY_PAGE_PATH,
  RIGHTS_REGISTRY_URL,
  ACCESS_VS_REUSE_BOUNDARY,
  CODE_RIGHTS,
  RELEASE_MANIFEST_STATUS,
  RIGHTS_ARTIFACT_CLASSES,
  REQUIRED_RIGHTS_SURFACES,
  hasRightsPointer,
  hasMachineReadableRightsPointer,
  findBlanketOpenDataClaims,
  findCodeOpenSourceClaims,
  findCompleteManifestClaims,
  findAllProhibitedRightsLanguage,
  validateRequiredRightsSurfaceSources,
} from "../reuse-rights";

// ── Registry invariants ─────────────────────────────────────────────────

test("RIGHTS_REGISTRY_PATH is an anchored /licensing section", () => {
  assert.equal(RIGHTS_REGISTRY_PATH, "/licensing#reuse");
  assert.equal(RIGHTS_REGISTRY_PAGE_PATH, "/licensing");
  assert.ok(RIGHTS_REGISTRY_URL.endsWith("/licensing#reuse"));
});

test("CODE_RIGHTS declares the non-open license file without asserting an affirmative MIT/open-source grant", () => {
  assert.equal(CODE_RIGHTS.hasLicenseFile, true);
  // The posture mentions "MIT" only to deny it; the scanner must not flag
  // the denial as an affirmative reuse grant.
  assert.deepEqual(findCodeOpenSourceClaims(CODE_RIGHTS.posture), []);
  assert.ok(/non-open, all-rights-reserved/i.test(CODE_RIGHTS.posture));
  assert.ok(/no open-source reuse license/i.test(CODE_RIGHTS.posture));
});

test("RELEASE_MANIFEST_STATUS publishes the DAT-003 registry", () => {
  assert.equal(RELEASE_MANIFEST_STATUS.available, true);
  assert.equal(RELEASE_MANIFEST_STATUS.owner, "DAT-003");
  assert.ok(
    /publishes a machine-readable rights registry/i.test(
      RELEASE_MANIFEST_STATUS.statement,
    ),
  );
});

test("every RIGHTS_ARTIFACT_CLASSES row has nonempty required fields", () => {
  for (const row of RIGHTS_ARTIFACT_CLASSES) {
    assert.ok(row.label.trim().length > 0, `${row.id} label`);
    assert.ok(row.scope.trim().length > 0, `${row.id} scope`);
    assert.ok(
      row.currentPermissionPosture.trim().length > 0,
      `${row.id} posture`,
    );
    assert.ok(row.governingBasis.trim().length > 0, `${row.id} governingBasis`);
    assert.ok(row.readerAction.trim().length > 0, `${row.id} readerAction`);
  }
});

test("RIGHTS_ARTIFACT_CLASSES has no unqualified blanket-open-data or false-manifest language", () => {
  for (const row of RIGHTS_ARTIFACT_CLASSES) {
    const blob = [
      row.scope,
      row.currentPermissionPosture,
      row.governingBasis,
      row.readerAction,
    ].join("\n");
    assert.deepEqual(
      findAllProhibitedRightsLanguage(blob),
      [],
      `artifact class ${row.id}`,
    );
  }
});

test("the source-data row does not generalize about 'most index feeds'", () => {
  const row = RIGHTS_ARTIFACT_CLASSES.find((r) => r.id === "source-data");
  assert.ok(row);
  assert.equal(/most index feeds/i.test(row!.currentPermissionPosture), false);
});

test("the downloads-api row does not claim every export always carries per-row license fields", () => {
  const row = RIGHTS_ARTIFACT_CLASSES.find((r) => r.id === "downloads-api");
  assert.ok(row);
  assert.ok(
    /not every export or endpoint currently carries/i.test(
      row!.currentPermissionPosture,
    ),
  );
});

test("the civica-derived-outputs row states citation is credit, not permission", () => {
  const row = RIGHTS_ARTIFACT_CLASSES.find(
    (r) => r.id === "civica-derived-outputs",
  );
  assert.ok(row);
  assert.ok(
    /not.*grant a standalone dataset license/i.test(
      row!.currentPermissionPosture,
    ),
  );
  assert.ok(
    /not the same as obtaining reuse permission/i.test(row!.readerAction),
  );
});

test("REQUIRED_RIGHTS_SURFACES declares at least one path per surface", () => {
  for (const surface of REQUIRED_RIGHTS_SURFACES) {
    assert.ok(surface.paths.length > 0, surface.id);
  }
});

test("required-surface coverage fails on a silent or missing point-of-use surface", () => {
  const sources = Object.fromEntries(
    REQUIRED_RIGHTS_SURFACES.flatMap((surface) =>
      surface.paths.map((path) => [
        path,
        '<a href="/licensing#reuse">Rights</a>',
      ]),
    ),
  );
  assert.deepEqual(validateRequiredRightsSurfaceSources(sources), []);

  const silent = {
    ...sources,
    "src/components/cite/CiteAccordion.tsx": "citation only",
  };
  assert.ok(
    validateRequiredRightsSurfaceSources(silent).some(
      (issue) =>
        issue.ruleId === "missing-pointer" && issue.surfaceId === "citation-ui",
    ),
  );

  const missing = { ...sources };
  delete missing["src/components/SiteFooter.tsx"];
  assert.ok(
    validateRequiredRightsSurfaceSources(missing).some(
      (issue) =>
        issue.ruleId === "missing-surface" && issue.surfaceId === "footer",
    ),
  );

  const embedMetaOnly = {
    ...sources,
    "src/app/embed/[slug]/route.ts":
      '<meta name="civica:rights" content="https://civicaatlas.org/licensing#reuse">',
  };
  const embedIssues = validateRequiredRightsSurfaceSources(embedMetaOnly);
  assert.equal(
    embedIssues.some((issue) => issue.path === "src/app/embed/[slug]/route.ts"),
    false,
  );
  assert.equal(embedIssues.length, 0);
});

// ── hasRightsPointer / hasMachineReadableRightsPointer ──────────────────

test("hasRightsPointer accepts the anchored path, the bare page path, and absolute forms", () => {
  assert.ok(hasRightsPointer('<a href="/licensing#reuse">Licensing</a>'));
  assert.ok(hasRightsPointer('<a href="/licensing">Licensing</a>'));
  assert.ok(hasRightsPointer("https://civicaatlas.org/licensing#reuse"));
  assert.equal(
    hasRightsPointer('<a href="/licensing#imagery">Imagery policy</a>'),
    false,
  );
  assert.equal(
    hasRightsPointer('import { RIGHTS_REGISTRY_PATH } from "./rights";'),
    false,
  );
  assert.equal(
    hasRightsPointer(
      'import { RIGHTS_REGISTRY_PATH } from "./rights"; // RIGHTS_REGISTRY_PATH is canonical',
    ),
    false,
  );
  assert.ok(
    hasRightsPointer(
      'import { RIGHTS_REGISTRY_PATH } from "./rights"; <a href={RIGHTS_REGISTRY_PATH}>Rights</a>',
    ),
  );
  assert.equal(hasRightsPointer("<p>no pointer here</p>"), false);
});

test("hasMachineReadableRightsPointer accepts a civica:rights meta tag or an absolute URL", () => {
  assert.ok(
    hasMachineReadableRightsPointer(
      '<meta name="civica:rights" content="https://civicaatlas.org/licensing">',
    ),
  );
  assert.ok(
    hasMachineReadableRightsPointer("https://civicaatlas.org/licensing#reuse"),
  );
  assert.equal(hasMachineReadableRightsPointer("<p>nothing</p>"), false);
});

// ── Blanket open-data claims ─────────────────────────────────────────────

test("findBlanketOpenDataClaims flags an unscoped 'all data is open' claim", () => {
  const findings = findBlanketOpenDataClaims(
    "All data on Civica is open and free to use.",
  );
  assert.ok(findings.length > 0);
  assert.ok(
    findBlanketOpenDataClaims("Civica data is free to reuse.").length > 0,
  );
  assert.ok(
    findBlanketOpenDataClaims("Every dataset is public domain.").length > 0,
  );
});

test("findBlanketOpenDataClaims does not flag a scoped, source-by-source claim", () => {
  const findings = findBlanketOpenDataClaims(
    "Public-domain and CC0 data can generally be reused freely; publisher-restricted datasets remain governed by their original terms.",
  );
  assert.deepEqual(findings, []);
});

// ── Code open-source / MIT claims ────────────────────────────────────────

test("findCodeOpenSourceClaims flags an MIT-license claim", () => {
  const findings = findCodeOpenSourceClaims(
    "The Civica codebase itself is MIT-licensed.",
  );
  assert.ok(findings.length > 0);
});

test("findCodeOpenSourceClaims flags 'Civica is open-source'", () => {
  const findings = findCodeOpenSourceClaims(
    "Civica is open-source and welcomes contributions.",
  );
  assert.ok(findings.length > 0);
});

test("findCodeOpenSourceClaims does not flag an explicit denial of an MIT license", () => {
  const findings = findCodeOpenSourceClaims(
    "No root LICENSE file is published, so no open-source reuse license (MIT or otherwise) is currently granted for the code.",
  );
  assert.deepEqual(findings, []);
});

test("findCodeOpenSourceClaims does not flag a nearby denial of an MIT license", () => {
  const findings = findCodeOpenSourceClaims(
    "Civica has not published an MIT license for the repository.",
  );
  assert.deepEqual(findings, []);
});

// ── Complete-manifest claims ──────────────────────────────────────────────

test("findCompleteManifestClaims flags a false claim that the complete manifest ships", () => {
  const findings = findCompleteManifestClaims(
    "Civica publishes a complete rights manifest covering every source and field.",
  );
  assert.ok(findings.length > 0);
});

test("findCompleteManifestClaims does not flag the scoped machine-readable registry statement", () => {
  const findings = findCompleteManifestClaims(
    RELEASE_MANIFEST_STATUS.statement,
  );
  assert.deepEqual(findings, []);
});

test("findCompleteManifestClaims does not flag 'there is no complete rights manifest'", () => {
  const findings = findCompleteManifestClaims(
    "There is no complete rights manifest published today; DAT-003 owns that future artifact.",
  );
  assert.deepEqual(findings, []);
});

// ── ACCESS_VS_REUSE_BOUNDARY content ───────────────────────────────────────

test("ACCESS_VS_REUSE_BOUNDARY does not claim attribution is legally required for public-domain/CC0", () => {
  assert.equal(/legally required/i.test(ACCESS_VS_REUSE_BOUNDARY), false);
  assert.ok(/upstream/i.test(ACCESS_VS_REUSE_BOUNDARY));
});

test("findAllProhibitedRightsLanguage is negation-aware across all three rule families at once", () => {
  const honestParagraph = [
    "No root LICENSE file is published, so no open-source reuse license is currently granted.",
    "There is no complete rights manifest published today.",
    "Public-domain and CC0 data can generally be reused freely; publisher-restricted datasets remain governed by their original terms.",
  ].join(" ");
  assert.deepEqual(findAllProhibitedRightsLanguage(honestParagraph), []);
});
