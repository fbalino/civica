"use client";

import { useMemo, useState } from "react";
import { Copy, Check, Download } from "lucide-react";
import {
  formatAPA,
  formatBibTeX,
  formatChicago,
  type CiteInput,
} from "@/lib/cite/format";

export interface CiteAccordionProps {
  /** Country / subject of the page being cited. */
  subject: string;
  /** Friendly tab/page title — "Structure", "Scores & Rankings", etc. */
  pageTitle: string;
  /** Canonical URL (origin + path). Defaults to current page. */
  url?: string;
  /**
   * The data's real vintage / `last_sync_at` for this page — drives the
   * citation's publication date (the year in APA/BibTeX/Chicago).
   * Accepts a `Date` or an ISO-ish string ("2026-05-05", "2024-12-31",
   * or any value `new Date()` parses). When omitted/null/unparseable
   * the citation shows "n.d." rather than fabricating today's date as
   * the data's vintage. The access date (today) is shown separately.
   * Pass the real handle wherever one exists (e.g. a quarterly cut date
   * or `composite.calculatedAt`); leave unset only when the page truly
   * has no dated data yet.
   */
  dataVintage?: Date | string | null;
  /** Slug used by the data download endpoint (`/api/v1/countries/<slug>`). */
  downloadSlug?: string;
  /** Optional dataset list for the BibTeX note + footer. */
  sourceNames?: string[];
}

type Format = "apa" | "bibtex" | "chicago";

const FORMAT_LABEL: Record<Format, string> = {
  apa: "APA",
  bibtex: "BibTeX",
  chicago: "Chicago",
};

/**
 * Phase E — Cite & Embed accordion.
 *
 * Sits at the bottom of every country tab. Closed: a single "Cite this
 * page" affordance. Open: tabbed citation strings (APA / BibTeX /
 * Chicago) with a copy button per format. A "Download as JSON" link to
 * the v1 API is shown only when a `downloadSlug` is supplied (i.e. on
 * per-country pages where `/api/v1/countries/<slug>` actually serves
 * that page's data); the summary advertises "· JSON" only in that case.
 *
 * Two dates, kept distinct: the citation's publication date is the
 * data's real `dataVintage` (or "n.d." when unknown — never today),
 * while `accessedAt` is the reader's access date. The canonical URL +
 * the data vintage are the snapshot markers, so a citation copied today
 * still resolves and still names the data's actual version in 2030.
 */
export function CiteAccordion({
  subject,
  pageTitle,
  url,
  dataVintage,
  downloadSlug,
  sourceNames,
}: CiteAccordionProps) {
  const [active, setActive] = useState<Format>("apa");
  const [copied, setCopied] = useState(false);

  // Resolved at render time on the client, so SSR doesn't ship a stale
  // "today". Fall back to a fixed string if window is undefined (e.g.
  // during the brief pre-hydration paint).
  const accessedAt = useMemo(() => new Date(), []);

  // The DATA's vintage — the publication date of the citation. Parse a
  // bare "YYYY-MM-DD" as a local calendar date so the year never shifts
  // across the UTC boundary; fall back to Date parsing for anything
  // else. Unparseable/absent → null → formatters emit "n.d.".
  const dataDate = useMemo<Date | null>(() => {
    if (!dataVintage) return null;
    if (dataVintage instanceof Date) {
      return Number.isNaN(dataVintage.getTime()) ? null : dataVintage;
    }
    const ymd = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dataVintage.trim());
    if (ymd) {
      return new Date(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3]));
    }
    const parsed = new Date(dataVintage);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }, [dataVintage]);
  const resolvedUrl = useMemo(() => {
    if (url) return url;
    if (typeof window === "undefined") return "";
    const u = new URL(window.location.href);
    // Drop ?house= and other transient query params from the citation
    // URL — they're not part of the canonical resource.
    u.search = "";
    u.hash = "";
    return u.toString();
  }, [url]);

  const input: CiteInput = useMemo(
    () => ({
      subject,
      pageTitle,
      url: resolvedUrl,
      accessedAt,
      dataDate,
      sourceNames,
    }),
    [subject, pageTitle, resolvedUrl, accessedAt, dataDate, sourceNames],
  );

  const text = useMemo(() => {
    if (!resolvedUrl) return "";
    if (active === "apa") return formatAPA(input);
    if (active === "bibtex") return formatBibTeX(input);
    return formatChicago(input);
  }, [active, input, resolvedUrl]);

  const handleCopy = async () => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      /* ignore */
    }
  };

  return (
    <details className="cite-accordion">
      <summary className="cite-accordion-summary">
        <span className="cite-accordion-title">Cite this page</span>
        <span className="cite-accordion-meta">
          {downloadSlug ? "APA · BibTeX · Chicago · JSON" : "APA · BibTeX · Chicago"}
        </span>
        <span className="cite-accordion-chev" aria-hidden="true">
          ▾
        </span>
      </summary>

      <div className="cite-accordion-body">
        <div className="cite-format-tabs" role="tablist">
          {(Object.keys(FORMAT_LABEL) as Format[]).map((f) => (
            <button
              key={f}
              role="tab"
              aria-selected={active === f}
              className={`cite-format-tab${active === f ? " on" : ""}`}
              onClick={() => {
                setActive(f);
                setCopied(false);
              }}
            >
              {FORMAT_LABEL[f]}
            </button>
          ))}
        </div>

        <pre className="cite-text" aria-live="polite" suppressHydrationWarning>
          {text || "—"}
        </pre>

        <div className="cite-actions">
          <button
            type="button"
            className="cite-action"
            onClick={handleCopy}
            aria-label={`Copy ${FORMAT_LABEL[active]} citation`}
          >
            {copied ? (
              <>
                <Check size={13} aria-hidden="true" /> Copied
              </>
            ) : (
              <>
                <Copy size={13} aria-hidden="true" /> Copy
              </>
            )}
          </button>
          {downloadSlug ? (
            <a
              className="cite-action"
              href={`/api/v1/countries/${downloadSlug}`}
              download={`civica-${downloadSlug}.json`}
            >
              <Download size={13} aria-hidden="true" /> Download as JSON
            </a>
          ) : null}
        </div>

        {sourceNames && sourceNames.length > 0 ? (
          <div className="cite-sources">
            <span className="cite-sources-label">Sources:</span>{" "}
            {sourceNames.join(", ")}
          </div>
        ) : null}
      </div>
    </details>
  );
}
