export default function Loading() {
  return (
    <div
      style={{
        maxWidth: "var(--max-w-content)",
        margin: "0 auto",
        padding: "60px var(--spacing-page-x)",
      }}
    >
      <div className="skeleton" style={{ width: 160, height: 36, marginBottom: 8 }} />
      <div className="skeleton" style={{ width: 320, height: 14, marginBottom: 32 }} />

      <div className="compare-selector-grid">
        {[1, 2, 3].map((i) => (
          <div key={i} className="skeleton" style={{ height: 48 }} />
        ))}
      </div>
    </div>
  );
}
