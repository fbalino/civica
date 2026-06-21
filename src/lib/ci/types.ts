export type CIDimension =
  | "democratic_quality"
  | "rule_of_law"
  | "human_development"
  | "freedom_rights"
  | "corruption_control"
  | "stability_security";

export interface SourceDataRecord {
  iso3: string;
  year: number;
  dimension: CIDimension;
  indicator: string;
  rawValue: number;
  nativeMin: number;
  nativeMax: number;
  isInverted: boolean;
}

export interface IngestionResult {
  sourceId: string;
  dimension: CIDimension;
  datasetYear: number;
  records: SourceDataRecord[];
  globalMinObserved: number;
  globalMaxObserved: number;
}

