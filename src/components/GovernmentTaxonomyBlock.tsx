import type { GovernmentClassification } from "@/lib/government-taxonomy";

type Props = {
  classification: GovernmentClassification | null | undefined;
  compact?: boolean;
  showTitle?: boolean;
  showNote?: boolean;
};

function TaxonomyRow({
  label,
  value,
  compact,
}: {
  label: string;
  value: string;
  compact: boolean;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: compact ? "86px 1fr" : "108px 1fr",
        gap: compact ? 8 : 12,
        alignItems: "start",
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontWeight: "var(--font-weight-mono)",
          fontSize: compact ? "var(--text-10)" : "var(--text-11)",
          color: "var(--color-text-30)",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: "var(--font-body-sans)",
          fontSize: compact ? "var(--text-12)" : "var(--text-13)",
          lineHeight: 1.45,
          color: "var(--color-text-primary)",
        }}
      >
        {value}
      </div>
    </div>
  );
}

export function GovernmentTaxonomyBlock({
  classification,
  compact = false,
  showTitle = true,
  showNote = true,
}: Props) {
  if (!classification) return null;

  const rows = [
    classification.rawLabel
      ? { label: "Raw source", value: classification.rawLabel }
      : null,
    classification.regimeTypeLabel
      ? {
          label: "Regime type",
          value:
            classification.regimeYear != null
              ? `${classification.regimeTypeLabel} · ${classification.regimeYear}`
              : classification.regimeTypeLabel,
        }
      : {
          label: "Regime type",
          value: "Not yet coded from Bjornskov-Rode / CGV",
        },
    classification.structuralSubtypeLabel
      ? {
          label: "Structure",
          value:
            classification.structuralFamilyLabel &&
            classification.structuralSubtypeLabel !== classification.structuralFamilyLabel
              ? `${classification.structuralFamilyLabel} · ${classification.structuralSubtypeLabel}`
              : classification.structuralSubtypeLabel,
        }
      : null,
  ].filter(Boolean) as Array<{ label: string; value: string }>;

  return (
    <div
      style={{
        border: "1px solid var(--color-card-border)",
        borderRadius: "var(--radius-sm)",
        padding: compact ? "12px 14px" : "16px 18px",
        background: "var(--color-surface-elevated)",
      }}
    >
      {showTitle ? (
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontWeight: "var(--font-weight-mono)",
            fontSize: compact ? "var(--text-10)" : "var(--text-11)",
            color: "var(--color-text-30)",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            marginBottom: compact ? 10 : 12,
          }}
        >
          Government taxonomy
        </div>
      ) : null}

      <div style={{ display: "grid", gap: compact ? 8 : 10 }}>
        {rows.map((row) => (
          <TaxonomyRow
            key={row.label}
            label={row.label}
            value={row.value}
            compact={compact}
          />
        ))}
      </div>

      {showNote && classification.overrideNote ? (
        <p
          style={{
            margin: compact ? "10px 0 0" : "12px 0 0",
            fontFamily: "var(--font-body-sans)",
            fontSize: compact ? "var(--text-11)" : "var(--text-12)",
            lineHeight: 1.45,
            color: "var(--color-text-50)",
          }}
        >
          {classification.overrideNote}
        </p>
      ) : null}
    </div>
  );
}
