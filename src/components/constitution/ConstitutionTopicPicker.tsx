"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import type { TopicCategory, TopicLeaf } from "@/lib/constitute/topics";

interface ConstitutionTopicPickerProps {
  categories: TopicCategory[];
  leaves: TopicLeaf[];
  /** Currently selected topic key, or null. */
  selectedKey: string | null;
  onSelect: (key: string) => void;
}

/**
 * Searchable, category-grouped picker over the 414 Constitute topics. Typing
 * filters across labels + descriptions; the grouped list is virtualized only
 * by collapse (categories are closed by default until searched/expanded) so a
 * 414-row list doesn't dump into the pane at once.
 */
export function ConstitutionTopicPicker({
  categories,
  leaves,
  selectedKey,
  onSelect,
}: ConstitutionTopicPickerProps) {
  const [query, setQuery] = useState("");
  const [openCats, setOpenCats] = useState<Set<string>>(() => new Set());

  const q = query.trim().toLowerCase();

  const leavesByCategory = useMemo(() => {
    const m = new Map<string, TopicLeaf[]>();
    const seenPerCat = new Map<string, Set<string>>();
    for (const leaf of leaves) {
      // A topic key can be listed more than once under the same category in
      // the taxonomy (e.g. `intrght`); collapse those so the category list
      // shows each topic once and React keys stay unique.
      let seen = seenPerCat.get(leaf.categoryKey);
      if (!seen) {
        seen = new Set<string>();
        seenPerCat.set(leaf.categoryKey, seen);
      }
      if (seen.has(leaf.key)) continue;
      seen.add(leaf.key);
      const arr = m.get(leaf.categoryKey) ?? [];
      arr.push(leaf);
      m.set(leaf.categoryKey, arr);
    }
    return m;
  }, [leaves]);

  const filtered = useMemo(() => {
    if (!q) return null;
    // Topic keys can appear under multiple categories in the taxonomy, so a
    // flat search would list the same topic several times (and collide on the
    // React key). De-dupe by topic key — the search is topic-level, not
    // category-level.
    const seen = new Set<string>();
    const out: TopicLeaf[] = [];
    for (const leaf of leaves) {
      if (seen.has(leaf.key)) continue;
      if (
        leaf.label.toLowerCase().includes(q) ||
        leaf.description.toLowerCase().includes(q) ||
        leaf.key.toLowerCase().includes(q)
      ) {
        seen.add(leaf.key);
        out.push(leaf);
        if (out.length >= 60) break;
      }
    }
    return out;
  }, [leaves, q]);

  const toggleCat = (key: string) =>
    setOpenCats((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <div className="constitution-topic-picker">
      <div className="constitution-topic-search">
        <Search aria-hidden className="constitution-topic-search-icon" />
        <input
          type="search"
          value={query}
          placeholder="Search 414 topics…"
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search constitution topics"
          autoComplete="off"
        />
      </div>

      {filtered ? (
        <ul className="constitution-topic-results" role="listbox">
          {filtered.length === 0 ? (
            <li className="constitution-topic-empty">
              No topics match “{query}”.
            </li>
          ) : (
            filtered.map((leaf) => (
              <li key={leaf.key}>
                <button
                  type="button"
                  role="option"
                  aria-selected={leaf.key === selectedKey}
                  className={`constitution-topic-option${
                    leaf.key === selectedKey ? " is-selected" : ""
                  }`}
                  onClick={() => onSelect(leaf.key)}
                >
                  {leaf.label}
                </button>
              </li>
            ))
          )}
        </ul>
      ) : (
        <ul className="constitution-topic-categories">
          {categories.map((cat) => {
            const catLeaves = leavesByCategory.get(cat.key) ?? [];
            if (catLeaves.length === 0) return null;
            const open = openCats.has(cat.key);
            return (
              <li key={cat.key} className="constitution-topic-category">
                <button
                  type="button"
                  className="constitution-topic-category-head"
                  aria-expanded={open}
                  onClick={() => toggleCat(cat.key)}
                >
                  <span>{cat.label}</span>
                  <span className="constitution-topic-category-count">
                    {catLeaves.length}
                  </span>
                </button>
                {open ? (
                  <ul className="constitution-topic-category-list">
                    {catLeaves.map((leaf) => (
                      <li key={leaf.key}>
                        <button
                          type="button"
                          className={`constitution-topic-option${
                            leaf.key === selectedKey ? " is-selected" : ""
                          }`}
                          onClick={() => onSelect(leaf.key)}
                        >
                          {leaf.label}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
