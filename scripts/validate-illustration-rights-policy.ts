import { existsSync, readFileSync } from "node:fs";

import {
  EDITORIAL_ILLUSTRATION_RIGHTS_EFFECTIVE_ON,
  EDITORIAL_ILLUSTRATION_RIGHTS_VERSION,
  editorialIllustrationRightsPolicyErrors,
} from "../src/lib/illustrations/rights-policy";

const errors = editorialIllustrationRightsPolicyErrors();
const read = (path: string) => readFileSync(path, "utf8");

const policyPath = "data/EDITORIAL-ILLUSTRATION-RIGHTS.md";
const policy = read(policyPath);
for (const fragment of [
  EDITORIAL_ILLUSTRATION_RIGHTS_VERSION,
  "Ownership and provider terms",
  "Reference images and derivative-work risk",
  "Architecture and panorama",
  "Trademark and insignia",
  "Personality and likeness",
  "Manifest and evidence retention",
  "Correction, complaint, and takedown",
  "professional-review-required",
  "Uncommitted image experiments",
]) {
  if (!policy.includes(fragment))
    errors.push(`${policyPath}: missing ${fragment}`);
}

const manifestPath =
  "src/lib/illustrations/illustration-manifest.generated.json";
const manifest = JSON.parse(read(manifestPath)) as {
  contract?: string;
  rightsPolicy?: {
    version?: string;
    effectiveOn?: string;
    operatorPolicy?: string;
    publicDisclosure?: string;
    thirdPartyReuse?: string;
  };
  retention?: {
    history?: string;
    replacement?: string;
    publicSecretsOrUnlicensedReferenceBytes?: string;
  };
  summary?: {
    assetCount?: number;
    irrecoverableGenerationSessions?: number;
    completeForwardGenerationRecords?: number;
  };
  assets?: Array<{
    id?: string;
    origin?: {
      provider?: string | null;
      model?: string;
      version?: string | null;
      tool?: string;
      prompt?: string;
      negativePrompt?: string | null;
      sourceReferences?: unknown;
      parameters?: Record<string, unknown> | null;
      accountContext?: string | null;
      accountTerms?: {
        name?: string;
        url?: string;
        effectiveOn?: string;
        checkedOn?: string;
        applicabilityBasis?: string;
        outputRightsSummary?: string;
        nonUniquenessSummary?: string;
      } | null;
      humanDirection?: Record<string, unknown> | null;
      selection?: Record<string, unknown> | null;
      provenanceStatus?: string;
      firstTrackedAt?: string | null;
    };
    rights?: {
      policy?: string;
      sourceEvidence?: boolean;
      forwardRecord?: string | null;
      screenings?: Array<{
        id?: string;
        disposition?: string;
        reason?: string;
      }> | null;
      review?: {
        reviewer?: string;
        reviewedOn?: string;
        outcome?: string;
      } | null;
      release?: {
        releaseIdentity?: string;
        status?: string;
      } | null;
      correctionHistory?: Array<Record<string, unknown>> | null;
    };
  }>;
};

if (manifest.rightsPolicy?.version !== EDITORIAL_ILLUSTRATION_RIGHTS_VERSION)
  errors.push("manifest rights-policy version drifted");
if (
  manifest.rightsPolicy?.effectiveOn !==
  EDITORIAL_ILLUSTRATION_RIGHTS_EFFECTIVE_ON
)
  errors.push("manifest rights-policy effective date drifted");
if (manifest.rightsPolicy?.operatorPolicy !== policyPath)
  errors.push("manifest does not link the operator rights policy");
if (manifest.rightsPolicy?.publicDisclosure !== "/licensing#imagery")
  errors.push("manifest does not link the public imagery disclosure");
if (
  !manifest.rightsPolicy?.thirdPartyReuse?.includes(
    "No separate copyright",
  )
)
  errors.push("manifest does not retain the conservative reuse posture");
if (manifest.retention?.history !== "git-and-frozen-release-snapshots")
  errors.push("manifest history retention contract drifted");
if (manifest.retention?.replacement !== "superseding-record-or-tombstone")
  errors.push("manifest replacement retention contract drifted");
if (
  manifest.retention?.publicSecretsOrUnlicensedReferenceBytes !== "prohibited"
)
  errors.push("manifest public-evidence exclusion drifted");

const assets = manifest.assets ?? [];
if (manifest.summary?.assetCount !== assets.length)
  errors.push("manifest asset summary does not match rows");
let irrecoverable = 0;
let completeForward = 0;
for (const asset of assets) {
  if (asset.rights?.policy !== "/licensing#imagery")
    errors.push(`${asset.id}: public policy pointer drifted`);
  if (asset.rights?.sourceEvidence !== false)
    errors.push(`${asset.id}: illustration can be mistaken for source evidence`);
  const origin = asset.origin;
  const partial = [
    origin?.model,
    origin?.tool,
    origin?.prompt,
    origin?.sourceReferences,
  ].some((value) => value === "unknown-not-retained");
  if (
    origin?.provenanceStatus ===
    "partial-irrecoverable-generation-session"
  )
    irrecoverable += 1;
  if (origin?.provenanceStatus === "complete-forward-generation-record") {
    completeForward += 1;
    for (const [field, value] of Object.entries({
      provider: origin.provider,
      model: origin.model,
      version: origin.version,
      tool: origin.tool,
      prompt: origin.prompt,
      negativePrompt: origin.negativePrompt,
      accountContext: origin.accountContext,
    })) {
      if (typeof value !== "string" || !value.trim()) {
        errors.push(`${asset.id}: forward generation record missing ${field}`);
      }
    }
    if (!origin.parameters || !Object.keys(origin.parameters).length)
      errors.push(`${asset.id}: forward generation parameters missing`);
    const terms = origin.accountTerms;
    for (const [field, value] of Object.entries({
      name: terms?.name,
      url: terms?.url,
      effectiveOn: terms?.effectiveOn,
      checkedOn: terms?.checkedOn,
      applicabilityBasis: terms?.applicabilityBasis,
      outputRightsSummary: terms?.outputRightsSummary,
      nonUniquenessSummary: terms?.nonUniquenessSummary,
    })) {
      if (typeof value !== "string" || !value.trim()) {
        errors.push(`${asset.id}: account terms missing ${field}`);
      }
    }
    if (!origin.humanDirection || !Object.keys(origin.humanDirection).length)
      errors.push(`${asset.id}: human direction record missing`);
    if (!origin.selection || !Object.keys(origin.selection).length)
      errors.push(`${asset.id}: selection record missing`);
    if (asset.rights?.forwardRecord !== "data/illustration-generation-records.v1.json")
      errors.push(`${asset.id}: forward record pointer missing`);
    const screenings = asset.rights?.screenings ?? [];
    const screeningIds = new Set(screenings.map((screening) => screening.id));
    for (const id of [
      "reference-copyright",
      "architecture-panorama",
      "trademark-insignia",
      "personality-likeness",
      "cultural-documentary-risk",
    ]) {
      if (!screeningIds.has(id))
        errors.push(`${asset.id}: screening missing ${id}`);
    }
    for (const screening of screenings) {
      if (
        !["cleared", "replaced", "withheld", "professional-review-required"].includes(
          screening.disposition ?? "",
        ) ||
        !screening.reason?.trim()
      ) {
        errors.push(`${asset.id}: invalid screening ${screening.id ?? "unknown"}`);
      }
      if (screening.disposition === "professional-review-required")
        errors.push(`${asset.id}: professional review blocks release`);
    }
    if (
      !asset.rights?.review?.reviewer?.trim() ||
      !asset.rights.review.reviewedOn?.trim() ||
      asset.rights.review.outcome !== "cleared"
    ) {
      errors.push(`${asset.id}: cleared release review missing`);
    }
    if (
      !asset.rights?.release?.releaseIdentity?.trim() ||
      !asset.rights.release.status?.trim()
    ) {
      errors.push(`${asset.id}: release identity missing`);
    }
    if (!Array.isArray(asset.rights?.correctionHistory))
      errors.push(`${asset.id}: correction history missing`);
  }
  if (
    origin?.firstTrackedAt &&
    origin.firstTrackedAt.slice(0, 10) >=
      EDITORIAL_ILLUSTRATION_RIGHTS_EFFECTIVE_ON &&
    partial
  ) {
    errors.push(
      `${asset.id}: asset introduced after the policy effective date has an incomplete generation/reference record`,
    );
  }
}
if (manifest.summary?.irrecoverableGenerationSessions !== irrecoverable)
  errors.push("irrecoverable generation-session count drifted");
if (manifest.summary?.completeForwardGenerationRecords !== completeForward)
  errors.push("complete forward-generation count drifted");

const manual = read("plan/MANUAL-CHECKS.md");
if (!manual.includes("BRD-010"))
  errors.push("BRD-010 professional review is not queued");
const evidencePath = "plan/evidence/BRD-010/rights-policy-audit.v1.json";
if (!existsSync(evidencePath))
  errors.push(`missing ${evidencePath}`);
else {
  const evidence = JSON.parse(read(evidencePath)) as {
    manifestAssetCount?: number;
    irrecoverableGenerationSessions?: number;
    completeForwardGenerationRecords?: number;
    assetsWithIncompleteOriginRecords?: number;
  };
  if (evidence.manifestAssetCount !== assets.length)
    errors.push("BRD-010 evidence asset count drifted");
  if (evidence.irrecoverableGenerationSessions !== irrecoverable)
    errors.push("BRD-010 evidence provenance count drifted");
  if (evidence.completeForwardGenerationRecords !== completeForward)
    errors.push("BRD-010 forward-record count drifted");
  if (
    evidence.assetsWithIncompleteOriginRecords !==
    assets.length - completeForward
  )
    errors.push("BRD-010 incomplete-origin count drifted");
}

const packageJson = JSON.parse(read("package.json")) as {
  scripts?: Record<string, string>;
};
if (
  !packageJson.scripts?.["validate:editorial-illustrations"]?.includes(
    "validate:illustration-rights-policy",
  )
) {
  errors.push("editorial-illustration aggregate omits the rights-policy gate");
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log(
  `PASS ${EDITORIAL_ILLUSTRATION_RIGHTS_VERSION}: ownership limits, provider/reference records, subject screening, retention, reuse, complaint handling, and professional-review boundaries are closed for ${assets.length} manifest assets.`,
);
