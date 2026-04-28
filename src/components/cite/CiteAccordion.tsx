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
 * Chicago) with a copy button per format and a "Download as JSON" link
 * to the v1 API for the same country.
 *
 * URL stays canonical so a citation copied today still resolves in 2030
 * even after underlying scores update — accessedAt is the snapshot
 * marker.
 */
export function CiteAccordion({
  subject,
  pageTitle,
  url,
  downloadSlug,
  sourceNames,
}: CiteAccordionProps) {
  const [active, setActive] = useState<Format>("apa");
  const [copied, setCopied] = useState(false);

  // Resolved at render time on the client, so SSR doesn't ship a stale
  // "today". Fall back to a fixed string if window is undefined (e.g.
  // during the brief pre-hydration paint).
  const accessedAt = useMemo(() => new Date(), []);
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
      sourceNames,
    }),
    [subject, pageTitle, resolvedUrl, accessedAt, sourceNames],
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
          APA · BibTeX · Chicago · JSON
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

        <pre className="cite-text" aria-live="polite">
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
