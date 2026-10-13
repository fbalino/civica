import Link from "next/link";
import { SourceDot } from "@/components/SourceDot";
import type { RenderableSection } from "@/lib/constitution/article-nav";
import type { ConstitutionDetail } from "@/lib/db/queries-constitution";
import { ConstitutionHashFocus } from "./ConstitutionHashFocus";

/*
 * Shared, hook-free pieces of the constitution reader. They render on the
 * server for the country Constitution tab and inside the client
 * `ConstitutionReadingColumn` for the Constitution Explorer, so both surfaces
 * draw the same header and body markup.
 */

/** Human year range for the metadata line. */
function yearLine(year: number | null, yearUpdated: number | null): string {
  if (year && yearUpdated && yearUpdated !== year) {
    return `Enacted ${year} · last amended ${yearUpdated}`;
  }
  if (year) return `Enacted ${year}`;
  if (yearUpdated) return `Last amended ${yearUpdated}`;
  return "Date unknown";
}

type ConstitutionHeaderFields = Pick<
  ConstitutionDetail,
  "year" | "yearUpdated" | "constituteProjectId"
>;

/** Year line, provenance dot, Constitute attribution, optional Explorer link. */
export function ConstitutionReaderHeader({
  constitution,
  sourceRetrievedAt,
  explorerHref,
}: {
  constitution: ConstitutionHeaderFields;
  /** Constitute source last_sync_at, for the provenance dot. */
  sourceRetrievedAt: string | null;
  /** Optional route back to the multi-country Constitution Explorer. */
  explorerHref?: string;
}) {
  return (
    <div className="constitution-reader-header">
      <div className="constitution-reader-meta">
        <span>{yearLine(constitution.year, constitution.yearUpdated)}</span>
        <SourceDot
          source="constitute_project"
          retrievedAt={sourceRetrievedAt}
        />
      </div>
      <div className="constitution-reader-attribution-row">
        <p className="constitution-reader-attribution">
          Text from the{" "}
          <a
            href={
              constitution.constituteProjectId
                ? `https://www.constituteproject.org/constitution/${encodeURIComponent(constitution.constituteProjectId)}`
                : "https://www.constituteproject.org/"
            }
            target="_blank"
            rel="noopener noreferrer"
          >
            Constitute Project
          </a>{" "}
          (Elkins, Ginsburg &amp; Melton), CC BY-NC 3.0.
        </p>
        {explorerHref ? (
          <Link className="btn btn--secondary btn--sm" href={explorerHref}>
            Open in the Constitution Explorer
            <span className="btn__arrow" aria-hidden="true">
              →
            </span>
          </Link>
        ) : null}
      </div>
    </div>
  );
}

/**
 * The reading column's sections as one HTML string. Each section's `html`
 * already crossed the server-side constitution-html/v1 boundary; the only
 * markup added here is the outer `<section>` with its navigation DOM id
 * (`sec-…`, restricted to `[A-Za-z0-9-]` by `constitutionSectionDomId`) and
 * the part modifier class. One string keeps a 1,000-section constitution
 * from repeating per-section element overhead in the page and its payload.
 */
export function constitutionBodyHtml(
  sections: ReadonlyArray<RenderableSection>,
): string {
  let html = "";
  for (const section of sections) {
    const cls = section.partId ? ` class="constitution-section--part"` : "";
    html += `<section id="${section.domId}"${cls}>${section.html}</section>`;
  }
  return html;
}

/** The reading body; navigation focus comes from `ConstitutionHashFocus`. */
export function ConstitutionReaderBody({
  sections,
}: {
  sections: ReadonlyArray<RenderableSection>;
}) {
  return (
    <>
      <article
        className="constitution-reader-body"
        dangerouslySetInnerHTML={{ __html: constitutionBodyHtml(sections) }}
      />
      <ConstitutionHashFocus />
    </>
  );
}
