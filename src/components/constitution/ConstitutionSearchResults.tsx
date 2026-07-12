import { Banner } from "@/components/editorial/Banner";
import Link from "next/link";
import type {
  ConstitutionSearchErrorResponse,
  ConstitutionSearchResponse,
} from "@/lib/constitution/search-contract";
import { ConstitutionPassageCard } from "./ConstitutionPassageCard";

interface ConstitutionSearchResultsProps {
  response?: ConstitutionSearchResponse | null;
  error?: ConstitutionSearchErrorResponse | null;
}

export function ConstitutionSearchResults({
  response = null,
  error = null,
}: ConstitutionSearchResultsProps) {
  if (error) {
    return (
      <div role="alert">
        <Banner variant="danger">
          <strong>Constitution search is unavailable.</strong> {error.message}
        </Banner>
      </div>
    );
  }

  if (!response) return null;

  const nextHref = (() => {
    if (!response.pagination.hasMore || !response.pagination.nextCursor) {
      return null;
    }
    const params = new URLSearchParams({ q: response.query.raw });
    for (const jurisdiction of response.filters.jurisdictions) {
      params.append("jurisdiction", jurisdiction);
    }
    for (const topic of response.filters.topics) params.append("topic", topic);
    params.set("cursor", response.pagination.nextCursor);
    return `/constitution/search?${params.toString()}`;
  })();

  if (response.state === "no_results") {
    return (
      <section className="constitution-search-results" aria-labelledby="constitution-search-results-title">
        <div className="constitution-search-results__summary" role="status" aria-live="polite">
          <h2 id="constitution-search-results-title">No passages found</h2>
          <p>
            No indexed passage matched “{response.query.raw}”. Try broader terms
            or remove a filter.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="constitution-search-results" aria-labelledby="constitution-search-results-title">
      <div className="constitution-search-results__summary" role="status" aria-live="polite">
        <h2 id="constitution-search-results-title">
          Passages matching “{response.query.raw}”
        </h2>
        <p>
          Showing {response.data.length} passage
          {response.data.length === 1 ? "" : "s"}
          {response.pagination.hasMore ? " in this result set" : ""}.
        </p>
      </div>

      <div className="constitution-search-results__list">
        {response.data.map((result) => (
          <ConstitutionPassageCard key={result.passageId} result={result} />
        ))}
      </div>

      {nextHref ? (
        <nav className="editorial-pagination" aria-label="Constitution search results">
          <span />
          <Link className="btn btn--secondary" href={nextHref} rel="next">
            Next results <span className="btn__arrow" aria-hidden>→</span>
          </Link>
        </nav>
      ) : null}
    </section>
  );
}
