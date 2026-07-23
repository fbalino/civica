import type { Metadata } from "next";
import Link from "next/link";

import { Banner } from "@/components/editorial/Banner";
import { DataTable } from "@/components/editorial/DataTable";
import { MethodologyLayout } from "@/components/editorial/MethodologyLayout";
import { Chip } from "@/components/editorial/Pill";
import type { ReaderSidebarItem } from "@/components/editorial/ReaderSidebar";
import { SmartBreadcrumbs } from "@/components/editorial/SmartBreadcrumbs";
import { CiteAccordion } from "@/components/cite/CiteAccordion";
import { ATLAS_CASE_STUDY_REPORT as report } from "@/lib/atlas/case-studies-runtime";
import { withOg } from "@/lib/og";

export const revalidate = 0;

export const metadata: Metadata = {
  title: "Reproducible Atlas Case Studies",
  description:
    `${report.cases.length} frozen, source-rights-aware Civica Atlas case studies with exact API recipes, input rows, decision trails, limitations, tables, and stable citations.`,
  alternates: {
    canonical: "https://civicaatlas.org/methodology/case-studies",
  },
  openGraph: withOg({
    title: "Reproducible Atlas Case Studies · Civica Atlas",
    description:
      "Frozen examples showing how to query, interpret, and cite Civica Atlas data without hiding source rights or limitations.",
    url: "https://civicaatlas.org/methodology/case-studies",
  }),
};

const SIDEBAR_ITEMS: ReaderSidebarItem[] = [
  { id: "overview", label: "Overview" },
  ...report.cases.map((study) => ({
    id: study.id,
    label: study.title,
  })),
  { id: "reproduce", label: "Reproduce" },
  { id: "cite", label: "Cite this collection" },
];

function cell(value: unknown): string {
  if (value === null || value === undefined || value === "") return "Not available";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value).replaceAll("_", " ");
}

export default function AtlasCaseStudiesPage() {
  return (
    <MethodologyLayout items={SIDEBAR_ITEMS}>
      <SmartBreadcrumbs />
      <h1 className="editorial-page-title">Reproducible Atlas case studies</h1>
      <p className="editorial-page-subtitle">
        {report.cases.length} compact examples built from one immutable Atlas
        release. Every case publishes its exact query, frozen input rows,
        decision trail, output table, source-rights posture, limitations, and
        citation.
      </p>
      <div className="editorial-meta">
        <span>{report.release.id}</span>
        <span>{report.schemaVersion}</span>
        <span>Byte-exact replay</span>
      </div>

      <section id="overview" className="editorial-section">
        <h2>What these examples prove</h2>
        <p>
          The cases show how the{" "}
          <Link href="/api-docs#atlas-query">frozen Atlas query API</Link> can
          support auditable research without becoming a live database browser.
          The published tables are generated from the same request parser,
          allowlists, ordering, pagination, release hashes, and source-rights
          rows as <code>/api/v1/atlas/query</code>.
        </p>
        <Banner variant="info">
          These are release-bound demonstrations, not claims of completeness,
          independent verification, representativeness, or legal status. Read
          each case&apos;s limitations before reusing its result.
        </Banner>
        <p>
          Release semantic SHA-256: <code>{report.release.semanticSha256}</code>
          . Case-study semantic SHA-256:{" "}
          <code>{report.semanticSha256}</code>.
        </p>
      </section>

      {report.cases.map((study) => (
        <section
          id={study.id}
          className="editorial-section"
          key={study.id}
        >
          <Chip variant="sage">Reproducible case</Chip>
          <h2>{study.title}</h2>

          <h3>Research question</h3>
          <p>{study.researchQuestion}</p>

          <h3>Finding</h3>
          <p>{study.answer}</p>

          <DataTable>
            <caption>{study.table.caption}</caption>
            <thead>
              <tr>
                {study.table.columns.map((column) => (
                  <th key={column.key}>{column.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {study.table.rows.map((row, rowIndex) => (
                <tr key={`${study.id}-${rowIndex}`}>
                  {study.table.columns.map((column) => (
                    <td key={column.key}>{cell(row[column.key])}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </DataTable>

          <h3>Method</h3>
          <p>{study.methods}</p>

          <h3>Exact API recipes</h3>
          {study.recipes.map((recipe) => (
            <div key={recipe.id}>
              <p>
                <strong>{recipe.label}.</strong>{" "}
                {recipe.inputRowCount.toLocaleString()} input rows frozen in
                release {artifact.release.id} across{" "}
                {recipe.pagesRead.toLocaleString()} page
                {recipe.pagesRead === 1 ? "" : "s"}.
              </p>
              <pre className="api-code-block" tabIndex={0}>
                {`curl "https://civicaatlas.org${recipe.path}"`}
              </pre>
            </div>
          ))}

          <h3>Decision trail</h3>
          <ol>
            {study.decisionTrail.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>

          <h3>Source rights</h3>
          <p>{study.rightsNote}</p>
          {study.sourceRights.length > 0 ? (
            <DataTable>
              <thead>
                <tr>
                  <th>Source</th>
                  <th>License</th>
                  <th>Review</th>
                  <th>Public export</th>
                </tr>
              </thead>
              <tbody>
                {study.sourceRights.map((source) => (
                  <tr key={String(source.sourceId)}>
                    <td>{cell(source.sourceId)}</td>
                    <td>{cell(source.licenseId)}</td>
                    <td>{cell(source.reviewStatus)}</td>
                    <td>{cell(source.publicExport)}</td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          ) : null}

          <h3>Limitations</h3>
          <ul>
            {study.limitations.map((limitation) => (
              <li key={limitation}>{limitation}</li>
            ))}
          </ul>

          <h3>Stable citation</h3>
          <pre className="api-code-block" tabIndex={0}>
            {study.citation}
          </pre>
        </section>
      ))}

      <section id="reproduce" className="editorial-section">
        <h2>Reproduce every table</h2>
        <p>
          The checked artifact embeds every selected input row. The replay
          command re-runs all recipes against the hash-verified frozen gzip,
          follows pagination, rebuilds all {report.cases.length} tables, and
          requires byte equality with the published JSON.
        </p>
        <pre className="api-code-block" tabIndex={0}>
          {report.reproduction.command}
        </pre>
        <p>
          Generator: <code>{report.reproduction.generator}</code>
          <br />
          Validator: <code>{report.reproduction.validator}</code>
          <br />
          Tolerance: <code>{report.reproduction.tolerance}</code>
        </p>
      </section>

      <section id="cite" className="editorial-section">
        <h2>Cite this collection</h2>
        <CiteAccordion
          subject="Civica Atlas"
          pageTitle="Reproducible Atlas case studies"
          url="https://civicaatlas.org/methodology/case-studies"
          dataVintage={report.release.date}
          sourceNames={["CIA World Factbook", "World Bank"]}
        />
      </section>
    </MethodologyLayout>
  );
}
