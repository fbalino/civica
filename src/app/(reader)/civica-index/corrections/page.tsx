import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { correctionLog, jurisdictions } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { CorrectionsForm } from "./CorrectionsForm";
import { EditorialPage } from "@/components/editorial/EditorialPage";
import { Banner } from "@/components/editorial/Banner";
import { disputeSla } from "@/lib/content/site-state";

export const metadata: Metadata = {
  title: "Corrections — Civica Index",
  description: `Dispute a data error, methodology decision, or Pulse event classification. Every submission is logged publicly and reviewed within ${disputeSla.fullDispositionDays} days.`,
  alternates: { canonical: "https://civicaatlas.org/civica-index/corrections" },
};

const CATEGORY_LABELS: Record<string, string> = {
  ci_data_error: "CI data error",
  ci_methodology: "CI methodology",
  pulse_misclassification: "Pulse misclassification",
  pulse_severity: "Pulse severity",
  pulse_false_positive: "Pulse false positive",
  pulse_missing_event: "Pulse missing event",
  pulse_duplicate: "Pulse duplicate",
  other: "Other",
};

const STATUS_META: Record<string, { label: string; color: string }> = {
  open: { label: "Open", color: "var(--color-warn)" },
  in_review: { label: "In review", color: "var(--color-accent)" },
  resolved_corrected: { label: "Resolved — corrected", color: "var(--tier-exceptional)" },
  resolved_no_change: { label: "Resolved — no change", color: "var(--color-text-40)" },
  rejected: { label: "Rejected", color: "var(--tier-failed)" },
};

function truncate(str: string, n: number) {
  return str.length > n ? str.slice(0, n) + "…" : str;
}

function formatDate(d: Date | string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

interface PageProps {
  searchParams: Promise<{ page?: string; submitted?: string }>;
}

export default async function CorrectionsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);
  const submitted = params.submitted === "1";
  const perPage = 20;
  const offset = (page - 1) * perPage;

  // Fetch countries for the form autocomplete
  let countries: { slug: string; name: string }[] = [];
  let logRows: {
    id: string;
    submittedAt: Date;
    category: string;
    countryName: string | null;
    description: string;
    status: string;
    disposition: string | null;
    resolvedAt: Date | null;
  }[] = [];
  let totalCount = 0;

  try {
    // Minimal join: jurisdictions only for name display
    const rawCountries = await db
      .select({ slug: jurisdictions.slug, name: jurisdictions.name })
      .from(jurisdictions)
      .orderBy(jurisdictions.name);
    countries = rawCountries;

    // Public log — exclude private rows
    const allPublic = await db
      .select({
        id: correctionLog.id,
        submittedAt: correctionLog.submittedAt,
        category: correctionLog.category,
        description: correctionLog.description,
        status: correctionLog.status,
        disposition: correctionLog.disposition,
        resolvedAt: correctionLog.resolvedAt,
        countryId: correctionLog.countryId,
      })
      .from(correctionLog)
      .where(eq(correctionLog.isPublic, true))
      .orderBy(desc(correctionLog.submittedAt));

    totalCount = allPublic.length;
    const pageRows = allPublic.slice(offset, offset + perPage);

    // Resolve country names
    const countryIds = [...new Set(pageRows.map((r) => r.countryId).filter(Boolean))] as string[];
    const countryMap = new Map<string, string>();
    if (countryIds.length > 0) {
      for (const id of countryIds) {
        const jRows = await db
          .select({ id: jurisdictions.id, name: jurisdictions.name })
          .from(jurisdictions)
          .where(eq(jurisdictions.id, id))
          .limit(1);
        if (jRows.length > 0) countryMap.set(jRows[0].id, jRows[0].name);
      }
    }

    logRows = pageRows.map((r) => ({
      ...r,
      countryName: r.countryId ? (countryMap.get(r.countryId) ?? null) : null,
    }));
  } catch {
    // DB unavailable
  }

  const totalPages = Math.ceil(totalCount / perPage);

  return (
    <EditorialPage
      width="wide"
      breadcrumbs={
        <>
          <Link href="/civica-index">← Civica Index</Link>
          <span>/</span>
          Corrections
        </>
      }
      title="Corrections."
    >
      <style>{`
        /* Explainer callout (padding/typography only; background+border from Banner) */
        .corr-explainer {
          padding: 20px 24px;
          margin-bottom: 40px;
          font-family: var(--font-body);
          font-size: 14px;
          line-height: 1.65;
        }
        .corr-explainer strong { color: var(--color-text-primary); font-weight: 500; }
        .corr-explainer ul { margin: 10px 0 0 20px; padding: 0; }
        .corr-explainer li { margin-bottom: 4px; }

        /* Form */
        .corr-form { display: flex; flex-direction: column; gap: 20px; }
        .corr-field { display: flex; flex-direction: column; gap: 6px; }
        .corr-label {
          font-family: var(--font-mono);
          font-size: 11px;
          font-weight: var(--font-weight-mono, 500);
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--color-text-60);
        }
        .corr-required { color: var(--color-accent); margin-left: 2px; }
        .corr-hint {
          font-family: var(--font-body);
          font-size: 11px;
          font-style: italic;
          color: var(--color-text-40);
          text-transform: none;
          letter-spacing: 0;
          margin-left: 4px;
        }
        .corr-select, .corr-input {
          font-family: var(--font-body);
          font-size: 14px;
          color: var(--color-text-primary);
          background: var(--color-page-bg);
          border: 1px solid var(--color-card-border);
          border-radius: 4px;
          padding: 10px 12px;
          width: 100%;
          box-sizing: border-box;
          outline: none;
          transition: border-color 0.1s;
        }
        .corr-select:focus, .corr-input:focus, .corr-textarea:focus {
          border-color: var(--color-accent);
          box-shadow: 0 0 0 2px color-mix(in oklch, var(--color-accent) 15%, transparent);
        }
        .corr-textarea {
          font-family: var(--font-body);
          font-size: 14px;
          color: var(--color-text-primary);
          background: var(--color-page-bg);
          border: 1px solid var(--color-card-border);
          border-radius: 4px;
          padding: 10px 12px;
          width: 100%;
          box-sizing: border-box;
          resize: vertical;
          outline: none;
          transition: border-color 0.1s;
          line-height: 1.6;
        }
        .corr-char-count {
          font-family: var(--font-mono);
          font-size: 11px;
          color: var(--color-text-30);
          text-align: right;
        }
        .corr-fieldset {
          border: 1px solid var(--color-card-border);
          border-radius: 4px;
          padding: 20px 20px 8px;
          margin: 0;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .corr-legend {
          font-family: var(--font-mono);
          font-size: 11px;
          font-weight: var(--font-weight-mono, 500);
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--color-text-60);
          padding: 0 6px;
        }
        .corr-privacy-field { margin-top: 4px; }
        .corr-privacy-label {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          font-family: var(--font-body);
          font-size: 13px;
          line-height: 1.55;
          color: var(--color-text-60);
          cursor: pointer;
        }
        .corr-checkbox { margin-top: 3px; flex-shrink: 0; accent-color: var(--color-accent); }
        .corr-submit {
          font-family: var(--font-mono);
          font-size: 12px;
          font-weight: var(--font-weight-mono, 500);
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--color-page-bg);
          background: var(--color-text-primary);
          border: none;
          border-radius: 4px;
          padding: 12px 28px;
          cursor: pointer;
          align-self: flex-start;
          transition: opacity 0.1s;
        }
        .corr-submit:hover { opacity: 0.8; }
        .corr-submit:disabled { opacity: 0.5; cursor: wait; }
        .corr-field-error {
          background: color-mix(in oklch, var(--tier-failed) 10%, var(--color-page-bg) 90%);
          border: 1px solid var(--tier-failed);
          border-radius: 4px;
          padding: 12px 16px;
          font-family: var(--font-body);
          font-size: 13px;
          color: var(--color-text-primary);
        }
        .corr-success-banner {
          background: color-mix(in oklch, var(--tier-exceptional) 10%, var(--color-page-bg) 90%);
          border: 1px solid var(--tier-exceptional);
          border-radius: 4px;
          padding: 18px 22px;
          font-family: var(--font-body);
          font-size: 14px;
          line-height: 1.6;
          color: var(--color-text-primary);
          margin-bottom: 8px;
        }

        /* Log */
        .corr-log-empty {
          font-family: var(--font-body);
          font-size: 14px;
          color: var(--color-text-40);
          padding: 32px 0;
        }
        .corr-log-row {
          border-top: 1px solid var(--color-card-border);
          padding: 20px 0;
        }
        .corr-log-row:last-child { border-bottom: 1px solid var(--color-card-border); }
        .corr-log-meta {
          font-family: var(--font-mono);
          font-size: 11px;
          letter-spacing: 0.03em;
          color: var(--color-text-30);
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          align-items: center;
          margin-bottom: 8px;
        }
        .corr-status-badge {
          font-family: var(--font-mono);
          font-size: 10px;
          font-weight: var(--font-weight-mono, 500);
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--color-page-bg);
          padding: 2px 7px;
          border-radius: 3px;
        }
        .corr-log-desc {
          font-family: var(--font-body);
          font-size: 14px;
          line-height: 1.6;
          color: var(--color-text-60);
          margin: 0 0 8px;
        }
        .corr-log-disposition {
          font-family: var(--font-body);
          font-size: 13px;
          line-height: 1.55;
          color: var(--color-text-primary);
          background: var(--color-grid-cell);
          border-left: 3px solid var(--color-card-border);
          padding: 8px 14px;
          margin-top: 8px;
        }
        .corr-log-disposition strong {
          font-weight: 500;
          color: var(--color-text-primary);
        }
        .corr-pagination {
          display: flex;
          gap: 12px;
          align-items: center;
          padding-top: 24px;
          font-family: var(--font-mono);
          font-size: 12px;
          color: var(--color-text-40);
        }
        .corr-pagination a {
          color: var(--color-accent);
          text-decoration: none;
        }
        .corr-pagination a:hover { text-decoration: underline; }
        .corr-resolution-note {
          font-family: var(--font-body);
          font-size: 13px;
          color: var(--color-text-40);
          margin-top: 32px;
          padding-top: 16px;
          border-top: 1px solid var(--color-card-border);
        }
      `}</style>

      <p className="editorial-page-subtitle">
        Every score in the Civica Index traces to a public data source.
        If you believe a value is wrong, a methodology decision is flawed,
        or a Pulse event has been misclassified, you can dispute it here.
        All submissions are reviewed by the Civica team.
      </p>

      <Banner variant="info" className="corr-explainer">
        <strong>What corrections are for:</strong>
        <ul>
          <li><strong>CI data errors</strong> — a source value was ingested incorrectly, or the underlying dataset has been revised.</li>
          <li><strong>CI methodology disagreements</strong> — you believe a dimension weight, normalization choice, or composite formula is wrong.</li>
          <li><strong>Pulse event issues</strong> — an event was misclassified, its severity score is too high or low, it does not belong in the index, it is a duplicate, or a significant event is missing entirely.</li>
        </ul>
        <p style={{ marginTop: 10, marginBottom: 0 }}>
          Governments, researchers, NGOs, journalists, and any affected party may submit.
          You do not need to provide your name or email.
        </p>
      </Banner>

      {/* Submission form */}
      <section className="editorial-section">
        <h2>Submit a correction</h2>
        <CorrectionsForm countries={countries} submitted={submitted} />
      </section>

      <hr style={{ border: "none", borderTop: "1px solid var(--color-card-border)", margin: "48px 0" }} />

      {/* Public log */}
      <section className="editorial-section">
        <h2>Public corrections log</h2>
        <p>
          Every public submission is listed here, newest first. Submissions where
          the submitter requested privacy are omitted. Contact details are never displayed.
        </p>

        {logRows.length === 0 ? (
          <div className="corr-log-empty">No public corrections yet. Be the first.</div>
        ) : (
          <>
            {logRows.map((row) => {
              const statusMeta = STATUS_META[row.status] ?? { label: row.status, color: "var(--color-text-40)" };
              return (
                <div key={row.id} className="corr-log-row">
                  <div className="corr-log-meta">
                    <span>{formatDate(row.submittedAt)}</span>
                    <span>{CATEGORY_LABELS[row.category] ?? row.category}</span>
                    {row.countryName && <span>{row.countryName}</span>}
                    <span
                      className="corr-status-badge"
                      style={{ background: statusMeta.color }}
                    >
                      {statusMeta.label}
                    </span>
                  </div>
                  <p className="corr-log-desc">{truncate(row.description, 200)}</p>
                  {row.disposition && (
                    <div className="corr-log-disposition">
                      <strong>Civica response</strong>{row.resolvedAt ? ` · ${formatDate(row.resolvedAt)}` : ""}: {row.disposition}
                    </div>
                  )}
                </div>
              );
            })}

            {totalPages > 1 && (
              <div className="corr-pagination">
                {page > 1 && (
                  <Link href={`/civica-index/corrections?page=${page - 1}`}>← Previous</Link>
                )}
                <span>Page {page} of {totalPages}</span>
                {page < totalPages && (
                  <Link href={`/civica-index/corrections?page=${page + 1}`}>Next →</Link>
                )}
              </div>
            )}
          </>
        )}

        <p className="corr-resolution-note">
          Resolution targets: initial response within{" "}
          <strong>{disputeSla.initialResponseDays} days</strong>, full
          disposition within{" "}
          <strong>{disputeSla.fullDispositionDays} days</strong> of
          submission.
        </p>
      </section>
    </EditorialPage>
  );
}
