import { Fragment, type ReactNode } from "react";
import { SourceDot } from "./SourceDot";

interface FactbookField {
  label: string;
  value: string;
  subfields?: FactbookField[];
}

const INLINE_TAG_RE = /<(\/?)(strong|b|em|i|br|p)\s*\/?>(?!<)/gi;

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
}

function FieldRow({ field, source, retrievedAt, depth = 0 }: {
  field: FactbookField;
  source?: string;
  retrievedAt?: string;
  depth?: number;
}) {
  return (
    <>
      <div
        style={{
          padding: "10px 0",
          paddingLeft: depth > 0 ? 16 : 0,
          borderBottom: "1px solid var(--color-stat-border)",
        }}
      >
        <dt
          style={{
            fontFamily: "var(--font-mono)",
            fontWeight: "var(--font-weight-mono)",
            fontSize: "var(--text-10)",
            color: "var(--color-text-30)",
            letterSpacing: "var(--tracking-wider)",
            textTransform: "uppercase",
            marginBottom: 4,
          }}
        >
          {field.label}
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
      {field.subfields?.map((sub) => (
        <FieldRow
          key={sub.label}
          field={sub}
          source={source}
          retrievedAt={retrievedAt}
          depth={depth + 1}
        />
      ))}
    </>
  );
}

export function FactbookSection({
  sectionName,
  fields,
  source,
  retrievedAt,
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
      <dl style={{ margin: 0 }}>
        {fields.map((field) => (
          <FieldRow
            key={field.label}
            field={field}
            source={source}
            retrievedAt={retrievedAt}
          />
        ))}
      </dl>
    </section>
  );
}
