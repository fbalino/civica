import type { Metadata } from "next";
import Link from "next/link";
import { Banner } from "@/components/editorial/Banner";
import { EditorialPage } from "@/components/editorial/EditorialPage";
import {
  ReaderSidebar,
  type ReaderSidebarItem,
} from "@/components/editorial/ReaderSidebar";
import { SmartBreadcrumbs } from "@/components/editorial/SmartBreadcrumbs";
import { SectionHeader } from "@/components/editorial/SectionHeader";
import { withOg } from "@/lib/og";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Terms of Use",
  description:
    "The plain-language terms for using Civica Atlas — a free, open reference for how every country is governed. Data is free to reuse with attribution.",
  alternates: { canonical: "https://civicaatlas.org/terms" },
  openGraph: withOg({
    title: "Terms of Use · Civica Atlas",
    description:
      "Plain-language terms for using Civica Atlas, a free and open reference for how every country is governed.",
    url: "https://civicaatlas.org/terms",
  }),
};

const SIDEBAR_ITEMS: ReaderSidebarItem[] = [
  { id: "use", label: "Using the site" },
  { id: "data-reuse", label: "Reusing the data" },
  { id: "assistant", label: "The AI assistant" },
  { id: "accuracy", label: "Accuracy & availability" },
  { id: "index-status", label: "Civica Index beta" },
  { id: "changes", label: "Changes" },
];

export default function TermsPage() {
  return (
    <EditorialPage className="methodology-layout">
      <ReaderSidebar items={SIDEBAR_ITEMS} className="methodology-sidebar" />

      <article className="methodology-content">
        <SmartBreadcrumbs />
        <h1 className="editorial-page-title">Terms of Use</h1>
        <p className="editorial-page-meta">Last updated: July 4, 2026</p>
        <p className="editorial-page-subtitle">
          Civica Atlas is a free, open reference for how every country on
          Earth is governed. These terms describe, in plain language, what you
          can do with the site and its data, and the limits that come with a
          reference work built from many sources.
        </p>

        <section className="editorial-section">
          <Banner variant="info">
            This is a plain-language summary of how the site is meant to be
            used, not exhaustive legal boilerplate. Where a data source
            imposes its own terms, those terms govern that data.
          </Banner>
        </section>

        <section id="use" className="editorial-section">
          <SectionHeader
            eyebrow="Using the site"
            title="What you can do here"
            dek="Reading and referencing Civica Atlas is open to everyone."
          />

          <ul>
            <li>
              You may read, search, cite, and link to Civica Atlas freely. No
              account is required, and there is nothing to sign up for.
            </li>
            <li>
              Please use the site in good faith. Do not attempt to break,
              overload, or scrape it in ways that degrade the service for
              others, and do not use it to misrepresent the underlying
              sources.
            </li>
            <li>
              The public API is documented at{" "}
              <Link href="/api-docs">API Docs</Link>. Use it within any
              published rate limits and reuse terms.
            </li>
          </ul>
        </section>

        <section id="data-reuse" className="editorial-section">
          <SectionHeader
            eyebrow="The data"
            title="Reusing Civica data"
            dek="Civica is a mixed-source atlas, so reuse rights depend on the source."
          />

          <p>
            Civica data is free to use with attribution, but the site combines
            public-domain material, openly licensed data, and
            publisher-restricted feeds. Public-domain and CC0 data can
            generally be reused freely; publisher-restricted datasets remain
            governed by their original terms. Preserve the source names,
            license labels, and freshness dates shown with each data point,
            and cite Civica Atlas when reusing Civica Index, Civica Pulse, or
            reconciliation-derived outputs.
          </p>

          <p>
            The full source-by-source guide lives on the{" "}
            <Link href="/licensing">Licensing</Link> page. Read it before
            redistributing data or building a derivative service.
          </p>
        </section>

        <section id="assistant" className="editorial-section">
          <SectionHeader
            eyebrow="Ask Civica"
            title="The AI assistant"
            dek="The in-page assistant is a convenience, not an authority."
          />

          <p>
            The Ask Civica assistant generates answers with an AI model and
            can be incomplete or wrong. Treat its replies as a starting point,
            and verify anything important against the source-backed data and
            citations shown on the country and index pages. Do not rely on it
            as legal, financial, or professional advice.
          </p>
        </section>

        <section id="accuracy" className="editorial-section">
          <SectionHeader
            eyebrow="No warranty"
            title="Accuracy and availability"
            dek="We work hard on accuracy, but a reference work is never finished."
          />

          <p>
            Civica Atlas is provided &ldquo;as is.&rdquo; We aim for accuracy
            and keep provenance attached to each fact, but we make no warranty
            that every data point is complete, current, or error-free, and the
            service may change or be unavailable at times. Governance is a
            moving subject; some figures are frozen at a stated vintage. If
            you spot an error, please tell us through the{" "}
            <Link href="/contact">contact page</Link> or the published{" "}
            <Link href="/civica-index/corrections">corrections</Link> process.
          </p>
        </section>

        <section id="index-status" className="editorial-section">
          <SectionHeader
            eyebrow="Beta methodology"
            title="The Civica Index is in beta"
            dek="An original score carries an original disclaimer."
          />

          <p>
            The Civica Index and Civica Pulse are original composite measures
            under active methodological development and marked as beta. Their{" "}
            <Link href="/civica-index/methodology">methodology</Link> is
            published for scrutiny. Use them as one lens among the externally
            attested sources on each country, not as a settled verdict.
          </p>
        </section>

        <section id="changes" className="editorial-section">
          <SectionHeader
            eyebrow="Changes"
            title="Updates to these terms"
            dek="When the terms change, the date changes too."
          />

          <p>
            We may update these terms as the site evolves. The &ldquo;last
            updated&rdquo; date at the top reflects the current version.
            Questions belong on the{" "}
            <Link href="/contact">contact page</Link>.
          </p>
        </section>

        <footer className="editorial-footer-nav">
          <Link href="/privacy">Privacy Policy</Link>
          <Link href="/licensing">Licensing</Link>
          <Link href="/contact">Contact</Link>
        </footer>
      </article>
    </EditorialPage>
  );
}
