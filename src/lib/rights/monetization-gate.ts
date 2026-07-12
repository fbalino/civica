/**
 * BRD-009 — non-commercial-source monetization gate.
 *
 * Several sources are licensed non-commercial-only (IPU Parline, Constitute,
 * International IDEA). Until they are relicensed or removed (with owner/legal
 * approval), Civica must not ship a paid subscription, paid API, paid embed, or
 * otherwise commercial/fee-bearing deployment. This gate makes that a
 * build/CI-enforced invariant rather than a memory.
 */
import { SOURCE_RIGHTS, type SourceRightsRecord } from "./manifest";

/** Sources whose terms forbid commercial reuse (the monetization blockers). */
export function nonCommercialSources(
  sources: readonly SourceRightsRecord[] = SOURCE_RIGHTS,
): SourceRightsRecord[] {
  return sources.filter(
    (r) =>
      r.commercialUse === false || r.publicExport === "non-commercial-only",
  );
}

export type MonetizationEnv = {
  CIVICA_COMMERCIAL_DEPLOYMENT?: string;
  CIVICA_FEE_BEARING_ACCESS?: string;
  // Index signature so `process.env` (NodeJS.ProcessEnv) is assignable
  // without the weak-type "no properties in common" check (TS2559).
  [key: string]: string | undefined;
};

export function isCommercialPosture(env: MonetizationEnv): boolean {
  return (
    env.CIVICA_COMMERCIAL_DEPLOYMENT === "true" ||
    env.CIVICA_FEE_BEARING_ACCESS === "true"
  );
}

/**
 * Returns a list of blocking errors. A commercial/fee-bearing posture with any
 * active non-commercial source is a release blocker.
 */
export function monetizationGateErrors(
  env: MonetizationEnv = process.env,
  sources: readonly SourceRightsRecord[] = SOURCE_RIGHTS,
): string[] {
  if (!isCommercialPosture(env)) return [];
  const blockers = nonCommercialSources(sources);
  if (blockers.length === 0) return [];
  return [
    "commercial/fee-bearing deployment is enabled while non-commercial-only " +
      "sources are still active — relicense or remove them (and obtain owner/" +
      "legal approval) before monetizing.",
    ...blockers.map((r) => `  blocked by: ${r.sourceId} (${r.publicExport})`),
  ];
}
