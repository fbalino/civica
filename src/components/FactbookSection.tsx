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
        className={`
          py-3 border-b border-[var(--color-border-muted)] last:border-b-0
          ${depth > 0 ? "pl-6" : ""}
        `}
      >
        <dt className="text-sm font-medium text-[var(--color-text-secondary)] mb-1">
          {field.label}
        </dt>
        <dd className="text-[var(--text-base)] leading-relaxed text-[var(--color-text-primary)]">
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
      <div className="py-8 text-center text-[var(--color-text-tertiary)] text-sm">
        No data available for this section.
      </div>
    );
  }

  return (
    <section aria-label={sectionName}>
      <dl className="divide-y-0">
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
