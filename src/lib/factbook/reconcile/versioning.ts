import {
  buildDerivationVersionEnvelope,
  derivationVersionKey,
  notApplicable,
  versioned,
} from "@/lib/research/derivation-version";
import { RECONCILIATION_AUDIT_VERSION } from "./reconciliation-audit";
import { SOURCE_PRECEDENCE_VERSION } from "./resolver";

export function reconciliationVersionEnvelope(input: {
  methodologyVersion: string;
  sourceIds: readonly string[];
}) {
  const envelope = buildDerivationVersionEnvelope({
    methodology: versioned(input.methodologyVersion),
    algorithm: versioned(SOURCE_PRECEDENCE_VERSION),
    prompt: notApplicable("Country-fact reconciliation is deterministic and does not use a model prompt."),
    taxonomy: versioned(RECONCILIATION_AUDIT_VERSION),
    sourceIds: input.sourceIds,
  });
  return { envelope, key: derivationVersionKey(envelope) };
}
