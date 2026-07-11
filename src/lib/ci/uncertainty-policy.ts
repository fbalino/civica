import { CURRENT_CI_METHODOLOGY_VERSION } from "./current-release";

export const CURRENT_CI_UNCERTAINTY_POLICY = Object.freeze({
  schemaVersion: "ci-uncertainty-policy/v1" as const,
  id: `ci-uncertainty/${CURRENT_CI_METHODOLOGY_VERSION}` as const,
  methodologyVersion: CURRENT_CI_METHODOLOGY_VERSION,
  pointEstimate: "deterministic_weighted_composite" as const,
  displayedRange: "not_published" as const,
  covarianceModel: "not_available" as const,
  usableReleasedUncertaintyRows: 0 as const,
  releasedDimensionRows: 745 as const,
  disposition:
    "removed_until_source_specific_uncertainty_and_dependence_are_retained_and_validated" as const,
  sources: Object.freeze([
    Object.freeze({
      sourceId: "vdem",
      upstreamUncertainty: "posterior_intervals_available",
      retainedInCurrentRelease: false,
      reference: "https://www.v-dem.net/documents/56/methodology.pdf",
    }),
    Object.freeze({
      sourceId: "worldbank_wgi",
      upstreamUncertainty: "model_based_standard_errors_available",
      retainedInCurrentRelease: false,
      reference:
        "https://www.worldbank.org/en/publication/worldwide-governance-indicators/documentation",
    }),
    Object.freeze({
      sourceId: "freedom_house",
      upstreamUncertainty: "no_per_country_probability_distribution_published",
      retainedInCurrentRelease: false,
      reference:
        "https://freedomhouse.org/reports/freedom-world/freedom-world-research-methodology",
    }),
    Object.freeze({
      sourceId: "transparency_intl",
      upstreamUncertainty:
        "source_agreement_and_significance_information_not_retained_as_a_distribution",
      retainedInCurrentRelease: false,
      reference:
        "https://www.transparency.org/en/news/how-cpi-scores-are-calculated",
    }),
  ]),
});
