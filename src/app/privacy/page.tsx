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
import { ADVISORY_APPLICATION_POLICY } from "@/lib/research/advisory-application";

export const revalidate = 0;

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How Civica Atlas handles your information — written in plain language for a public reference site with no user accounts and no analytics tracking.",
  alternates: { canonical: "https://civicaatlas.org/privacy" },
  openGraph: withOg({
    title: "Privacy Policy · Civica Atlas",
    description:
      "How Civica Atlas handles your information — plain language, no user accounts, no analytics tracking.",
    url: "https://civicaatlas.org/privacy",
  }),
};

const SIDEBAR_ITEMS: ReaderSidebarItem[] = [
  { id: "no-accounts", label: "No accounts, no tracking" },
  { id: "storage", label: "In your browser" },
  { id: "messages", label: "What you send us" },
  { id: "ask-civica", label: "Ask Civica" },
  { id: "applications", label: "Board applications" },
  { id: "servers", label: "Hosting & logs" },
  { id: "data-licensing", label: "About the data" },
  { id: "contact", label: "Questions" },
];

export default function PrivacyPage() {
  return (
    <EditorialPage className="methodology-layout">
      <ReaderSidebar items={SIDEBAR_ITEMS} className="methodology-sidebar" />

      <article className="methodology-content">
        <SmartBreadcrumbs />
        <h1 className="editorial-page-title">Privacy Policy</h1>
        <p className="editorial-page-meta">Last updated: July 16, 2026</p>
        <p className="editorial-page-subtitle">
          Civica Atlas is a public reference site. There are no visitor
          accounts, no sign-up, and no advertising or analytics trackers. This
          page explains, in plain language, the small amount of information
          the site touches and why.
        </p>

        <section className="editorial-section">
          <Banner variant="info">
            This is a plain-language summary of how the site works today, not
            formal legal boilerplate. If a specific practice changes, this
            page changes with it.
          </Banner>
        </section>

        <section id="no-accounts" className="editorial-section">
          <SectionHeader
            eyebrow="The short version"
            title="No accounts, no tracking"
            dek="Reading Civica Atlas does not require you to identify yourself."
          />

          <ul>
            <li>
              There are no visitor accounts, logins, or profiles. You never
              create one, and we never ask you to.
            </li>
            <li>
              The site runs no advertising networks, no third-party analytics
              (such as Google Analytics or Plausible), and no behavioral
              tracking pixels.
            </li>
            <li>
              We do not sell or rent personal information. Information sent
              through the contact and advisory-board forms is stored only for
              the purposes described below.
            </li>
          </ul>
        </section>

        <section id="storage" className="editorial-section">
          <SectionHeader
            eyebrow="On your device"
            title="What the site stores in your browser"
            dek="A couple of small preferences live in your own browser, not on our servers."
          />

          <ul>
            <li>
              <strong>Theme preference.</strong>{" "}
              When you switch between light and dark mode, that choice is saved in your browser&rsquo;s
              local storage (under the key <code>theme</code>) so the site
              remembers it on your next visit. It stays on your device.
            </li>
            <li>
              <strong>Ask Civica history.</strong>{" "}
              If you use the in-page Ask Civica assistant, your conversation
              is kept in your browser&rsquo;s local storage so it survives
              page navigation.
              Clearing your browser storage removes it.
            </li>
          </ul>

          <p>
            You can clear both at any time by clearing your browser&rsquo;s
            site data for civicaatlas.org. The site keeps working without
            them; it just forgets your theme choice and prior chat.
          </p>
        </section>

        <section id="messages" className="editorial-section">
          <SectionHeader
            eyebrow="When you write to us"
            title="Information you choose to send"
            dek="Three features let you send content on purpose. Here is where it goes."
          />

          <ul>
            <li>
              <strong>Contact form.</strong> If you use the{" "}
              <Link href="/contact">contact form</Link>, the details you type
              there (such as your message and any email address you provide)
              are stored in the Civica project database so Fernando Balino can
              read and respond. They are not used for advertising or sold.
            </li>
            <li>
              <strong>Advisory-board application.</strong> The{" "}
              <Link href="/about/advisory-board/apply">application form</Link>{" "}
              stores the fields and consent described in the next section.
            </li>
            <li>
              <strong>Ask Civica assistant.</strong> Messages you type into
              the Ask Civica assistant are sent to our AI provider (Anthropic)
              to generate a reply, the same way any AI chat feature works.
              Avoid typing sensitive personal information into it.
            </li>
          </ul>
        </section>

        <section id="ask-civica" className="editorial-section">
          <SectionHeader
            eyebrow="Ask Civica"
            title="A bounded AI assistant, with no server-side chat history"
            dek="It can explain only the current, cited country evidence supplied by Civica."
          />

          <p>
            Ask Civica sends the question you type and a small, source-labelled
            country-evidence bundle to Anthropic&rsquo;s API to generate a reply.
            Civica does not persist Ask Civica questions or replies in its
            application database, and it does not build a server-side
            conversation history. The conversation you see remains in your
            browser&rsquo;s local storage until you clear it or clear site data.
          </p>

          <p>
            To run and monitor the feature safely, Civica records only the
            checked prompt version, model identifier, closed outcome, and a
            bounded evidence count&mdash;never the question, answer, country,
            sources, URLs, raw facts, provider error, or API key. The assistant
            has no web browsing, file, database, account, or secret access.
            It may be incomplete or unavailable; use the country profile and
            its sources to verify important claims.
          </p>

          <p>
            Anthropic&rsquo;s handling of the request depends on the arrangement
            for Civica&rsquo;s API organization. Civica does not claim that
            zero-data retention is enabled. Please avoid entering sensitive
            personal information, and review Anthropic&rsquo;s{" "}
            <a
              href="https://docs.anthropic.com/en/docs/build-with-claude/zero-data-retention"
              target="_blank"
              rel="noreferrer"
            >
              current API data-retention documentation
            </a>{" "}
            for the provider-level boundary.
          </p>
        </section>

        <section id="applications" className="editorial-section">
          <SectionHeader
            eyebrow="Expressions of interest"
            title="Advisory-board applications"
            dek="Applications are private recruitment records, not public profiles or evidence of appointment."
          />

          <p><strong>What is collected.</strong> {ADVISORY_APPLICATION_POLICY.collectedFields.join(", ")}.</p>
          <p><strong>Purpose.</strong> {ADVISORY_APPLICATION_POLICY.purpose}</p>
          <p><strong>Access and processors.</strong> {ADVISORY_APPLICATION_POLICY.access}</p>
          <p><strong>Retention.</strong> {ADVISORY_APPLICATION_POLICY.retention}</p>
          <p><strong>Access, correction, and deletion.</strong> {ADVISORY_APPLICATION_POLICY.deletion}</p>
          <p><strong>Security.</strong> {ADVISORY_APPLICATION_POLICY.security}</p>
          <p><strong>IP and abuse prevention.</strong> {ADVISORY_APPLICATION_POLICY.ipUse}</p>
          <p><strong>Receipt and response.</strong> {ADVISORY_APPLICATION_POLICY.response}</p>
          <p className="editorial-page-meta">
            Application notice {ADVISORY_APPLICATION_POLICY.schemaVersion}; effective {ADVISORY_APPLICATION_POLICY.effectiveOn}.
          </p>
        </section>

        <section id="servers" className="editorial-section">
          <SectionHeader
            eyebrow="Infrastructure"
            title="Hosting and standard server logs"
            dek="Like any website, the servers that deliver Civica Atlas can see basic request information."
          />

          <p>
            Civica Atlas is served by a hosting provider (Vercel). As with any
            site, the infrastructure that delivers pages can process routine
            technical information such as your IP address and browser type in
            the course of returning a page to you and keeping the service
            running. Civica does not build visitor profiles from this and does
            not use it for advertising.
          </p>

          <p>
            A separate sign-in cookie exists only for internal editorial staff
            who review data corrections. It is never set for ordinary visitors
            reading the site.
          </p>
        </section>

        <section id="data-licensing" className="editorial-section">
          <SectionHeader
            eyebrow="About the data"
            title="Country data is public reference data"
            dek="The facts on Civica Atlas are about governments, not about you."
          />

          <p>
            The government structures, constitutions, elections, and index
            scores on this site come from public and licensed sources, not
            from tracking visitors. For how that data may be reused and cited,
            see <Link href="/licensing">Licensing</Link>.
          </p>
        </section>

        <section id="contact" className="editorial-section">
          <SectionHeader
            eyebrow="Questions"
            title="Reaching us about privacy"
            dek="If anything here is unclear, ask."
          />

          <p>
            Send privacy questions through the{" "}
            <Link href="/contact">contact page</Link>. If this policy changes,
            the &ldquo;last updated&rdquo; date at the top of the page changes
            with it.
          </p>
        </section>

        <footer className="editorial-footer-nav">
          <Link href="/terms">Terms of Use</Link>
          <Link href="/licensing">Licensing</Link>
          <Link href="/contact">Contact</Link>
        </footer>
      </article>
    </EditorialPage>
  );
}
