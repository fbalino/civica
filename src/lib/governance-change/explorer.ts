export const GOVERNANCE_CHANGE_CONTRACT =
  "source-native-governance-change/v1" as const;
export const GOVERNANCE_CHANGE_MIN_COMPARABLE = 30;
export const GOVERNANCE_CHANGE_MIN_COVERAGE = 0.5;

export interface GovernanceChangeObservation {
  jurisdictionId: string;
  jurisdictionName: string;
  jurisdictionSlug: string;
  year: number;
  value: number;
}

export interface GovernanceChangeRow {
  jurisdictionId: string;
  jurisdictionName: string;
  jurisdictionSlug: string;
  startValue: number;
  endValue: number;
  rawDelta: number;
  publisherAlignedDelta: number;
  sensitivityMin: number;
  sensitivityMax: number;
  sensitivityWindowCount: number;
  directionStable: boolean;
}

export interface GovernanceChangeResult {
  schemaVersion: typeof GOVERNANCE_CHANGE_CONTRACT;
  status: "ranked" | "no_ranking";
  reason: string | null;
  startYear: number;
  endYear: number;
  eligibleJurisdictions: number;
  comparableJurisdictions: number;
  coverageRatio: number;
  rows: GovernanceChangeRow[];
}

function direction(value: number): -1 | 0 | 1 {
  if (Math.abs(value) < 1e-12) return 0;
  return value > 0 ? 1 : -1;
}

export function buildGovernanceChangeResult(input: {
  observations: GovernanceChangeObservation[];
  startYear: number;
  endYear: number;
  isInverted: boolean;
  minComparable?: number;
  minCoverage?: number;
}): GovernanceChangeResult {
  if (input.startYear >= input.endYear) {
    throw new Error("The governance-change window must move forward in time.");
  }
  const byJurisdiction = new Map<
    string,
    {
      name: string;
      slug: string;
      points: Map<number, number>;
    }
  >();
  for (const observation of input.observations) {
    const row =
      byJurisdiction.get(observation.jurisdictionId) ??
      {
        name: observation.jurisdictionName,
        slug: observation.jurisdictionSlug,
        points: new Map<number, number>(),
      };
    row.points.set(observation.year, observation.value);
    byJurisdiction.set(observation.jurisdictionId, row);
  }

  const orient = (delta: number) => (input.isInverted ? -delta : delta);
  const rows: GovernanceChangeRow[] = [];
  for (const [jurisdictionId, jurisdiction] of byJurisdiction) {
    const startValue = jurisdiction.points.get(input.startYear);
    const endValue = jurisdiction.points.get(input.endYear);
    if (startValue === undefined || endValue === undefined) continue;
    const rawDelta = endValue - startValue;
    const publisherAlignedDelta = orient(rawDelta);
    const sensitivity = new Set<number>();
    for (const startYear of [
      input.startYear - 1,
      input.startYear,
      input.startYear + 1,
    ]) {
      for (const endYear of [
        input.endYear - 1,
        input.endYear,
        input.endYear + 1,
      ]) {
        if (startYear >= endYear) continue;
        const alternativeStart = jurisdiction.points.get(startYear);
        const alternativeEnd = jurisdiction.points.get(endYear);
        if (
          alternativeStart === undefined ||
          alternativeEnd === undefined
        ) {
          continue;
        }
        sensitivity.add(orient(alternativeEnd - alternativeStart));
      }
    }
    const sensitivityValues = [...sensitivity];
    const directions = sensitivityValues.map(direction);
    rows.push({
      jurisdictionId,
      jurisdictionName: jurisdiction.name,
      jurisdictionSlug: jurisdiction.slug,
      startValue,
      endValue,
      rawDelta,
      publisherAlignedDelta,
      sensitivityMin: Math.min(...sensitivityValues),
      sensitivityMax: Math.max(...sensitivityValues),
      sensitivityWindowCount: sensitivityValues.length,
      directionStable: directions.every(
        (value) => value === direction(publisherAlignedDelta),
      ),
    });
  }

  const eligibleJurisdictions = byJurisdiction.size;
  const comparableJurisdictions = rows.length;
  const coverageRatio =
    eligibleJurisdictions === 0
      ? 0
      : comparableJurisdictions / eligibleJurisdictions;
  const minComparable =
    input.minComparable ?? GOVERNANCE_CHANGE_MIN_COMPARABLE;
  const minCoverage = input.minCoverage ?? GOVERNANCE_CHANGE_MIN_COVERAGE;
  const reasons: string[] = [];
  if (comparableJurisdictions < minComparable) {
    reasons.push(
      `${comparableJurisdictions} exact-window countries is below the ${minComparable}-country minimum`,
    );
  }
  if (coverageRatio < minCoverage) {
    reasons.push(
      `${Math.round(coverageRatio * 100)}% exact-window coverage is below the ${Math.round(minCoverage * 100)}% minimum`,
    );
  }
  const status = reasons.length ? "no_ranking" : "ranked";

  return {
    schemaVersion: GOVERNANCE_CHANGE_CONTRACT,
    status,
    reason: reasons.length ? reasons.join("; ") : null,
    startYear: input.startYear,
    endYear: input.endYear,
    eligibleJurisdictions,
    comparableJurisdictions,
    coverageRatio,
    rows:
      status === "ranked"
        ? rows.sort(
            (a, b) =>
              b.publisherAlignedDelta - a.publisherAlignedDelta ||
              a.jurisdictionName.localeCompare(b.jurisdictionName),
          )
        : rows.sort((a, b) =>
            a.jurisdictionName.localeCompare(b.jurisdictionName),
          ),
  };
}
