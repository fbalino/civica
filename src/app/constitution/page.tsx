import type { Metadata } from "next";
import Link from "next/link";
import { EditorialPage } from "@/components/editorial/EditorialPage";
import { withOg } from "@/lib/og";
import { parseCountrySlugs } from "@/lib/constitution/slugs";
import {
  getConstitutionWithArticles,
  getIndexedConstitutionCountries,
} from "@/lib/db/queries-constitution";
import { getTopicTaxonomy } from "@/lib/constitute/topics";
import { getSource } from "@/lib/db/queries";
import { ConstitutionExplorerShell } from "@/components/constitution/ConstitutionExplorerShell";
import { ConstitutionLanding } from "@/components/constitution/ConstitutionLanding";

export const revalidate = 3600;

const MAX_SLUGS = 4;

/** A curated shortlist of recognizable, high-coverage topics for the landing. */
const FEATURED_TOPIC_KEYS = [
  "dignity",
  "hosterm",
  "em",
  "amend",
  "referen",
  "env",
  "relig",
  "eqgen",
];

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const sp = await searchParams;
  const slugs = parseCountrySlugs(sp?.c, MAX_SLUGS);

  let titleBase = "Constitution Explorer";
  try {
    if (slugs.length > 0) {
      const primary = await getConstitutionWithArticles(slugs[0]);
      if (primary) {
        titleBase =
          slugs.length > 1
            ? `${primary.name} constitution, compared`
            : `${primary.name} constitution`;
      }
    }
  } catch {
    /* ignore — fall back to generic title */
  }

  const title = `${titleBase} | Civica`;
  const canonical =
    slugs.length > 0
      ? `https://civicaatlas.org/constitution?${slugs
          .map((s) => `c=${encodeURIComponent(s)}`)
          .join("&")}`
      : "https://civicaatlas.org/constitution";

  return {
    title,
    description:
      "Read national constitutions in full and compare, topic by topic, how different countries handle the same constitutional question. Text from the Constitute Project.",
    alternates: { canonical },
    openGraph: withOg({
      title,
      description:
        "Read and compare the world's constitutions, topic by topic.",
      url: canonical,
    }),
  };
}

export default async function ConstitutionPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const requestedSlugs = parseCountrySlugs(sp?.c, MAX_SLUGS);

  // Indexed countries + taxonomy are needed in every state.
  const [indexedCountries, constituteSource] = await Promise.all([
    getIndexedConstitutionCountries(),
    getSource("constitute_project").catch(() => null),
  ]);
  const taxonomy = getTopicTaxonomy();
  const sourceRetrievedAt = constituteSource?.lastSyncAt
    ? constituteSource.lastSyncAt.toISOString()
    : null;

  const indexedSet = new Set(indexedCountries.map((c) => c.slug));

  // Featured topics for the landing (label-resolved, coverage-checked keys).
  const featuredTopics = FEATURED_TOPIC_KEYS.map((key) => {
    const leaf = taxonomy.leaves.find((l) => l.key === key);
    return leaf ? { key: leaf.key, label: leaf.label } : null;
  }).filter((t): t is { key: string; label: string } => t != null);

  const defaultLandingSlug = indexedSet.has("united-states")
    ? "united-states"
    : indexedCountries[0]?.slug ?? "";

  // ── Landing state — no country selected ──────────────────────────────
  if (requestedSlugs.length === 0) {
    return (
      <EditorialPage width="full">
        <header className="constitution-page-header">
          <div className="constitution-page-eyebrow">Constitutions</div>
          <h1 className="editorial-page-title">
            Read and compare the world&apos;s constitutions.
          </h1>
        </header>
        <ConstitutionLanding
          countries={indexedCountries}
          featuredTopics={featuredTopics}
          defaultSlug={defaultLandingSlug}
        />
        <ConstitutionFooter />
      </EditorialPage>
    );
  }

  // Keep only indexed slugs, preserving order; the first indexed one is primary.
  const selectedSlugs = requestedSlugs.filter((s) => indexedSet.has(s));
  const unindexedSelected = requestedSlugs.filter((s) => !indexedSet.has(s));

  // ── Edge: every requested country lacks an ingested constitution ─────
  if (selectedSlugs.length === 0) {
    return (
      <EditorialPage width="full">
        <header className="constitution-page-header">
          <div className="constitution-page-eyebrow">Constitutions</div>
          <h1 className="editorial-page-title">No constitution on file</h1>
        </header>
        <div className="constitution-empty-state">
          <p>
            {unindexedSelected.length === 1
              ? "We don't yet have a full-text constitution for that country."
              : "We don't yet have full-text constitutions for the countries you selected."}{" "}
            Civica indexes {indexedCountries.length} of the world&apos;s
            constitutions, drawn from the Constitute Project.
          </p>
          <Link href="/constitution" className="btn btn--secondary">
            Browse indexed constitutions
          </Link>
        </div>
        <ConstitutionFooter />
      </EditorialPage>
    );
  }

  // Fetch the primary constitution (the first indexed selection).
  const primaryConstitution = await getConstitutionWithArticles(
    selectedSlugs[0],
  );

  if (!primaryConstitution) {
    // Defensive: indexed set said yes but the row failed to load.
    return (
      <EditorialPage width="full">
        <header className="constitution-page-header">
          <div className="constitution-page-eyebrow">Constitutions</div>
          <h1 className="editorial-page-title">Constitution unavailable</h1>
        </header>
        <div className="constitution-empty-state">
          <p>
            That constitution couldn&apos;t be loaded right now. Please try
            again.
          </p>
          <Link href="/constitution" className="btn btn--secondary">
            Browse indexed constitutions
          </Link>
        </div>
        <ConstitutionFooter />
      </EditorialPage>
    );
  }

  return (
    <EditorialPage width="full">
      <header className="constitution-page-header">
        <div className="constitution-page-eyebrow">Constitution Explorer</div>
        <h1 className="editorial-page-title">
          {primaryConstitution.name}
          <span className="constitution-page-title-sub">
            {selectedSlugs.length > 1
              ? ` · compared with ${selectedSlugs
                  .slice(1)
                  .map(
                    (s) =>
                      indexedCountries.find((c) => c.slug === s)?.name ?? s,
                  )
                  .join(", ")}`
              : ""}
          </span>
        </h1>
      </header>

      <ConstitutionExplorerShell
        indexedCountries={indexedCountries}
        selectedSlugs={selectedSlugs}
        primaryConstitution={primaryConstitution}
        sourceRetrievedAt={sourceRetrievedAt}
        categories={taxonomy.categories}
        leaves={taxonomy.leaves}
        maxSlugs={MAX_SLUGS}
      />

      <ConstitutionFooter />
    </EditorialPage>
  );
}

function ConstitutionFooter() {
  return (
    <footer className="constitution-page-footer">
      <span>
        Constitutional text from the{" "}
        <a
          href="https://www.constituteproject.org/"
          target="_blank"
          rel="noopener noreferrer"
        >
          Constitute Project
        </a>{" "}
        (Elkins, Ginsburg &amp; Melton), licensed CC BY-NC 3.0.
      </span>
      <Link href="/compare">Compare countries →</Link>
    </footer>
  );
}
