export const revalidate = 3600;

// STUB — the Constitution Explorer is built in a later sub-phase. For now
// it renders a placeholder so the tab resolves instead of 404-ing.
export default async function CountryConstitutionTab({
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
            <h2 className="factbook-section-title">Constitution</h2>
          </header>
          <p style={{ color: "var(--color-text-60)", fontSize: "var(--text-15)" }}>
            Constitution Explorer — coming next.
          </p>
        </section>
      </div>
    </div>
  );
}
