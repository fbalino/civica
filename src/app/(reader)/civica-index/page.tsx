import type { Metadata } from "next";
import Link from "next/link";
import { Banner } from "@/components/editorial/Banner";
import { Button } from "@/components/editorial/Button";
import { MethodologyLayout } from "@/components/editorial/MethodologyLayout";
import { SmartBreadcrumbs } from "@/components/editorial/SmartBreadcrumbs";
import { INDEX_DISPOSITION } from "@/lib/ci/index-disposition";

export const metadata: Metadata = {
  title: "Civica Index Research Status",
  // PUBLIC_CLAIM: metadata.index-disposition
  description:
    "The source-native Governance Evidence Dashboard is Civica's selected public comparison product. The composite remains versioned research and is not a recommended country ranking.",
  alternates: { canonical: "https://civicaatlas.org/civica-index" },
  robots: { index: true, follow: true },
};

const sections = [
  { id: "disposition", label: "Disposition" },
  { id: "composite", label: "Composite research" },
  { id: "evidence", label: "Evidence" },
  { id: "reconsideration", label: "Reconsideration" },
  { id: "policies", label: "Policies" },
];

export default function CivicaIndexStatusPage() {
  return (
    <MethodologyLayout items={sections}>
      <SmartBreadcrumbs />
      <h1 className="editorial-page-title">Civica Index research status.</h1>
      <div className="editorial-page-meta">
        <span>Confirmatory tournament complete</span>
        <span>·</span>
        <span>No winner</span>
        <span>·</span>
        <span>External gates pending</span>
      </div>

      {/* PUBLIC_CLAIM: index.public-disposition */}
      <p className="meth-abstract">{INDEX_DISPOSITION.publicSummary}</p>

      <section id="disposition" className="editorial-section">
        <h2>Current public disposition</h2>
        <p>{INDEX_DISPOSITION.publicProduct.claim}</p>
        <Banner variant="info">
          The dashboard reports established sources separately. Agreement
          between rows is not independent corroboration, and Civica does not
          turn the rows into a country-quality verdict.
        </Banner>
        <Button href={INDEX_DISPOSITION.publicProduct.route}>
          Open the Governance Evidence Dashboard
        </Button>
      </section>

      <section id="composite" className="editorial-section">
        <h2>Composite research</h2>
        <p>{INDEX_DISPOSITION.k1Composite.preservation}</p>
        <p>
          The current formula fails the original-information test and its
          league-table presentation fails the misuse audit. Its narrower
          derivative utility remains unresolved because the qualified-reader
          experiment has no human responses.
        </p>
      </section>

      <section id="evidence" className="editorial-section">
        <h2>Evidence record</h2>
        <ul>
          <li>
            <Link href="/civica-index/methodology#disposition">
              Methodology and disposition
            </Link>
          </li>
          <li>
            <Link href="/civica-index/replication">
              Replication and external-review status
            </Link>
          </li>
          <li>
            <Link href="/civica-index/corrections">
              Corrections and disputes
            </Link>
          </li>
        </ul>
      </section>

      <section id="reconsideration" className="editorial-section">
        <h2>What would justify reconsideration</h2>
        <ul>
          {INDEX_DISPOSITION.reconsiderationCriteria.map((criterion) => (
            <li key={criterion}>{criterion}</li>
          ))}
        </ul>
      </section>

      <section id="policies" className="editorial-section">
        <h2>Publication policies</h2>
        <p>
          The research record follows Civica&apos;s policies for{" "}
          <Link href="/policies#corrections">corrections</Link>,{" "}
          <Link href="/policies#retractions">retractions</Link>,{" "}
          <Link href="/policies#versioning">versioning</Link>, and{" "}
          <Link href="/policies#known-limitations">known limitations</Link>.
        </p>
      </section>
    </MethodologyLayout>
  );
}
