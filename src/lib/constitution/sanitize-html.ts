/**
 * A tiny, dependency-free, isomorphic (server + client) allowlist sanitizer for
 * the Constitute-derived constitution HTML we render via
 * `dangerouslySetInnerHTML`.
 *
 * WHY a hand-rolled sanitizer: the constitution body/excerpt HTML comes from a
 * single trusted academic source (the Constitute Project) stored in our own DB,
 * so the stored-XSS likelihood is low — but "trusted source in a DB column" is
 * exactly the kind of thing that quietly becomes attacker-influenced later, so
 * we defend at the render seam. We deliberately avoid pulling in a full DOM
 * sanitizer (DOMPurify needs a browser DOM; sanitize-html is a heavy Node dep)
 * because this runs during SSR *and* in the client bundle, and the input
 * vocabulary is small and well-understood.
 *
 * What it does:
 *  - Keeps only the structural tags the source actually uses (headings,
 *    paragraphs, lists, generic containers, inline emphasis, anchors).
 *  - Drops `<script>/<style>/<iframe>/<object>/<embed>` etc. AND their inner
 *    content (so a stripped `<script>` can't leak its body as text).
 *  - Strips every `on*` event-handler attribute and any attribute whose value
 *    is a `javascript:` (or other script) URI.
 *  - PRESERVES `id` (deep-link + scroll targets), `class` (styling), and
 *    `data-*` (e.g. `data-topics`, used by the topic mapping) — the things the
 *    reading column and cross-reference pane depend on.
 *
 * It is intentionally conservative: unknown tags are unwrapped (their text
 * content is kept, the tag itself removed) rather than passed through.
 */

// Tags whose *content* is dangerous and must be discarded entirely.
const DROP_WITH_CONTENT = new Set([
  "script",
  "style",
  "iframe",
  "object",
  "embed",
  "noscript",
  "template",
  "svg",
  "math",
  "form",
  "input",
  "button",
  "textarea",
  "select",
  "link",
  "meta",
  "base",
]);

// Tags we render as-is (attributes still filtered). Everything the stored
// Constitute HTML uses, plus the inline-emphasis set the render seam expects.
const ALLOWED_TAGS = new Set([
  "div",
  "span",
  "p",
  "br",
  "hr",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "ul",
  "ol",
  "li",
  "b",
  "i",
  "em",
  "strong",
  "u",
  "sup",
  "sub",
  "small",
  "blockquote",
  "a",
  "table",
  "thead",
  "tbody",
  "tr",
  "td",
  "th",
]);

// Void elements never have a closing tag.
const VOID_TAGS = new Set(["br", "hr"]);

// Attributes allowed by exact name (beyond the `data-*` prefix rule).
const ALLOWED_ATTRS = new Set([
  "id",
  "class",
  "style",
  "title",
  "lang",
  "dir",
  // anchors
  "href",
  "target",
  "rel",
  // tables
  "colspan",
  "rowspan",
  "scope",
]);

const SCRIPT_URI = /^\s*(javascript|data|vbscript):/i;

function isSafeHref(value: string): boolean {
  const v = value.trim();
  // Allow fragment, relative, absolute http(s), and mailto/tel; reject script URIs.
  if (SCRIPT_URI.test(v)) return false;
  return true;
}

/** Filter a raw attribute string down to the allowlist. */
function sanitizeAttrs(raw: string): string {
  const out: string[] = [];
  // Matches: name="value" | name='value' | name=value | name (boolean)
  const attrRe =
    /([a-zA-Z_:][-a-zA-Z0-9_:.]*)(?:\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'`=<>]+)))?/g;
  let m: RegExpExecArray | null;
  while ((m = attrRe.exec(raw))) {
    const name = m[1].toLowerCase();
    const value = m[3] ?? m[4] ?? m[5] ?? "";
    if (!name) continue;
    // Never keep event handlers.
    if (name.startsWith("on")) continue;
    const isData = name.startsWith("data-");
    if (!isData && !ALLOWED_ATTRS.has(name)) continue;
    // URL-bearing attributes must not carry a script URI.
    if ((name === "href" || name === "src") && !isSafeHref(value)) continue;
    // Escape double quotes in the value so we can always re-emit as name="…".
    const safeVal = value.replace(/"/g, "&quot;");
    out.push(`${name}="${safeVal}"`);
  }
  return out.length ? " " + out.join(" ") : "";
}

/**
 * Sanitize a Constitute HTML fragment. Returns HTML safe to pass to
 * `dangerouslySetInnerHTML`. Preserves ids/classes/data-* and text content;
 * drops disallowed tags (unwrapping them) and dangerous tags with their body.
 */
export function sanitizeConstitutionHtml(input: string | null | undefined): string {
  if (!input) return "";

  const out: string[] = [];
  // A stack of dangerous-tag names whose content we are currently discarding.
  let dropDepth = 0;
  let dropTag: string | null = null;

  // Tokenize into tags and text.
  const tokenRe = /<\/?[a-zA-Z][^>]*>|<!--[\s\S]*?-->|[^<]+/g;
  let token: RegExpExecArray | null;

  while ((token = tokenRe.exec(input))) {
    const t = token[0];

    // Comments — always drop.
    if (t.startsWith("<!--")) continue;

    // Tag token.
    if (t[0] === "<") {
      const closing = t[1] === "/";
      const nameMatch = /^<\/?\s*([a-zA-Z][a-zA-Z0-9]*)/.exec(t);
      const tag = nameMatch ? nameMatch[1].toLowerCase() : "";

      // Currently inside a dropped element: only watch for its matching close.
      if (dropDepth > 0) {
        if (closing && tag === dropTag) {
          dropDepth -= 1;
          if (dropDepth === 0) dropTag = null;
        } else if (!closing && tag === dropTag && !isSelfClosing(t, tag)) {
          dropDepth += 1;
        }
        continue;
      }

      if (DROP_WITH_CONTENT.has(tag)) {
        // Begin discarding this element and everything inside it.
        if (!closing && !isSelfClosing(t, tag)) {
          dropDepth = 1;
          dropTag = tag;
        }
        continue;
      }

      if (!ALLOWED_TAGS.has(tag)) {
        // Unknown tag — unwrap (drop the tag, keep children/text).
        continue;
      }

      if (closing) {
        if (!VOID_TAGS.has(tag)) out.push(`</${tag}>`);
        continue;
      }

      // Opening (or self-closing) allowed tag: re-emit with filtered attrs.
      const attrsRaw = t.replace(/^<\s*[a-zA-Z][a-zA-Z0-9]*/, "").replace(/\/?>$/, "");
      const attrs = sanitizeAttrs(attrsRaw);
      if (VOID_TAGS.has(tag)) {
        out.push(`<${tag}${attrs} />`);
      } else {
        out.push(`<${tag}${attrs}>`);
      }
      continue;
    }

    // Text token. Discard if we're inside a dropped element (so a stripped
    // <script>/<style> can't leak its body as visible text); otherwise keep
    // verbatim (already HTML-entity-encoded in the source).
    if (dropDepth > 0) continue;
    out.push(t);
  }

  return out.join("");
}

/** True for `<tag .../>` self-closing syntax. */
function isSelfClosing(tagToken: string, tag: string): boolean {
  return VOID_TAGS.has(tag) || /\/>$/.test(tagToken.trim());
}
