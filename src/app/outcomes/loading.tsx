export default function Loading() {
  return (
    <div
      style={{
        maxWidth: "var(--max-w-content)",
        margin: "0 auto",
        padding: "var(--spacing-content-top) var(--spacing-page-x) 80px",
      }}
    >
      {/* Breadcrumb */}
      <div
        className="skeleton"
        style={{ width: 200, height: 12, marginBottom: 20, borderRadius: "var(--radius-sm)" }}
      />

      {/* H1 */}
      <div
        className="skeleton"
        style={{ width: "60%", height: 52, marginBottom: 12, borderRadius: "var(--radius-sm)" }}
      />
      <div
        className="skeleton"
        style={{ width: "40%", height: 52, marginBottom: 20, borderRadius: "var(--radius-sm)" }}
      />

      {/* Dek */}
      <div
        className="skeleton"
        style={{ width: "80%", height: 16, marginBottom: 8, borderRadius: "var(--radius-sm)" }}
      />
      <div
        className="skeleton"
        style={{ width: "70%", height: 16, marginBottom: 8, borderRadius: "var(--radius-sm)" }}
      />
      <div
        className="skeleton"
        style={{ width: "55%", height: 16, marginBottom: 36, borderRadius: "var(--radius-sm)" }}
      />

      {/* Controls row */}
      <div
        style={{ display: "flex", gap: 8, marginBottom: 28, flexWrap: "wrap" }}
      >
        {[220, 90, 80, 130, 110, 100].map((w, i) => (
          <div
            key={i}
            className="skeleton"
            style={{ width: w, height: 34, borderRadius: "var(--radius-sm)" }}
          />
        ))}
      </div>

      {/* Strip plot rows */}
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className="skeleton"
          style={{
            width: "100%",
            height: 60,
            marginBottom: 2,
            borderRadius: "var(--radius-sm)",
          }}
        />
      ))}

      {/* Caption area */}
      <div
        style={{
          marginTop: 20,
          paddingTop: 16,
          borderTop: "1px solid var(--color-divider)",
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <div
          className="skeleton"
          style={{ width: "50%", height: 12, borderRadius: "var(--radius-sm)" }}
        />
        <div
          className="skeleton"
          style={{ width: 120, height: 12, borderRadius: "var(--radius-sm)" }}
        />
      </div>
    </div>
  );
}
