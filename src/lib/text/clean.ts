const HTML_ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&apos;": "'",
  "&#39;": "'",
  "&nbsp;": " ",
  "&mdash;": "—",
  "&ndash;": "–",
};

export function stripHtml(input: string | null | undefined): string {
  if (!input) return "";
  return input
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p\s*>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&(amp|lt|gt|quot|apos|nbsp|mdash|ndash|#39);/g, (m) => HTML_ENTITIES[m] ?? m)
    .replace(/\s+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+/g, " ")
    .trim();
}

export function formatGovernmentType(raw: string | null | undefined): string {
  if (!raw) return "";
  return stripHtml(raw)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

export interface GovernmentDisplay {
  label: string;
  detail: string | null;
  full: string;
}

function normalizeGovernmentText(raw: string | null | undefined): string {
  if (!raw) return "";
  return stripHtml(raw)
    .replace(/_/g, " ")
    .replace(/\s*;\s*/g, "; ")
    .replace(/\s+/g, " ")
    .trim();
}

function sentenceCase(input: string): string {
  if (!input) return "";
  return input.charAt(0).toUpperCase() + input.slice(1);
}

function looksLikeCountryPrefix(segment: string, countryName: string): boolean {
  const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const left = normalize(segment);
  const country = normalize(countryName);

  return (
    left === country ||
    left.endsWith(country) ||
    /^republic of\b/.test(left) ||
    /^kingdom of\b/.test(left) ||
    /^state of\b/.test(left)
  );
}

function isRedundantCountryPrefix(segment: string, countryName: string): boolean {
  const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  return normalize(segment).endsWith(normalize(countryName));
}

export function formatGovernmentDisplay(
  raw: string | null | undefined,
  countryName?: string
): GovernmentDisplay {
  const full = normalizeGovernmentText(raw);
  if (!full) {
    return { label: "—", detail: null, full: "—" };
  }

  const clauses = full
    .split(/\s*;\s+/)
    .map((clause) => clause.trim())
    .filter(Boolean);

  let label = clauses[0] ?? full;
  const detailParts = clauses.slice(1);

  const splitMatch = label.match(/\s+(under|that)\s+/i);
  if (splitMatch && splitMatch.index) {
    const head = label.slice(0, splitMatch.index).trim();
    const tail = label.slice(splitMatch.index).trim();
    if (head) {
      label = head;
      detailParts.unshift(tail);
    }
  }

  const dashParts = label.split(/\s+-\s+/);
  if (countryName && dashParts.length === 2 && looksLikeCountryPrefix(dashParts[0], countryName)) {
    label = dashParts[1].trim();
    if (!isRedundantCountryPrefix(dashParts[0], countryName)) {
      detailParts.unshift(dashParts[0].trim());
    }
  }

  label = label.replace(/\s*\([^)]*\)/g, "").trim();
  label = formatGovernmentType(label);

  const detail = detailParts.length > 0
    ? sentenceCase(
        detailParts
          .join("; ")
          .replace(/^[-,;:\s]+/, "")
          .replace(/^that\s+/i, "")
      )
    : null;

  return {
    label: label || formatGovernmentType(full),
    detail,
    full,
  };
}

export function firstSentences(input: string | null | undefined, count = 3): string {
  const clean = stripHtml(input).replace(/\n+/g, " ");
  if (!clean) return "";
  const parts = clean.split(/(?<=[.!?])\s+/);
  return parts.slice(0, count).join(" ").trim();
}
