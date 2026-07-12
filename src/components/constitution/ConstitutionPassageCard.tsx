import Link from "next/link";
import { CountryFlag } from "@/components/CountryFlag";
import { SourceDot } from "@/components/SourceDot";
import { Chip } from "@/components/editorial/Pill";
import { getTopicLabel } from "@/lib/constitute/topics";
import type { ConstitutionSearchResult } from "@/lib/constitution/search-contract";

function constitutionYear(result: ConstitutionSearchResult): string | null {
  if (result.constitution.documentNature === "publisher-composite-collection") {
    const from = result.constitution.year;
    const to = result.constitution.yearUpdated;
    return from && to
      ? `Constitute composite collection · texts dated ${from}–${to}`
      : "Constitute composite collection";
  }
  return result.constitution.dateLabel || null;
}

export function ConstitutionPassageCard({
  result,
}: {
  result: ConstitutionSearchResult;
}) {
  const headingId = `constitution-passage-${result.passageId.replace(/[^a-zA-Z0-9_-]+/g, "-")}`;
  const year = constitutionYear(result);

  return (
    <article className="constitution-search-result" aria-labelledby={headingId}>
      <header className="constitution-search-result__header">
        <span className="constitution-search-result__flag" aria-hidden>
          <CountryFlag iso2={result.jurisdiction.iso2} size={22} decorative />
        </span>
        <div className="constitution-search-result__identity">
          <h3 id={headingId} className="constitution-search-result__country">
            {result.jurisdiction.name}
          </h3>
          <p className="constitution-search-result__section">
            {result.passage.headingLabel ?? "Constitutional provision"}
            {year ? <span> · {year}</span> : null}
          </p>
        </div>
        {result.jurisdiction.disputed ? (
          <Chip variant="sand">Disputed jurisdiction</Chip>
        ) : null}
      </header>

      {result.passage.topicKeys.length > 0 ? (
        <div className="constitution-search-result__topics" aria-label="Topics">
          {result.passage.topicKeys.slice(0, 4).map((topic) => (
            <Chip key={topic}>{getTopicLabel(topic)}</Chip>
          ))}
        </div>
      ) : null}

      <blockquote className="constitution-search-result__excerpt">
        {result.passage.highlightSegments.map((segment, index) =>
          segment.highlighted ? (
            <mark key={`${result.passageId}-${index}`}>{segment.text}</mark>
          ) : (
            <span key={`${result.passageId}-${index}`}>{segment.text}</span>
          ),
        )}
      </blockquote>

      <div className="constitution-search-result__context">
        <span>
          English text supplied by Constitute; original language and translation
          status are not verified.
        </span>
        <span className="constitution-search-result__source">
          <SourceDot
            source={result.provenance.sourceId}
            retrievedAt={result.provenance.retrievedAt}
          />
          <a href={result.provenance.sourceUrl} target="_blank" rel="noreferrer">
            {result.provenance.sourceName}
          </a>
          <a href={result.provenance.termsUrl} target="_blank" rel="noreferrer">
            {result.provenance.licenseId}
          </a>
        </span>
      </div>

      <footer className="constitution-search-result__actions">
        <Link className="btn btn--primary btn--sm" href={result.readerUrl}>
          Open passage <span className="btn__arrow" aria-hidden>→</span>
        </Link>
        <Link className="btn btn--text btn--sm" href={result.citationUrl}>
          Cite passage
        </Link>
      </footer>
    </article>
  );
}
