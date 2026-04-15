import { SourceDot } from "./SourceDot";

interface FactbookField {
  label: string;
  value: string;
  subfields?: FactbookField[];
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
            fontFamily: "var(--font-mono)",
            fontWeight: "var(--font-weight-mono)",
            fontSize: "var(--text-12)",
            lineHeight: "var(--leading-relaxed)",
            color: "var(--color-text-50)",
            margin: 0,
          }}
        >
          {field.value}
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
          fontFamily: "var(--font-mono)",
          fontWeight: "var(--font-weight-mono)",
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
