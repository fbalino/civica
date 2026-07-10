import {
  buildDerivationVersionEnvelope,
  derivationVersionKey,
  notApplicable,
  versioned,
} from "@/lib/research/derivation-version";
import {
  BJORNKSKOV_RODE_SOURCE_ID,
  DEFAULT_GOVERNMENT_TAXONOMY_VERSION,
} from "./index";

export const GOVERNMENT_TAXONOMY_ALGORITHM_VERSION =
  "government-taxonomy/derivation-2026-v1" as const;

export function governmentTaxonomyVersionEnvelope() {
  const envelope = buildDerivationVersionEnvelope({
    methodology: versioned(DEFAULT_GOVERNMENT_TAXONOMY_VERSION),
    algorithm: versioned(GOVERNMENT_TAXONOMY_ALGORITHM_VERSION),
    prompt: notApplicable("Government taxonomy derivation is deterministic and does not use a model prompt."),
    taxonomy: versioned(DEFAULT_GOVERNMENT_TAXONOMY_VERSION),
    sourceIds: [BJORNKSKOV_RODE_SOURCE_ID, "cia_factbook", "wikidata"],
  });
  return { envelope, key: derivationVersionKey(envelope) };
}
