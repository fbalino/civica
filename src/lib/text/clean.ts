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

export function firstSentences(input: string | null | undefined, count = 3): string {
  const clean = stripHtml(input).replace(/\n+/g, " ");
  if (!clean) return "";
  const parts = clean.split(/(?<=[.!?])\s+/);
  return parts.slice(0, count).join(" ").trim();
}
