export const EDITORIAL_ILLUSTRATION_RIGHTS_VERSION =
  "civica-editorial-illustration-rights/v1" as const;
export const EDITORIAL_ILLUSTRATION_RIGHTS_EFFECTIVE_ON = "2026-07-23";

export const EDITORIAL_ILLUSTRATION_SCREENING_IDS = [
  "reference-copyright",
  "architecture-panorama",
  "trademark-insignia",
  "personality-likeness",
  "cultural-documentary-risk",
] as const;

export type EditorialIllustrationScreeningId =
  (typeof EDITORIAL_ILLUSTRATION_SCREENING_IDS)[number];

export interface EditorialIllustrationScreening {
  id: EditorialIllustrationScreeningId;
  question: string;
  failClosedAction: string;
}

export const EDITORIAL_ILLUSTRATION_REQUIRED_RECORD_FIELDS = [
  "asset and light/dark pair identity",
  "intended route, subject, and caption",
  "model, tool, version, and account terms checked on",
  "prompt and negative prompt",
  "seed and generation parameters when exposed",
  "every reference URL or file hash, source, author, license, and permission",
  "human direction, selection, edits, and transformation steps",
  "copyright, architecture, trademark, insignia, and likeness screening",
  "file hash, dimensions, format, and release identity",
  "reviewer, review date, result, and correction or replacement history",
] as const;

export const EDITORIAL_ILLUSTRATION_SCREENINGS: readonly EditorialIllustrationScreening[] =
  [
    {
      id: "reference-copyright",
      question:
        "Does any prompt, upload, or reference depend on a protected photograph, illustration, or other pre-existing expression?",
      failClosedAction:
        "Record the reference and permission/license or replace it; do not rely on discovery, public visibility, attribution, or an unrecorded fair-use assumption.",
    },
    {
      id: "architecture-panorama",
      question:
        "Does the image feature modern architecture, public art, interiors, or another work whose copyright or freedom-of-panorama treatment can vary by jurisdiction?",
      failClosedAction:
        "Use a cleared/public-domain alternative or obtain jurisdiction-specific professional review before release.",
    },
    {
      id: "trademark-insignia",
      question:
        "Does the image reproduce a logo, trade dress, protected emblem, flag treatment, or official insignia in a way that can imply sponsorship or source?",
      failClosedAction:
        "Remove or neutralize it unless factual editorial use and non-endorsement have been reviewed.",
    },
    {
      id: "personality-likeness",
      question:
        "Does the image depict an identifiable living or recently deceased person, or imitate a recognizable performer/public figure?",
      failClosedAction:
        "Do not release without recorded consent, a documented editorial basis, and professional review of publicity, privacy, and false-endorsement risk.",
    },
    {
      id: "cultural-documentary-risk",
      question:
        "Could the image misidentify a landmark, sacred/cultural site, community, event, or present a fictional scene as documentary fact?",
      failClosedAction:
        "Correct or replace it, preserve the failed review, and keep the non-documentary disclosure visible.",
    },
  ];

export const EDITORIAL_ILLUSTRATION_RIGHTS_POLICY = Object.freeze({
  version: EDITORIAL_ILLUSTRATION_RIGHTS_VERSION,
  effectiveOn: EDITORIAL_ILLUSTRATION_RIGHTS_EFFECTIVE_ON,
  scope:
    "Every AI-assisted, generated, edited, or photographic-treatment editorial image released by Civica, including country, territory, page, blog, navigation, and shared imagery.",
  ownership:
    "Fernando Balino records and controls Civica's human-authored selection, arrangement, captions, edits, and release decisions to the extent protectable. Civica does not claim ownership of upstream references, landmarks, marks, likenesses, provider technology, or machine-generated elements that applicable law does not protect.",
  historicalPosture:
    "Historical assets with missing model, prompt, seed, tool-terms, or reference-image records remain explicitly partial. Missing facts are never reconstructed from filenames, Git time, captions, or visual similarity.",
  futureReleaseRule:
    "An asset introduced or materially replaced on or after the effective date cannot enter a release until every required record field and screening disposition is complete.",
  displayPermission:
    "Civica authorizes display on Civica Atlas under the current non-open product posture.",
  thirdPartyReuse:
    "No separate copyright, trademark, personality-right, or other third-party reuse license is granted for editorial imagery. Public file access, attribution, citation, or a screenshot does not create such a license; applicable-law rights remain unaffected.",
  retention:
    "The checked manifest, generation/edit record, source-reference evidence, review result, and correction history are retained in Git and each frozen release. Replacement or withdrawal creates a superseding record or tombstone; it does not erase the prior release record.",
  takedown:
    "Rights or accuracy complaints use the BRD-015 complaint flow. Credible urgent risk can trigger temporary containment; evidence is preserved, conflicts are separated, a reasoned decision is recorded, the asset is corrected/replaced/withdrawn as required, and material public error receives a correction notice.",
  requiredRecordFields: EDITORIAL_ILLUSTRATION_REQUIRED_RECORD_FIELDS,
  screenings: EDITORIAL_ILLUSTRATION_SCREENINGS,
});

export function editorialIllustrationRightsPolicyErrors(): string[] {
  const errors: string[] = [];
  const policy = EDITORIAL_ILLUSTRATION_RIGHTS_POLICY;
  for (const [label, value] of Object.entries({
    scope: policy.scope,
    ownership: policy.ownership,
    historicalPosture: policy.historicalPosture,
    futureReleaseRule: policy.futureReleaseRule,
    displayPermission: policy.displayPermission,
    thirdPartyReuse: policy.thirdPartyReuse,
    retention: policy.retention,
    takedown: policy.takedown,
  })) {
    if (!value.trim()) errors.push(`empty ${label}`);
  }
  if (policy.requiredRecordFields.length < 10)
    errors.push("future record contract is incomplete");
  const ids = new Set(policy.screenings.map((screening) => screening.id));
  for (const id of EDITORIAL_ILLUSTRATION_SCREENING_IDS) {
    if (!ids.has(id)) errors.push(`missing screening: ${id}`);
  }
  if (ids.size !== policy.screenings.length)
    errors.push("duplicate illustration screening id");
  return errors;
}
