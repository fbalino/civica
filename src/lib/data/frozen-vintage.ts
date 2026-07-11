import { createHash } from "node:crypto";

const ATLAS_LABEL = /^Civica Atlas Reconciled (v[^\s]+) — vintage (\d{4}-Q[1-4])$/;
const INDEX_LABEL = /^Civica Index (\d{4}) Q([1-4]) \(([^)]+)\)$/;

export type FrozenVintageProduct = "atlas" | "civica_index";

export interface FrozenVintageIdentity {
  product: FrozenVintageProduct;
  label: string;
  period: string;
  methodologyVersion: string;
}

export function parseAtlasVintageLabel(label: string): FrozenVintageIdentity {
  const match = ATLAS_LABEL.exec(label);
  if (!match) {
    throw new Error(
      `Invalid frozen Atlas vintage label: ${label}. Expected "Civica Atlas Reconciled v<version> — vintage YYYY-Qn".`,
    );
  }
  return { product: "atlas", label, methodologyVersion: match[1], period: match[2] };
}

export function parseIndexVintageLabel(label: string): FrozenVintageIdentity {
  const match = INDEX_LABEL.exec(label);
  if (!match) {
    throw new Error(
      `Invalid frozen Civica Index vintage label: ${label}. Expected "Civica Index YYYY Qn (<version>)".`,
    );
  }
  return {
    product: "civica_index",
    label,
    period: `${match[1]}-Q${match[2]}`,
    methodologyVersion: match[3].toLowerCase(),
  };
}

/** Stable JSON hashing for exact rerun and release-content checks. */
export function frozenContentHash(value: unknown): string {
  return createHash("sha256").update(stableStringify(value)).digest("hex");
}

export function indexContentHash(input: {
  score: number;
  scoreLower: number | null;
  scoreUpper: number | null;
  completenessFlag: string | null;
  rank: number | null;
  totalRanked: number | null;
  isPartial: boolean;
  dimensionsAvailable: number;
  missingDimensions: readonly string[] | null;
  methodologyVersion: string;
  derivationVersionKey: string;
}): string {
  const recipe = [
    input.score,
    input.scoreLower ?? "",
    input.scoreUpper ?? "",
    input.completenessFlag ?? "",
    input.rank ?? "",
    input.totalRanked ?? "",
    input.isPartial,
    input.dimensionsAvailable,
    [...(input.missingDimensions ?? [])].sort().join(","),
    input.methodologyVersion,
    input.derivationVersionKey,
  ].join("|");
  return createHash("sha256").update(recipe).digest("hex");
}

export function stableStringify(value: unknown): string {
  if (value === undefined) return "null";
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(",")}}`;
}

export function assertSupersession(input: {
  label: string;
  supersedes?: string | null;
  priorLabels: readonly string[];
}): void {
  const prior = [...new Set(input.priorLabels.filter((label) => label !== input.label))];
  if (prior.length === 0) {
    if (input.supersedes) throw new Error(`${input.label} cannot supersede unknown vintage ${input.supersedes}.`);
    return;
  }
  if (!input.supersedes) {
    throw new Error(`${input.label} is a correction to an existing period and must name the superseded vintage.`);
  }
  if (!prior.includes(input.supersedes)) {
    throw new Error(`${input.label} cannot supersede unknown vintage ${input.supersedes}.`);
  }
}
