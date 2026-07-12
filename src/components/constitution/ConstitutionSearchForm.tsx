import { Search } from "lucide-react";
import { Button } from "@/components/editorial/Button";
import { Banner } from "@/components/editorial/Banner";

interface ConstitutionSearchFormProps {
  defaultQuery?: string;
  defaultJurisdiction?: string;
  defaultTopic?: string;
  jurisdictionOptions?: ReadonlyArray<{ value: string; label: string }>;
  topicOptions?: ReadonlyArray<{ value: string; label: string }>;
  filterCatalogAvailable?: boolean;
  compact?: boolean;
}

/** URL-driven entry point for the bounded constitutional passage search. */
export function ConstitutionSearchForm({
  defaultQuery = "",
  defaultJurisdiction = "",
  defaultTopic = "",
  jurisdictionOptions = [],
  topicOptions = [],
  filterCatalogAvailable = true,
  compact = false,
}: ConstitutionSearchFormProps) {
  return (
    <form
      className={`constitution-search-form${compact ? " constitution-search-form--compact" : ""}`}
      action="/constitution/search"
      method="get"
      role="search"
      aria-label="Search constitutional text"
    >
      <label className="constitution-search-form__label" htmlFor="constitution-search-query">
        Search constitutional text
      </label>
      <div className="constitution-search-form__row">
        <div className="constitution-search-form__field">
          <Search className="constitution-search-form__icon" aria-hidden />
          <input
            id="constitution-search-query"
            name="q"
            type="search"
            defaultValue={defaultQuery}
            minLength={2}
            maxLength={256}
            required
            autoComplete="off"
            enterKeyHint="search"
            placeholder="Search rights, institutions, offices, or powers…"
          />
        </div>
        <Button type="submit" arrow>
          Search passages
        </Button>
      </div>
      {jurisdictionOptions.length > 0 || topicOptions.length > 0 ? (
        <div className="constitution-search-form__filters">
          {jurisdictionOptions.length > 0 ? (
            <label className="constitution-search-form__filter">
              <span>Jurisdiction</span>
              <input
                name="jurisdiction"
                defaultValue={defaultJurisdiction}
                list="constitution-search-jurisdictions"
                placeholder="All jurisdictions"
                autoComplete="off"
              />
              <datalist id="constitution-search-jurisdictions">
                {jurisdictionOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </datalist>
            </label>
          ) : null}
          {topicOptions.length > 0 ? (
            <label className="constitution-search-form__filter">
              <span>Topic</span>
              <input
                name="topic"
                defaultValue={defaultTopic}
                list="constitution-search-topics"
                placeholder="All topics"
                autoComplete="off"
              />
              <datalist id="constitution-search-topics">
                {topicOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </datalist>
            </label>
          ) : null}
        </div>
      ) : null}
      {!filterCatalogAvailable ? (
        <div role="status">
          <Banner variant="warn" className="constitution-search-form__catalog-warning">
            Filter catalog unavailable; text search still works.
          </Banner>
        </div>
      ) : null}
      {!compact ? (
        <p className="constitution-search-form__hint">
          Use plain terms for English lexical matching; put words in quotation
          marks to search an exact phrase. Search the English-language texts
          supplied by the Constitute Project. Translation status is not yet
          verified.
          {jurisdictionOptions.length > 0 || topicOptions.length > 0
            ? " The page accepts one jurisdiction and one topic filter per search."
            : ""}
        </p>
      ) : null}
    </form>
  );
}
