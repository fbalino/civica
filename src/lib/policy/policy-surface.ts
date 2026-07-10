/**
 * Pure, DB-free invariants for the CLM-016 policy surface: the
 * `/policies` page itself, the closed research-artifact registry's
 * required links, and the correction simulator's frozen fixtures.
 * Mirrors the `src/lib/content/replication-surface.ts` pattern
 * (CLM-010): the pure core here takes plain strings/objects and
 * returns an issue-code list; `scripts/validate-policy-surface.ts`
 * does the file I/O and exits non-zero on any issue.
 */

import { isDeepStrictEqual } from "node:util";

import {
  POLICY_ANCHORS,
  REQUIRED_ARTIFACT_IDS,
  type PolicyAnchor,
  type ResearchArtifact,
} from "./research-artifacts";
import { extractHeadingAnchorIds } from "../docs/links";
import {
  simulateCorrection,
  FIXTURE_CORRECTION,
  EXPECTED_CORRECTION,
  FIXTURE_RETRACTION,
  EXPECTED_RETRACTION,
  FIXTURE_CLARIFICATION,
  EXPECTED_CLARIFICATION,
} from "./correction-simulator";

export type PolicySurfaceIssueCode =
  | "missing-policy-page"
  | "missing-policy-anchor"
  | "artifact-missing-policy-link"
  | "unregistered-artifact"
  | "duplicated-policy-prose"
  | "overpromise-staffing"
  | "overpromise-notification"
  | "hardcoded-sla"
  | "hardcoded-version"
  | "missing-current-boundary"
  | "simulator-drift"
  | "migration-theater";

export interface PolicySurfaceIssue {
  code: PolicySurfaceIssueCode;
  message: string;
  artifactId?: string;
  anchor?: PolicyAnchor;
}

// ─────────────────────────────────────────────────────────────────────
// Policy page + anchors
// ─────────────────────────────────────────────────────────────────────

export function checkPolicyPageExists(
  policyMarkdown: string | null,
): PolicySurfaceIssue[] {
  if (policyMarkdown == null) {
    return [
      {
        code: "missing-policy-page",
        message: "content/policies.md is missing or unreadable",
      },
    ];
  }
  return [];
}

export function findMissingPolicyAnchors(
  policyMarkdown: string,
): PolicySurfaceIssue[] {
  const found = extractHeadingAnchorIds(policyMarkdown);
  return POLICY_ANCHORS.filter((anchor) => !found.has(anchor)).map(
    (anchor) => ({
      code: "missing-policy-anchor" as const,
      anchor,
      message: `required anchor "#${anchor}" not found in content/policies.md`,
    }),
  );
}

// ─────────────────────────────────────────────────────────────────────
// Registry completeness ("every research artifact" is a closed set)
// ─────────────────────────────────────────────────────────────────────

export function checkRegistryCompleteness(
  artifacts: readonly ResearchArtifact[],
): PolicySurfaceIssue[] {
  const issues: PolicySurfaceIssue[] = [];
  const seen = new Set<string>();

  for (const artifact of artifacts) {
    if (seen.has(artifact.id)) {
      issues.push({
        code: "unregistered-artifact",
        artifactId: artifact.id,
        message: `duplicate research-artifact id "${artifact.id}"`,
      });
    }
    seen.add(artifact.id);
  }

  for (const requiredId of REQUIRED_ARTIFACT_IDS) {
    if (!seen.has(requiredId)) {
      issues.push({
        code: "unregistered-artifact",
        artifactId: requiredId,
        message: `required research artifact "${requiredId}" is missing from RESEARCH_ARTIFACTS`,
      });
    }
  }

  for (const id of seen) {
    if (!(REQUIRED_ARTIFACT_IDS as readonly string[]).includes(id)) {
      issues.push({
        code: "unregistered-artifact",
        artifactId: id,
        message: `research artifact "${id}" is registered but not in REQUIRED_ARTIFACT_IDS — extend the required-id inventory or remove the artifact`,
      });
    }
  }

  return issues;
}

/**
 * `combinedSource` is the artifact's TSX shell text concatenated with
 * its paired `content/*.md` prose (when it has one) — a link living
 * in either surface satisfies the requirement. A page may also link
 * indirectly through the shared `<ResearchArtifactPolicyLinks
 * anchors={[...]} />` component (used by pages with no existing
 * footer-nav area) — the anchor id then appears as a quoted string
 * literal alongside that component's name rather than as a literal
 * `/policies#anchor` href.
 */
function hasPolicyLink(combinedSource: string, anchor: PolicyAnchor): boolean {
  if (combinedSource.includes(`/policies#${anchor}`)) return true;
  return (
    combinedSource.includes("ResearchArtifactPolicyLinks") &&
    (combinedSource.includes(`"${anchor}"`) || combinedSource.includes(`'${anchor}'`))
  );
}

export function findArtifactMissingLinks(
  artifact: ResearchArtifact,
  combinedSource: string,
): PolicySurfaceIssue[] {
  return artifact.requiredPolicyAnchors
    .filter((anchor) => !hasPolicyLink(combinedSource, anchor))
    .map((anchor) => ({
      code: "artifact-missing-policy-link" as const,
      artifactId: artifact.id,
      anchor,
      message: `${artifact.id}: missing a link to "/policies#${anchor}"`,
    }));
}

// ─────────────────────────────────────────────────────────────────────
// Prohibited-phrase scanners (policy prose)
// ─────────────────────────────────────────────────────────────────────

export interface PhraseMatch {
  phrase: string;
  match: string;
}

function scanPhrases(
  text: string,
  patterns: readonly RegExp[],
): PhraseMatch[] {
  const matches: PhraseMatch[] = [];
  for (const pattern of patterns) {
    const re = new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`);
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      matches.push({ phrase: pattern.source, match: m[0] });
    }
  }
  return matches;
}

const STAFFING_OVERPROMISE_PATTERNS: readonly RegExp[] = [
  /24\/7/i,
  /guaranteed response/i,
  /support team/i,
  /dedicated staff/i,
  /within \d+\s*hours?/i,
];

const NOTIFICATION_OVERPROMISE_PATTERNS: readonly RegExp[] = [
  /we will email you/i,
  /subscribe to alerts?/i,
  /notify all affected/i,
  /push notifications?/i,
];

const MIGRATION_THEATER_PATTERNS: readonly RegExp[] = [
  /used to/i,
  /previously wrong/i,
  /now fixed/i,
  /was broken/i,
];

/** A `{{...}}` interpolation marker never itself contains a literal
 *  digit-day or version string — the number/string only exists after
 *  runtime substitution. Stripping markers before scanning means a
 *  correctly interpolated value can never trip the hardcoded checks. */
function stripInterpolationMarkers(text: string): string {
  return text.replace(/\{\{[^}]*\}\}/g, "");
}

const HARDCODED_SLA_PATTERN = /\b\d+\s*(calendar\s+)?days?\b/gi;
const HARDCODED_VERSION_PATTERN = /\bv\d+\.\d+(-beta)?\b/gi;

const REQUIRED_CURRENT_BOUNDARIES = [
  "not currently have an automated correction-publication job",
  "no frozen public release package yet",
  "does not currently publish a versioned api endpoint",
  "does not currently operate an email list",
  "privacy are retained for review but omitted from that public log",
] as const;

export function findMissingCurrentBoundaries(
  text: string,
): PolicySurfaceIssue[] {
  const normalized = text.toLowerCase().replace(/\s+/g, " ");
  return REQUIRED_CURRENT_BOUNDARIES.filter(
    (phrase) => !normalized.includes(phrase),
  ).map((phrase) => ({
    code: "missing-current-boundary" as const,
    message: `policy prose must disclose current boundary ${JSON.stringify(phrase)}`,
  }));
}

export function findOverpromiseStaffing(text: string): PhraseMatch[] {
  return scanPhrases(text, STAFFING_OVERPROMISE_PATTERNS);
}

export function findOverpromiseNotification(text: string): PhraseMatch[] {
  return scanPhrases(text, NOTIFICATION_OVERPROMISE_PATTERNS);
}

export function findMigrationTheater(text: string): PhraseMatch[] {
  return scanPhrases(text, MIGRATION_THEATER_PATTERNS);
}

export function findHardcodedSla(text: string): PhraseMatch[] {
  return scanPhrases(stripInterpolationMarkers(text), [HARDCODED_SLA_PATTERN]);
}

export function findHardcodedVersion(text: string): PhraseMatch[] {
  return scanPhrases(stripInterpolationMarkers(text), [
    HARDCODED_VERSION_PATTERN,
  ]);
}

export function checkPolicyProse(
  policyMarkdown: string,
): PolicySurfaceIssue[] {
  const issues: PolicySurfaceIssue[] = [];

  for (const m of findOverpromiseStaffing(policyMarkdown)) {
    issues.push({
      code: "overpromise-staffing",
      message: `forbidden staffing phrase ${JSON.stringify(m.match)} found in policy prose`,
    });
  }
  for (const m of findOverpromiseNotification(policyMarkdown)) {
    issues.push({
      code: "overpromise-notification",
      message: `forbidden notification phrase ${JSON.stringify(m.match)} found in policy prose`,
    });
  }
  for (const m of findHardcodedSla(policyMarkdown)) {
    issues.push({
      code: "hardcoded-sla",
      message: `hardcoded day-count ${JSON.stringify(m.match)} found in policy prose — interpolate from disputeSla instead`,
    });
  }
  for (const m of findHardcodedVersion(policyMarkdown)) {
    issues.push({
      code: "hardcoded-version",
      message: `hardcoded version string ${JSON.stringify(m.match)} found in policy prose — interpolate from site-state.ts instead`,
    });
  }
  for (const m of findMigrationTheater(policyMarkdown)) {
    issues.push({
      code: "migration-theater",
      message: `before/after remediation phrasing ${JSON.stringify(m.match)} found in policy prose`,
    });
  }
  issues.push(...findMissingCurrentBoundaries(policyMarkdown));

  return issues;
}

// ─────────────────────────────────────────────────────────────────────
// Duplicated policy prose in link-only mirrors
// ─────────────────────────────────────────────────────────────────────

const MIN_FINGERPRINT_SENTENCE_LENGTH = 60;

/** Splits policy prose into candidate sentences long enough that a
 *  verbatim match elsewhere is meaningfully "duplicated prose" rather
 *  than a coincidental short phrase. */
function candidateSentences(policyBody: string): string[] {
  const withoutHeadings = policyBody.replace(/^#{1,6}\s+.*$/gm, "");
  return withoutHeadings
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= MIN_FINGERPRINT_SENTENCE_LENGTH);
}

/**
 * A mirror is allowed to LINK to the policy body; it must never
 * restate a full policy sentence verbatim (§2.2). Ordinary use of
 * words like "correction" or "limitation" in unrelated prose does not
 * trip this — only a verbatim shared sentence does.
 */
export function findDuplicatedPolicyProse(
  policyBody: string,
  mirrorText: string,
  mirrorLabel: string,
): PolicySurfaceIssue[] {
  const issues: PolicySurfaceIssue[] = [];
  for (const sentence of candidateSentences(policyBody)) {
    if (mirrorText.includes(sentence)) {
      issues.push({
        code: "duplicated-policy-prose",
        message: `${mirrorLabel} restates a policy sentence verbatim instead of linking: ${JSON.stringify(sentence.slice(0, 80))}…`,
      });
    }
  }
  return issues;
}

// ─────────────────────────────────────────────────────────────────────
// Simulator drift
// ─────────────────────────────────────────────────────────────────────

export function checkSimulatorDrift(): PolicySurfaceIssue[] {
  const issues: PolicySurfaceIssue[] = [];
  const cases: Array<[string, unknown, unknown]> = [
    [
      "FIXTURE_CORRECTION",
      simulateCorrection(FIXTURE_CORRECTION),
      EXPECTED_CORRECTION,
    ],
    [
      "FIXTURE_RETRACTION",
      simulateCorrection(FIXTURE_RETRACTION),
      EXPECTED_RETRACTION,
    ],
    [
      "FIXTURE_CLARIFICATION",
      simulateCorrection(FIXTURE_CLARIFICATION),
      EXPECTED_CLARIFICATION,
    ],
  ];
  for (const [label, actual, expected] of cases) {
    if (!isDeepStrictEqual(actual, expected)) {
      issues.push({
        code: "simulator-drift",
        message: `simulateCorrection(${label}) no longer matches its frozen expected output`,
      });
    }
  }
  return issues;
}

// ─────────────────────────────────────────────────────────────────────
// Orchestration
// ─────────────────────────────────────────────────────────────────────

export interface ArtifactSource {
  artifact: ResearchArtifact;
  /** TSX shell text concatenated with the paired content/*.md file,
   *  when present. */
  combinedSource: string;
}

export interface MirrorSource {
  label: string;
  text: string;
}

export interface PolicySurfaceInput {
  policyMarkdown: string | null;
  artifactSources: readonly ArtifactSource[];
  registry: readonly ResearchArtifact[];
  mirrors: readonly MirrorSource[];
}

export function validatePolicySurface(
  input: PolicySurfaceInput,
): PolicySurfaceIssue[] {
  const issues: PolicySurfaceIssue[] = [];

  issues.push(...checkPolicyPageExists(input.policyMarkdown));
  issues.push(...checkRegistryCompleteness(input.registry));

  if (input.policyMarkdown != null) {
    issues.push(...findMissingPolicyAnchors(input.policyMarkdown));
    issues.push(...checkPolicyProse(input.policyMarkdown));

    for (const mirror of input.mirrors) {
      issues.push(
        ...findDuplicatedPolicyProse(
          input.policyMarkdown,
          mirror.text,
          mirror.label,
        ),
      );
    }
  }

  for (const { artifact, combinedSource } of input.artifactSources) {
    issues.push(...findArtifactMissingLinks(artifact, combinedSource));
  }

  issues.push(...checkSimulatorDrift());

  return issues;
}
