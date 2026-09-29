/**
 * DAT-037 apply authorization rules for `scripts/repair-cabinet-terms.ts`.
 *
 * Pure checks, kept out of the CLI so they are tested. Two decisions:
 *
 * 1. Public correction. `--apply` needs exactly one explicit choice:
 *    `--public-correction=waived-prelaunch` (the owner's prelaunch waiver,
 *    APR-D173: Civica has no users, so a prelaunch data repair may run
 *    without a public correction record), or `--correction-log-id=<uuid>`
 *    naming an existing correction record, which the CLI then requires to be
 *    `in_review`. Any other value, both, or neither is refused.
 *
 * 2. Owner approval evidence. The approval file must be non-empty, name the
 *    repair method the plan was built with, and contain the full SHA-256 of
 *    the plan being applied. The plan SHA is only known at plan time, so the
 *    operator appends it to the approval file after planning and before
 *    apply. A waiver must also be recorded in that file (it names APR-D173).
 */

export const PUBLIC_CORRECTION_WAIVER = "waived-prelaunch";
export const PUBLIC_CORRECTION_WAIVER_DECISION = "APR-D173";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SHA256 = /^[0-9a-f]{64}$/;

export type PublicCorrectionChoice =
  | { kind: "waived_prelaunch"; flag: typeof PUBLIC_CORRECTION_WAIVER; decision: typeof PUBLIC_CORRECTION_WAIVER_DECISION }
  | { kind: "correction_record"; correctionLogId: string };

export type AuthorizationResult<T> = { ok: true; value: T } | { ok: false; reason: string };

export function parsePublicCorrectionChoice(input: {
  publicCorrection?: string;
  correctionLogId?: string;
}): AuthorizationResult<PublicCorrectionChoice> {
  const { publicCorrection, correctionLogId } = input;
  if (publicCorrection !== undefined && correctionLogId !== undefined) {
    return {
      ok: false,
      reason: "pass exactly one of --public-correction or --correction-log-id, not both",
    };
  }
  if (publicCorrection !== undefined) {
    if (publicCorrection !== PUBLIC_CORRECTION_WAIVER) {
      return {
        ok: false,
        reason: `--public-correction accepts only ${PUBLIC_CORRECTION_WAIVER}`,
      };
    }
    return {
      ok: true,
      value: {
        kind: "waived_prelaunch",
        flag: PUBLIC_CORRECTION_WAIVER,
        decision: PUBLIC_CORRECTION_WAIVER_DECISION,
      },
    };
  }
  if (correctionLogId !== undefined) {
    if (!UUID.test(correctionLogId)) {
      return { ok: false, reason: "--correction-log-id must be a correction record UUID" };
    }
    return {
      ok: true,
      value: { kind: "correction_record", correctionLogId: correctionLogId.toLowerCase() },
    };
  }
  return {
    ok: false,
    reason: `--apply requires --public-correction=${PUBLIC_CORRECTION_WAIVER} (owner waiver, ${PUBLIC_CORRECTION_WAIVER_DECISION}) or --correction-log-id=<uuid>`,
  };
}

export function checkApprovalEvidence(
  text: string,
  expected: { planSha256: string; methodologyVersion: string; choice: PublicCorrectionChoice },
): AuthorizationResult<{ planSha256: string }> {
  if (text.trim().length === 0) {
    return { ok: false, reason: "the approval evidence file is empty" };
  }
  if (!SHA256.test(expected.planSha256)) {
    return { ok: false, reason: "the plan SHA-256 is not a 64-character lowercase hex digest" };
  }
  if (!text.includes(expected.methodologyVersion)) {
    return {
      ok: false,
      reason: `the approval evidence does not name the approved repair method ${expected.methodologyVersion}`,
    };
  }
  const digests = new Set(text.match(/\b[0-9a-f]{64}\b/g) ?? []);
  if (!digests.has(expected.planSha256)) {
    return {
      ok: false,
      reason:
        "the approval evidence does not contain this plan's SHA-256; append the production plan SHA-256 to the approval file before apply",
    };
  }
  if (
    expected.choice.kind === "waived_prelaunch" &&
    !text.includes(PUBLIC_CORRECTION_WAIVER_DECISION)
  ) {
    return {
      ok: false,
      reason: `the public-correction waiver needs an approval file that records ${PUBLIC_CORRECTION_WAIVER_DECISION}`,
    };
  }
  return { ok: true, value: { planSha256: expected.planSha256 } };
}
