import type { Metadata } from "next";
import Link from "next/link";

import { Banner } from "@/components/editorial/Banner";
import { EditorialPage } from "@/components/editorial/EditorialPage";
import { SectionHeader } from "@/components/editorial/SectionHeader";
import { getAllJurisdictions } from "@/lib/db/queries";
import {
  REPORTABLE_ATLAS_ENTITY_TYPES,
  type ReportableAtlasEntityType,
} from "@/lib/corrections/data-error-report";
import { isAtlasCorrectionSchemaReady } from "@/lib/corrections/schema-readiness";
import { ReportDataIssueForm } from "./ReportDataIssueForm";

export const revalidate = 0;

export const metadata: Metadata = {
  title: "Report a Data Issue",
  description:
    "Report a precise Civica Atlas entity, field, release, and source issue and receive an immediate intake receipt.",
  alternates: {
    canonical: "https://civicaatlas.org/report-data-issue",
  },
};

type SearchParams = Promise<
  Record<string, string | string[] | undefined>
>;

function one(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

function bounded(value: string, max: number): string {
  return value.trim().slice(0, max);
}

export default async function ReportDataIssuePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const requestedType = one(params.entityType);
  const entityType = (
    REPORTABLE_ATLAS_ENTITY_TYPES.includes(
      requestedType as ReportableAtlasEntityType,
    )
      ? requestedType
      : ""
  ) as ReportableAtlasEntityType | "";

  const [schemaReady, jurisdictionRows] = await Promise.all([
    isAtlasCorrectionSchemaReady(),
    getAllJurisdictions().catch(() => []),
  ]);
  const countries = jurisdictionRows.map((country) => ({
    slug: country.slug,
    name: country.name,
  }));
  const requestedCountry = bounded(one(params.country), 100);
  const countrySlug = countries.some(
    (country) => country.slug === requestedCountry,
  )
    ? requestedCountry
    : "";

  return (
    <EditorialPage
      width="wide"
      breadcrumbs={
        <ol className="editorial-breadcrumbs-list">
          <li>
            <Link href="/">Home</Link>
          </li>
          <li aria-current="page">Report a data issue</li>
        </ol>
      }
      title="Report a data issue"
      meta="Precise record intake · immediate receipt · accountable triage"
    >
      <section className="editorial-section">
        <SectionHeader
          eyebrow="Atlas corrections"
          title="Point to the exact record"
          dek="Identify the entity, field, release, displayed source, and value you believe is wrong. A report opens a review record; it does not silently change released data."
        />

        <Banner variant="info">
          Reports are rate-limited through a non-reversible request-identity
          digest and a hidden bot trap. An on-screen receipt acknowledges
          intake only. A correction is published only through a versioned
          change linked to the report; “resolved — corrected” cannot be
          recorded without that history.
        </Banner>

        {!schemaReady ? (
          <Banner variant="warn">
            Atlas data-error intake is temporarily unavailable while its
            append-only report schema is being activated. No form is shown and
            no report can be lost. Existing Index and Pulse reports remain
            available in the{" "}
            <Link href="/civica-index/corrections">corrections log</Link>.
          </Banner>
        ) : (
          <ReportDataIssueForm
            countries={countries}
            prefill={{
              countrySlug,
              entityType,
              entityId: bounded(one(params.entityId), 200),
              fieldPath: bounded(one(params.field), 200),
              releaseId: bounded(one(params.release), 200),
              sourceId: bounded(one(params.source), 200),
              sourceUrl: bounded(one(params.sourceUrl), 2_048),
              publishedValue: bounded(one(params.value), 2_000),
            }}
          />
        )}
      </section>
    </EditorialPage>
  );
}
