export const CI_SERIES_TYPES = [
  "as_published_release",
  "harmonized_backcast",
] as const;

export type CiSeriesType = (typeof CI_SERIES_TYPES)[number];

export function normalizeCiSeriesType(value: string): CiSeriesType {
  if (value === "as_published_release") return value;
  if (value === "harmonized_backcast" || value === "current_harmonized_backcast_not_as_published") {
    return "harmonized_backcast";
  }
  throw new Error(`Unknown Civica series type: ${value}`);
}

export type CiSeriesProvenance = {
  releaseId: string;
  seriesType: CiSeriesType;
  observationPeriodStart: string;
  observationPeriodEnd: string;
  originalPublicationCutAt: string | null;
  calculatedAt: string;
  methodVersion: string;
  citationLabel: string;
};

function validIsoInstant(value: string | null): value is string {
  return value !== null && Number.isFinite(Date.parse(value)) && /T\d{2}:\d{2}:\d{2}/.test(value);
}

export function ciSeriesProvenanceErrors(series: CiSeriesProvenance): string[] {
  const errors: string[] = [];
  const calculatedAt = Date.parse(series.calculatedAt);
  if (!series.releaseId.trim()) errors.push("release id is missing");
  if (!CI_SERIES_TYPES.includes(series.seriesType)) errors.push("series type is invalid");
  if (!series.observationPeriodStart.trim() || !series.observationPeriodEnd.trim()) errors.push("observation period is incomplete");
  if (!Number.isFinite(calculatedAt) || !validIsoInstant(series.calculatedAt)) errors.push("calculation time is invalid");
  if (!series.methodVersion.trim()) errors.push("method version is missing");
  if (!series.citationLabel.trim()) errors.push("citation label is missing");

  const observationYears = [series.observationPeriodStart, series.observationPeriodEnd]
    .map((value) => value.match(/(?:19|20)\d{2}/)?.[0])
    .filter((value): value is string => Boolean(value));

  if (series.seriesType === "as_published_release") {
    if (!validIsoInstant(series.originalPublicationCutAt)) {
      errors.push("as-published release requires its original publication cut time");
    } else {
      const cutAt = Date.parse(series.originalPublicationCutAt);
      const publicationYear = new Date(cutAt).getUTCFullYear();
      if (calculatedAt > cutAt) errors.push("as-published calculation occurs after its publication cut");
      if (!series.citationLabel.includes(`published ${publicationYear}`)) {
        errors.push("as-published citation must name the actual publication year");
      }
    }
    for (const year of observationYears) {
      if (series.citationLabel.toLowerCase().includes(`${year} as-published`)) {
        errors.push("observation year is mislabelled as the as-published vintage");
      }
    }
  } else {
    if (series.originalPublicationCutAt !== null) errors.push("harmonized backcast cannot invent an original publication cut");
    if (!/harmonized backcast/i.test(series.citationLabel)) errors.push("backcast citation must disclose harmonized backcast status");
    if (/as-published/i.test(series.citationLabel)) errors.push("backcast citation cannot claim as-published status");
  }
  return errors;
}

export function assertCiSeriesProvenance(series: CiSeriesProvenance): CiSeriesProvenance {
  const errors = ciSeriesProvenanceErrors(series);
  if (errors.length > 0) throw new Error(`${series.releaseId}: ${errors.join(", ")}`);
  return Object.freeze({ ...series });
}

export function selectCiSeries<T extends { seriesType: CiSeriesType }>(rows: readonly T[], seriesType: CiSeriesType): T[] {
  return rows.filter((row) => row.seriesType === seriesType);
}
