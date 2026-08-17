"use client";

import { useId, useMemo, useState, type KeyboardEvent } from "react";
import { Copy, Check, Download } from "lucide-react";
import {
  formatAPA,
  formatBibTeX,
  formatChicago,
  formatJSON,
  type CiteInput,
} from "@/lib/cite/format";
import { RIGHTS_REGISTRY_PATH } from "@/lib/claims/reuse-rights";

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

type Format = "apa" | "bibtex" | "chicago" | "json";

const FORMAT_LABEL: Record<Format, string> = {
  apa: "APA",
  bibtex: "BibTeX",
  chicago: "Chicago",
  json: "JSON",
};

/**
 * Phase E — Cite & Embed accordion.
 *
 * Sits at the bottom of every country tab. Closed: a single "Cite this
 * page" affordance. Open: tabbed citation strings (APA / BibTeX /
 * Chicago / JSON) with a copy button per format. The JSON tab emits a
 * structured, CSL-flavoured citation record the reader can paste into a
 * reference manager — it is always available. Separately, a "Download as
 * JSON" link to the v1 API (the page's full underlying dataset, not the
 * citation) is shown only when a `downloadSlug` is supplied (i.e. on
 * per-country pages where `/api/v1/countries/<slug>` actually serves that
 * page's data). That endpoint requires an explicit temporal selection
 * (DAT-031), so the link always carries `as_of` — dropping it makes the
 * download return 400.
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
  const tabIdPrefix = useId();

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
    if (active === "json") return formatJSON(input);
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

  const handleTabKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) => {
    const formats = Object.keys(FORMAT_LABEL) as Format[];
    let nextIndex: number | null = null;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      nextIndex = (index + 1) % formats.length;
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      nextIndex = (index - 1 + formats.length) % formats.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = formats.length - 1;
    }
    if (nextIndex === null) return;

    event.preventDefault();
    const nextFormat = formats[nextIndex];
    setActive(nextFormat);
    setCopied(false);
    requestAnimationFrame(() => {
      document.getElementById(`${tabIdPrefix}-tab-${nextFormat}`)?.focus();
    });
  };

  return (
    <details className="cite-accordion">
      <summary className="cite-accordion-summary">
        <span className="cite-accordion-title">Cite this page</span>
        <span className="cite-accordion-meta">
          APA · BibTeX · Chicago · JSON
        </span>
        <span className="cite-accordion-chev" aria-hidden="true">
          ▾
        </span>
      </summary>

      <div className="cite-accordion-body">
        <div className="cite-format-tabs" role="tablist">
          {(Object.keys(FORMAT_LABEL) as Format[]).map((f, index) => (
            <button
              key={f}
              id={`${tabIdPrefix}-tab-${f}`}
              type="button"
              role="tab"
              aria-selected={active === f}
              aria-controls={`${tabIdPrefix}-panel`}
              tabIndex={active === f ? 0 : -1}
              className={`cite-format-tab${active === f ? " on" : ""}`}
              onClick={() => {
                setActive(f);
                setCopied(false);
              }}
              onKeyDown={(event) => handleTabKeyDown(event, index)}
            >
              {FORMAT_LABEL[f]}
            </button>
          ))}
        </div>

        <pre
          id={`${tabIdPrefix}-panel`}
          className="cite-text"
          role="tabpanel"
          aria-labelledby={`${tabIdPrefix}-tab-${active}`}
          aria-live="polite"
          suppressHydrationWarning
        >
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
              href={`/api/v1/countries/${downloadSlug}?as_of=live`}
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

        <div className="cite-rights-note">
          Citing is a request for credit, not a reuse license.{" "}
          <a href={RIGHTS_REGISTRY_PATH}>Reuse terms</a>
        </div>
      </div>
    </details>
  );
}
