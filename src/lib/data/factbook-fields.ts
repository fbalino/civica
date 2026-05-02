// Discriminated union of factbook fields.
//
// A "leaf" is a key that resolves to a renderable string value.
// A "group" is a key whose value is a nested object — its children
// are rendered as a subsection (heading + nested rows), NOT as a row
// with an empty value above its indented children.
export type FactbookField =
  | { kind: "leaf"; label: string; value: string }
  | { kind: "group"; label: string; children: FactbookField[] };

function extractText(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number") return v.toLocaleString();
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (typeof v === "object" && "text" in (v as Record<string, unknown>)) {
    return String((v as Record<string, unknown>).text);
  }
  if (Array.isArray(v)) return v.map(extractText).filter(Boolean).join(", ");
  return "";
}

export function jsonbToFields(data: unknown, maxDepth = 3): FactbookField[] {
  if (!data || typeof data !== "object" || maxDepth <= 0) return [];

  const entries = Object.entries(data as Record<string, unknown>);
  const fields: FactbookField[] = [];

  for (const [key, value] of entries) {
    if (value === null || value === undefined) continue;

    const directText = extractText(value);

    if (directText) {
      fields.push({ kind: "leaf", label: key, value: directText });
      continue;
    }

    if (typeof value === "object" && !Array.isArray(value)) {
      const children = jsonbToFields(value, maxDepth - 1);
      if (children.length > 0) {
        fields.push({ kind: "group", label: key, children });
      }
      continue;
    }

    if (Array.isArray(value)) {
      const items = value.map(extractText).filter(Boolean);
      if (items.length > 0) {
        fields.push({ kind: "leaf", label: key, value: items.join(", ") });
      }
    }
  }

  return fields;
}
