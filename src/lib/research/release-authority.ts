import { createHash } from "node:crypto";

export const RELEASE_AUTHORITY_VERSION = "civica-release-correction-authority/v1" as const;

export const RELEASE_AUTHORITY = Object.freeze({
  schemaVersion: RELEASE_AUTHORITY_VERSION,
  effectiveOn: "2026-07-11",
  approver: Object.freeze({
    name: "Fernando Baliño",
    role: "Founder, publisher, and responsible human decision-maker",
    releaseAuthority: "Approve preview, frozen, DOI, superseding, retracted, rolled-back, and retired release states after applicable gates pass.",
    methodologyAuthority: "Approve methodology versions and claim standing after applicable validation and independent-review gates pass.",
    correctionAuthority: "Classify reports and approve correction, clarification, no-change, rejection, supersession, or retraction.",
    emergencyAuthority: "Temporarily suppress affected facts, routes, exports, jobs, credentials, or releases to contain credible ongoing harm.",
  }),
  independenceBoundary:
    "The approver cannot rewrite an independent report, waive an unmanageable personal conflict, or restore a suspended surface without the recorded restoration evidence. An unmanageable owner conflict blocks the affected decision until a qualified independent decision-maker is appointed.",
  versionTriggers: Object.freeze({
    major: "Incompatible construct, unit, scale, dimension, taxonomy, normalization, or interpretation change; prior and new outputs are not directly comparable.",
    minor: "Comparable-method refinement, added source/category, threshold change, or computation correction that can change outputs.",
    patch: "Documentation, presentation, metadata, or implementation correction that does not change research outputs or their interpretation.",
    beta: "Validation standing only; it does not reduce the required major/minor/patch increment.",
  }),
  emergency: Object.freeze({
    triggers: ["credible material misinformation", "active security compromise", "privacy exposure", "rights breach", "unsafe automated output"],
    immediateActions: ["stop propagation", "preserve the minimum lawful evidence", "record affected identities", "open a dated incident/correction record", "set restoration criteria"],
    reviewDeadlineHours: 72,
    restorationRule: "Resolve the trigger, pass applicable checks, publish required notice, and record Fernando Baliño's restoration decision.",
  }),
  historicalPreservation: Object.freeze({
    correction: "Publish the corrected value or statement prospectively and retain the prior value/version as superseded in history.",
    supersession: "Keep both versions addressable and link predecessor and successor in both directions.",
    retraction: "Keep a dated public tombstone, reason, scope, and audit copy; do not silently delete the research record.",
    securityException: "Restrict harmful payload bytes while retaining a lawful metadata/tombstone record and private incident evidence.",
  }),
  doi: Object.freeze({
    mutableMetadataOnly: "A DOI's descriptive metadata may be corrected without changing the object only when the underlying release bytes and interpretation are unchanged.",
    correctedRelease: "A changed frozen release receives a new version and DOI; metadata links it as IsNewVersionOf the prior DOI and the prior DOI as IsPreviousVersionOf the successor.",
    retraction: "The original DOI continues to resolve to a retraction notice and preserved metadata. A withdrawal never reassigns the DOI to different bytes.",
    preRegistrationBoundary: "No DOI relationship is claimed until the repository accepts the corresponding frozen object and identifiers.",
  }),
  noticeLocations: Object.freeze([
    "/policies",
    "/civica-index/corrections",
    "affected artifact release notes or changelog",
    "release/DOI landing page after DOI registration",
    "affected API metadata or deprecation headers where applicable",
  ]),
  reportAndAppeal: Object.freeze({
    reportRoutes: ["/civica-index/corrections", "/contact"],
    appealRule: "A reporter or affected contributor may request one reconsideration with new evidence or a claimed process error. The appeal, response, and final disposition are retained.",
    conflictRule: "A material conflict held by the original decision-maker requires a named independent appeal decision-maker.",
    noRetaliation: "Critical reports, appeals, reviewer disagreement, and recommendations to retract or retire do not reduce payment, access to the response, or future eligibility.",
  }),
});

export interface ReleaseIncidentInput {
  incidentId: string;
  detectedAt: string;
  kind: "material_error" | "methodology_failure" | "security_or_rights";
  artifactId: string;
  fromVersion: string;
  fromDoi: string | null;
  summary: string;
  changedFrozenBytes: boolean;
}

export function simulateReleaseIncident(input: ReleaseIncidentInput) {
  const nextVersion = input.kind === "methodology_failure" ? "v2.0.0" : input.changedFrozenBytes ? "v1.1.0" : "v1.0.1";
  const disposition = input.kind === "methodology_failure" ? "retraction_pending_replacement" : "correction_pending";
  return {
    incident: { ...input, actor: RELEASE_AUTHORITY.approver.name, status: "contained_pending_disposition" },
    emergencyAction: {
      action: input.kind === "security_or_rights" ? "restrict_affected_payload_and_export" : "suppress_affected_claim_and_promotion",
      takenAt: input.detectedAt,
      reviewDueAt: new Date(Date.parse(input.detectedAt) + RELEASE_AUTHORITY.emergency.reviewDeadlineHours * 3_600_000).toISOString(),
      restorationCriteria: RELEASE_AUTHORITY.emergency.restorationRule,
    },
    changelog: { incidentId: input.incidentId, artifactId: input.artifactId, fromVersion: input.fromVersion, disposition, summary: input.summary },
    releaseNote: { artifactId: input.artifactId, fromVersion: input.fromVersion, proposedVersion: nextVersion, status: disposition },
    doiAction: input.fromDoi === null
      ? { status: "no_registered_doi", relation: null }
      : input.changedFrozenBytes
        ? { status: "new_doi_required", relation: { relationType: "IsNewVersionOf", relatedIdentifier: input.fromDoi } }
        : { status: "metadata_correction_only", relation: null },
    notices: [...RELEASE_AUTHORITY.noticeLocations],
    appeal: { routes: [...RELEASE_AUTHORITY.reportAndAppeal.reportRoutes], rule: RELEASE_AUTHORITY.reportAndAppeal.appealRule },
  };
}

export function releaseAuthorityHash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function releaseAuthorityErrors(record: typeof RELEASE_AUTHORITY = RELEASE_AUTHORITY): string[] {
  const errors: string[] = [];
  if (record.schemaVersion !== RELEASE_AUTHORITY_VERSION) errors.push("wrong schema version");
  if (record.approver.name !== "Fernando Baliño") errors.push("named approver missing");
  if (Object.keys(record.versionTriggers).sort().join(",") !== "beta,major,minor,patch") errors.push("version triggers incomplete");
  if (!record.doi.correctedRelease.includes("new version and DOI") || !record.doi.retraction.includes("continues to resolve")) errors.push("DOI policy incomplete");
  if (record.noticeLocations.length < 5 || record.reportAndAppeal.reportRoutes.length < 2) errors.push("notice or appeal routes incomplete");
  return errors;
}
