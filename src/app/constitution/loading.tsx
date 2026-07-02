export default function Loading() {
  return (
    <div className="editorial-page editorial-page--full">
      <div className="skeleton" style={{ width: 200, height: 14, marginBottom: 12 }} />
      <div className="skeleton" style={{ width: 420, height: 48, marginBottom: 32 }} />
      <div className="constitution-explorer">
        <div className="constitution-explorer-left">
          <div className="skeleton" style={{ height: 32, marginBottom: 12 }} />
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 28, marginBottom: 6 }} />
          ))}
        </div>
        <div className="constitution-explorer-middle">
          <div className="skeleton" style={{ height: 20, width: 260, marginBottom: 24 }} />
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 72, marginBottom: 16 }} />
          ))}
        </div>
        <div className="constitution-explorer-right">
          <div className="skeleton" style={{ height: 40, marginBottom: 16 }} />
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 96, marginBottom: 12 }} />
          ))}
        </div>
      </div>
    </div>
  );
}
