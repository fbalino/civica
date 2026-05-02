import { Fragment, type ReactNode } from "react";
import { SourceDot } from "./SourceDot";
import type { FactbookField } from "@/lib/data/factbook-fields";
import { humanizeLabel, humanizeSectionLabel } from "@/lib/data/humanize-label";
import { slugify } from "@/lib/text/slugify";

// Match opening or closing tags for a small allowlist of inline elements.
// Note: there is no negative lookahead — earlier `(?!<)` caused the first
// of consecutive tags (e.g. the leading <br> in `<br><br>`) to be skipped
// and rendered as literal text.
const INLINE_TAG_RE = /<(\/?)(strong|b|em|i|br|p)\s*\/?>/gi;

function renderInlineHtml(raw: string): ReactNode {
  if (!raw || !/<[a-z]/i.test(raw)) return raw;

  const nodes: ReactNode[] = [];
  const stack: Array<{ tag: string; children: ReactNode[] }> = [
    { tag: "root", children: nodes },
  ];
  let cursor = 0;
  let key = 0;

  const pushText = (text: string) => {
    if (!text) return;
    stack[stack.length - 1].children.push(text);
  };

  for (const match of raw.matchAll(INLINE_TAG_RE)) {
    const [full, slash, tagRaw] = match;
    const idx = match.index ?? 0;
    pushText(raw.slice(cursor, idx));
    cursor = idx + full.length;

    const tag = tagRaw.toLowerCase();

    if (tag === "br") {
      stack[stack.length - 1].children.push(<br key={`br-${key++}`} />);
      continue;
    }
    if (tag === "p") {
      if (slash) {
        stack[stack.length - 1].children.push(<br key={`p-${key++}`} />);
      }
      continue;
    }

    if (!slash) {
      stack.push({ tag, children: [] });
      continue;
    }

    const top = stack[stack.length - 1];
    if (stack.length > 1 && top.tag === tag) {
      stack.pop();
      const parent = stack[stack.length - 1];
      const k = `${tag}-${key++}`;
      if (tag === "strong" || tag === "b") {
        parent.children.push(
          <strong key={k} style={{ color: "var(--color-text-primary)" }}>
            {top.children}
          </strong>
        );
      } else if (tag === "em" || tag === "i") {
        parent.children.push(<em key={k}>{top.children}</em>);
      } else {
        parent.children.push(<Fragment key={k}>{top.children}</Fragment>);
      }
    }
  }
  pushText(raw.slice(cursor));

  while (stack.length > 1) {
    const top = stack.pop()!;
    stack[stack.length - 1].children.push(
      <Fragment key={`unclosed-${key++}`}>{top.children}</Fragment>
    );
  }

  return <>{nodes}</>;
}

interface FactbookSectionProps {
  sectionName: string;
  fields: FactbookField[];
  source?: string;
  retrievedAt?: string;
  /** Optional prefix for subsection DOM ids — typically the parent
   *  section's id. Yields ids like `government--legal-system` so a
   *  scroll-spy / right-rail can target individual subsections. */
  idPrefix?: string;
}

type LeafField = Extract<FactbookField, { kind: "leaf" }>;
type GroupField = Extract<FactbookField, { kind: "group" }>;

function LeafRow({
  field,
  source,
  retrievedAt,
}: {
  field: LeafField;
  source?: string;
  retrievedAt?: string;
}) {
  return (
    <div
      style={{
        padding: "10px 0",
        borderBottom: "1px solid var(--color-stat-border)",
      }}
    >
      <dt
        style={{
          fontFamily: "var(--font-mono)",
          fontWeight: "var(--font-weight-mono)",
          fontSize: "var(--text-12)",
          color: "var(--color-text-40)",
          marginBottom: 4,
        }}
      >
        {humanizeLabel(field.label)}
      </dt>
      <dd
        style={{
          fontFamily: "var(--font-body)",
          fontSize: "var(--text-14)",
          lineHeight: "var(--leading-relaxed)",
          color: "var(--color-text-85)",
          margin: 0,
        }}
      >
        {renderInlineHtml(field.value)}
        {source && retrievedAt && (
          <SourceDot source={source} retrievedAt={retrievedAt} />
        )}
      </dd>
    </div>
  );
}

function GroupBlock({
  field,
  source,
  retrievedAt,
  depth = 0,
  idPrefix,
}: {
  field: GroupField;
  source?: string;
  retrievedAt?: string;
  depth?: number;
  idPrefix?: string;
}) {
  const HeadingTag = depth === 0 ? "h3" : "h4";
  const headingFontSize = depth === 0 ? "var(--text-20)" : "var(--text-16)";
  const blockMarginTop = depth === 0 ? "var(--space-7)" : "var(--space-5)";
  // Subsection headings use title case ("Capital", "Independence",
  // "Country Name") — matches the convention for headings + TOC items.
  // Slug ids stay derived from the same string so anchors are stable.
  const headingText = humanizeSectionLabel(field.label);
  const headingId = idPrefix && depth === 0
    ? `${idPrefix}--${slugify(headingText)}`
    : undefined;

  return (
    <div style={{ marginTop: blockMarginTop, scrollMarginTop: "calc(56px + var(--space-5))" }}>
      <HeadingTag
        id={headingId}
        className="factbook-subsection-title"
        style={{
          fontFamily: "var(--font-heading)",
          fontSize: headingFontSize,
          fontWeight: 400,
          margin: "0 0 var(--space-3)",
          color: "var(--color-text-primary)",
          letterSpacing: "var(--tracking-tighter)",
        }}
      >
        {headingText}
      </HeadingTag>
      {renderFields(field.children, source, retrievedAt, depth + 1, idPrefix)}
    </div>
  );
}

// Group consecutive leaves into a single <dl>; render group fields as
// their own subsection blocks. This avoids producing a leaf row with an
// empty value above its children.
function renderFields(
  fields: FactbookField[],
  source: string | undefined,
  retrievedAt: string | undefined,
  depth: number,
  idPrefix?: string
): ReactNode[] {
  const out: ReactNode[] = [];
  let leafBuffer: LeafField[] = [];
  let dlIndex = 0;

  const flushLeaves = () => {
    if (leafBuffer.length === 0) return;
    const buf = leafBuffer;
    leafBuffer = [];
    out.push(
      <dl key={`dl-${dlIndex++}`} style={{ margin: 0 }}>
        {buf.map((leaf) => (
          <LeafRow
            key={leaf.label}
            field={leaf}
            source={source}
            retrievedAt={retrievedAt}
          />
        ))}
      </dl>
    );
  };

  for (const field of fields) {
    if (field.kind === "leaf") {
      leafBuffer.push(field);
      continue;
    }
    flushLeaves();
    out.push(
      <GroupBlock
        key={`group-${field.label}`}
        field={field}
        source={source}
        retrievedAt={retrievedAt}
        depth={depth}
        idPrefix={idPrefix}
      />
    );
  }
  flushLeaves();
  return out;
}

export function FactbookSection({
  sectionName,
  fields,
  source,
  retrievedAt,
  idPrefix,
}: FactbookSectionProps) {
  if (fields.length === 0) {
    return (
      <div
        style={{
          padding: "var(--spacing-content-top) 0",
          textAlign: "center",
          fontFamily: "var(--font-body)",
          fontSize: "var(--text-14)",
          color: "var(--color-text-40)",
        }}
      >
        No data available for this section.
      </div>
    );
  }

  return (
    <section aria-label={sectionName}>
      {renderFields(fields, source, retrievedAt, 0, idPrefix)}
    </section>
  );
}
