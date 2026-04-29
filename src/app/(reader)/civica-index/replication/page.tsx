import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Replication package — Civica Index",
  description:
    "Reproduce every Civica Index score from primary sources. Full methodology, codebook, processing logic, and downloadable outputs — coming at Beta launch.",
  alternates: { canonical: "https://civicaatlas.org/civica-index/replication" },
};

export default function ReplicationPage() {
  return (
    <div className="repl-layout">
      <style>{`
        .repl-layout {
          max-width: 760px;
          margin: 0 auto;
          padding: 60px 24px 80px;
        }
        .repl-breadcrumb {
          font-family: var(--font-mono);
          font-weight: var(--font-weight-mono, 500);
          font-size: 12px;
          letter-spacing: 0.03em;
          color: var(--color-text-30);
          margin-bottom: 16px;
          display: flex;
          gap: 8px;
          align-items: center;
        }
        .repl-breadcrumb a {
          color: var(--color-text-30);
          text-decoration: none;
        }
        .repl-breadcrumb a:hover { color: var(--color-text-primary); }

        .repl-eyebrow {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 12px;
        }
        .repl-beta-pill {
          font-family: var(--font-mono);
          font-size: 10px;
          font-weight: var(--font-weight-mono, 500);
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #7a5c00;
          background: color-mix(in oklch, var(--color-warn) 18%, var(--color-page-bg) 82%);
          border: 1px solid var(--color-warn);
          border-radius: 3px;
          padding: 2px 7px;
          white-space: nowrap;
        }

        .repl-title {
          font-family: var(--font-heading, var(--font-serif));
          font-size: 48px;
          font-weight: 400;
          letter-spacing: -0.04em;
          line-height: 1.02;
          margin: 0 0 12px;
          color: var(--color-text-primary);
        }
        .repl-subtitle {
          font-family: var(--font-heading, var(--font-serif));
          font-size: 20px;
          font-weight: 400;
          letter-spacing: -0.01em;
          color: var(--color-text-60);
          margin: 0 0 32px;
          line-height: 1.4;
        }
        .repl-lede {
          font-family: var(--font-sans);
          font-size: 15px;
          line-height: 1.7;
          color: var(--color-text-60);
          margin: 0 0 36px;
          max-width: 640px;
        }
        .repl-status-box {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          background: color-mix(in oklch, var(--color-warn) 10%, var(--color-page-bg) 90%);
          border: 1px solid var(--color-warn);
          border-radius: 4px;
          padding: 12px 18px;
          margin-bottom: 40px;
          font-family: var(--font-mono);
          font-size: 12px;
          font-weight: var(--font-weight-mono, 500);
          letter-spacing: 0.04em;
          color: var(--color-text-primary);
        }
        .repl-status-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: var(--color-warn);
          flex-shrink: 0;
        }

        .repl-section-label {
          font-family: var(--font-mono);
          font-size: 11px;
          font-weight: var(--font-weight-mono, 500);
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--color-text-30);
          margin: 0 0 12px;
        }
        .repl-h2 {
          font-family: var(--font-heading, var(--font-serif));
          font-size: 26px;
          font-weight: 400;
          letter-spacing: -0.02em;
          color: var(--color-text-primary);
          margin: 0 0 16px;
        }
        .repl-list {
          font-family: var(--font-sans);
          font-size: 14px;
          line-height: 1.7;
          color: var(--color-text-60);
          padding-left: 20px;
          margin: 0 0 40px;
        }
        .repl-list li {
          margin-bottom: 8px;
        }
        .repl-list li strong {
          color: var(--color-text-primary);
          font-weight: 500;
        }

        .repl-divider {
          border: none;
          border-top: 1px solid var(--color-card-border);
          margin: 40px 0;
        }
        .repl-footer-links {
          font-family: var(--font-sans);
          font-size: 14px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .repl-footer-links a {
          color: var(--color-accent);
          text-decoration: none;
        }
        .repl-footer-links a:hover { text-decoration: underline; }
        .repl-footer-note {
          font-family: var(--font-sans);
          font-size: 13px;
          color: var(--color-text-30);
          margin-top: 4px;
        }

        @media (max-width: 480px) {
          .repl-title { font-size: 36px; }
        }
      `}</style>

      <nav className="repl-breadcrumb">
        <Link href="/civica-index">← Civica Index</Link>
        <span>/</span>
        Replication package
      </nav>

      <div className="repl-eyebrow">
        <span className="repl-beta-pill">Coming soon</span>
      </div>

      <h1 className="repl-title">Replication package.</h1>
      <p className="repl-subtitle">
        Reproduce every Civica Index score from primary sources.
      </p>

      <p className="repl-lede">
        The Civica Index is designed to be fully reproducible. That means
        publishing not just the scores, but every formula, normalization step,
        source dataset reference, and codebook entry needed to re-derive the
        same numbers from scratch. The replication package ships at Beta
        cut-over (target: Q3 2026), once the PCA / factor analysis and
        confidence-interval work are finalized. The contents are described
        below.
      </p>

      <div className="repl-status-box">
        <span className="repl-status-dot" />
        Status: coming at Beta launch — target Q3 2026
      </div>

      <div className="repl-section-label">What will be available</div>
      <h2 className="repl-h2">Package contents</h2>
      <ul className="repl-list">
        <li>
          <strong>Full methodology document.</strong> An expanded version of
          the published methodology, including worked examples and
          edge-case decisions.
        </li>
        <li>
          <strong>Codebook.</strong> Every variable, every source, every formula
          — documented in a single reference table. Includes native-scale
          definitions and normalization bounds for each dimension.
        </li>
        <li>
          <strong>Processing logic.</strong> Step-by-step description of how raw
          source data flows into final CI scores: ingestion, normalization
          (fixed-bound, not observed-extremes), PCA factor weights, composite
          formula, confidence interval derivation, and tier classification.
        </li>
        <li>
          <strong>Source references.</strong> Direct links and bibliographic
          citations for every upstream dataset, including dataset version,
          release date, and coverage notes.
        </li>
        <li>
          <strong>Downloadable outputs.</strong> Country-level CSV covering all
          197 scored jurisdictions: CI score, 90% confidence interval, rank,
          rank band, dimensional breakdowns, completeness flag (Full / Partial /
          Insufficient), and data vintage per source.
        </li>
        <li>
          <strong>Code (where legally permissible).</strong> The ingestion and
          normalization scripts from this codebase, published under an open
          license. Restricted upstream datasets are not redistributed — only
          the processing code that consumes them.
        </li>
      </ul>

      <hr className="repl-divider" />

      <div className="repl-footer-links">
        <div>
          <Link href="/civica-index/methodology">← Back to methodology</Link>
        </div>
        <div>
          <Link href="/civica-index/corrections">Report a data issue or methodology concern</Link>
          <div className="repl-footer-note">
            Found a problem before the replication package is live? Submit it via the corrections form.
          </div>
        </div>
      </div>
    </div>
  );
}
