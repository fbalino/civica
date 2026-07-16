import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  getJurisdictionBySlug,
  getSource,
  getFactbookCountryOptions,
} from "@/lib/db/queries";
import { getConstitutionWithArticles } from "@/lib/db/queries-constitution";
import { ConstitutionReadingColumn } from "@/components/constitution/ConstitutionReadingColumn";
import { CountryJumpSearch } from "@/components/country/CountryJumpSearch";
import { FactbookSidebar } from "@/components/factbook/FactbookSidebar";
import { buildArticleNav } from "@/lib/constitution/article-nav";
import { withOg } from "@/lib/og";
import "@/app/civica-data.css";

export const revalidate = 0;

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
  const jurisdiction = await getJurisdictionBySlug(slug);
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

  const jurisdiction = await getJurisdictionBySlug(slug);
  if (!jurisdiction) notFound();

  // getConstitutionWithArticles already soft-fails (try/catch → null) and
  // returns null when the country has no structured articles, so the empty
  // state covers both "no text" and "DB unreachable". countryOptions feeds the
  // shared <CountryJumpSearch>; it soft-fails to an empty list.
  const [constitution, constituteSource, countryOptions] = await Promise.all([
    getConstitutionWithArticles(slug),
    getSource("constitute_project").catch(() => null),
    getFactbookCountryOptions().catch(() => []),
  ]);

  const sourceRetrievedAt = constituteSource?.lastSyncAt
    ? constituteSource.lastSyncAt.toISOString()
    : null;

  // Shared country search — identical position/component to the Factbook and
  // Civica Data tabs (owner mandate 2026-07-05: the country tabs must not
  // drift apart). The masthead <h1> in the shared layout is the ONLY H1; this
  // tab's headings are <h2> and never repeat the country name.
  const jumpSearch = (
    <CountryJumpSearch
      country={{ name: jurisdiction.name, iso2: jurisdiction.iso2 }}
      countries={countryOptions}
    />
  );

  // ── Empty state — no ingested constitution text ──────────────────────
  if (!constitution) {
    return (
      <div className="factbook-tab">
        <div className="civica-data-body">
          <div className="factbook-left-rail">
            {jumpSearch}
            <FactbookSidebar
              items={[{ id: "constitution", label: "Constitution" }]}
            />
          </div>
          <section
            id="constitution"
            className="editorial-section"
            aria-labelledby="constitution-heading"
          >
            <span className="editorial-eyebrow">Constitution</span>
            <h2 id="constitution-heading">Not yet indexed</h2>
            <div className="constitution-empty-state">
              <p>
                Civica indexes the world&rsquo;s constitutions from the
                Constitute Project, the standard scholarly repository. We
                haven&rsquo;t indexed {jurisdiction.name}&rsquo;s constitution
                here yet — but you can still explore its government,
                institutions and governance evidence.
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
          </section>
        </div>
      </div>
    );
  }

  // ── Reading state — the country's own constitution ───────────────────
  // The outline lives in the shared <FactbookSidebar> left rail (showOutline
  // is off on the reading column). Sidebar items are the constitution's parts
  // when it has more than one, else its articles — each id is a rendered
  // section domId so the ReaderSidebar scroll-spy aligns.
  const { groups } = buildArticleNav(constitution.articles);
  const partItems = groups
    .map((g) => ({ id: g.entries[0]?.id ?? "", label: g.label }))
    .filter((i) => i.id);
  const articleItems = groups
    .flatMap((g) => g.entries)
    .map((e) => ({ id: e.id, label: (e.label ?? "").trim() }))
    .filter((e) => e.label && e.label.toLowerCase() !== "untitled")
    .slice(0, 60);
  // Prefer part-level navigation when the document has enough parts; otherwise
  // fall back to article-level items so a lightly-grouped constitution still
  // gets a useful "On this page" nav rather than one or two entries.
  const rawItems = partItems.length >= 3 ? partItems : articleItems;
  const sidebarItems =
    rawItems.length > 0
      ? rawItems
      : [{ id: "constitution", label: "Constitution" }];

  return (
    <div className="factbook-tab">
      <div className="civica-data-body">
        <div className="factbook-left-rail">
          {jumpSearch}
          <FactbookSidebar items={sidebarItems} />
        </div>
        <section
          id="constitution"
          className="editorial-section country-constitution-section"
          aria-labelledby="constitution-heading"
        >
          <span className="editorial-eyebrow">Constitution</span>
          <h2 id="constitution-heading">Full constitutional text</h2>
          {/* Reading body only — the reading column renders its own year line,
              SourceDot and Constitute attribution. Outline is off; the shared
              sidebar owns navigation. */}
          <ConstitutionReadingColumn
            constitution={constitution}
            sourceRetrievedAt={sourceRetrievedAt}
            explorerHref={`/constitution?c=${encodeURIComponent(slug)}`}
            showOutline={false}
          />
        </section>
      </div>
    </div>
  );
}
