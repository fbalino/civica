import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { EditorialPage } from "@/components/editorial/EditorialPage";
import { ConstitutionSearchForm } from "@/components/constitution/ConstitutionSearchForm";
import { ConstitutionSearchResults } from "@/components/constitution/ConstitutionSearchResults";
import { getTopicTaxonomy } from "@/lib/constitute/topics";
import {
  ConstitutionSearchQueryError,
  searchConstitutionPassages,
} from "@/lib/db/queries-constitution-search";
import { getIndexedConstitutionCountries } from "@/lib/db/queries-constitution";
import {
  CONSTITUTION_SEARCH_DEFAULT_LIMIT,
  CONSTITUTION_SEARCH_SCHEMA_VERSION,
  type ConstitutionSearchErrorResponse,
  type ConstitutionSearchInput,
  type ConstitutionSearchResponse,
} from "@/lib/constitution/search-contract";
import { withOg } from "@/lib/og";
import { getRequestIp } from "@/lib/api/request-ip";

export const metadata: Metadata = {
  title: "Search constitutional text",
  description:
    "Search passage-level constitutional text across Civica Atlas, with stable links, source attribution, and language context.",
  robots: { index: false, follow: true },
  openGraph: withOg({
    title: "Search constitutional text · Civica Atlas",
    description:
      "Search national constitutions passage by passage with source attribution.",
    url: "https://civicaatlas.org/constitution/search",
  }),
};

type SearchParams = Record<string, string | string[] | undefined>;

function values(value: string | string[] | undefined): string[] {
  const source = Array.isArray(value) ? value : value ? [value] : [];
  return source.map((item) => item.trim()).filter(Boolean);
}

export default async function ConstitutionSearchPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const query = values(params.q)[0] ?? "";
  const jurisdictions = values(params.jurisdiction);
  const topics = values(params.topic);
  const cursor = values(params.cursor)[0] ?? null;

  const input: ConstitutionSearchInput = {
    query,
    jurisdictions,
    topics,
    language: "en",
    limit: CONSTITUTION_SEARCH_DEFAULT_LIMIT,
    cursor,
  };

  const catalogPromise = getIndexedConstitutionCountries({ throwOnError: true })
    .then((countries) => ({ available: true as const, countries }))
    .catch(() => ({ available: false as const, countries: [] }));
  let response: ConstitutionSearchResponse | null = null;
  let error: ConstitutionSearchErrorResponse | null = null;

  if (query) {
    const requestHeaders = await headers();
    const request = new Request("https://civicaatlas.org/constitution/search", {
      headers: requestHeaders,
    });
    try {
      response = await searchConstitutionPassages(input, {
        scope: "constitution-search",
        key: getRequestIp(request),
        limit: 30,
        windowMs: 60_000,
      });
    } catch (caught) {
      const known =
        caught instanceof ConstitutionSearchQueryError ? caught : null;
      error = {
        schemaVersion: CONSTITUTION_SEARCH_SCHEMA_VERSION,
        error: known?.code ?? "data_unavailable",
        message:
          known?.message ??
          "The constitution search index could not be reached. Please try again later.",
      };
    }
  }

  const catalog = await catalogPromise;
  const countries = catalog.countries;
  const jurisdictionOptions = [...countries]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((country) => ({ value: country.slug, label: country.name }));
  const taxonomy = getTopicTaxonomy();
  const topicOptions = Array.from(
    new Map(
      taxonomy.leaves.map((topic) => [
        topic.key,
        { value: topic.key, label: topic.label },
      ]),
    ).values(),
  ).sort((a, b) => a.label.localeCompare(b.label));

  return (
    <EditorialPage width="reference">
      <header className="constitution-search-page-header">
        <nav className="editorial-breadcrumbs" aria-label="Breadcrumb">
          <Link href="/constitution">Constitutions</Link>
          <span aria-hidden>›</span>
          <span>Search</span>
        </nav>
        <div className="constitution-page-eyebrow">Constitution research</div>
        <h1 className="editorial-page-title">Search constitutional text</h1>
        <p className="editorial-page-subtitle">
          Find provisions across the indexed constitutional corpus, then open
          the exact passage or cite its source trail.
        </p>
        <ConstitutionSearchForm
          defaultQuery={query}
          defaultJurisdiction={jurisdictions[0] ?? ""}
          defaultTopic={topics[0] ?? ""}
          jurisdictionOptions={jurisdictionOptions}
          topicOptions={topicOptions}
          filterCatalogAvailable={catalog.available}
        />
      </header>

      <ConstitutionSearchResults response={response} error={error} />
    </EditorialPage>
  );
}
