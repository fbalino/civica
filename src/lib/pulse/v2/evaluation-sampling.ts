import { createHash } from "node:crypto";

export const PULSE_EVALUATION_SAMPLING_VERSION =
  "pulse-evaluation-sampling-frame/v1" as const;

export const PULSE_EVALUATION_SAMPLING_PROTOCOL = Object.freeze({
  schemaVersion: PULSE_EVALUATION_SAMPLING_VERSION,
  preregisteredAt: "2026-07-11",
  populationFreezeAt: "2026-07-11T16:45:00.899Z",
  period: { start: "2026-04-13", end: "2026-07-11", days: 90 },
  labelAccessAtFreeze: "none",
  unitSeparation: {
    retainedEventCandidate: "one distinct production cluster with a retained event row, regardless of publication or review outcome",
    systemNegative: "one retained exclusion outcome or unresolved raw candidate",
    countryDay: "one sovereign jurisdiction on one UTC calendar date",
    famousHistoricalCases: "regression_only_excluded_from_estimation",
  },
  precision: {
    confidenceLevel: 0.95,
    anticipatedProportion: 0.5,
    absoluteHalfWidth: 0.05,
    simpleRandomRequired: 385,
    planningDesignEffect: 1.25,
    validRequiredPerProbabilityFrame: 482,
    anticipatedUnusableFraction: 0.1,
    initialDrawPerProbabilityFrame: 536,
    rule: "report design-based intervals; never replace observed design effect with the planning value",
  },
  frames: [
    {
      id: "retained_event_candidate_census",
      selection: "census",
      validTarget: 384,
      initialDraw: 384,
      primaryStratum: "event_month",
      populationRule:
        "all event rows created by the freeze time whose event date is inside the period, deduplicated by cluster",
      estimandRole: "finite-period event-candidate precision and error analysis",
    },
    {
      id: "system_negative_probability",
      selection: "stratified_probability",
      validTarget: 482,
      initialDraw: 536,
      primaryStratum: "candidate_state",
      populationRule:
        "retained exclusion outcomes whose candidate is outside the event census, plus raw candidates retrieved by the freeze time that have no event-source link",
      estimandRole: "false-negative, abstention, invalid-input, and deduplication error analysis",
    },
    {
      id: "country_day_retrieval_probability",
      selection: "stratified_probability",
      validTarget: 482,
      initialDraw: 536,
      primaryStratum: "continent_x_calendar_month",
      populationRule:
        "every sovereign-state jurisdiction crossed with every UTC date in the frozen period",
      estimandRole: "retrieval-miss, true-negative, and insufficient-observation analysis",
    },
  ],
  balancingMargins: {
    geography: ["continent", "jurisdiction"],
    time: ["calendar_month", "week"],
    language: ["en", "es", "fr", "ar", "zh", "ru", "pt", "de", "id", "it", "other", "und"],
    sourceType: ["specialist", "news", "none"],
    regime: [
      "parliamentary_democracy",
      "semi_presidential_democracy",
      "presidential_democracy",
      "civilian_dictatorship",
      "military_dictatorship",
      "royal_dictatorship",
      "unclassified",
    ],
    mediaEvidenceEnvironment: [
      "multi_family_5plus",
      "observed_below_threshold",
      "no_retained_documents",
      "political_media_context_missing",
    ],
    minimumValidPerReportableMarginWhenPopulationPermits: 30,
    crossingRule:
      "balance margins separately; do not require a sparse full cross-product",
  },
  selection: {
    seed: "pulse-evaluation-sampling-frame/v1|2026-07-11",
    allocator: "bounded_minimum_plus_largest_remainder/v1",
    secondaryMarginRepair:
      "same-primary-stratum deterministic swaps until declared marginal minima are met; population, primary quotas, seed, and primary base weights remain fixed",
    withinStratumOrder: "sha256(seed|frame|stratum|unit_id)",
    replacement: "next hash-ranked reserve in the same primary stratum",
    weight:
      "primary-stratum draw fractions define base weights; analysis calibrates them to the frozen media-evidence population totals after secondary-margin repair",
    prohibited: [
      "labels_or_model_correctness_in_selection",
      "owner_approval_as_gold",
      "famous_case_substitution",
      "post_label_quota_changes",
      "dropping_sampled_failures",
    ],
  },
  analysis: {
    benchmarkAccuracy: "conditioned_on_the_frozen_items",
    generalizedAccuracy:
      "requires design weights plus item/country clustering or a declared mixed model",
    variance: "Taylor linearization or replicate-weight equivalent",
    secondaryMarginAdjustment:
      "report calibrated-weight results against unweighted and primary-base-weight sensitivity estimates; secondary-margin repair is not ignorable simple random sampling",
    rareMargins: "report insufficient evidence when valid n is below 30",
    multiplicity: "headline overall metrics primary; subgroup results descriptive with intervals",
  },
  sources: [
    "https://pubmed.ncbi.nlm.nih.gov/8870764/",
    "https://wwwn.cdc.gov/nchs/nhanes/tutorials/varianceestimation.aspx",
    "https://wwwn.cdc.gov/nchs/nhanes/tutorials/weighting.aspx",
    "https://doi.org/10.6028/NIST.AI.800-3",
  ],
} as const);

export function simpleRandomProportionSampleSize(input: {
  z: number;
  proportion: number;
  halfWidth: number;
}): number {
  if (input.z <= 0 || input.proportion <= 0 || input.proportion >= 1 || input.halfWidth <= 0 || input.halfWidth >= 1) {
    throw new Error("invalid proportion sample-size inputs");
  }
  return Math.ceil(
    (input.z ** 2 * input.proportion * (1 - input.proportion)) /
      input.halfWidth ** 2,
  );
}

export function inflateSampleSize(input: {
  simpleRandom: number;
  designEffect: number;
  unusableFraction: number;
}): { validRequired: number; initialDraw: number } {
  if (!Number.isInteger(input.simpleRandom) || input.simpleRandom < 1 || input.designEffect < 1 || input.unusableFraction < 0 || input.unusableFraction >= 1) {
    throw new Error("invalid sample-size inflation inputs");
  }
  const validRequired = Math.ceil(input.simpleRandom * input.designEffect);
  return {
    validRequired,
    initialDraw: Math.ceil(validRequired / (1 - input.unusableFraction)),
  };
}

export function allocatePrimaryStrata(
  population: Readonly<Record<string, number>>,
  target: number,
  minimum: number,
): Record<string, number> {
  const entries = Object.entries(population).sort(([a], [b]) => a.localeCompare(b));
  if (!Number.isInteger(target) || target < 1 || !Number.isInteger(minimum) || minimum < 0) throw new Error("invalid allocation target");
  if (entries.some(([, count]) => !Number.isInteger(count) || count < 0)) throw new Error("invalid stratum population");
  const total = entries.reduce((sum, [, count]) => sum + count, 0);
  if (target > total) throw new Error("sample target exceeds the population");
  const allocated = Object.fromEntries(entries.map(([key, count]) => [key, Math.min(count, minimum)]));
  let remaining = target - Object.values(allocated).reduce((sum, count) => sum + count, 0);
  if (remaining < 0) throw new Error("stratum minima exceed the sample target");
  while (remaining > 0) {
    const capacity = entries.map(([key, count]) => ({ key, capacity: count - allocated[key] })).filter(({ capacity }) => capacity > 0);
    const capacityTotal = capacity.reduce((sum, row) => sum + row.capacity, 0);
    const ranked = capacity.map((row) => {
      const exact = (remaining * row.capacity) / capacityTotal;
      return { ...row, floor: Math.min(row.capacity, Math.floor(exact)), remainder: exact - Math.floor(exact) };
    });
    const floorTotal = ranked.reduce((sum, row) => sum + row.floor, 0);
    for (const row of ranked) allocated[row.key] += row.floor;
    remaining -= floorTotal;
    if (remaining === 0) break;
    for (const row of ranked.sort((a, b) => b.remainder - a.remainder || a.key.localeCompare(b.key))) {
      if (remaining === 0) break;
      if (allocated[row.key] < population[row.key]) {
        allocated[row.key]++;
        remaining--;
      }
    }
  }
  return allocated;
}

export function stableSample<T extends { id: string; stratum: string }>(input: {
  rows: readonly T[];
  quotas: Readonly<Record<string, number>>;
  seed: string;
  frameId: string;
}): T[] {
  const byStratum = new Map<string, T[]>();
  for (const row of input.rows) byStratum.set(row.stratum, [...(byStratum.get(row.stratum) ?? []), row]);
  return Object.entries(input.quotas).sort(([a], [b]) => a.localeCompare(b)).flatMap(([stratum, quota]) => {
    const rows = byStratum.get(stratum) ?? [];
    if (quota > rows.length) throw new Error(`quota exceeds population for ${stratum}`);
    return rows
      .map((row) => ({ row, key: createHash("sha256").update(`${input.seed}|${input.frameId}|${stratum}|${row.id}`).digest("hex") }))
      .sort((a, b) => a.key.localeCompare(b.key) || a.row.id.localeCompare(b.row.id))
      .slice(0, quota)
      .map(({ row }) => row);
  });
}

export function pulseEvaluationSamplingErrors(): string[] {
  const protocol = PULSE_EVALUATION_SAMPLING_PROTOCOL;
  const errors: string[] = [];
  const expectedSrs = simpleRandomProportionSampleSize({ z: 1.96, proportion: 0.5, halfWidth: 0.05 });
  const inflated = inflateSampleSize({ simpleRandom: expectedSrs, designEffect: protocol.precision.planningDesignEffect, unusableFraction: protocol.precision.anticipatedUnusableFraction });
  if (expectedSrs !== protocol.precision.simpleRandomRequired) errors.push("simple-random sample-size rationale drifted");
  if (inflated.validRequired !== protocol.precision.validRequiredPerProbabilityFrame || inflated.initialDraw !== protocol.precision.initialDrawPerProbabilityFrame) errors.push("design/attrition inflation drifted");
  if (protocol.frames.length !== 3) errors.push("three sampling frames are required");
  if (protocol.labelAccessAtFreeze !== "none") errors.push("protocol was not frozen blind to labels");
  if (protocol.unitSeparation.famousHistoricalCases !== "regression_only_excluded_from_estimation") errors.push("famous cases entered estimation");
  for (const axis of ["geography", "time", "language", "sourceType", "regime", "mediaEvidenceEnvironment"] as const) {
    if ([...protocol.balancingMargins[axis]].length === 0) errors.push(`missing ${axis} margin`);
  }
  return errors;
}
