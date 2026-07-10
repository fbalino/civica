/**
 * Pure, DB-free, clock-free correction simulator (CLM-016 §7.5).
 *
 * `simulateCorrection()` is the executable proof of the CLM-016
 * "Done when" clause: a simulated correction produces the expected
 * changelog entry, supersession marker, and release-note entry. No
 * database, no network, no `new Date()` — every date is a field on
 * the input, per the repo's no-clock rule.
 */

import { artifactLabel } from "./research-artifacts";

export type PolicySeverity = "critical" | "major" | "minor" | "editorial";

export type CorrectionDisposition =
  | "correction"
  | "clarification"
  | "no-change"
  | "rejected"
  | "retraction";

export interface CorrectionInput {
  artifactId: string;
  fromVersion: string;
  /** Ignored by the simulator for "clarification", "no-change",
   *  "rejected", and "retraction" — those never bump the version, so
   *  the output always carries `fromVersion` instead. Only
   *  "correction" actually adopts this value. */
  toVersion: string;
  disposition: CorrectionDisposition;
  severity: PolicySeverity | null;
  /** One-line, present-tense summary — becomes the changelog summary
   *  and the release-note's sole change bullet. */
  summary: string;
  /** Short reader-facing phrase used inside the release-note
   *  headline. Defaults to `summary` when omitted. */
  headlineSummary?: string;
  correctionLogId: string | null;
  /** ISO date, passed in by the caller — never `new Date()`. */
  effectiveDate: string;
}

export type ChangelogEntryType =
  | "correction"
  | "clarification"
  | "no-change"
  | "retraction"
  | "supersession"
  | "methodology-change";

export interface ChangelogEntry {
  artifactId: string;
  version: string;
  date: string;
  type: ChangelogEntryType;
  severity: PolicySeverity | null;
  summary: string;
  correctionLogId: string | null;
}

export type SupersessionKind =
  | "correction"
  | "supersession"
  | "retraction"
  | "methodology-change";

export interface SupersessionMarker {
  artifactId: string;
  fromVersion: string;
  toVersion: string;
  kind: SupersessionKind;
  reason: string;
  effectiveDate: string;
  /** Present only when `kind === "retraction"` — there is no
   *  successor version for a retraction. */
  retractedAt?: string;
}

export interface ReleaseNote {
  artifactId: string;
  version: string;
  date: string;
  headline: string;
  changes: string[];
  supersedes: string | null;
}

export interface CorrectionSimulationResult {
  changelog: ChangelogEntry | null;
  supersession: SupersessionMarker | null;
  releaseNote: ReleaseNote | null;
}

/**
 * Runs a correction disposition through the CLM-016 marker rules
 * (§3, §6, §7.1–§7.4). Pure: no I/O, no clock, deterministic on
 * `input` alone.
 */
export function simulateCorrection(
  input: CorrectionInput,
): CorrectionSimulationResult {
  const label = artifactLabel(input.artifactId);
  const headlineSummary = input.headlineSummary ?? input.summary;

  switch (input.disposition) {
    case "correction": {
      const changelog: ChangelogEntry = {
        artifactId: input.artifactId,
        version: input.toVersion,
        date: input.effectiveDate,
        type: "correction",
        severity: input.severity,
        summary: input.summary,
        correctionLogId: input.correctionLogId,
      };
      const supersession: SupersessionMarker = {
        artifactId: input.artifactId,
        fromVersion: input.fromVersion,
        toVersion: input.toVersion,
        kind: "correction",
        reason: input.summary,
        effectiveDate: input.effectiveDate,
      };
      const releaseNote: ReleaseNote = {
        artifactId: input.artifactId,
        version: input.toVersion,
        date: input.effectiveDate,
        headline: `${label} ${input.toVersion} — ${headlineSummary}`,
        changes: [input.summary],
        supersedes: input.fromVersion,
      };
      return { changelog, supersession, releaseNote };
    }

    case "clarification": {
      const changelog: ChangelogEntry = {
        artifactId: input.artifactId,
        version: input.fromVersion,
        date: input.effectiveDate,
        type: "clarification",
        severity: "editorial",
        summary: input.summary,
        correctionLogId: input.correctionLogId,
      };
      return { changelog, supersession: null, releaseNote: null };
    }

    case "no-change": {
      const changelog: ChangelogEntry = {
        artifactId: input.artifactId,
        version: input.fromVersion,
        date: input.effectiveDate,
        type: "no-change",
        severity: null,
        summary: input.summary,
        correctionLogId: input.correctionLogId,
      };
      return { changelog, supersession: null, releaseNote: null };
    }

    case "rejected": {
      // §3: rejected dispositions produce a log entry only — no
      // changelog, supersession marker, or release note.
      return { changelog: null, supersession: null, releaseNote: null };
    }

    case "retraction": {
      const changelog: ChangelogEntry = {
        artifactId: input.artifactId,
        version: input.fromVersion,
        date: input.effectiveDate,
        type: "retraction",
        severity: input.severity,
        summary: input.summary,
        correctionLogId: input.correctionLogId,
      };
      const supersession: SupersessionMarker = {
        artifactId: input.artifactId,
        fromVersion: input.fromVersion,
        toVersion: input.fromVersion,
        kind: "retraction",
        reason: input.summary,
        effectiveDate: input.effectiveDate,
        retractedAt: input.effectiveDate,
      };
      const releaseNote: ReleaseNote = {
        artifactId: input.artifactId,
        version: input.fromVersion,
        date: input.effectiveDate,
        headline: `RETRACTED — ${label} — ${headlineSummary}`,
        changes: [input.summary],
        supersedes: null,
      };
      return { changelog, supersession, releaseNote };
    }

    default: {
      const exhaustive: never = input.disposition;
      throw new Error(`Unhandled disposition: ${exhaustive}`);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────
// Frozen fixtures + expected outputs (CLM-016 §7.5 acceptance proof)
// ─────────────────────────────────────────────────────────────────────

export const FIXTURE_CORRECTION: CorrectionInput = {
  artifactId: "civica-index",
  fromVersion: "v2.0",
  toVersion: "v2.1",
  disposition: "correction",
  severity: "major",
  summary: "Correct an over-counted Rule of Law input for Example Republic.",
  headlineSummary: "corrected Rule of Law input for Example Republic.",
  correctionLogId: "00000000-0000-0000-0000-000000000000",
  effectiveDate: "2026-07-10",
};

/** Exact expected shape from the OP48 contract §7.5 — asserted by
 *  deep equality in `__tests__/correction-simulator.test.ts` and by
 *  `policy-surface.ts`'s `simulator-drift` check. */
export const EXPECTED_CORRECTION: CorrectionSimulationResult = {
  changelog: {
    artifactId: "civica-index",
    version: "v2.1",
    date: "2026-07-10",
    type: "correction",
    severity: "major",
    summary: "Correct an over-counted Rule of Law input for Example Republic.",
    correctionLogId: "00000000-0000-0000-0000-000000000000",
  },
  supersession: {
    artifactId: "civica-index",
    fromVersion: "v2.0",
    toVersion: "v2.1",
    kind: "correction",
    reason: "Correct an over-counted Rule of Law input for Example Republic.",
    effectiveDate: "2026-07-10",
  },
  releaseNote: {
    artifactId: "civica-index",
    version: "v2.1",
    date: "2026-07-10",
    headline: "Civica Index v2.1 — corrected Rule of Law input for Example Republic.",
    changes: ["Correct an over-counted Rule of Law input for Example Republic."],
    supersedes: "v2.0",
  },
};

export const FIXTURE_RETRACTION: CorrectionInput = {
  artifactId: "pulse-ledger",
  fromVersion: "v2.0",
  toVersion: "v2.0",
  disposition: "retraction",
  severity: "critical",
  summary:
    "Withdraw a misattributed Pulse event cluster published for Example Republic.",
  headlineSummary: "withdrew a misattributed event cluster for Example Republic.",
  correctionLogId: "11111111-1111-1111-1111-111111111111",
  effectiveDate: "2026-07-10",
};

export const EXPECTED_RETRACTION: CorrectionSimulationResult = {
  changelog: {
    artifactId: "pulse-ledger",
    version: "v2.0",
    date: "2026-07-10",
    type: "retraction",
    severity: "critical",
    summary:
      "Withdraw a misattributed Pulse event cluster published for Example Republic.",
    correctionLogId: "11111111-1111-1111-1111-111111111111",
  },
  supersession: {
    artifactId: "pulse-ledger",
    fromVersion: "v2.0",
    toVersion: "v2.0",
    kind: "retraction",
    reason:
      "Withdraw a misattributed Pulse event cluster published for Example Republic.",
    effectiveDate: "2026-07-10",
    retractedAt: "2026-07-10",
  },
  releaseNote: {
    artifactId: "pulse-ledger",
    version: "v2.0",
    date: "2026-07-10",
    headline: "RETRACTED — Pulse ledger — withdrew a misattributed event cluster for Example Republic.",
    changes: [
      "Withdraw a misattributed Pulse event cluster published for Example Republic.",
    ],
    supersedes: null,
  },
};

export const FIXTURE_CLARIFICATION: CorrectionInput = {
  artifactId: "reconciliation",
  fromVersion: "v0.2-beta",
  toVersion: "v0.2-beta",
  disposition: "clarification",
  severity: null,
  summary:
    "Clarify how the plausibility-envelope threshold is described in the reconciliation disputes queue.",
  correctionLogId: "22222222-2222-2222-2222-222222222222",
  effectiveDate: "2026-07-10",
};

export const EXPECTED_CLARIFICATION: CorrectionSimulationResult = {
  changelog: {
    artifactId: "reconciliation",
    version: "v0.2-beta",
    date: "2026-07-10",
    type: "clarification",
    severity: "editorial",
    summary:
      "Clarify how the plausibility-envelope threshold is described in the reconciliation disputes queue.",
    correctionLogId: "22222222-2222-2222-2222-222222222222",
  },
  supersession: null,
  releaseNote: null,
};
