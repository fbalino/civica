"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CountryFlag } from "@/components/CountryFlag";
import { getTopicLabel } from "@/lib/constitute/topics";
import { sanitizeConstitutionHtml } from "@/lib/constitution/sanitize-html";
import type { TopicExcerptCountry } from "@/lib/db/queries-constitution";
import { ConstitutionTopicPicker } from "./ConstitutionTopicPicker";
import type { TopicCategory, TopicLeaf } from "@/lib/constitute/topics";

interface ConstitutionCrossReferencePaneProps {
  categories: TopicCategory[];
  leaves: TopicLeaf[];
  /** All selected slugs, in order (primary first, then peers). */
  slugs: string[];
  /** Primary country (the one being read). */
  primary: { slug: string; name: string };
  /** Topic keys of the section currently in view (for one-click chips). */
  activeArticleTopics: string[];
  /** Whether the reader has peers to compare (slugs.length > 1). */
  hasPeers: boolean;
  /**
   * A topic to preselect on mount (from `?topic=` — e.g. a landing "Explore by
   * topic" chip). Already validated against the taxonomy by the caller.
   */
  initialTopic?: string | null;
}

/**
 * The flagship right pane: pick a constitutional topic and see how each
 * selected country (or, with only one selected, a few notable peers) treats it.
 * Excerpts come from our own indexed `constitution_topic_excerpts` via the
 * `/api/constitution/excerpts` route — never a live Constitute call.
 */
export function ConstitutionCrossReferencePane({
  categories,
  leaves,
  slugs,
  primary,
  activeArticleTopics,
  hasPeers,
  initialTopic = null,
}: ConstitutionCrossReferencePaneProps) {
  // Seed from `?topic=` so a landing "Explore by topic" chip lands directly on
  // the chosen topic. Lazy initializer so it applies on first render (SSR +
  // hydration) rather than after an effect.
  const [selectedTopic, setSelectedTopic] = useState<string | null>(
    () => initialTopic,
  );
  const [countries, setCountries] = useState<TopicExcerptCountry[]>([]);
  const [notable, setNotable] = useState<TopicExcerptCountry[]>([]);
  const [loading, setLoading] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  // Fetch excerpts whenever the topic or the peer set changes.
  //
  // Race guard: rapid topic switching (e.g. clicking chips) fires overlapping
  // requests. Without a guard, a slow response for an *older* topic can resolve
  // after a newer one and overwrite the pane with stale content. `signal`
  // aborts the superseded request's fetch; `isCurrent()` is a belt-and-braces
  // generation check so even a response that lands between abort and the next
  // effect run can't commit stale state.
  const fetchExcerpts = useCallback(
    async (
      topic: string,
      currentSlugs: string[],
      signal: AbortSignal,
      isCurrent: () => boolean,
    ) => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        params.set("topic", topic);
        for (const s of currentSlugs) params.append("c", s);
        const res = await fetch(
          `/api/constitution/excerpts?${params.toString()}`,
          { signal },
        );
        if (!res.ok) {
          if (isCurrent()) {
            setCountries([]);
            setNotable([]);
          }
          return;
        }
        const data = (await res.json()) as {
          countries: TopicExcerptCountry[];
        };
        if (!isCurrent()) return;
        setCountries(data.countries ?? []);

        // When only the primary is selected, ALSO fetch notable peers so the
        // pane shows comparisons rather than a single passage.
        if (currentSlugs.length <= 1) {
          const notableRes = await fetch(
            `/api/constitution/excerpts/notable?topic=${encodeURIComponent(
              topic,
            )}&exclude=${encodeURIComponent(currentSlugs[0] ?? "")}`,
            { signal },
          );
          if (notableRes.ok) {
            const nd = (await notableRes.json()) as {
              countries: TopicExcerptCountry[];
            };
            if (isCurrent()) setNotable(nd.countries ?? []);
          } else if (isCurrent()) {
            setNotable([]);
          }
        } else if (isCurrent()) {
          setNotable([]);
        }
      } catch (err) {
        // An aborted fetch throws AbortError — that's expected on supersession,
        // so leave state untouched; only surface real failures.
        if ((err as { name?: string })?.name === "AbortError") return;
        if (isCurrent()) {
          setCountries([]);
          setNotable([]);
        }
      } finally {
        if (isCurrent()) setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (!selectedTopic) {
      setCountries([]);
      setNotable([]);
      return;
    }
    const controller = new AbortController();
    let active = true;
    void fetchExcerpts(
      selectedTopic,
      slugs,
      controller.signal,
      () => active,
    );
    return () => {
      active = false;
      controller.abort();
    };
  }, [selectedTopic, slugs, fetchExcerpts]);

  const selectTopic = (key: string) => {
    setSelectedTopic(key);
    setPickerOpen(false);
  };

  // De-dupe active-article topic chips and keep them readable.
  const activeChips = Array.from(new Set(activeArticleTopics)).slice(0, 8);

  return (
    <aside className="constitution-xref" aria-label="Cross-reference by topic">
      <div className="constitution-xref-head">
        <h2 className="constitution-xref-title">Compare by topic</h2>
        <p className="constitution-xref-sub">
          Pick a constitutional topic to see how {hasPeers ? "your selected countries" : "other constitutions"} address it.
        </p>
      </div>

      {/* One-click chips for the topics of the article currently in view. */}
      {activeChips.length > 0 ? (
        <div className="constitution-xref-active">
          <div className="constitution-xref-active-label">
            In this article
          </div>
          <div className="constitution-xref-chips">
            {activeChips.map((key) => (
              <button
                key={key}
                type="button"
                className={`constitution-topic-chip${
                  key === selectedTopic ? " is-active" : ""
                }`}
                onClick={() => selectTopic(key)}
              >
                {getTopicLabel(key)}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {/* The topic selector. Collapsed to a trigger once a topic is chosen. */}
      <div className="constitution-xref-picker">
        {selectedTopic && !pickerOpen ? (
          <div className="constitution-xref-selected">
            <span className="constitution-xref-selected-label">Topic</span>
            <span className="constitution-xref-selected-value">
              {getTopicLabel(selectedTopic)}
            </span>
            <button
              type="button"
              className="constitution-xref-change"
              onClick={() => setPickerOpen(true)}
            >
              Change
            </button>
          </div>
        ) : (
          <ConstitutionTopicPicker
            categories={categories}
            leaves={leaves}
            selectedKey={selectedTopic}
            onSelect={selectTopic}
          />
        )}
      </div>

      {/* Results. */}
      {selectedTopic ? (
        <div className="constitution-xref-results">
          {loading ? (
            <div className="constitution-xref-loading">
              <div className="skeleton" style={{ height: 96 }} />
              <div className="skeleton" style={{ height: 96 }} />
            </div>
          ) : (
            <>
              {slugs.map((slug) => {
                const entry = countries.find((c) => c.slug === slug);
                if (entry) {
                  return (
                    <ExcerptCard key={slug} entry={entry} isPrimary={slug === primary.slug} />
                  );
                }
                // Country selected but no excerpt for this topic.
                return (
                  <div key={slug} className="constitution-xref-card constitution-xref-card--empty">
                    <div className="constitution-xref-card-head">
                      <span className="constitution-xref-card-country">{slug}</span>
                    </div>
                    <p className="constitution-xref-empty-note">
                      No provision tagged with this topic in this constitution.
                    </p>
                  </div>
                );
              })}

              {/* When only one country is selected, surface notable peers. */}
              {!hasPeers && notable.length > 0 ? (
                <div className="constitution-xref-notable">
                  <div className="constitution-xref-notable-label">
                    How others treat this topic
                  </div>
                  {notable.map((entry) => (
                    <ExcerptCard key={entry.slug} entry={entry} isPrimary={false} showAdd />
                  ))}
                </div>
              ) : null}

              {!hasPeers ? (
                <p className="constitution-xref-add-hint">
                  Add another country from the picker to compare passages side by side.
                </p>
              ) : null}
            </>
          )}
        </div>
      ) : (
        <div className="constitution-xref-idle">
          <p>
            Choose a topic{activeChips.length > 0 ? " above" : ""} to compare
            how each constitution handles it — from human dignity to term limits
            to emergency powers.
          </p>
        </div>
      )}
    </aside>
  );
}

function ExcerptCard({
  entry,
  isPrimary,
  showAdd,
}: {
  entry: TopicExcerptCountry;
  isPrimary: boolean;
  showAdd?: boolean;
}) {
  return (
    <div
      className={`constitution-xref-card${isPrimary ? " constitution-xref-card--primary" : ""}`}
    >
      <div className="constitution-xref-card-head">
        <span className="constitution-xref-card-flag" aria-hidden>
          <CountryFlag iso2={entry.iso2} size={18} />
        </span>
        <Link
          href={`/constitution?c=${encodeURIComponent(entry.slug)}`}
          className="constitution-xref-card-country"
        >
          {entry.name}
        </Link>
        {showAdd ? (
          <AddPeerLink slug={entry.slug} />
        ) : null}
      </div>
      <div className="constitution-xref-card-body">
        {entry.excerpts.map((ex, i) => (
          <div key={`${ex.sectionId}-${i}`} className="constitution-xref-excerpt">
            {ex.articleLabel ? (
              <div className="constitution-xref-excerpt-label">
                {ex.articleLabel}
              </div>
            ) : null}
            <div
              className="constitution-xref-excerpt-text"
              // Constitute-derived excerpt HTML, passed through the allowlist
              // sanitizer at this render seam (preserves ids/classes/data-*,
              // drops scripts/handlers) as defense-in-depth.
              dangerouslySetInnerHTML={{
                __html: sanitizeConstitutionHtml(ex.excerptHtml),
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

/** "Add to compare" link — appends the slug to the current `?c=` set. */
function AddPeerLink({ slug }: { slug: string }) {
  const [href, setHref] = useState(`/constitution?c=${encodeURIComponent(slug)}`);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const current = params.getAll("c");
    if (!current.includes(slug)) current.push(slug);
    const qs = current.map((s) => `c=${encodeURIComponent(s)}`).join("&");
    setHref(`/constitution?${qs}`);
  }, [slug]);
  return (
    <Link href={href} className="constitution-xref-add">
      + Add to compare
    </Link>
  );
}
