export const TEMPORAL_METADATA_VERSION = "temporal-metadata/v1" as const;

export interface TemporalMetadata {
  observationReferenceYear: number | null;
  upstreamDatasetRelease: string | null;
  retrievedAt: string | null;
  civicaPublicationVersion: string | null;
}

export function temporalMetadataErrors(value: TemporalMetadata): string[] {
  const errors: string[] = [];
  if (value.observationReferenceYear !== null && (!Number.isInteger(value.observationReferenceYear) || value.observationReferenceYear < 1800 || value.observationReferenceYear > 2200)) errors.push("invalid observation reference year");
  if (value.retrievedAt !== null && Number.isNaN(Date.parse(value.retrievedAt))) errors.push("invalid retrieval time");
  if (value.upstreamDatasetRelease !== null && !value.upstreamDatasetRelease.trim()) errors.push("blank upstream dataset release");
  if (value.civicaPublicationVersion !== null && !value.civicaPublicationVersion.trim()) errors.push("blank Civica publication version");
  return errors;
}

export function assertReferenceYear(value: TemporalMetadata, expectedYear: number, source: string): void {
  const errors = temporalMetadataErrors(value);
  if (value.observationReferenceYear !== expectedYear) errors.push(`${source} reference year must be ${expectedYear}, not ${value.observationReferenceYear}`);
  if (errors.length) throw new Error(errors.join("; "));
}
