import type { Metadata } from "next";
import Link from "next/link";
import { EditorialPage } from "@/components/editorial/EditorialPage";
import { SmartBreadcrumbs } from "@/components/editorial/SmartBreadcrumbs";
import { CiteAccordion } from "@/components/cite/CiteAccordion";
import { FACTBOOK_RECONCILIATION_META } from "@/lib/factbook/reconcile/api";
import {
  getPublicDisputeFeed,
  getPublicDisputeFilterDistributions,
  type DisputeFilterDistributions,
} from "@/lib/db/queries-data-disputes";
import { reconciliation } from "@/lib/content/site-state";
import { DisputesFilterClient } from "./DisputesFilterClient";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Data Disputes Log — Reconciliation Conflicts (Beta)",
  description:
    "A public, read-only log of conflicts the resolver flagged across the CIA Factbook, Wikidata, and named statistical agencies — open, resolved, and auto-resolved disputes with source attribution.",
  alternates: {
    canonical:
      "https://civicaatlas.org/country/methodology/reconciliation/disputes",
  },
};

export default async function PublicDisputesPage() {
  let rows: Awaited<ReturnType<typeof getPublicDisputeFeed>>["rows"] = [];
  let totalAll = 0;
  let distributions: DisputeFilterDistributions = {
    sourcePairs: [],
    factKeys: [],
  };

  try {
    const [feed, distributionRows] = await Promise.all([
      getPublicDisputeFeed({ limit: 2000 }),
      getPublicDisputeFilterDistributions({ topN: 8 }),
    ]);
    rows = feed.rows;
    totalAll = feed.totalAll;
    distributions = distributionRows;
  } catch {
    // Keep the public methodology page renderable during DB outages.
  }

  return (
    <EditorialPage width="wide">
      <SmartBreadcrumbs />

      <h1 className="editorial-page-title">
        Data disputes
        {reconciliation.status === "beta" ? (
          <span className="editorial-beta-tag">Beta</span>
        ) : null}
      </h1>
      <p className="editorial-page-subtitle">
        Public read-only log of conflicts the resolver flagged across the
        Civica source allowlist. Open disputes await human review;
        resolved disputes carry an outcome and methodology rationale;
        auto-resolved disputes were closed by the staleness cron after
        the resolver stopped emitting them. Reviewer identity is
        redacted on this surface.
      </p>

      <div className="editorial-warning">
        These disputes are part of the reconciliation methodology under
        active revision. The resolver, source allowlist, and
        material-error thresholds may change in future methodology
        version bumps (currently <code>{reconciliation.version}</code>).
        See the{" "}
        <Link href="/country/methodology/reconciliation">
          full reconciliation methodology
        </Link>{" "}
        for context.
      </div>

      <DisputesFilterClient
        disputes={rows}
        distributions={distributions}
        totalAll={totalAll}
      />

      <section
        id="cite"
        className="editorial-section"
        style={{ marginTop: "var(--space-7)" }}
      >
        <h2>Cite this page</h2>
        <CiteAccordion
          subject={FACTBOOK_RECONCILIATION_META.vintage}
          pageTitle="Data disputes log"
          url="https://civicaatlas.org/country/methodology/reconciliation/disputes"
          dataVintage={reconciliation.firstVintageCutDate}
        />
      </section>

      <footer
        className="editorial-footer-nav"
        style={{ marginTop: "var(--space-7)" }}
      >
        <Link href="/country/methodology/reconciliation">
          ← Back to reconciliation methodology
        </Link>
        <Link href="/methodology">Methodology hub →</Link>
      </footer>
    </EditorialPage>
  );
}
