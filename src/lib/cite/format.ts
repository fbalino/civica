/**
 * Phase E — citation formatters.
 *
 * Civica is meant to be cited in academic and journalistic work. Each
 * format takes the same input (page metadata + a data vintage + an
 * access date) and returns a single string. URLs stay canonical
 * (https://civicaatlas.org/atlas/<slug>/<tab>) so a citation copied
 * today still resolves in 2030 even after underlying scores change.
 *
 * Two distinct dates, never conflated:
 *   • `dataDate`   — the data's actual vintage / `last_sync_at`. This is
 *                    the publication date: APA "(year)", BibTeX `year`,
 *                    Chicago author–date year. Falls back to "n.d." when
 *                    unknown — we never stamp today's date as the data's
 *                    date on a citability-first reference work.
 *   • `accessedAt` — when the reader loaded the page (today). Drives the
 *                    "Retrieved"/"Accessed" line + BibTeX `urldate`.
 */

export interface CiteInput {
  /** Country (or org / page subject) being cited. */
  subject: string;
  /** Tab or page-section title — e.g. "Structure", "Scores & Rankings". */
  pageTitle: string;
  /** Canonical URL for the page (includes tab). */
  url: string;
  /** Access date (Date object — "today" at render time). Drives the
   *  "Retrieved"/"Accessed" line and the BibTeX `urldate` ONLY — i.e.
   *  when the *reader* loaded the page, not when the data is from. */
  accessedAt: Date;
  /** The data's actual vintage / `last_sync_at` (e.g. a quarterly cut
   *  date). Drives the publication date — the "(year)" in APA, the
   *  `year` in BibTeX, and the author–date year in Chicago. When
   *  null/undefined the formatters emit "n.d." rather than fabricating
   *  the access date as the data's date: for a citability-first
   *  reference work the publication date must be the data vintage, not
   *  today. */
  dataDate?: Date | null;
  /** Optional dataset list, used in BibTeX `note` field. */
  sourceNames?: string[];
}

const SITE_TITLE = "Civica Atlas";
const PUBLISHER = "Civica";

function formatLongDate(d: Date): string {
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatShortDate(d: Date): string {
  // ISO-ish "2026-04-28" — used inside BibTeX urldate.
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Publication-year token — the data vintage's year, or "nd" when no
 *  data date is known. Never the access (today) year. */
function pubYearKey(input: CiteInput): string {
  return input.dataDate ? String(input.dataDate.getFullYear()) : "nd";
}

/** Slug-safe BibTeX key from the subject + tab + data-vintage year. */
function bibKey(input: CiteInput): string {
  const slug = `${input.subject}-${input.pageTitle}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `civica-${slug}-${pubYearKey(input)}`;
}

export function formatAPA(input: CiteInput): string {
  // APA 7th — website with no author defaults to publisher.
  // Pattern: Publisher. (DataYear). Subject: Page title. Site Title.
  //   Retrieved Month Day, Year, from URL
  // The "(year)" is the DATA vintage (or "n.d."), never today; the
  // "Retrieved …" date is the access date.
  const year = input.dataDate ? input.dataDate.getFullYear() : "n.d.";
  return `${PUBLISHER}. (${year}). ${input.subject}: ${input.pageTitle}. ${SITE_TITLE}. Retrieved ${formatLongDate(input.accessedAt)}, from ${input.url}`;
}

export function formatBibTeX(input: CiteInput): string {
  const note = input.sourceNames && input.sourceNames.length > 0
    ? `Data sources: ${input.sourceNames.join(", ")}.`
    : "";
  // Standard BibTeX @misc — common for online resources without a paper.
  // `year` is the DATA vintage; omitted entirely when unknown (BibTeX
  // has no "n.d." literal). `urldate` is the access date.
  const lines = [
    `@misc{${bibKey(input)},`,
    `  title        = {${input.subject}: ${input.pageTitle}},`,
    `  author       = {{${PUBLISHER}}},`,
  ];
  if (input.dataDate) {
    lines.push(`  year         = {${input.dataDate.getFullYear()}},`);
  }
  lines.push(
    `  publisher    = {{${SITE_TITLE}}},`,
    `  url          = {${input.url}},`,
    `  urldate      = {${formatShortDate(input.accessedAt)}},`,
  );
  if (note) lines.push(`  note         = {${note}},`);
  lines.push(`}`);
  return lines.join("\n");
}

export function formatChicago(input: CiteInput): string {
  // Chicago 17th — author–date variant for an online resource.
  // Pattern: Publisher. DataYear. "Subject: Page title." Site Title.
  //   Accessed Month Day, Year. URL.
  // The year after the publisher is the DATA vintage (or "n.d."); the
  // access date follows "Accessed". "n.d." already carries its own
  // terminal period, so don't append a second one.
  const yearSeg = input.dataDate ? `${input.dataDate.getFullYear()}.` : "n.d.";
  return `${PUBLISHER}. ${yearSeg} "${input.subject}: ${input.pageTitle}." ${SITE_TITLE}. Accessed ${formatLongDate(input.accessedAt)}. ${input.url}.`;
}
