import type { Metadata } from "next";
import Link from "next/link";
import { PageHero } from "@/components/PageHero";

export const metadata: Metadata = {
  title: "Accessibility & Security",
  description:
    "Civica Atlas's accessibility commitment, known limitations, and how to report an accessibility or security issue.",
};

export default function AccessibilityPage() {
  return (
    <>
      <PageHero
        eyebrow="Accessibility & Security"
        titleId="accessibility-hero-title"
        title="Access, and reporting a problem."
        description="Civica Atlas is a public reference work; it should be usable by everyone and safe to report issues on. This page states our accessibility commitment, its current limits, and how to reach us — including a responsible-disclosure path for security researchers."
      />

      <div className="editorial-page editorial-page--full">
        <section className="editorial-section" aria-labelledby="a11y">
          <div className="editorial-section-header">
            <span className="editorial-eyebrow">Accessibility</span>
            <h2 id="a11y">Our commitment and its current limits.</h2>
          </div>
          <p>
            We target <strong>WCAG 2.2 Level AA</strong> across the reader
            surfaces. Text, structure, colour contrast, focus visibility, and
            keyboard operation are checked as part of ongoing work, and both
            light and dark themes are maintained to the same standard.
          </p>
          <p>
            This is an honest work in progress, not a certified conformance
            claim. Known areas still being improved:
          </p>
          <ul>
            <li>
              Full keyboard and screen-reader parity for the interactive world
              map and some data charts, which currently offer tabular or list
              alternatives rather than complete in-canvas interaction.
            </li>
            <li>
              Non-visual equivalents (title, description, source, and downloadable
              data) for every research visualization.
            </li>
            <li>
              Reduced-motion coverage for all decorative entrances and parallax.
            </li>
          </ul>
          <p>
            If a page or control is not usable for you, please tell us via{" "}
            <Link href="/contact">Contact</Link> — describe the page and what
            went wrong, and we will treat it as a defect.
          </p>
        </section>

        <section className="editorial-section" aria-labelledby="browser-support">
          <div className="editorial-section-header">
            <span className="editorial-eyebrow">Browser support</span>
            <h2 id="browser-support">Reader journeys and graceful fallback.</h2>
          </div>
          <p>
            Our automated reader checks run against the current Playwright-managed
            desktop Chromium, Firefox, and WebKit profiles. This is a bounded
            critical-journey commitment, not a claim that every historical browser
            version, extension configuration, or branded browser build is supported.
          </p>
          <p>
            Reader prose and primary landmarks remain available from server-rendered
            HTML when JavaScript is unavailable. Search, maps, filters, and other
            client-side controls are progressive enhancements; use a current browser
            with JavaScript enabled for their full interaction.
          </p>
          <p>
            If a map, image, or optional model service fails, the surrounding country
            evidence remains available. Atlas retains its table alternative and local
            geometry fallback; country maps disclose an unavailable state rather than
            leaving a blank canvas; portraits fall back to a monogram; and Ask Civica
            reports temporary unavailability without replacing source-linked facts.
          </p>
          <p>
            A failed Pulse source basket is represented as a source-outage,
            not-assessable state rather than a no-event or country-quality conclusion.
            See the <Link href="/civica-index/methodology/pulse">Pulse methodology</Link>
            for its observation limits.
          </p>
        </section>

        <section className="editorial-section" aria-labelledby="security">
          <div className="editorial-section-header">
            <span className="editorial-eyebrow">Responsible disclosure</span>
            <h2 id="security">Reporting a security issue.</h2>
          </div>
          <p>
            If you believe you have found a security vulnerability, please report
            it privately through <Link href="/contact">Contact</Link> or by email
            to <a href="mailto:admin@civicaatlas.org">admin@civicaatlas.org</a>.
            Our machine-readable policy is at{" "}
            <a href="/.well-known/security.txt">/.well-known/security.txt</a>.
          </p>
          <p>
            <strong>Safe harbour.</strong> We will not pursue or support legal
            action against researchers who, in good faith, find and report a
            vulnerability, provided they avoid privacy violations, data
            destruction, service degradation, and access beyond what is needed to
            demonstrate the issue, and give us a reasonable chance to remediate
            before public disclosure. Please do not access, modify, or exfiltrate
            other people&rsquo;s data.
          </p>
          <p>
            In scope: <code>civicaatlas.org</code> and its public APIs. Out of
            scope: third-party services we depend on (report those to their
            owners), volumetric denial-of-service, and social engineering.
          </p>
        </section>

        <nav className="editorial-footer-nav">
          <Link href="/contact">Contact</Link>
          <Link href="/licensing">Licensing</Link>
          <Link href="/privacy">Privacy</Link>
        </nav>
      </div>
    </>
  );
}
