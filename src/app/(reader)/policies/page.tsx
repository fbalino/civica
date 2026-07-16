import type { Metadata } from "next";
import Link from "next/link";
import { EditorialPage } from "@/components/editorial/EditorialPage";
import { MethodologyLayout } from "@/components/editorial/MethodologyLayout";
import { CiteAccordion } from "@/components/cite/CiteAccordion";
import { SmartBreadcrumbs } from "@/components/editorial/SmartBreadcrumbs";
import { MarkdownContent } from "@/components/content/MarkdownContent";
import { Reveal } from "@/components/motion/Reveal";
import {
  disputeSla,
  reconciliation,
  pulse,
  peerGrouping,
  civicaIndex,
} from "@/lib/content/site-state";
import { PUBLICATION_POLICY_META } from "@/lib/policy/research-artifacts";

export const revalidate = 0;

export const metadata: Metadata = {
  title: "Policies — Corrections, Retractions, Versioning, Known Limitations",
  description:
    "Civica's single correction, retraction, versioning, and known-limitations policy, covering the Civica Index, Pulse, reconciliation, peer grouping, PCA appendix, and Civica Conditions.",
  alternates: { canonical: "https://civicaatlas.org/policies" },
};

const SECTIONS = [
  { id: "corrections", label: "Corrections" },
  { id: "retractions", label: "Retractions" },
  { id: "versioning", label: "Versioning" },
  { id: "known-limitations", label: "Known limitations" },
  { id: "data-api-corrections", label: "Data & API corrections" },
  { id: "notification", label: "Notification" },
  { id: "deferred", label: "Deferred boundaries" },
  { id: "cite", label: "Cite this page" },
];

export default function PoliciesPage() {
  const state = { disputeSla, reconciliation, pulse, peerGrouping, civicaIndex };

  return (
    <MethodologyLayout items={SECTIONS}>
      <EditorialPage>
        <SmartBreadcrumbs />

        <h1 className="editorial-page-title">Research publication policies</h1>
        <p className="editorial-page-subtitle">
          Corrections, retractions, versioning, and known limitations —
          one policy for every Civica research artifact.
        </p>
        <div className="editorial-page-meta">
          <span>Institutional posture</span>
          <span>·</span>
          <span>Policy {PUBLICATION_POLICY_META.version}</span>
          <span>·</span>
          <span>Effective {PUBLICATION_POLICY_META.effectiveDate}</span>
          <span>·</span>
          <span>Reconciliation {reconciliation.version}</span>
          <span>·</span>
          <span>Pulse taxonomy {pulse.taxonomy.version}</span>
        </div>

        <div className="editorial-warning">
          <strong>Pre-launch, single-maintainer project.</strong> The response
          targets on this page are best-effort, calendar-day targets for a
          single-maintainer research project, not a staffed service-level
          agreement. The public{" "}
          <Link href="/civica-index/corrections">corrections log</Link> is
          the current site-wide notification surface; artifact-specific
          release notes are additional channels only where they exist. See{" "}
          <Link href="#notification">Notification</Link> below.
        </div>

        <Reveal as="section" className="editorial-section" amount={0.15}>
          <MarkdownContent
            file="content/policies.md"
            stats={null}
            state={state as unknown as Record<string, unknown>}
          />
        </Reveal>

        <Reveal as="section" className="editorial-section" id="cite" amount={0.15}>
          <h2>Cite this page</h2>
          <CiteAccordion
            subject="Civica Atlas — Research publication policies"
            pageTitle="Research publication policies"
            url="https://civicaatlas.org/policies"
            dataVintage={PUBLICATION_POLICY_META.effectiveDate}
          />
        </Reveal>

        <footer className="editorial-footer-nav">
          <Link href="/methodology">← Methodology hub</Link>
          <Link href="/civica-index/corrections">Corrections log →</Link>
          <Link href="/country/methodology/reconciliation/disputes">
            Reconciliation disputes log →
          </Link>
        </footer>
      </EditorialPage>
    </MethodologyLayout>
  );
}
