import { createHash } from "node:crypto";

export const VALUE_FIDELITY_SEED =
  "dat-034|atlas-2026-07-11|publisher-fidelity-v1" as const;

export const VALUE_FIDELITY_SOURCE_QUOTAS = {
  cia_factbook: 171,
  world_bank: 120,
  wikidata: 9,
} as const;

export type FidelitySampleCandidate = {
  canonicalFactId: string;
  sourceId: keyof typeof VALUE_FIDELITY_SOURCE_QUOTAS;
  category: string;
  factGroup: string;
};

export type WilsonInterval = {
  estimate: number;
  lower: number;
  upper: number;
  confidenceLevel: 0.95;
  numerator: number;
  denominator: number;
};

export function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function seededScore(candidate: FidelitySampleCandidate): string {
  return sha256(`${VALUE_FIDELITY_SEED}|${candidate.canonicalFactId}`);
}

function allocateStrata(
  candidates: readonly FidelitySampleCandidate[],
  quota: number,
): Map<string, number> {
  const grouped = new Map<string, FidelitySampleCandidate[]>();
  for (const candidate of candidates) {
    const key = `${candidate.category}\u0000${candidate.factGroup}`;
    grouped.set(key, [...(grouped.get(key) ?? []), candidate]);
  }
  if (quota > candidates.length) {
    throw new Error(`quota ${quota} exceeds ${candidates.length} candidates`);
  }
  const rows = [...grouped.entries()].map(([key, values]) => {
    const exact = (quota * values.length) / candidates.length;
    return {
      key,
      capacity: values.length,
      allocated: Math.min(values.length, Math.max(1, Math.floor(exact))),
      remainder: exact - Math.floor(exact),
    };
  });
  let allocated = rows.reduce((sum, row) => sum + row.allocated, 0);
  while (allocated > quota) {
    const row = [...rows]
      .filter((candidate) => candidate.allocated > 1)
      .sort(
        (a, b) =>
          a.remainder - b.remainder ||
          b.allocated - a.allocated ||
          a.key.localeCompare(b.key),
      )[0];
    if (!row) throw new Error("stratified minimums exceed source quota");
    row.allocated -= 1;
    allocated -= 1;
  }
  while (allocated < quota) {
    const row = [...rows]
      .filter((candidate) => candidate.allocated < candidate.capacity)
      .sort(
        (a, b) =>
          b.remainder - a.remainder ||
          b.capacity - a.capacity ||
          a.key.localeCompare(b.key),
      )[0];
    if (!row) throw new Error("stratified allocation exhausted candidates");
    row.allocated += 1;
    allocated += 1;
  }
  return new Map(rows.map((row) => [row.key, row.allocated]));
}

export function selectValueFidelitySample(
  candidates: readonly FidelitySampleCandidate[],
): FidelitySampleCandidate[] {
  const selected: FidelitySampleCandidate[] = [];
  for (const [sourceId, quota] of Object.entries(
    VALUE_FIDELITY_SOURCE_QUOTAS,
  ) as Array<
    [keyof typeof VALUE_FIDELITY_SOURCE_QUOTAS, number]
  >) {
    const sourceCandidates = candidates.filter(
      (candidate) => candidate.sourceId === sourceId,
    );
    const allocations = allocateStrata(sourceCandidates, quota);
    for (const [stratum, stratumQuota] of allocations) {
      selected.push(
        ...sourceCandidates
          .filter(
            (candidate) =>
              `${candidate.category}\u0000${candidate.factGroup}` === stratum,
          )
          .sort(
            (a, b) =>
              seededScore(a).localeCompare(seededScore(b)) ||
              a.canonicalFactId.localeCompare(b.canonicalFactId),
          )
          .slice(0, stratumQuota),
      );
    }
  }
  return selected.sort(
    (a, b) =>
      a.sourceId.localeCompare(b.sourceId) ||
      a.category.localeCompare(b.category) ||
      a.factGroup.localeCompare(b.factGroup) ||
      seededScore(a).localeCompare(seededScore(b)),
  );
}

export function wilson95(
  numerator: number,
  denominator: number,
): WilsonInterval {
  if (
    !Number.isInteger(numerator) ||
    !Number.isInteger(denominator) ||
    numerator < 0 ||
    denominator <= 0 ||
    numerator > denominator
  ) {
    throw new Error("invalid binomial counts");
  }
  const z = 1.959963984540054;
  const proportion = numerator / denominator;
  const denominatorAdjustment = 1 + (z * z) / denominator;
  const center =
    (proportion + (z * z) / (2 * denominator)) / denominatorAdjustment;
  const margin =
    (z *
      Math.sqrt(
        (proportion * (1 - proportion)) / denominator +
          (z * z) / (4 * denominator * denominator),
      )) /
    denominatorAdjustment;
  return {
    estimate: proportion,
    lower: numerator === 0 ? 0 : Math.max(0, center - margin),
    upper: numerator === denominator ? 1 : Math.min(1, center + margin),
    confidenceLevel: 0.95,
    numerator,
    denominator,
  };
}
