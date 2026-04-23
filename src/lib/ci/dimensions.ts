/**
 * Shared constants for the six Civica Index dimensions and their weights
 * under methodology v1.0. Centralised so the CI compare view, the country
 * detail view, the rankings page, and the methodology docs all agree.
 *
 * If the methodology is ever updated, the new weights should land in
 * ci_methodology_versions (the database source of truth) AND this file —
 * the DB row drives the scoring pipeline, this file drives the display.
 */

export type CIDimensionKey =
  | "democratic_quality"
  | "rule_of_law"
  | "human_development"
  | "freedom_rights"
  | "corruption_control"
  | "stability_security";

export const DIMENSION_LABELS: Record<CIDimensionKey, string> = {
  democratic_quality: "Democratic quality",
  rule_of_law: "Rule of law & institutions",
  human_development: "Human development",
  freedom_rights: "Freedom & rights",
  corruption_control: "Corruption control",
  stability_security: "Stability & security",
};

export const DIMENSION_ORDER: readonly CIDimensionKey[] = [
  "democratic_quality",
  "rule_of_law",
  "human_development",
  "freedom_rights",
  "corruption_control",
  "stability_security",
];

export const DIMENSION_WEIGHTS: Record<CIDimensionKey, number> = {
  democratic_quality: 30,
  rule_of_law: 20,
  human_development: 15,
  freedom_rights: 15,
  corruption_control: 10,
  stability_security: 10,
};
