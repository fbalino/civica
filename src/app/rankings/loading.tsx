export default function Loading() {
  return (
    <div
      style={{
        maxWidth: "var(--max-w-content)",
        margin: "0 auto",
        padding: "var(--spacing-section-y) var(--spacing-page-x)",
      }}
    >
      <div className="skeleton" style={{ width: 180, height: 36, marginBottom: 8 }} />
      <div className="skeleton" style={{ width: 260, height: 14, marginBottom: 40 }} />

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 32 }}>
        {[80, 90, 130, 100, 120, 100].map((w, i) => (
          <div key={i} className="skeleton" style={{ width: w, height: 32, borderRadius: "var(--radius-sm)" }} />
        ))}
      </div>

      <div style={{ display: "grid", gap: 1, background: "var(--color-grid-bg)", borderRadius: "var(--radius-sm)", overflow: "hidden" }}>
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} style={{ background: "var(--color-bg)", padding: "16px 24px", display: "flex", alignItems: "center", gap: 16 }}>
            <div className="skeleton" style={{ width: 28, height: 14 }} />
            <div className="skeleton" style={{ width: 28, height: 21, borderRadius: 2 }} />
            <div className="skeleton" style={{ flex: 1, height: 16 }} />
            <div className="skeleton" style={{ width: 80, height: 14 }} />
          </div>
        ))}
      </div>
    </div>
  );
}
