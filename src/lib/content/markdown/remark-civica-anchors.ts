/**
 * remark-civica-anchors — recognise `## Heading {#anchor-id}` syntax.
 *
 *   Adopted via: ~/civica/plan/content-templating-audit-v1.md (Phase 1)
 *   Companion :  src/lib/content/markdown/substitute.ts (substitution engine)
 *
 * Civica's reader pages use stable section ids (`problem`,
 * `multi-source`, `disagree`, ...) for the `<ReaderSidebar>` left-rail
 * anchors. The TSX SECTIONS constants list these ids verbatim. The
 * heading text changes more often than the ids — "What's still rolling
 * out" is fragile in a way that the slug `rolling-out` is not.
 *
 * Auto-slugged headings (the `rehype-slug` default) would couple every
 * future copy edit to a stable-anchor change. This plugin keeps the
 * heading prose decoupled from the anchor id by recognising a trailing
 * `{#anchor-id}` token on each heading and assigning the id to the
 * heading's `data.hProperties.id`. The token is then stripped from the
 * rendered text.
 *
 * Syntax:
 *
 *   ## Multi-source reconciliation {#multi-source}
 *   ### What you see on reader pages {#reader-pages}
 *
 * Anchor ids must match `[a-z0-9][a-z0-9_-]*`. The token must be the
 * last text in the heading; whitespace before it is allowed and
 * stripped.
 *
 * The rule mirrors a long-established markdown convention used by
 * pandoc, mdBook, GitBook, MkDocs Material, and others. We implement
 * it locally rather than depending on `remark-attr` to keep the dep
 * surface minimal — the syntax we accept is a strict subset and easily
 * inlined.
 */

import { visit } from "unist-util-visit";
import type { Plugin } from "unified";
import type { Heading, Root, Text } from "mdast";

const ANCHOR_RE = /\s*\{#([a-z0-9][a-z0-9_-]*)\}\s*$/;

export const remarkCivicaAnchors: Plugin<[], Root> = () => {
  return (tree) => {
    visit(tree, "heading", (node: Heading) => {
      // Find the last text-bearing child. We allow inline formatting
      // (links, emphasis, code, etc.) but the `{#id}` token must be
      // plain text at the end of the heading.
      let lastTextNode: Text | null = null;
      for (let i = node.children.length - 1; i >= 0; i--) {
        const child = node.children[i];
        if (child.type === "text") {
          lastTextNode = child;
          break;
        }
        // Stop at any non-text, non-whitespace child.
        break;
      }
      if (!lastTextNode) return;

      const match = lastTextNode.value.match(ANCHOR_RE);
      if (!match) return;

      const anchorId = match[1];

      // Strip the `{#id}` token from the rendered text.
      lastTextNode.value = lastTextNode.value.slice(0, match.index).trimEnd();

      // If the trim leaves the text empty, drop the node entirely so
      // we don't render a trailing empty span.
      if (lastTextNode.value === "") {
        node.children = node.children.filter((c) => c !== lastTextNode);
      }

      // Assign the id via mdast's `data.hProperties` channel — this is
      // the standard hook for surfacing arbitrary HAST attributes from
      // an mdast node. `react-markdown` honours these on rendering.
      node.data = node.data ?? {};
      const hProps =
        (node.data.hProperties as Record<string, unknown> | undefined) ?? {};
      node.data.hProperties = { ...hProps, id: anchorId };
    });
  };
};
