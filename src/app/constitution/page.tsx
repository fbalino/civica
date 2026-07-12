import type { Metadata } from "next";
import Link from "next/link";
import { EditorialPage } from "@/components/editorial/EditorialPage";
import { withOg } from "@/lib/og";
import { parseCountrySlugs, DEFAULT_MAX_SLUGS } from "@/lib/constitution/slugs";
import {
  getConstitutionWithArticles,
  getIndexedConstitutionCountries,
} from "@/lib/db/queries-constitution";
import { getTopicTaxonomy, isKnownTopic } from "@/lib/constitute/topics";
import { getSource } from "@/lib/db/queries";
import { ConstitutionExplorerShell } from "@/components/constitution/ConstitutionExplorerShell";
import { ConstitutionCountryBar } from "@/components/constitution/ConstitutionCountryBar";
import { ConstitutionLanding } from "@/components/constitution/ConstitutionLanding";
import { ConstitutionHero } from "@/components/constitution/ConstitutionHero";

export const revalidate = 3600;

const MAX_SLUGS = DEFAULT_MAX_SLUGS;

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

  const canonical =
    slugs.length > 0
      ? `https://civicaatlas.org/constitution?${slugs
          .map((s) => `c=${encodeURIComponent(s)}`)
          .join("&")}`
      : "https://civicaatlas.org/constitution";

  return {
    title: titleBase,
    description:
      "Read national constitutions in full and compare, topic by topic, how different countries handle the same constitutional question. Text from the Constitute Project.",
    alternates: { canonical },
    openGraph: withOg({
      title: `${titleBase} · Civica Atlas`,
      description:
        "Read and compare the world's constitutions in full, topic by topic.",
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

  // `?topic=<key>` preselects the cross-reference pane's topic (e.g. from a
  // landing "Explore by topic" chip). Passed as a server prop so it's in the
  // SSR HTML; validated so a bogus key is simply ignored.
  const rawTopic = Array.isArray(sp?.topic) ? sp.topic[0] : sp?.topic;
  const initialTopic =
    typeof rawTopic === "string" && isKnownTopic(rawTopic) ? rawTopic : null;

  // Indexed countries + taxonomy are needed in every state. Sorted
  // ALPHABETICALLY by name here so every country list on the page (the header
  // add-popover, the landing picker) reads in a predictable order — the old
  // population ordering read as random.
  const [indexedCountriesResult, constituteSourceResult] =
    await Promise.allSettled([
      getIndexedConstitutionCountries({ throwOnError: true }),
      getSource("constitute_project"),
    ]);
  const catalogAvailable = indexedCountriesResult.status === "fulfilled";
  const indexedCountriesRaw =
    indexedCountriesResult.status === "fulfilled"
      ? indexedCountriesResult.value
      : [];
  const constituteSource =
    constituteSourceResult.status === "fulfilled"
      ? constituteSourceResult.value
      : null;
  const indexedCountries = [...indexedCountriesRaw].sort((a, b) =>
    a.name.localeCompare(b.name),
  );
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
    // Typeahead options for the hero search (routes to /constitution?c=<slug>).
    const searchOptions = indexedCountries.map((c) => ({
      slug: c.slug,
      name: c.name,
      iso2: c.iso2,
      iso3: c.iso3,
    }));
    return (
      <>
        <ConstitutionHero countries={searchOptions} />
        <EditorialPage width="reference">
          <ConstitutionLanding
            countries={indexedCountries}
            featuredTopics={featuredTopics}
            defaultSlug={defaultLandingSlug}
            catalogAvailable={catalogAvailable}
          />
          <ConstitutionFooter />
        </EditorialPage>
      </>
    );
  }

  if (!catalogAvailable) {
    return (
      <EditorialPage width="reference">
        <header className="constitution-page-header">
          <div className="constitution-page-eyebrow">Constitutions</div>
          <h1 className="editorial-page-title">
            Constitution catalog unavailable
          </h1>
        </header>
        <div className="constitution-empty-state">
          <p>
            The indexed constitution catalog could not be loaded. Please try
            again later.
          </p>
          <Link href="/constitution" className="btn btn--secondary">
            Return to Constitution Explorer
          </Link>
        </div>
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
      <EditorialPage width="reference">
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
      <EditorialPage width="reference">
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
    <EditorialPage width="reference">
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
        {/* Country management moved out of a dedicated pane into the header:
            one chip per selected country (first = "Reading") + an add-popover. */}
        <ConstitutionCountryBar
          countries={indexedCountries}
          selectedSlugs={selectedSlugs}
          maxSlugs={MAX_SLUGS}
        />
      </header>

      <ConstitutionExplorerShell
        selectedSlugs={selectedSlugs}
        primaryConstitution={primaryConstitution}
        sourceRetrievedAt={sourceRetrievedAt}
        categories={taxonomy.categories}
        leaves={taxonomy.leaves}
        initialTopic={initialTopic}
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
