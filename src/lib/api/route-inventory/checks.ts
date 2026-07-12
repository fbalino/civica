/**
 * PLT-008 — pure comparison functions for the route-inventory validator.
 *
 * No filesystem or DB access here (mirrors the design of
 * `scripts/validate-api-docs.ts`'s `findPhantomRoutes` /
 * `findUncontractedEntries`) — everything takes plain strings/arrays so
 * `__tests__/route-inventory.test.ts` can drive every failure mode with
 * synthetic fixtures under `npm test`, independent of the real filesystem
 * walk that `scripts/validate-route-inventory.ts` performs.
 */

import type { RouteControl, RouteInventoryEntry } from "./registry";

/** `route.ts` files that exist on disk but have no registry entry — a
 *  route that shipped without ever being added to the PLT-008 inventory. */
export function findPhantomRoutes(
  diskPaths: Iterable<string>,
  registryPaths: Iterable<string>,
): string[] {
  const registrySet = new Set(registryPaths);
  return [...new Set(diskPaths)].filter((p) => !registrySet.has(p)).sort();
}

/** Registry entries whose `filePath` no longer exists on disk — a stale
 *  entry left behind after a route was renamed or deleted. */
export function findStaleEntries(
  diskPaths: Iterable<string>,
  registryPaths: Iterable<string>,
): string[] {
  const diskSet = new Set(diskPaths);
  return [...new Set(registryPaths)].filter((p) => !diskSet.has(p)).sort();
}

export interface UncontrolledMutationFinding {
  filePath: string;
  exposure: RouteInventoryEntry["exposure"];
  reason: string;
  /** True when the registry entry's `note` explains the gap (an honest,
   *  disclosed finding). `scripts/validate-route-inventory.ts` WARNs on
   *  documented findings and FAILS on undocumented ones — see the
   *  registry.ts module doc for the "flag, don't hide" rationale. */
  documented: boolean;
}

/** Controls that satisfy "this route requires an authenticated caller,
 *  and something plausibly enforces that" for admin/pulse-coding exposure:
 *  an established session, the OAuth bootstrap step that PRECEDES a
 *  session (state-cookie CSRF + account allowlist), or the login route
 *  itself (username/password or access-code verification). */
const SESSION_LIKE_CONTROLS: RouteControl[] = [
  "admin-session",
  "pulse-coding-session",
  "oauth-bootstrap",
  "credential-check",
];

type MinimalEntry = Pick<
  RouteInventoryEntry,
  "filePath" | "exposure" | "mutation" | "sensitive" | "controls" | "note"
>;

/**
 * Flags every mutation-or-sensitive entry whose declared `controls` don't
 * clear its exposure class's minimum bar:
 *   - cron            must declare "cron-secret"
 *   - admin/pulse-coding must declare a session-like control (see above)
 *   - public-mutation must declare "input-validation" or "rate-limit"
 *   - anything else (chat, export, embed, public-read, internal) just
 *     needs at least one real (non-"public") control once it is a
 *     mutation or flagged sensitive.
 *
 * "public" alone never counts as a control for this purpose — an entry
 * with `controls: []` or `controls: ["public"]` on a route that should be
 * protected is exactly the "uncontrolled" case PLT-008 must catch.
 */
export function findUncontrolledMutations(
  entries: readonly MinimalEntry[],
): UncontrolledMutationFinding[] {
  const findings: UncontrolledMutationFinding[] = [];

  for (const entry of entries) {
    if (!entry.mutation && !entry.sensitive) continue;

    const real = entry.controls.filter((c) => c !== "public");
    const documented = entry.note.trim().length > 0;

    if (real.length === 0) {
      findings.push({
        filePath: entry.filePath,
        exposure: entry.exposure,
        reason:
          "mutation-or-sensitive route declares no control beyond (or including) 'public'",
        documented,
      });
      continue;
    }

    if (entry.exposure === "cron" && !real.includes("cron-secret")) {
      findings.push({
        filePath: entry.filePath,
        exposure: entry.exposure,
        reason: "cron route does not declare the cron-secret control",
        documented,
      });
      continue;
    }

    if (
      (entry.exposure === "admin" || entry.exposure === "pulse-coding") &&
      !real.some((c) => SESSION_LIKE_CONTROLS.includes(c))
    ) {
      findings.push({
        filePath: entry.filePath,
        exposure: entry.exposure,
        reason: `${entry.exposure} route does not declare a session/credential/oauth-bootstrap control`,
        documented,
      });
      continue;
    }

    if (
      entry.exposure === "public-mutation" &&
      !real.some((c) => c === "input-validation" || c === "rate-limit")
    ) {
      findings.push({
        filePath: entry.filePath,
        exposure: entry.exposure,
        reason:
          "public-mutation route does not declare input-validation or rate-limit",
        documented,
      });
      continue;
    }
  }

  return findings;
}

export interface MethodDriftFinding {
  filePath: string;
  declared: string[];
  scanned: string[];
}

/** Cross-checks a registry entry's declared `methods` against the methods
 *  a static scan of its source actually found. Order-independent. */
export function diffMethods(
  filePath: string,
  declared: readonly string[],
  scanned: readonly string[],
): MethodDriftFinding | null {
  const declaredSet = new Set(declared);
  const scannedSet = new Set(scanned);
  const same =
    declaredSet.size === scannedSet.size &&
    [...declaredSet].every((m) => scannedSet.has(m));
  if (same) return null;
  return {
    filePath,
    declared: [...declaredSet].sort(),
    scanned: [...scannedSet].sort(),
  };
}
