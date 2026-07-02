/**
 * Constitute Project topic taxonomy — typed accessor.
 *
 * The Constitute ontology tags every constitution section with one or more
 * "topics" (e.g. `lhterm` = "Term length of first chamber"). Those tags arrive
 * in the section HTML as `data-topics="…/ontology/<key>,…"`. To render a human
 * label for a tag (and to drive the cross-reference topic picker) we need the
 * taxonomy's key → label map.
 *
 * The taxonomy is fetched ONCE from `GET /service/topics?lang=en` and cached to
 * `topic-taxonomy.generated.json` (12 categories, 414 leaf topics). Regenerate
 * it with `tsx scripts/sync-constitutions.ts --regenerate-taxonomy`.
 *
 * Source: Elkins, Ginsburg & Melton, "Constitute: The World's Constitutions to
 * Read, Search, and Compare" (constituteproject.org, CC BY-NC 3.0).
 */
import taxonomy from "./topic-taxonomy.generated.json";

export interface TopicCategory {
  /** Stable ontology key, e.g. `legislature`. */
  key: string;
  /** Human label, e.g. "Legislature". */
  label: string;
  /** Constitute's category description (often empty at the category level). */
  description: string;
  /** Number of section tags across all constitutions carrying this category. */
  count: number;
}

export interface TopicLeaf {
  /** Stable ontology key, e.g. `lhterm` (this is what `data-topics` carries). */
  key: string;
  /** Human label, e.g. "Term length of first chamber". */
  label: string;
  /** Constitute's editorial description of the topic. */
  description: string;
  /** The parent category's key, e.g. `legislature`. */
  categoryKey: string;
  /** Number of section tags across all constitutions carrying this topic. */
  count: number;
}

export interface TopicTaxonomy {
  generatedAt: string;
  source: string;
  categories: TopicCategory[];
  leaves: TopicLeaf[];
}

const TAXONOMY = taxonomy as TopicTaxonomy;

// key → leaf and key → category, built once at module load for O(1) lookup.
const LEAF_BY_KEY = new Map<string, TopicLeaf>(
  TAXONOMY.leaves.map((t) => [t.key, t]),
);
const CATEGORY_BY_KEY = new Map<string, TopicCategory>(
  TAXONOMY.categories.map((c) => [c.key, c]),
);

/** The full cached taxonomy (categories + flattened leaf topics). */
export function getTopicTaxonomy(): TopicTaxonomy {
  return TAXONOMY;
}

/**
 * Human label for a topic (or category) key. Falls back to the leaf label, then
 * the category label, then a de-slugged version of the key itself so a tag that
 * ever drifts ahead of the cached taxonomy still renders something readable
 * rather than a raw ontology slug.
 */
export function getTopicLabel(key: string): string {
  const leaf = LEAF_BY_KEY.get(key);
  if (leaf) return leaf.label;
  const cat = CATEGORY_BY_KEY.get(key);
  if (cat) return cat.label;
  // Unknown key — de-slug (`some_topic_key` → "Some topic key").
  return key
    .replace(/[_-]+/g, " ")
    .replace(/^\w/, (c) => c.toUpperCase())
    .trim();
}

/** The leaf topic for a key, or null if the key isn't a known leaf. */
export function getTopicLeaf(key: string): TopicLeaf | null {
  return LEAF_BY_KEY.get(key) ?? null;
}

/** The category for a key, or null if the key isn't a known category. */
export function getTopicCategory(key: string): TopicCategory | null {
  return CATEGORY_BY_KEY.get(key) ?? null;
}

/** True when the key is a known leaf topic OR category in the taxonomy. */
export function isKnownTopic(key: string): boolean {
  return LEAF_BY_KEY.has(key) || CATEGORY_BY_KEY.has(key);
}
