import Link from "next/link";

import { DataValueState } from "@/components/DataValueState";
import { Chip } from "@/components/editorial/Pill";
import { Banner } from "@/components/editorial/Banner";
import { ValueOriginNote } from "@/components/provenance/ValueOriginNote";
import {
  type ConditionsPublicCalculation,
  type ConditionsPublicRelease,
} from "@/lib/conditions/public-release";
import { parseDataValueStatus } from "@/lib/data/value-state";

const DIMENSION_LABEL: Record<string, string> = {
  human_development: "Human development",
  peace_security: "Peace & security",
  economic_stability: "Economic stability",
};

const COMPONENT_LABEL: Record<string, string> = {
  hdi: "Human Development Index",
  global_peace_index: "Global Peace Index",
  inflation: "Inflation",
  unemployment: "Unemployment",
  gdp_growth: "GDP growth",
};

function formatNumber(value: number | null, maximumFractionDigits = 2) {
  return value === null
    ? null
    : new Intl.NumberFormat("en", { maximumFractionDigits }).format(value);
}

/**
 * The card's headline line. A 0 to 100 position is a Civica calculation from
 * the publisher's figure, so it always carries the ValueOriginNote marker and
 * its formula (publisher-attribution/v1, CLM-020). The comparison view passes
 * `showCivicaPosition={false}` and shows only the publisher components.
 */
function CalculationPosition({
  calculation,
  showCivicaPosition,
}: {
  calculation: ConditionsPublicCalculation;
  showCivicaPosition: boolean;
}) {
  if (calculation.dimension === "economic_stability") {
    return <p className="conditions-country-score">No composite published</p>;
  }
  if (calculation.normalizedScore === null) {
    return <p className="conditions-country-score">Not scored</p>;
  }
  if (!showCivicaPosition) return null;
  return (
    <p className="conditions-country-score">
      {formatNumber(calculation.normalizedScore, 1)} / 100
      <ValueOriginNote
        origin={
          calculation.scoreOrigin ?? {
            kind: "civica_calculation",
            transformationId: "unregistered",
          }
        }
      />
    </p>
  );
}

function CountryConditionCard({
  calculation,
  showCivicaPosition,
}: {
  calculation: ConditionsPublicCalculation;
  showCivicaPosition: boolean;
}) {
  const source = calculation.scoreSourceName ?? calculation.scoreSourceId;
  return (
    <article className="conditions-country-card">
      <div className="conditions-country-card-head">
        <h3>{DIMENSION_LABEL[calculation.dimension]}</h3>
        <Chip variant={calculation.alignmentStatus === "aligned" ? "sage" : "sand"}>
          {calculation.alignmentStatus === "aligned"
            ? "Aligned inputs"
            : calculation.alignmentStatus === "mixed_year_refused"
              ? "Mixed years refused"
              : "Component unavailable"}
        </Chip>
      </div>
      <CalculationPosition
        calculation={calculation}
        showCivicaPosition={showCivicaPosition}
      />
      <p className="conditions-country-meta">
        {calculation.referenceYear === null
          ? "No common reference year"
          : `Reference year ${calculation.referenceYear}`}
        {source ? ` · ${source}` : ""}
      </p>
      <ul className="conditions-country-components">
        {calculation.components.map((component) => {
          const value = formatNumber(component.nativeValue);
          return (
            <li key={component.componentId}>
              <strong>{COMPONENT_LABEL[component.componentId] ?? component.componentId}</strong>
              <DataValueState
                status={parseDataValueStatus(component.valueStatus)}
                reason={component.valueStatusReason}
              >
                {value === null ? "Not available" : `${value} ${component.nativeUnit}`}
              </DataValueState>
              <span>
                {component.referenceYear === null ? "" : ` · ${component.referenceYear}`}
                {` · ${component.sourceName ?? component.sourceId}`}
              </span>
            </li>
          );
        })}
      </ul>
    </article>
  );
}

export function CivicaConditionsPanel({
  jurisdictionId,
  release,
  releaseStatus = "available",
  showHeading = true,
  stacked = false,
  showCivicaPosition = true,
}: {
  jurisdictionId: string;
  release: ConditionsPublicRelease | null;
  releaseStatus?: "available" | "unavailable";
  showHeading?: boolean;
  stacked?: boolean;
  /** False on the comparison view, which shows publisher components only. */
  showCivicaPosition?: boolean;
}) {
  const calculations = release?.calculations.filter(
    (calculation) => calculation.jurisdictionId === jurisdictionId,
  ) ?? [];
  const releaseHref = release
    ? `/civica-conditions?release=${encodeURIComponent(release.release.releaseId)}`
    : "/civica-conditions";

  return (
    <div className="conditions-country-panel">
      {showHeading ? (
        <div className="conditions-country-heading">
          <div>
            <p className="conditions-country-eyebrow">Civica Conditions</p>
            <p className="conditions-country-intro">
              Separate source-native material indicators. They are not combined
              with governance or each other.
            </p>
          </div>
          <Link className="conditions-country-link" href={releaseHref}>
            Explore release
          </Link>
        </div>
      ) : null}
      {releaseStatus === "unavailable" ? (
        <Banner variant="warn">
          Conditions data is temporarily unavailable. Civica is not treating
          this as evidence that this country has no material indicators.
        </Banner>
      ) : release === null ? (
        <p className="editorial-empty">
          No versioned Conditions release is available for this country yet.
        </p>
      ) : calculations.length === 0 ? (
        <p className="editorial-empty">
          This release has no Conditions calculation for this country.
        </p>
      ) : (
        <div
          className={`conditions-country-grid${stacked ? " conditions-country-grid--stacked" : ""}`}
        >
          {calculations.map((calculation) => (
            <CountryConditionCard
              key={calculation.calculationKey}
              calculation={calculation}
              showCivicaPosition={showCivicaPosition}
            />
          ))}
        </div>
      )}
    </div>
  );
}
