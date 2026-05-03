import { Fragment, type ReactNode } from "react";
import { SourceDot } from "./SourceDot";
import type { FactbookField } from "@/lib/data/factbook-fields";
import { humanizeLabel, humanizeSectionLabel } from "@/lib/data/humanize-label";
import { slugify } from "@/lib/text/slugify";
import { FactValueDot } from "@/components/factbook/FactValueDot";
import type { ResolverOutput } from "@/lib/factbook/reconcile/types";

/**
 * Phase F.4 — for the small set of structured-section leaves whose
 * label maps cleanly to a Phase F fact-key, we can swap the generic
 * `<SourceDot>` (which only attributes "CIA Factbook") for a clickable
 * `<FactValueDot>` that opens the alternates panel. Most factbook leaf
 * labels (Coastline, Climate, Industries, etc.) are CIA-prose-only and
 * stay on the generic SourceDot.
 *
 * Keys are the human label as rendered by `humanizeLabel(field.label)`
 * — match what the user sees on screen, not the raw underlying key.
 */
const LABEL_TO_FACT_KEY: Record<string, string> = {
  Capital: "capital",
  Population: "population_total",
  Languages: "official_languages",
  Currency: "currency_code",
  "GDP (PPP)": "gdp_ppp_usd_billions",
};

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

function renderValueWithSource(raw: string, sourceNode: ReactNode): ReactNode {
  if (/<[a-z]/i.test(raw)) {
    return (
      <>
        {renderInlineHtml(raw.replace(/\s*<\/p>\s*$/i, ""))}
        <span className="factbook-source-hang">{sourceNode}</span>
      </>
    );
  }

  const match = raw.match(/(\S+)\s*$/);
  if (!match || match.index == null) {
    return (
      <>
        {raw}
        <span className="factbook-value-source-lock">{sourceNode}</span>
      </>
    );
  }

  return (
    <>
      {raw.slice(0, match.index)}
      <span className="factbook-value-source-lock">
        {match[1]}
        {sourceNode}
      </span>
    </>
  );
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
  /** Phase F.4 — resolver outputs keyed by Phase F fact-key. When a
   *  leaf's humanized label matches a key in `LABEL_TO_FACT_KEY` AND
   *  the resolver returned a canonical row, the row renders
   *  `<FactValueDot>` (clickable alternates panel) instead of the
   *  plain CIA-Factbook `<SourceDot>`. Optional — pages that don't
   *  pass this still get the legacy single-source attribution. */
  resolverFacts?: Record<string, ResolverOutput>;
}

type LeafField = Extract<FactbookField, { kind: "leaf" }>;
type GroupField = Extract<FactbookField, { kind: "group" }>;

function LeafRow({
  field,
  source,
  retrievedAt,
  resolverFacts,
}: {
  field: LeafField;
  source?: string;
  retrievedAt?: string;
  resolverFacts?: Record<string, ResolverOutput>;
}) {
  const humanLabel = humanizeLabel(field.label);
  // Phase F.4 — does this leaf map to a Phase F fact-key, AND did the
  // resolver return a canonical row? If yes, swap the SourceDot for a
  // FactValueDot so the alternates panel is one click away.
  const factKey = LABEL_TO_FACT_KEY[humanLabel];
  const resolverFact = factKey ? resolverFacts?.[factKey] : undefined;
  const hasCanonical = resolverFact?.canonical != null;
  const hasInteractiveSource = hasCanonical && resolverFact && factKey;
  const sourceNode =
    hasInteractiveSource ? (
      <FactValueDot
        factKey={factKey}
        factLabel={humanLabel}
        resolverOutput={resolverFact}
        canonicalSourceId={resolverFact.canonical?.sourceId ?? null}
        ariaLabel={`${humanLabel}, see sources`}
      />
    ) : source && retrievedAt ? (
      <SourceDot source={source} retrievedAt={retrievedAt} />
    ) : null;

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
        {humanLabel}
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
        {sourceNode
          ? renderValueWithSource(field.value, sourceNode)
          : renderInlineHtml(field.value)}
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
  resolverFacts,
}: {
  field: GroupField;
  source?: string;
  retrievedAt?: string;
  depth?: number;
  idPrefix?: string;
  resolverFacts?: Record<string, ResolverOutput>;
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
      {renderFields(field.children, source, retrievedAt, depth + 1, idPrefix, resolverFacts)}
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
  idPrefix?: string,
  resolverFacts?: Record<string, ResolverOutput>
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
            resolverFacts={resolverFacts}
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
        resolverFacts={resolverFacts}
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
  resolverFacts,
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
      {renderFields(fields, source, retrievedAt, 0, idPrefix, resolverFacts)}
    </section>
  );
}
