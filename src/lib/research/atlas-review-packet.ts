export const ATLAS_REVIEW_PACKET_VERSION = "civica-atlas-review-packet/2026-07-v1" as const;

export const ATLAS_REVIEW_ARTIFACTS = Object.freeze([
  { id: "frozen_release", path: "data/releases/atlas-2026-07-11-g2-rc1.zip", role: "Frozen G2 release candidate archive" },
  { id: "bundle_manifest", path: "data/releases/atlas-2026-07-11/g2-rc1/bundle-manifest.v1.json", role: "Release identity and inventory" },
  { id: "checksums", path: "data/releases/atlas-2026-07-11/g2-rc1/SHA256SUMS", role: "Release checksums" },
  { id: "codebook", path: "data/releases/atlas-2026-07-11/g2-rc1/codebook.v1.json", role: "Released field codebook" },
  { id: "data_dictionary", path: "data/schema-data-dictionary.v1.json", role: "Complete schema data dictionary" },
  { id: "rights_manifest", path: "data/releases/atlas-2026-07-11/g2-rc1/rights-manifest.v1.json", role: "Source, field, product, and release rights" },
  { id: "source_input_manifest", path: "data/releases/atlas-2026-07-11/g2-rc1/source-input-manifest.v1.json", role: "Source and release-input state" },
  { id: "release_bom", path: "data/releases/atlas-2026-07-11/g2-rc1/release-bom.v1.json", role: "Release bill of materials" },
  { id: "clean_room", path: "data/releases/atlas-2026-07-11/g2-rc1/clean-room-evidence.v1.json", role: "Credential-free clean-room result" },
  { id: "reproduction", path: "data/releases/atlas-2026-07-11/g2-rc1/REPRODUCE.md", role: "Reproduction instructions" },
  { id: "coverage", path: "data/releases/atlas-2026-07-11/g2-rc1/coverage-report.v1.json", role: "Release coverage report" },
  { id: "quality", path: "data/release-quality-report.v1.json", role: "Release-quality and anomaly report" },
  { id: "limitations", path: "data/releases/atlas-2026-07-11/g2-rc1/KNOWN-LIMITATIONS.md", role: "Known limitations" },
  { id: "citation", path: "data/releases/atlas-2026-07-11/g2-rc1/CITATION.cff", role: "Citation metadata" },
  { id: "correction_policy", path: "content/policies.md", role: "Correction, retraction, supersession, and preservation policy" },
]);

export const ATLAS_REVIEW_QUESTIONS = Object.freeze([
  "Can the frozen release be reproduced from the supplied environment, manifest, codebook, and commands, and do the resulting checksums match?",
  "Does the codebook define every released field, unit, null/value state, vintage, derivation, and source meaning needed for independent use?",
  "Do the source-input and rights manifests distinguish access, citation, reuse permission, non-commercial restrictions, and excluded payloads accurately?",
  "Does the release preserve a sufficiently inspectable provenance chain from each exported fact to source identity and vintage?",
  "Are coverage and quality reports scoped honestly, with missing, unknown, unsupported, disputed, stale, and withheld states kept distinct?",
  "Are reconciliation, source independence, and precedence rules appropriate for the selected facts and supported by reproducible evidence?",
  "Do the known limitations identify the material gaps a researcher or teacher would need before reuse?",
  "Are citation metadata, version identity, checksums, and supersession rules adequate for a citable frozen release?",
  "Would the correction/retraction process preserve the scholarly record and make material changes discoverable to data users?",
  "Which blocking or major change is required before external academic outreach, and which claims should remain narrower even after that change?",
]);

export function atlasReviewPacketErrors(): string[] {
  const errors: string[] = [];
  const ids = new Set(ATLAS_REVIEW_ARTIFACTS.map(({ id }) => id));
  for (const required of ["frozen_release", "codebook", "data_dictionary", "rights_manifest", "source_input_manifest", "checksums", "clean_room", "coverage", "quality", "correction_policy"])
    if (!ids.has(required)) errors.push(`missing ${required}`);
  if (ids.size !== ATLAS_REVIEW_ARTIFACTS.length) errors.push("duplicate artifact id");
  if (ATLAS_REVIEW_QUESTIONS.length < 10) errors.push("review questionnaire is too broad or incomplete");
  return errors;
}
