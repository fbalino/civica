import Link from "next/link";

import { DataValueState } from "@/components/DataValueState";
import { Chip } from "@/components/editorial/Pill";
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

function calculationScore(calculation: ConditionsPublicCalculation) {
  if (calculation.normalizedScore !== null) {
    return `${formatNumber(calculation.normalizedScore, 1)} / 100`;
  }
  return calculation.dimension === "economic_stability"
    ? "No composite published"
    : "Not scored";
}

function CountryConditionCard({
  calculation,
}: {
  calculation: ConditionsPublicCalculation;
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
      <p className="conditions-country-score">{calculationScore(calculation)}</p>
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
}: {
  jurisdictionId: string;
  release: ConditionsPublicRelease | null;
}) {
  const calculations = release?.calculations.filter(
    (calculation) => calculation.jurisdictionId === jurisdictionId,
  ) ?? [];
  const releaseHref = release
    ? `/civica-conditions?release=${encodeURIComponent(release.release.releaseId)}`
    : "/civica-conditions";

  return (
    <div className="conditions-country-panel">
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
      {release === null ? (
        <p className="editorial-empty">
          No versioned Conditions release is available for this country yet.
        </p>
      ) : calculations.length === 0 ? (
        <p className="editorial-empty">
          This release has no Conditions calculation for this country.
        </p>
      ) : (
        <div className="conditions-country-grid">
          {calculations.map((calculation) => (
            <CountryConditionCard
              key={calculation.calculationKey}
              calculation={calculation}
            />
          ))}
        </div>
      )}
    </div>
  );
}
