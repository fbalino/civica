import { createHash } from "node:crypto";

export const DERIVATION_VERSION_SCHEMA = "derivation-version-envelope/v1" as const;

export type VersionRef =
  | { state: "versioned"; id: string }
  | { state: "not_applicable"; reason: string }
  | { state: "legacy_unversioned"; reason: string };

export interface DerivationVersionEnvelope {
  schemaVersion: typeof DERIVATION_VERSION_SCHEMA;
  methodology: VersionRef;
  algorithm: VersionRef;
  prompt: VersionRef;
  taxonomy: VersionRef;
  sourceBasket: VersionRef;
  sourceIds: string[];
}

export type VersionAxis = Exclude<keyof DerivationVersionEnvelope, "schemaVersion" | "sourceIds">;

export const versioned = (id: string): VersionRef => {
  const normalized = id.trim();
  if (!normalized) throw new Error("version id must not be blank");
  return { state: "versioned", id: normalized };
};

export const notApplicable = (reason: string): VersionRef => ({
  state: "not_applicable",
  reason: requiredReason(reason),
});

export const legacyUnversioned = (reason: string): VersionRef => ({
  state: "legacy_unversioned",
  reason: requiredReason(reason),
});

function requiredReason(reason: string): string {
  const normalized = reason.trim();
  if (!normalized) throw new Error("version applicability reason must not be blank");
  return normalized;
}

export function contentVersion(namespace: string, content: string): string {
  const name = namespace.trim();
  if (!name || !content) throw new Error("contentVersion requires a namespace and content");
  const hash = createHash("sha256").update(content).digest("hex").slice(0, 16);
  return `${name}/sha256:${hash}`;
}

export function sourceBasketVersion(sourceIds: readonly string[]): {
  id: string;
  sourceIds: string[];
} {
  const normalized = [...new Set(sourceIds.map((sourceId) => sourceId.trim()).filter(Boolean))].sort();
  if (!normalized.length) throw new Error("source basket must contain at least one source id");
  return {
    id: contentVersion("source-basket", normalized.join("\n")),
    sourceIds: normalized,
  };
}

export function versionSetId(namespace: string, versionIds: readonly string[]): string {
  const normalized = [...new Set(versionIds.map((id) => id.trim()).filter(Boolean))].sort();
  if (!normalized.length) throw new Error("version set must contain at least one version id");
  return normalized.length === 1 ? normalized[0] : contentVersion(namespace, normalized.join("\n"));
}

export function buildDerivationVersionEnvelope(input: {
  methodology: VersionRef;
  algorithm: VersionRef;
  prompt: VersionRef;
  taxonomy: VersionRef;
  sourceIds: readonly string[];
  sourceBasket?: VersionRef;
  allowLegacyInputAxes?: boolean;
}): DerivationVersionEnvelope {
  const normalizedSourceIds = [...new Set(input.sourceIds.map((id) => id.trim()).filter(Boolean))].sort();
  const sourceBasket = input.sourceBasket ?? versioned(sourceBasketVersion(normalizedSourceIds).id);
  const envelope: DerivationVersionEnvelope = {
    schemaVersion: DERIVATION_VERSION_SCHEMA,
    methodology: input.methodology,
    algorithm: input.algorithm,
    prompt: input.prompt,
    taxonomy: input.taxonomy,
    sourceBasket,
    sourceIds: normalizedSourceIds,
  };
  const errors = derivationVersionErrors(envelope, {
    allowLegacy: input.allowLegacyInputAxes ?? false,
  });
  if (errors.length) throw new Error(errors.join("; "));
  return envelope;
}

export function legacyDerivationVersionEnvelope(reason: string): DerivationVersionEnvelope {
  const ref = legacyUnversioned(reason);
  return {
    schemaVersion: DERIVATION_VERSION_SCHEMA,
    methodology: ref,
    algorithm: ref,
    prompt: ref,
    taxonomy: ref,
    sourceBasket: ref,
    sourceIds: [],
  };
}

export function derivationVersionErrors(
  value: unknown,
  options: { allowLegacy: boolean } = { allowLegacy: true },
): string[] {
  const errors: string[] = [];
  if (!value || typeof value !== "object") return ["version envelope must be an object"];
  const envelope = value as Partial<DerivationVersionEnvelope>;
  if (envelope.schemaVersion !== DERIVATION_VERSION_SCHEMA) errors.push(`schemaVersion must be ${DERIVATION_VERSION_SCHEMA}`);
  for (const axis of ["methodology", "algorithm", "prompt", "taxonomy", "sourceBasket"] as const) {
    const ref = envelope[axis];
    if (!ref || typeof ref !== "object" || !ref.state) {
      errors.push(`${axis} is missing a version state`);
      continue;
    }
    if (ref.state === "versioned") {
      if (!("id" in ref) || typeof ref.id !== "string" || !ref.id.trim()) errors.push(`${axis} has a blank version id`);
    } else if (ref.state === "not_applicable" || ref.state === "legacy_unversioned") {
      if (!("reason" in ref) || typeof ref.reason !== "string" || !ref.reason.trim()) errors.push(`${axis} is missing its reason`);
      if (!options.allowLegacy && ref.state === "legacy_unversioned") errors.push(`${axis} cannot be legacy_unversioned on a new row`);
    } else {
      errors.push(`${axis} has an unsupported version state`);
    }
  }
  if (!Array.isArray(envelope.sourceIds) || envelope.sourceIds.some((id) => typeof id !== "string" || !id.trim())) {
    errors.push("sourceIds must be an array of nonblank strings");
  }
  if (envelope.sourceBasket?.state === "versioned" && (!envelope.sourceIds || envelope.sourceIds.length === 0)) {
    errors.push("a versioned source basket requires at least one source id");
  }
  return errors;
}

export function matchesVersion(
  envelope: DerivationVersionEnvelope,
  axis: VersionAxis,
  versionId: string,
): boolean {
  const ref = envelope[axis];
  return ref.state === "versioned" && ref.id === versionId;
}

export function derivationVersionKey(envelope: DerivationVersionEnvelope): string {
  const errors = derivationVersionErrors(envelope);
  if (errors.length) throw new Error(errors.join("; "));
  return contentVersion("derivation", JSON.stringify(envelope));
}
