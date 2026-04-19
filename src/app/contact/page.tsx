import type { Metadata } from "next";
import Link from "next/link";
import { ContactForm } from "@/components/ContactForm";

export const metadata: Metadata = {
  title: "Contact the Editors",
  description:
    "Send a message to the Civica editorial team — data corrections, story tips, partnerships, press inquiries, and more.",
  alternates: { canonical: "https://civicaatlas.org/contact" },
  openGraph: {
    title: "Contact the Editors | Civica",
    description:
      "Send a message to the Civica editorial team — data corrections, story tips, partnerships, press inquiries, and more.",
    url: "https://civicaatlas.org/contact",
  },
};

export default function ContactPage() {
  return (
    <div
      style={{
        maxWidth: "var(--max-w-content)",
        margin: "0 auto",
        padding: "var(--spacing-section-y) var(--spacing-page-x)",
      }}
    >
      <h1 className="page-heading" style={{ marginBottom: 10 }}>
        Contact the editors
      </h1>

      <p
        style={{
          fontFamily: "var(--font-mono)",
          fontWeight: "var(--font-weight-mono)",
          fontSize: "var(--text-13)",
          color: "var(--color-text-50)",
          lineHeight: "var(--leading-relaxed)",
          marginBottom: 8,
        }}
      >
        Story tips, data corrections, partnership or press inquiries — we read everything.
      </p>

      <div
        style={{
          width: 40,
          height: 2,
          background: "var(--color-accent)",
          borderRadius: 1,
          marginBottom: 48,
        }}
      />

      {/* Two-column layout: form + sidebar */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr",
          gap: 48,
        }}
        className="contact-layout"
      >
        {/* Form column */}
        <div style={{ minWidth: 0 }}>
          <ContactForm />
        </div>

        {/* Sidebar */}
        <aside>
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            {/* Response time */}
            <div className="cv-card">
              <p
                style={{
                  fontFamily: "var(--font-mono)",
                  fontWeight: "var(--font-weight-mono)",
                  fontSize: "var(--text-11)",
                  color: "var(--color-text-30)",
                  letterSpacing: "var(--tracking-caps)",
                  textTransform: "uppercase",
                  margin: "0 0 8px",
                }}
              >
                Response time
              </p>
              <p
                style={{
                  fontFamily: "var(--font-mono)",
                  fontWeight: "var(--font-weight-mono)",
                  fontSize: "var(--text-13)",
                  color: "var(--color-text-50)",
                  lineHeight: "var(--leading-relaxed)",
                  margin: 0,
                }}
              >
                We usually reply within 3 business days. For urgent corrections to live data,
                include the country name and field in the subject line.
              </p>
            </div>

            {/* What we reply to */}
            <div className="cv-card">
              <p
                style={{
                  fontFamily: "var(--font-mono)",
                  fontWeight: "var(--font-weight-mono)",
                  fontSize: "var(--text-11)",
                  color: "var(--color-text-30)",
                  letterSpacing: "var(--tracking-caps)",
                  textTransform: "uppercase",
                  margin: "0 0 12px",
                }}
              >
                What we reply to
              </p>
              <ul
                style={{
                  margin: 0,
                  paddingLeft: 16,
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                  listStyle: "none",
                  padding: 0,
                }}
              >
                {[
                  "Data corrections & source disputes",
                  "Story tips & editorial suggestions",
                  "Partnership & integration inquiries",
                  "Press & media requests",
                  "General feedback",
                ].map((item) => (
                  <li
                    key={item}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 8,
                      fontFamily: "var(--font-mono)",
                      fontWeight: "var(--font-weight-mono)",
                      fontSize: "var(--text-12)",
                      color: "var(--color-text-50)",
                      lineHeight: "var(--leading-relaxed)",
                    }}
                  >
                    <span style={{ color: "var(--color-accent)", flexShrink: 0, marginTop: 1 }}>·</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Developer & bug resources */}
            <div className="cv-card">
              <p
                style={{
                  fontFamily: "var(--font-mono)",
                  fontWeight: "var(--font-weight-mono)",
                  fontSize: "var(--text-11)",
                  color: "var(--color-text-30)",
                  letterSpacing: "var(--tracking-caps)",
                  textTransform: "uppercase",
                  margin: "0 0 12px",
                }}
              >
                Developer resources
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <Link
                  href="/api-docs"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    fontFamily: "var(--font-mono)",
                    fontWeight: "var(--font-weight-mono)",
                    fontSize: "var(--text-12)",
                    color: "var(--color-accent)",
                    textDecoration: "none",
                  }}
                >
                  <span style={{ fontSize: "var(--text-11)", opacity: 0.7 }}>{ }</span>
                  Public API reference
                </Link>
                <a
                  href="https://github.com/civicaatlas/civica/issues"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    fontFamily: "var(--font-mono)",
                    fontWeight: "var(--font-weight-mono)",
                    fontSize: "var(--text-12)",
                    color: "var(--color-accent)",
                    textDecoration: "none",
                  }}
                >
                  <span style={{ fontSize: "var(--text-11)", opacity: 0.7 }}>⎇</span>
                  GitHub Issues — bug reports
                </a>
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* Responsive grid: two columns on md+ */}
      <style>{`
        @media (min-width: 768px) {
          .contact-layout {
            grid-template-columns: 1fr 320px !important;
          }
        }
      `}</style>
    </div>
  );
}
