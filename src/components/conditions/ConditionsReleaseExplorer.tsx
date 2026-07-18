import Link from "next/link";

import { DataValueState } from "@/components/DataValueState";
import { DataTable } from "@/components/editorial/DataTable";
import { Banner } from "@/components/editorial/Banner";
import { Chip } from "@/components/editorial/Pill";
import {
  type ConditionsPublicCalculation,
  type ConditionsPublicComponent,
  type ConditionsPublicRelease,
} from "@/lib/conditions/public-release";
import { parseDataValueStatus } from "@/lib/data/value-state";

const DIMENSION_LABEL: Record<string, string> = {
  human_development: "Human development",
  peace_security: "Peace & security",
  economic_stability: "Economic stability",
};

const ALIGNMENT_LABEL: Record<string, string> = {
  aligned: "Aligned inputs",
  mixed_year_refused: "Mixed years refused",
  missing_component: "Component unavailable",
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

function scoreLabel(calculation: ConditionsPublicCalculation) {
  if (calculation.normalizedScore !== null) {
    return `${formatNumber(calculation.normalizedScore, 1)} / 100`;
  }
  if (calculation.dimension === "economic_stability") {
    return "No composite published";
  }
  return "Not scored";
}

function ComponentDetail({ component }: { component: ConditionsPublicComponent }) {
  const value = formatNumber(component.nativeValue);
  const source = component.sourceName ?? component.sourceId;
  return (
    <li className="conditions-release-component">
      <strong>{COMPONENT_LABEL[component.componentId] ?? component.componentId}</strong>
      <span>
        <DataValueState
          status={parseDataValueStatus(component.valueStatus)}
          reason={component.valueStatusReason}
        >
          {value === null ? "Not available" : `${value} ${component.nativeUnit}`}
        </DataValueState>
        {component.referenceYear === null ? "" : ` · ${component.referenceYear}`}
      </span>
      <span>
        <a href={component.licenseUrl}>{source}</a> · {component.indicatorId}
      </span>
    </li>
  );
}

function CalculationRow({ calculation }: { calculation: ConditionsPublicCalculation }) {
  const source = calculation.scoreSourceName ?? calculation.scoreSourceId;
  return (
    <tr>
      <td>
        <Link href={`/country/${calculation.countrySlug}`}>
          {calculation.countryName}
        </Link>
        {calculation.countryIso3 ? <span> · {calculation.countryIso3}</span> : null}
      </td>
      <td>
        <strong>{DIMENSION_LABEL[calculation.dimension]}</strong>
        <br />
        <Chip variant={calculation.alignmentStatus === "aligned" ? "sage" : "sand"}>
          {ALIGNMENT_LABEL[calculation.alignmentStatus]}
        </Chip>
      </td>
      <td className="num">
        {scoreLabel(calculation)}
        {calculation.referenceYear === null ? null : <><br />{calculation.referenceYear}</>}
      </td>
      <td>
        {source ? <span>{source}</span> : <span>Component ledger only</span>}
        {calculation.scoreIndicatorId ? <><br />{calculation.scoreIndicatorId}</> : null}
      </td>
      <td>
        <ul className="conditions-release-components">
          {calculation.components.map((component) => (
            <ComponentDetail key={component.componentId} component={component} />
          ))}
        </ul>
      </td>
    </tr>
  );
}

export function ConditionsReleaseExplorer({
  release,
  unavailableReason,
}: {
  release: ConditionsPublicRelease | null;
  unavailableReason?: string;
}) {
  return (
    <section className="editorial-tool-page" aria-labelledby="conditions-title">
      <nav className="editorial-breadcrumbs" aria-label="Breadcrumb">
        <Link href="/">Civica</Link>
        <span>/</span>
        <span aria-current="page">Civica Conditions</span>
      </nav>
      <h1 id="conditions-title" className="editorial-tool-title">Civica Conditions</h1>
      <p className="editorial-tool-dek">
        Separate, source-native material indicators. They are not a governance
        score and are never combined into a single country ranking.
      </p>
      <Banner variant="info">
        Economic Stability currently shows its underlying source inputs only.
        Civica will not publish a stability composite until its frozen
        longitudinal validation is complete.
      </Banner>
      <p className="editorial-tool-dek">
        <Link href="/civica-conditions/methodology">
          Read the Conditions codebook and replication boundary.
        </Link>
      </p>

      {release === null ? (
        <p className="editorial-empty">
          {unavailableReason ?? "No versioned Conditions release is currently available."}
        </p>
      ) : (
        <>
          <section className="conditions-release-summary" aria-label="Selected Conditions release">
            <div className="conditions-release-stat">
              <span>Release</span>
              <strong>{release.release.releaseId}</strong>
            </div>
            <div className="conditions-release-stat">
              <span>Method</span>
              <strong>{release.release.methodologyVersion}</strong>
            </div>
            <div className="conditions-release-stat">
              <span>Manifest</span>
              <strong>{release.release.manifestSha256.slice(0, 12)}</strong>
            </div>
          </section>

          <section className="editorial-section" aria-labelledby="conditions-coverage-title">
            <h2 id="conditions-coverage-title">Coverage in this release</h2>
            <p>
              Counts are calculated from the stored Conditions calculations in
              this release. They are not a general country-universe claim.
            </p>
            <DataTable className="editorial-data-table--compact">
              <thead>
                <tr>
                  <th>Condition</th>
                  <th className="num">Calculations</th>
                  <th className="num">Aligned</th>
                  <th className="num">Scored</th>
                  <th className="num">Mixed-year refused</th>
                  <th className="num">Missing component</th>
                </tr>
              </thead>
              <tbody>
                {release.coverage.map((coverage) => (
                  <tr key={coverage.dimension}>
                    <td>{DIMENSION_LABEL[coverage.dimension]}</td>
                    <td className="num">{coverage.calculations}</td>
                    <td className="num">{coverage.aligned}</td>
                    <td className="num">{coverage.scored}</td>
                    <td className="num">{coverage.mixedYearRefused}</td>
                    <td className="num">{coverage.missingComponent}</td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          </section>

          <section className="editorial-section" aria-labelledby="conditions-rows-title">
            <h2 id="conditions-rows-title">Country components</h2>
            <p>
              Each row preserves the selected release, reference year, native
              source input, and the reason when a score is withheld.
            </p>
            <DataTable>
              <thead>
                <tr>
                  <th>Country</th>
                  <th>Condition</th>
                  <th className="num">Published position / year</th>
                  <th>Score source</th>
                  <th>Source-native components</th>
                </tr>
              </thead>
              <tbody>
                {release.calculations.map((calculation) => (
                  <CalculationRow key={calculation.calculationKey} calculation={calculation} />
                ))}
              </tbody>
            </DataTable>
          </section>
        </>
      )}
    </section>
  );
}
