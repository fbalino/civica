import {
  buildDerivationVersionEnvelope,
  derivationVersionKey,
  notApplicable,
  versioned,
  type DerivationVersionEnvelope,
} from "@/lib/research/derivation-version";

export const CI_INGEST_ALGORITHM_VERSION = "ci-ingest-normalization/minmax-v1" as const;
export const CI_COMPOSITE_ALGORITHM_VERSION = "ci-composite/weighted-v1" as const;
export const CI_BETA_COMPOSITE_ALGORITHM_VERSION = "ci-composite/fixed-bounds-monte-carlo-v2" as const;

export function ciVersionEnvelope(input: {
  methodologyVersion: string;
  algorithmVersion: string;
  sourceIds: readonly string[];
}): { envelope: DerivationVersionEnvelope; key: string } {
  const envelope = buildDerivationVersionEnvelope({
    methodology: versioned(input.methodologyVersion),
    algorithm: versioned(input.algorithmVersion),
    prompt: notApplicable("The Civica Index calculation does not use a model prompt."),
    taxonomy: notApplicable("The Civica Index calculation does not apply a categorical taxonomy."),
    sourceIds: input.sourceIds,
  });
  return { envelope, key: derivationVersionKey(envelope) };
}
