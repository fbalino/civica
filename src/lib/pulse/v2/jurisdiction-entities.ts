import { createHash } from "node:crypto";

import {
  COUNTRY_ALIASES,
  PULSE_JURISDICTION_ALIAS_VERSION,
} from "./country-resolver";

export const PULSE_JURISDICTION_ENTITY_VERSION =
  "pulse-jurisdiction-entities/v1" as const;
export const PULSE_JURISDICTION_ATTRIBUTION_VERSION =
  "pulse-jurisdiction-attribution/v2" as const;

export interface JurisdictionEntityInput {
  id: string;
  name: string;
  iso2: string | null;
  iso3: string | null;
  slug: string;
}

export interface JurisdictionEntitySnapshot {
  jurisdictionId: string;
  canonicalName: string;
  iso2: string | null;
  iso3: string | null;
  slug: string;
  aliases: string[];
}

export interface JurisdictionEntityCatalog {
  version: typeof PULSE_JURISDICTION_ENTITY_VERSION;
  aliasVersion: typeof PULSE_JURISDICTION_ALIAS_VERSION;
  hash: string;
  entities: JurisdictionEntitySnapshot[];
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function buildJurisdictionEntityCatalog(
  rows: readonly JurisdictionEntityInput[],
): JurisdictionEntityCatalog {
  const aliasesByCanonical = new Map<string, string[]>();
  for (const [alias, canonical] of Object.entries(COUNTRY_ALIASES)) {
    const list = aliasesByCanonical.get(canonical.toUpperCase()) ?? [];
    list.push(alias);
    aliasesByCanonical.set(canonical.toUpperCase(), list);
  }

  const entities = rows
    .map((row) => ({
      jurisdictionId: row.id,
      canonicalName: row.name,
      iso2: row.iso2?.toUpperCase() ?? null,
      iso3: row.iso3?.toUpperCase() ?? null,
      slug: row.slug,
      aliases: [
        ...(aliasesByCanonical.get(row.name.toUpperCase()) ?? []),
      ].sort(),
    }))
    .sort((left, right) =>
      (left.iso3 ?? left.slug).localeCompare(right.iso3 ?? right.slug),
    );

  const hash = createHash("sha256")
    .update(
      canonicalJson({
        version: PULSE_JURISDICTION_ENTITY_VERSION,
        aliasVersion: PULSE_JURISDICTION_ALIAS_VERSION,
        entities,
      }),
    )
    .digest("hex");

  return {
    version: PULSE_JURISDICTION_ENTITY_VERSION,
    aliasVersion: PULSE_JURISDICTION_ALIAS_VERSION,
    hash: `pulse-jurisdiction-entities/sha256:${hash}`,
    entities,
  };
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function findJurisdictionEntityCandidates(
  text: string,
  catalog: JurisdictionEntityCatalog,
): JurisdictionEntitySnapshot[] {
  const upper = text.toUpperCase();
  return catalog.entities.filter((entity) => {
    const labels = [
      entity.canonicalName,
      entity.iso3,
      ...entity.aliases,
    ].filter((value): value is string => Boolean(value && value.length > 2));
    return labels.some((label) =>
      new RegExp(`\\b${escapeRegex(label.toUpperCase())}\\b`, "u").test(upper),
    );
  });
}

export function humanReadableJurisdictionContext(input: {
  catalog: JurisdictionEntityCatalog;
  provisionalJurisdictionId: string | null;
  text: string;
}): string {
  const provisional = input.catalog.entities.find(
    (entity) => entity.jurisdictionId === input.provisionalJurisdictionId,
  );
  const candidates = findJurisdictionEntityCandidates(input.text, input.catalog);
  if (provisional && !candidates.some((row) => row.jurisdictionId === provisional.jurisdictionId)) {
    candidates.push(provisional);
  }
  const labels = candidates
    .sort((left, right) => left.canonicalName.localeCompare(right.canonicalName))
    .map(
      (entity) =>
        `${entity.canonicalName}${entity.iso3 ? ` (${entity.iso3})` : ""}${
          entity.aliases.length ? `; known aliases: ${entity.aliases.join(", ")}` : ""
        }`,
    );
  return [
    `Entity catalog: ${input.catalog.version}`,
    `Alias registry: ${input.catalog.aliasVersion}`,
    `Provisional ingest guess: ${provisional ? `${provisional.canonicalName}${provisional.iso3 ? ` (${provisional.iso3})` : ""}` : "unresolved"}`,
    `Human-readable candidates found in the retained text: ${labels.length ? labels.join(" | ") : "none"}`,
  ].join("\n");
}
