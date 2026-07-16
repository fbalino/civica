export interface ScoreFreshnessInput {
  freshness: "frozen_release" | "live_current";
  release: {
    releaseId: string;
    quarter: string;
    vintageLabel: string;
  } | null;
}

export interface ScoreFreshnessPresentation {
  label: string;
  ariaLabel: string;
  variant: "sand" | "sage";
}

/** Plain-language presentation for the mixed release/current score table. */
export function scoreFreshnessPresentation(
  row: ScoreFreshnessInput,
): ScoreFreshnessPresentation {
  if (row.freshness === "frozen_release") {
    if (!row.release) {
      throw new Error("Frozen score row is missing its release identity");
    }
    const quarter = row.release.quarter.replace("-", " ");
    return {
      label: `Frozen release · ${quarter}`,
      ariaLabel: `Frozen release: ${row.release.vintageLabel} (${row.release.releaseId})`,
      variant: "sand",
    };
  }
  if (row.release) {
    throw new Error("Current score row cannot claim a frozen release identity");
  }
  return {
    label: "Current source data",
    ariaLabel: "Current source data, not part of the frozen Index release",
    variant: "sage",
  };
}
