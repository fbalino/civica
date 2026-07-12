import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { EditorialPage } from "@/components/editorial/EditorialPage";
import { getJurisdictionBySlug, getSource } from "@/lib/db/queries";
import { getConstitutionWithArticles } from "@/lib/db/queries-constitution";
import { ConstitutionReadingColumn } from "@/components/constitution/ConstitutionReadingColumn";
import { withOg } from "@/lib/og";

export const revalidate = 3600;

// Per-tab metadata. The shared layout's generateMetadata sets the Factbook
// title + /country/[slug] canonical (correct for the base tab); metadata
// exported from a page shallowly overrides the layout's for the keys it
// defines, so this tab self-canonicalizes to its own URL/title instead of
// pointing back at the Factbook tab.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const jurisdiction = await getJurisdictionBySlug(slug).catch(() => null);
  if (!jurisdiction) return { title: "Country Not Found" };
  const title = `${jurisdiction.name} — Constitution, Full Text`;
  const description = `The full constitutional text of ${jurisdiction.name}, indexed article by article from the Constitute Project with topic cross-references and provenance.`;
  const url = `https://civicaatlas.org/country/${slug}/constitution`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: withOg({
      title: `${title} · Civica Atlas`,
      description,
      url,
      type: "website",
    }),
  };
}

// Constitution tab of the unified /country/[slug] page. The masthead, tab
// bar and AI drawer live in the shared layout — this page renders ONLY the
// constitution body: the country's OWN full text (reusing the standalone
// Explorer's reading column) plus a prominent "Open in the Constitution
// Explorer" CTA. When a country has no ingested text (67 of 253
// jurisdictions) we degrade to an on-brand empty state that points at the
// Explorer landing. Both the fetch and the source lookup soft-fail so a Neon
// hiccup degrades gracefully instead of 500-ing the tab.
export default async function CountryConstitutionTab({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const jurisdiction = await getJurisdictionBySlug(slug).catch(() => null);
  if (!jurisdiction) notFound();

  // getConstitutionWithArticles already soft-fails (try/catch → null) and
  // returns null when the country has no structured articles, so the empty
  // state covers both "no text" and "DB unreachable".
  const [constitution, constituteSource] = await Promise.all([
    getConstitutionWithArticles(slug),
    getSource("constitute_project").catch(() => null),
  ]);

  const sourceRetrievedAt = constituteSource?.lastSyncAt
    ? constituteSource.lastSyncAt.toISOString()
    : null;

  // ── Empty state — no ingested constitution text ──────────────────────
  if (!constitution) {
    return (
      <EditorialPage className="editorial-page editorial-page--full country-constitution-body">
        <header className="constitution-page-header">
          <div className="constitution-page-eyebrow">Constitution</div>
          <h2 className="editorial-page-title">
            No constitution text is available for {jurisdiction.name} yet
          </h2>
        </header>
        <div className="constitution-empty-state">
          <p>
            Civica indexes the world&rsquo;s constitutions from the Constitute
            Project, the standard scholarly repository. We haven&rsquo;t
            indexed {jurisdiction.name}&rsquo;s constitution here yet — but you
            can still explore its government, institutions and governance
            scores.
          </p>
          <Link className="btn btn--primary" href="/constitution">
            Open the Constitution Explorer
            <span className="btn__arrow" aria-hidden="true">
              →
            </span>
          </Link>
          <Link className="btn btn--secondary" href={`/country/${slug}`}>
            View the {jurisdiction.name} factbook
          </Link>
        </div>
      </EditorialPage>
    );
  }

  // ── Reading state — the country's own constitution ───────────────────
  return (
    <EditorialPage className="editorial-page editorial-page--full country-constitution-body">
      <header className="constitution-page-header">
        <h2 className="editorial-page-title">
          Constitution of {jurisdiction.name}
        </h2>
      </header>

      {/* Single-country reading column — renders its own year line, SourceDot
          and Constitute attribution, so the header above doesn't duplicate
          that metadata. Omit onActiveTopicsChange: no cross-reference pane. */}
      <ConstitutionReadingColumn
        constitution={constitution}
        sourceRetrievedAt={sourceRetrievedAt}
        explorerHref={`/constitution?c=${encodeURIComponent(slug)}`}
      />
    </EditorialPage>
  );
}
