export default function Loading() {
  return (
    <div className="editorial-page editorial-page--full">
      <div className="rankings-skeleton">
        {/* Header row */}
        <div className="rankings-skeleton-row">
          <div className="skeleton rankings-skeleton-label" />
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="skeleton rankings-skeleton-metric" />
          ))}
        </div>
        {/* Body rows */}
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="rankings-skeleton-row">
            <div className="rankings-skeleton-name">
              <div className="skeleton rankings-skeleton-flag" />
              <div className="skeleton rankings-skeleton-fill" />
            </div>
            {Array.from({ length: 8 }).map((_, j) => (
              <div key={j} className="skeleton rankings-skeleton-metric" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
