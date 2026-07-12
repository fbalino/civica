"use client";

import { useCallback, useState } from "react";
import { ConstitutionReadingColumn } from "./ConstitutionReadingColumn";
import { ConstitutionCrossReferencePane } from "./ConstitutionCrossReferencePane";
import type { ConstitutionDetail } from "@/lib/db/queries-constitution";
import type { TopicCategory, TopicLeaf } from "@/lib/constitute/topics";

interface ConstitutionExplorerShellProps {
  selectedSlugs: string[];
  primaryConstitution: ConstitutionDetail;
  sourceRetrievedAt: string | null;
  categories: TopicCategory[];
  leaves: TopicLeaf[];
  /**
   * A topic to preselect in the cross-reference pane on mount (from the page's
   * validated `?topic=` param — e.g. a landing "Explore by topic" chip).
   */
  initialTopic?: string | null;
}

/**
 * Client coordinator for the explorer's two panes — the reading column (which
 * carries its own OUTLINE nav, so the page reads as three zones: outline ·
 * reading · compare) and the cross-reference pane. Country management lives in
 * the page header (`ConstitutionCountryBar`), not here.
 *
 * Owns the one piece of shared client state — the topic keys of the article
 * currently in view — so the reading column can feed one-click topic chips to
 * the cross-reference pane. Everything else is prop-driven from the server page.
 */
export function ConstitutionExplorerShell({
  selectedSlugs,
  primaryConstitution,
  sourceRetrievedAt,
  categories,
  leaves,
  initialTopic = null,
}: ConstitutionExplorerShellProps) {
  const [activeArticleTopics, setActiveArticleTopics] = useState<string[]>([]);

  const handleActiveTopics = useCallback((topics: string[]) => {
    setActiveArticleTopics(topics);
  }, []);

  const hasPeers = selectedSlugs.length > 1;

  return (
    <div className="constitution-explorer">
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
          initialTopic={initialTopic}
          sourceRetrievedAt={sourceRetrievedAt}
        />
      </div>
    </div>
  );
}
