export const revalidate = 3600;

// STUB — the Civica Data tab is built in the next sub-phase. It will host
// the gov-structure org chart plus the Civica governance sections
// (legislature, leaders, bills, scores, additional indicators). For now it
// renders a placeholder so the tab resolves instead of 404-ing.
export default async function CountryCivicaDataTab({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  await params;
  return (
    <div className="factbook-body">
      <div className="factbook-main">
        <section className="factbook-section">
          <header className="factbook-section-header">
            <h2 className="factbook-section-title">Civica Data</h2>
          </header>
          <p style={{ color: "var(--color-text-60)", fontSize: "var(--text-15)" }}>
            Coming together in the next build step.
          </p>
        </section>
      </div>
    </div>
  );
}
