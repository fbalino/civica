import type { Metadata } from "next";
import Link from "next/link";
import { Banner } from "@/components/editorial/Banner";
import { DataTable } from "@/components/editorial/DataTable";
import { EditorialPage } from "@/components/editorial/EditorialPage";
import { Chip } from "@/components/editorial/Pill";
import {
  ReaderSidebar,
  type ReaderSidebarItem,
} from "@/components/editorial/ReaderSidebar";
import { SmartBreadcrumbs } from "@/components/editorial/SmartBreadcrumbs";
import rawReport from "@/lib/provenance/domain-coverage.generated.json";
import type { DomainCoverageReport } from "@/lib/provenance/domain-coverage";

export const metadata: Metadata = {
  title: "Source Coverage by Domain — Methodology",
  description:
    "Generated source freshness, jurisdiction coverage, field completeness, source-family, gap, and alert reporting for every declared Civica Atlas domain.",
  alternates: {
    canonical: "https://civicaatlas.org/methodology/source-coverage",
  },
};

const report = rawReport as DomainCoverageReport;
const alertPolicy = report.domains[0].threshold;
const number = new Intl.NumberFormat("en-US");
const date = (value: string | null) =>
  value
    ? new Date(value).toLocaleString("en-US", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "UTC",
      })
    : "Not recorded";

const SIDEBAR_ITEMS: ReaderSidebarItem[] = [
  { id: "snapshot", label: "Current snapshot" },
  ...report.domains.map((domain) => ({ id: domain.id, label: domain.label })),
  { id: "thresholds", label: "Thresholds" },
  { id: "machine-readable", label: "Machine-readable" },
];

export default function SourceCoveragePage() {
  return (
    <EditorialPage className="methodology-layout">
      <ReaderSidebar items={SIDEBAR_ITEMS} className="methodology-sidebar" />
      <article className="methodology-content">
        <SmartBreadcrumbs />
        <h1 className="editorial-page-title">Source coverage by domain</h1>
        <p className="editorial-page-subtitle">
          A generated operational view of where Civica has records, how complete
          their important fields are, which source families support them, and
          which gaps currently require attention.
        </p>

        {/* PUBLIC_CLAIM: methodology.domain-source-coverage */}
        <section id="snapshot" className="editorial-section">
          <h2>Current snapshot</h2>
          <p>
            Generated {date(report.generatedAt)} UTC under contract{" "}
            <code>{report.schemaVersion}</code>. Country coverage uses{" "}
            {number.format(report.scope.eligibleJurisdictions)}{" "}
            <code>{report.scope.eligibleClass}</code> rows from{" "}
            <code>{report.scope.jurisdictionTaxonomy}</code>.
          </p>
          <p>{report.scope.rule}</p>
          <DataTable>
            <thead>
              <tr>
                <th>Domain</th>
                <th>Status</th>
                <th className="num">Records</th>
                <th className="num">Jurisdictions</th>
                <th className="num">Coverage</th>
                <th>Last successful run</th>
              </tr>
            </thead>
            <tbody>
              {report.domains.map((domain) => (
                <tr key={domain.id}>
                  <td>
                    <Link href={`#${domain.id}`}>{domain.label}</Link>
                  </td>
                  <td>
                    <Chip
                      variant={domain.status === "current" ? "sage" : "sand"}
                    >
                      {domain.status === "current" ? "Current" : "Attention"}
                    </Chip>
                  </td>
                  <td className="num">{number.format(domain.recordCount)}</td>
                  <td className="num">
                    {number.format(domain.jurisdictionsCovered)} /{" "}
                    {number.format(domain.eligibleJurisdictions)}
                  </td>
                  <td className="num">
                    {domain.countryCoveragePercent.toFixed(1)}%
                  </td>
                  <td>
                    {date(domain.lastSuccessfulRun)}
                    {domain.lastSuccessfulRun ? " UTC" : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        </section>

        {report.domains.map((domain) => (
          <section id={domain.id} className="editorial-section" key={domain.id}>
            <h2>{domain.label}</h2>
            <p>
              {number.format(domain.recordCount)} {domain.recordLabel};{" "}
              {number.format(domain.jurisdictionsCovered)} of{" "}
              {number.format(domain.eligibleJurisdictions)} eligible
              jurisdictions have at least one record.
            </p>
            {domain.alerts.length > 0 && (
              <Banner variant="warn">
                <strong>
                  {domain.alerts.length} threshold alert
                  {domain.alerts.length === 1 ? "" : "s"}.
                </strong>{" "}
                {domain.alerts.map((alert) => alert.message).join(" ")}
              </Banner>
            )}
            <p>
              Release readiness: {domain.releaseReadiness.replaceAll("_", " ")}.
              Below-threshold domains remain visible with this status and their
              known gaps; they are not described as complete.
            </p>
            <h3>Field completeness</h3>
            <DataTable>
              <thead>
                <tr>
                  <th>Field</th>
                  <th className="num">Complete</th>
                  <th className="num">Total</th>
                  <th className="num">Share</th>
                </tr>
              </thead>
              <tbody>
                {domain.completeness.map((metric) => (
                  <tr key={metric.field}>
                    <td>{metric.label}</td>
                    <td className="num">{number.format(metric.complete)}</td>
                    <td className="num">{number.format(metric.total)}</td>
                    <td className="num">{metric.percent.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
            <h3>Source families and freshness</h3>
            <DataTable>
              <thead>
                <tr>
                  <th>Source</th>
                  <th>Family</th>
                  <th>Last successful run</th>
                </tr>
              </thead>
              <tbody>
                {domain.sources.map((source) => (
                  <tr key={source.id}>
                    <td>{source.label}</td>
                    <td>{source.family.replaceAll("_", " ")}</td>
                    <td>
                      {date(source.lastSuccessfulRun)}
                      {source.lastSuccessfulRun ? " UTC" : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
            <h3>Known gaps</h3>
            <ul>
              {domain.knownGaps.map((gap) => (
                <li key={gap}>{gap}</li>
              ))}
            </ul>
          </section>
        ))}

        <section id="thresholds" className="editorial-section">
          <h2>How alerts work</h2>
          <p>
            The checked policy currently warns when jurisdiction coverage falls
            below {alertPolicy.countryCoverageWarnBelow}% or a measured field
            falls below {alertPolicy.fieldCompletenessWarnBelow}%, when the
            latest successful run is older than {alertPolicy.staleAfterDays}{" "}
            days, or when a run timestamp is unavailable. Source families are
            checked separately so a recent source cannot conceal a stale or
            unrecorded companion source. Alerts disclose operating debt; they do
            not convert partial coverage into a release claim.
          </p>
        </section>

        <section id="machine-readable" className="editorial-section">
          <h2>Machine-readable report</h2>
          <p>
            The same checked rows and alert messages are available at{" "}
            <Link href="/api/source-coverage">
              <code>/api/source-coverage</code>
            </Link>
            . The separate{" "}
            <Link href="/methodology/provenance-coverage">
              fact provenance report
            </Link>{" "}
            measures source linkage and independent-source depth at fact-key
            level.
          </p>
        </section>
      </article>
    </EditorialPage>
  );
}
