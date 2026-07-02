import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { correctionLog, jurisdictions } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { CorrectionsForm } from "./CorrectionsForm";
import { EditorialPage } from "@/components/editorial/EditorialPage";
import { Banner } from "@/components/editorial/Banner";
import { disputeSla } from "@/lib/content/site-state";

export const revalidate = 3600;

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
        <p style={{ marginTop: "var(--space-3)", marginBottom: 0 }}>
          Governments, researchers, NGOs, journalists, and any affected party may submit.
          You do not need to provide your name or email.
        </p>
      </Banner>

      {/* Submission form */}
      <section className="editorial-section">
        <h2>Submit a correction</h2>
        <CorrectionsForm countries={countries} submitted={submitted} />
      </section>

      <hr style={{ border: "none", borderTop: "1px solid var(--color-card-border)", margin: "var(--space-8) 0" }} />

      {/* Public log */}
      <section className="editorial-section">
        <h2>Public corrections log</h2>
        <p>
          Every public submission is listed here, newest first. Submissions where
          the submitter requested privacy are omitted. Contact details are never displayed.
        </p>

        {logRows.length === 0 ? (
          <div className="editorial-empty">No public corrections yet. Be the first.</div>
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
              <div className="editorial-pagination">
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
