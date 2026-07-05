import type { JsonLdNode } from "./jsonld";

// Server component that renders JSON-LD structured data as one
// `<script type="application/ld+json">` element per node. Pass a single node or
// an array; each node becomes its own script tag (cleaner for validators than a
// single @graph, and each builder already carries its own @context).
//
// The payload is developer-authored, JSON-serializable data from
// `src/lib/seo/jsonld.ts` — never user input — so `dangerouslySetInnerHTML`
// with `JSON.stringify` is safe here. `<` is still escaped defensively to
// prevent any `</script>` sequence in a value from breaking out of the tag.

function serialize(node: JsonLdNode): string {
  return JSON.stringify(node).replace(/</g, "\\u003c");
}

export function JsonLd({ data }: { data: JsonLdNode | JsonLdNode[] }) {
  const nodes = Array.isArray(data) ? data : [data];
  return (
    <>
      {nodes.map((node, index) => (
        <script
          // Order is stable (builder outputs are deterministic), so the index
          // key is fine for this static, non-reorderable list.
          key={index}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serialize(node) }}
        />
      ))}
    </>
  );
}
