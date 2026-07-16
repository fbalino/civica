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

export const revalidate = 0;

export const metadata: Metadata = {
  title: "Terms of Use",
  description:
    "Plain-language terms for accessing Civica Atlas and reusing its mixed-source data under the applicable upstream licenses.",
  alternates: { canonical: "https://civicaatlas.org/terms" },
  openGraph: withOg({
    title: "Terms of Use · Civica Atlas",
    description:
      "Plain-language terms for accessing Civica Atlas and reusing its mixed-source data under the applicable upstream licenses.",
    url: "https://civicaatlas.org/terms",
  }),
};

const SIDEBAR_ITEMS: ReaderSidebarItem[] = [
  { id: "use", label: "Using the site" },
  { id: "data-reuse", label: "Reusing the data" },
  { id: "downloads", label: "Downloads & bulk exports" },
  { id: "embedding", label: "Embedding" },
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
        <p className="editorial-page-meta">Last updated: July 14, 2026</p>
        <p className="editorial-page-subtitle">
          Civica Atlas is a free-to-access comparative reference for how every
          country on Earth is governed. These terms describe, in plain language,
          what you can do with the site and its data, and the limits that come
          with a reference work built from many sources.
        </p>

        <section className="editorial-section">
          <Banner variant="info">
            This is a plain-language summary of how the site is meant to be
            used, not exhaustive legal boilerplate. Where a data source imposes
            its own terms, those terms govern that data.
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
              others, and do not use it to misrepresent the underlying sources.
            </li>
            <li>
              The public API is documented at{" "}
              <Link href="/api-docs">API Docs</Link>. Its GET routes and the
              per-country export are subject to the published distributed rate
              limits and reuse terms.
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
            Access to Civica Atlas is free, but reuse rights vary because the
            site combines public-domain material, openly licensed data, and
            publisher-restricted feeds. Public-domain and CC0 data can generally
            be reused freely; publisher-restricted datasets remain governed by
            their original terms. Preserve any source names, license labels, and
            freshness dates shown with a data point; that point-of-use coverage
            is not yet universal. Cite Civica Atlas when reusing Civica Index,
            Civica Pulse, or reconciliation-derived outputs.
          </p>

          <p>
            The full source-by-source guide lives on the{" "}
            <Link href="/licensing">Licensing</Link> page. Read it before
            redistributing data or building a derivative service.
          </p>
        </section>

        <section id="downloads" className="editorial-section">
          <SectionHeader
            eyebrow="Downloads"
            title="Downloads and bulk exports"
            dek="Free, no-account access to a download is not itself a reuse license."
          />

          <p>
            Civica publishes a frozen, rights-filtered Atlas package and a
            per-country research export (
            <code>/api/countries/:slug/export</code>, JSON or CSV). Both include
            only facts whose selected source carries verified public-export
            terms; when a fact&rsquo;s canonical source lacks that permission,
            the fact is withheld from the download rather than silently
            reassigned to a different source. No account is required to download
            either. The per-country export is rate-limited by the shared policy
            published in API Docs; OPTIONS requests do not consume that counter.
            Downloading is free, but it is not a reuse license — reuse rights
            remain source-by-source, exactly as described on{" "}
            <Link href="/licensing#reuse">Licensing</Link>. See{" "}
            <Link href="/api-docs#bulk-data">API Docs</Link> for current package
            contents and export formats.
          </p>
        </section>

        <section id="embedding" className="editorial-section">
          <SectionHeader
            eyebrow="Embeds"
            title="Embedding Civica data"
            dek="The legacy score widget is retired."
          />

          <p>
            The legacy <code>/embed/[slug]</code> iframe widget that once
            rendered a Civica Index score is retired. Every request, including
            existing embedded iframes, now returns <code>410 Gone</code> with a
            short retirement notice linking to the successor{" "}
            <Link href="/governance-evidence">Governance Evidence</Link> page.
            Civica does not currently offer a replacement scalar score, rank, or
            live embeddable widget. See{" "}
            <Link href="/licensing#source-licenses">Licensing</Link> for the
            current reuse posture on retired embeds, and{" "}
            <Link href="/api-docs#widget-embed">API Docs</Link> for the exact
            retirement behavior.
          </p>
        </section>

        <section id="assistant" className="editorial-section">
          <SectionHeader
            eyebrow="Ask Civica"
            title="The AI assistant"
            dek="The in-page assistant is a convenience, not an authority."
          />

          <p>
            The Ask Civica assistant generates answers with an AI model and can
            be incomplete or wrong. Treat its replies as a starting point, and
            verify anything important against the source-backed data and
            citations shown on the country and index pages. Do not rely on it as
            legal, financial, or professional advice.
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
            moving subject; some figures are frozen at a stated vintage. To the
            extent permitted by law, Civica is not liable for losses arising
            from your use of, or reliance on, the site, the API, or its data. If
            you spot an error, please tell us through the{" "}
            <Link href="/contact">contact page</Link> or the published{" "}
            <Link href="/civica-index/corrections">corrections</Link> process.
          </p>
        </section>

        <section id="index-status" className="editorial-section">
          <SectionHeader
            eyebrow="Beta methodology"
            title="The Civica Index is in beta"
            dek="Experimental outputs require explicit limits."
          />

          <p>
            The Civica Index is a research-beta composite and Civica Pulse is an
            experimental event-classification system. Neither has completed
            independent review. Their{" "}
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
            Questions belong on the <Link href="/contact">contact page</Link>.
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
