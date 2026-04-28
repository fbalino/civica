/**
 * Phase E — citation formatters.
 *
 * Civica is meant to be cited in academic and journalistic work. Each
 * format takes the same input (page metadata + access date) and returns
 * a single string. URLs stay canonical (https://civicaatlas.org/atlas/
 * <slug>/<tab>) so a citation copied today still resolves in 2030 even
 * after underlying scores change — the date-of-access is the snapshot
 * marker.
 */

export interface CiteInput {
  /** Country (or org / page subject) being cited. */
  subject: string;
  /** Tab or page-section title — e.g. "Structure", "Scores & Rankings". */
  pageTitle: string;
  /** Canonical URL for the page (includes tab). */
  url: string;
  /** Access date (Date object — "today" at render time). */
  accessedAt: Date;
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

/** Slug-safe BibTeX key from the subject + tab. */
function bibKey(input: CiteInput): string {
  const slug = `${input.subject}-${input.pageTitle}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `civica-${slug}-${input.accessedAt.getFullYear()}`;
}

export function formatAPA(input: CiteInput): string {
  // APA 7th — website with no author defaults to publisher.
  // Pattern: Publisher. (Year). Page title: Subject [Atlas page]. Site
  //   Title. Retrieved Month Day, Year, from URL
  const year = input.accessedAt.getFullYear();
  return `${PUBLISHER}. (${year}). ${input.subject}: ${input.pageTitle}. ${SITE_TITLE}. Retrieved ${formatLongDate(input.accessedAt)}, from ${input.url}`;
}

export function formatBibTeX(input: CiteInput): string {
  const note = input.sourceNames && input.sourceNames.length > 0
    ? `Data sources: ${input.sourceNames.join(", ")}.`
    : "";
  // Standard BibTeX @misc — common for online resources without a paper.
  const lines = [
    `@misc{${bibKey(input)},`,
    `  title        = {${input.subject}: ${input.pageTitle}},`,
    `  author       = {{${PUBLISHER}}},`,
    `  year         = {${input.accessedAt.getFullYear()}},`,
    `  publisher    = {{${SITE_TITLE}}},`,
    `  url          = {${input.url}},`,
    `  urldate      = {${formatShortDate(input.accessedAt)}},`,
  ];
  if (note) lines.push(`  note         = {${note}},`);
  lines.push(`}`);
  return lines.join("\n");
}

export function formatChicago(input: CiteInput): string {
  // Chicago 17th — author–date variant for an online resource.
  // Pattern: Publisher. "Subject: Page title." Site Title. Accessed
  //   Month Day, Year. URL.
  return `${PUBLISHER}. "${input.subject}: ${input.pageTitle}." ${SITE_TITLE}. Accessed ${formatLongDate(input.accessedAt)}. ${input.url}.`;
}
