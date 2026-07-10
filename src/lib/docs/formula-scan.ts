/**
 * Public-formula fingerprint scanner (CLM-009 §2, §7). Pure and
 * in-memory: callers pass file contents in, nothing here touches the
 * filesystem. `scripts/validate-doc-sources.ts` is the disk-reading
 * caller; `src/lib/docs/__tests__/doc-concepts.test.ts` feeds
 * synthetic fixtures directly.
 *
 * Deliberately fingerprint-based rather than diff-based: a
 * fingerprint is a short, distinctive, exact substring of a
 * REGISTERED canonical formula/table (e.g. the literal transform text
 * `"((score + 2.5) / 5.0) × 100"`), not a bare number. Per CLM-009 §2,
 * generic weight fingerprints like a bare `0.27` are avoided — the
 * worked-examples fixture (CLM-008) already owns code-to-code weight
 * equality, and a bare short number would false-positive constantly.
 */

import { SCANNABLE_KINDS, type DocSurfaceKind } from "@/lib/docs/doc-concepts";
import { stripAllGenBlocks } from "@/lib/docs/gen-markers";

export interface FormulaFingerprint {
  /** Concept id this fingerprint belongs to, for reporting. */
  conceptId: string;
  /** Exact substring that should only ever appear inside its
   *  concept's declared generated block. */
  text: string;
}

export interface ScanTarget {
  /** Repo-relative path, for reporting. */
  path: string;
  kind: DocSurfaceKind;
  content: string;
}

export interface FingerprintViolation {
  conceptId: string;
  path: string;
  /** 1-indexed line number of the offending occurrence. */
  line: number;
}

/**
 * Scan every SCANNABLE target for every fingerprint, ignoring any
 * occurrence that falls inside a `[//]: # "GEN:START ..."` ...
 * `[//]: # "GEN:END ..."` block (fingerprints are EXPECTED inside
 * their own generated block —
 * that's the whole point of generating it). A hit outside any
 * generated block is a duplicated formula: exactly what CLM-009 is
 * meant to prevent.
 */
export function scanForFingerprints(
  targets: readonly ScanTarget[],
  fingerprints: readonly FormulaFingerprint[],
): FingerprintViolation[] {
  const violations: FingerprintViolation[] = [];
  for (const target of targets) {
    if (!SCANNABLE_KINDS.includes(target.kind)) continue;
    const outsideGenerated = stripAllGenBlocks(target.content);
    const lines = outsideGenerated.split("\n");
    for (const fp of fingerprints) {
      lines.forEach((line, i) => {
        if (line.includes(fp.text)) {
          violations.push({ conceptId: fp.conceptId, path: target.path, line: i + 1 });
        }
      });
    }
  }
  return violations;
}
