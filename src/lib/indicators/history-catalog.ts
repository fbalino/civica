export const INDICATOR_HISTORY_CATALOG_VERSION =
  "indicator-history-catalog/v1" as const;

export interface IndicatorHistoryCatalogEntry {
  sourceId: string;
  indicator: string;
  dimension: string;
  label: string;
  shortLabel: string;
  definition: string;
  unit: string;
  nativeScale: string;
  expectedCadence: string;
  comparabilityNote: string;
}

export const INDICATOR_HISTORY_CATALOG: readonly IndicatorHistoryCatalogEntry[] =
  [
    {
      sourceId: "vdem",
      indicator: "v2x_libdem",
      dimension: "democratic_quality",
      label: "V-Dem Liberal Democracy Index",
      shortLabel: "Liberal democracy",
      definition:
        "V-Dem's model-based Liberal Democracy Index, retained on its published 0–1 scale.",
      unit: "index points",
      nativeScale:
        "0–1; higher values indicate more liberal-democratic institutions",
      expectedCadence: "Annual where V-Dem publishes an observation",
      comparabilityNote:
        "The archive is the historical series carried by one captured current release, not a set of historical as-published vintages. V-Dem may revise earlier estimates between releases.",
    },
    {
      sourceId: "worldbank_wgi",
      indicator: "rl.est",
      dimension: "rule_of_law",
      label: "World Bank WGI Rule of Law estimate",
      shortLabel: "Rule of law",
      definition:
        "The World Bank Worldwide Governance Indicators Rule of Law estimate in its published estimate units.",
      unit: "estimate",
      nativeScale:
        "approximately −2.5 to +2.5; higher values indicate stronger rule-of-law estimates",
      expectedCadence: "Biennial in 1996–2002, annual thereafter",
      comparabilityNote:
        "The early biennial cadence is a publication pattern, not missing annual zeroes. WGI uncertainty intervals are not stored in this history table and the point estimates should not be read as exact measurements.",
    },
    {
      sourceId: "undp_hdi",
      indicator: "hdi",
      dimension: "human_development",
      label: "UNDP Human Development Index",
      shortLabel: "Human development",
      definition:
        "UNDP's Human Development Index, retained on its published 0–1 scale.",
      unit: "index points",
      nativeScale:
        "0–1; higher values indicate higher measured human development",
      expectedCadence: "Annual where UNDP publishes an observation",
      comparabilityNote:
        "The archive is a current-release historical series rather than historical as-published vintages. Method and input revisions can change earlier values in later releases.",
    },
    {
      sourceId: "freedom_house",
      indicator: "fh_total_score",
      dimension: "freedom_rights",
      label: "Freedom House Total Score",
      shortLabel: "Freedom and rights",
      definition:
        "Freedom House Political Rights and Civil Liberties component scores summed to the publisher's 0–100 Total Score.",
      unit: "score points",
      nativeScale:
        "0–100; higher values indicate more political rights and civil liberties",
      expectedCadence: "Annual from 2003 where both components are published",
      comparabilityNote:
        "This history uses the 0–100 Total Score and is not the same measure as the older 1–7 Freedom Rating used in some Civica Index research inputs.",
    },
    {
      sourceId: "transparency_intl",
      indicator: "score",
      dimension: "corruption_control",
      label: "Transparency International Corruption Perceptions Index",
      shortLabel: "Corruption perceptions",
      definition:
        "Transparency International's Corruption Perceptions Index on the post-2012 0–100 scale.",
      unit: "score points",
      nativeScale:
        "0–100; higher values indicate lower perceived public-sector corruption",
      expectedCadence: "Annual from 2012",
      comparabilityNote:
        "The stored series begins with the post-2012 methodology. It must not be joined silently to earlier CPI scales.",
    },
  ] as const;

export function indicatorHistoryCatalogEntry(
  sourceId: string,
  indicator: string,
): IndicatorHistoryCatalogEntry | null {
  return (
    INDICATOR_HISTORY_CATALOG.find(
      (entry) => entry.sourceId === sourceId && entry.indicator === indicator,
    ) ?? null
  );
}

export interface IndicatorObservationBreak {
  afterYear: number;
  beforeYear: number;
  unobservedYears: number;
}

/**
 * Identify visible holes without inventing an observation for an unrecorded
 * year. A two-year step remains connected because WGI's early publication
 * cadence is biennial; three years or more becomes an explicit break.
 */
export function indicatorObservationBreaks(
  years: readonly number[],
): IndicatorObservationBreak[] {
  const ordered = [...new Set(years)].sort((a, b) => a - b);
  const breaks: IndicatorObservationBreak[] = [];
  for (let index = 1; index < ordered.length; index++) {
    const afterYear = ordered[index - 1];
    const beforeYear = ordered[index];
    if (beforeYear - afterYear <= 2) continue;
    breaks.push({
      afterYear,
      beforeYear,
      unobservedYears: beforeYear - afterYear - 1,
    });
  }
  return breaks;
}
