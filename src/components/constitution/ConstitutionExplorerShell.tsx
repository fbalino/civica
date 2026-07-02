"use client";

import { useCallback, useState } from "react";
import { ConstitutionCountryPicker } from "./ConstitutionCountryPicker";
import { ConstitutionReadingColumn } from "./ConstitutionReadingColumn";
import { ConstitutionCrossReferencePane } from "./ConstitutionCrossReferencePane";
import type {
  ConstitutionDetail,
  IndexedConstitutionCountry,
} from "@/lib/db/queries-constitution";
import type { TopicCategory, TopicLeaf } from "@/lib/constitute/topics";

interface ConstitutionExplorerShellProps {
  indexedCountries: IndexedConstitutionCountry[];
  selectedSlugs: string[];
  primaryConstitution: ConstitutionDetail;
  sourceRetrievedAt: string | null;
  categories: TopicCategory[];
  leaves: TopicLeaf[];
  maxSlugs: number;
}

/**
 * Client coordinator for the 3-pane explorer. Owns the one piece of shared
 * client state — the topic keys of the article currently in view — so the
 * reading column (middle) can feed one-click topic chips to the cross-
 * reference pane (right). Everything else is prop-driven from the server page.
 */
export function ConstitutionExplorerShell({
  indexedCountries,
  selectedSlugs,
  primaryConstitution,
  sourceRetrievedAt,
  categories,
  leaves,
  maxSlugs,
}: ConstitutionExplorerShellProps) {
  const [activeArticleTopics, setActiveArticleTopics] = useState<string[]>([]);

  const handleActiveTopics = useCallback((topics: string[]) => {
    setActiveArticleTopics(topics);
  }, []);

  const hasPeers = selectedSlugs.length > 1;

  return (
    <div className="constitution-explorer">
      <div className="constitution-explorer-left">
        <ConstitutionCountryPicker
          countries={indexedCountries}
          selectedSlugs={selectedSlugs}
          maxSlugs={maxSlugs}
        />
      </div>

      <div className="constitution-explorer-middle">
        <ConstitutionReadingColumn
          constitution={primaryConstitution}
          sourceRetrievedAt={sourceRetrievedAt}
          onActiveTopicsChange={handleActiveTopics}
        />
      </div>

      <div className="constitution-explorer-right">
        <ConstitutionCrossReferencePane
          categories={categories}
          leaves={leaves}
          slugs={selectedSlugs}
          primary={{
            slug: primaryConstitution.slug,
            name: primaryConstitution.name,
          }}
          activeArticleTopics={activeArticleTopics}
          hasPeers={hasPeers}
        />
      </div>
    </div>
  );
}
