export default function Loading() {
  return (
    <div
      style={{
        maxWidth: "var(--max-w-content)",
        margin: "0 auto",
        padding: "var(--spacing-content-top) var(--spacing-page-x)",
      }}
    >
      <div className="skeleton" style={{ width: 120, height: 14, marginBottom: 32 }} />

      <div style={{ display: "flex", alignItems: "flex-end", gap: 20, marginBottom: 24 }}>
        <div className="skeleton" style={{ width: 56, height: 42, borderRadius: 2 }} />
        <div>
          <div className="skeleton" style={{ width: 240, height: 40, marginBottom: 8 }} />
          <div className="skeleton" style={{ width: 140, height: 14 }} />
        </div>
      </div>

      <div style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--color-divider)", marginBottom: 32 }}>
        {[100, 110, 90].map((w, i) => (
          <div key={i} className="skeleton" style={{ width: w, height: 14, margin: "10px 14px" }} />
        ))}
      </div>

      <div className="overview-grid">
        <div className="skeleton" style={{ height: 260, padding: 24 }} />
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="skeleton" style={{ height: 120 }} />
          <div className="skeleton" style={{ height: 120 }} />
        </div>
      </div>
    </div>
  );
}
