import type { Metadata } from "next";
import Link from "next/link";
import { Banner } from "@/components/editorial/Banner";
import { DataTable } from "@/components/editorial/DataTable";
import { EditorialPage } from "@/components/editorial/EditorialPage";
import {
  ReaderSidebar,
  type ReaderSidebarItem,
} from "@/components/editorial/ReaderSidebar";
import { SmartBreadcrumbs } from "@/components/editorial/SmartBreadcrumbs";
import rawReport from "@/lib/provenance/fact-coverage.generated.json";
import type { FactCoverageReport } from "@/lib/provenance/fact-coverage";

export const metadata: Metadata = {
  title: "Fact Provenance Coverage — Methodology",
  description:
    "Generated statement and country fact-key provenance coverage, source depth, dispute, and staleness metrics for Civica Atlas.",
  alternates: {
    canonical: "https://civicaatlas.org/methodology/provenance-coverage",
  },
};

const report = rawReport as FactCoverageReport;
const number = new Intl.NumberFormat("en-US");
const percent = (value: number, denominator: number) =>
  denominator === 0 ? "—" : `${((value / denominator) * 100).toFixed(1)}%`;

const SIDEBAR_ITEMS: ReaderSidebarItem[] = [
  { id: "snapshot", label: "Current snapshot" },
  { id: "definitions", label: "Definitions" },
  { id: "statements", label: "Statement ledger" },
  { id: "fact-keys", label: "By fact key" },
  { id: "countries", label: "By country or area" },
  { id: "limitations", label: "Limitations" },
  { id: "machine-readable", label: "Machine-readable" },
];

const summaryRows = [
  [
    "Active source rows",
    report.facts.activeRows,
    "Individual active publisher observations.",
  ],
  [
    "Country/fact-key groups",
    report.facts.total,
    "The report's fact denominator: one jurisdiction plus one fact key.",
  ],
  [
    "Source-linked facts",
    report.facts.sourceLinked,
    "Every active observation in the group resolves to a source registry row, license, and row or source URL.",
  ],
  [
    "Single-source facts",
    report.facts.oneSource,
    "Groups with exactly one distinct source ID.",
  ],
  [
    "Two-plus independent-source facts",
    report.facts.twoPlusIndependentSources,
    "Groups passing the conservative native-publisher family rule.",
  ],
  [
    "Unresolved disputes",
    report.facts.unresolvedDisputes,
    "Groups with an open or in-review data dispute.",
  ],
  [
    "Stale live rows",
    report.facts.staleRows,
    `Non-frozen active rows retrieved more than ${report.staleness.liveRowThresholdDays} days before this snapshot.`,
  ],
] as const;

export default function ProvenanceCoveragePage() {
  const generatedDate = new Date(report.generatedAt).toLocaleString("en-US", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "UTC",
  });

  return (
    <EditorialPage className="methodology-layout">
      <ReaderSidebar items={SIDEBAR_ITEMS} className="methodology-sidebar" />
      <article className="methodology-content">
        <SmartBreadcrumbs />
        <h1 className="editorial-page-title">Fact provenance coverage</h1>
        <p className="editorial-page-subtitle">
          A generated audit of the source depth, linkage, disputes, and
          operational freshness behind Civica&apos;s country fact-key and
          statement ledgers.
        </p>

        {/* PUBLIC_CLAIM: methodology.dataset-provenance-coverage */}
        <section id="snapshot" className="editorial-section">
          <h2>Current snapshot</h2>
          <p>
            Generated {generatedDate} UTC from the live database under schema{" "}
            <code>{report.schemaVersion}</code>. It covers{" "}
            {number.format(report.facts.distinctJurisdictions)} country or area
            records and {number.format(report.facts.distinctFactKeys)} fact
            keys.
          </p>
          <DataTable>
            <thead>
              <tr>
                <th>Metric</th>
                <th className="num">Count</th>
                <th className="num">Share of facts</th>
                <th>Meaning</th>
              </tr>
            </thead>
            <tbody>
              {summaryRows.map(([label, value, meaning]) => (
                <tr key={label}>
                  <td>{label}</td>
                  <td className="num">{number.format(value)}</td>
                  <td className="num">
                    {label === "Active source rows" ||
                    label === "Stale live rows"
                      ? "—"
                      : percent(value, report.facts.total)}
                  </td>
                  <td>{meaning}</td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        </section>

        <section id="definitions" className="editorial-section">
          <h2>What the counts mean</h2>
          <p>
            A <strong>fact</strong> in this report is one active
            jurisdiction/fact-key group, regardless of how many publisher rows
            sit behind it. A source-linked fact passes only when every active
            row in the group resolves to a source record with a license and a
            usable row-level or source-level URL.
          </p>
          <p>{report.independence.rule}</p>
          <p>{report.staleness.rule}</p>
        </section>

        <section id="statements" className="editorial-section">
          <h2>Statement ledger</h2>
          <p>
            The statement ledger is measured separately because its subjects
            include terms, elections, legislature-party rows, constitutions, and
            jurisdictions—not only country fact keys.
          </p>
          <DataTable>
            <thead>
              <tr>
                <th>Subject table</th>
                <th className="num">Statements</th>
                <th className="num">Source-linked</th>
              </tr>
            </thead>
            <tbody>
              {report.statements.bySubjectTable.map((row) => (
                <tr key={row.subjectTable}>
                  <td>{row.subjectTable}</td>
                  <td className="num">{number.format(row.total)}</td>
                  <td className="num">{number.format(row.sourceLinked)}</td>
                </tr>
              ))}
            </tbody>
          </DataTable>
          <p>
            Total: {number.format(report.statements.sourceLinked)} of{" "}
            {number.format(report.statements.total)} statement rows are
            source-linked across{" "}
            {number.format(report.statements.distinctGroups)}
            distinct subject/predicate groups.
          </p>
        </section>

        <section id="fact-keys" className="editorial-section">
          <h2>Coverage by fact key</h2>
          <DataTable>
            <thead>
              <tr>
                <th>Fact key</th>
                <th className="num">Facts</th>
                <th className="num">Linked</th>
                <th className="num">One source</th>
                <th className="num">2+ independent</th>
                <th className="num">Disputes</th>
                <th className="num">Stale rows</th>
              </tr>
            </thead>
            <tbody>
              {report.byFactKey.map((row) => (
                <tr key={row.id}>
                  <td>{row.label}</td>
                  <td className="num">{number.format(row.facts)}</td>
                  <td className="num">
                    {number.format(row.sourceLinkedFacts)}
                  </td>
                  <td className="num">{number.format(row.oneSourceFacts)}</td>
                  <td className="num">
                    {number.format(row.twoPlusIndependentSourceFacts)}
                  </td>
                  <td className="num">
                    {number.format(row.unresolvedDisputes)}
                  </td>
                  <td className="num">{number.format(row.staleRows)}</td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        </section>

        <section id="countries" className="editorial-section">
          <h2>Coverage by country or area</h2>
          <DataTable>
            <thead>
              <tr>
                <th>Country or area</th>
                <th className="num">Facts</th>
                <th className="num">Linked</th>
                <th className="num">One source</th>
                <th className="num">2+ independent</th>
                <th className="num">Disputes</th>
                <th className="num">Stale rows</th>
              </tr>
            </thead>
            <tbody>
              {report.byCountry.map((row) => (
                <tr key={row.id}>
                  <td>
                    <Link href={`/country/${row.id}`}>{row.label}</Link>
                  </td>
                  <td className="num">{number.format(row.facts)}</td>
                  <td className="num">
                    {number.format(row.sourceLinkedFacts)}
                  </td>
                  <td className="num">{number.format(row.oneSourceFacts)}</td>
                  <td className="num">
                    {number.format(row.twoPlusIndependentSourceFacts)}
                  </td>
                  <td className="num">
                    {number.format(row.unresolvedDisputes)}
                  </td>
                  <td className="num">{number.format(row.staleRows)}</td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        </section>

        <section id="limitations" className="editorial-section">
          <h2>Limitations</h2>
          <Banner variant="warn">{report.independence.limitation}</Banner>
          <p>
            This report measures database provenance contracts. It does not say
            that every compact UI renderer exposes all of that provenance at
            point of use. The separate{" "}
            <Link href="/methodology/approach#reader-pages">
              compact-surface audit
            </Link>{" "}
            measures that presentation question.
          </p>
        </section>

        <section id="machine-readable" className="editorial-section">
          <h2>Machine-readable report</h2>
          <p>
            The same checked report, including every country and fact-key row,
            is available at{" "}
            <Link href="/api/provenance-coverage">
              <code>/api/provenance-coverage</code>
            </Link>
            . Regenerate it with <code>npm run generate:fact-coverage</code> and
            verify it with <code>npm run validate:fact-coverage</code>.
          </p>
        </section>
      </article>
    </EditorialPage>
  );
}
