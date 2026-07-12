import {
  buildDerivationVersionEnvelope,
  contentVersion,
  derivationVersionKey,
  legacyUnversioned,
  notApplicable,
  versioned,
  versionSetId,
  type DerivationVersionEnvelope,
} from "@/lib/research/derivation-version";
import { CLASSIFIER_SYSTEM_PROMPT, VERIFY_SYSTEM_PROMPT } from "./classifier-prompt";
import {
  PULSE_RUNTIME_METHOD_VERSION,
  PULSE_TAXONOMY_VERSION,
} from "./runtime-contract";

export const PULSE_CLASSIFICATION_ALGORITHM_VERSION =
  "pulse-classification/ensemble-verify-subject-v2.1" as const;
export const PULSE_DELTA_ALGORITHM_VERSION =
  "pulse-delta/decay-window-v2.3+incident-resolution-v1+output-history-v1" as const;
export const PULSE_CLASSIFIER_PROMPT_VERSION = contentVersion(
  "pulse-classifier-prompt",
  `${CLASSIFIER_SYSTEM_PROMPT}\n---VERIFY---\n${VERIFY_SYSTEM_PROMPT}`,
);

export function pulseEventVersionEnvelope(sourceIds: readonly string[]): {
  envelope: DerivationVersionEnvelope;
  key: string;
} {
  const envelope = buildDerivationVersionEnvelope({
    methodology: versioned(PULSE_RUNTIME_METHOD_VERSION),
    algorithm: versioned(PULSE_CLASSIFICATION_ALGORITHM_VERSION),
    prompt: versioned(PULSE_CLASSIFIER_PROMPT_VERSION),
    taxonomy: versioned(PULSE_TAXONOMY_VERSION),
    sourceIds,
  });
  return { envelope, key: derivationVersionKey(envelope) };
}

export function pulseDeltaVersionEnvelope(inputs: readonly DerivationVersionEnvelope[], sourceIds: readonly string[]): {
  envelope: DerivationVersionEnvelope;
  key: string;
} {
  const inputAxis = (axis: "methodology" | "prompt" | "taxonomy") => {
    if (!inputs.length) {
      return axis === "methodology"
        ? versioned(PULSE_RUNTIME_METHOD_VERSION)
        : notApplicable(`No event-level ${axis} contributes to this zero delta row.`);
    }
    const refs = inputs.map((input) => input[axis]);
    if (refs.some((ref) => ref.state === "legacy_unversioned")) {
      return legacyUnversioned(`At least one contributing Pulse event lacks a recorded ${axis} version.`);
    }
    const ids = refs.filter((ref) => ref.state === "versioned").map((ref) => ref.id);
    return ids.length
      ? versioned(versionSetId(`pulse-input-${axis}-set`, ids))
      : notApplicable(`Contributing Pulse events declare ${axis} not applicable.`);
  };
  const envelope = buildDerivationVersionEnvelope({
    methodology: inputAxis("methodology"),
    algorithm: versioned(PULSE_DELTA_ALGORITHM_VERSION),
    prompt: inputAxis("prompt"),
    taxonomy: inputAxis("taxonomy"),
    sourceIds,
    sourceBasket:
      sourceIds.length > 0
        ? undefined
        : notApplicable("No published event contributes to this zero delta row."),
    allowLegacyInputAxes: true,
  });
  return { envelope, key: derivationVersionKey(envelope) };
}
