/**
 * Sitemap XML safety.
 *
 * Next.js writes each sitemap `url` into `<loc>` verbatim, without XML
 * escaping. A canonical URL with more than one query parameter (the compare
 * pages' `?c=a&c=b`) therefore produced an invalid document that crawlers
 * rejected. `src/app/sitemap.ts` escapes every URL with `escapeSitemapUrl`;
 * code that reads the sitemap entries as URLs (the daily page warm-up)
 * decodes them with `unescapeSitemapUrl`.
 */

const XML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&apos;",
};

export function escapeSitemapUrl(url: string): string {
  return url.replace(/[&<>"']/g, (character) => XML_ESCAPES[character]!);
}

export function unescapeSitemapUrl(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

const NAME = "[A-Za-z_][\\w:.-]*";
const TOKEN = new RegExp(
  `<\\?[\\s\\S]*?\\?>|<!--[\\s\\S]*?-->|<(/?)(${NAME})((?:\\s+${NAME}\\s*=\\s*(?:"[^"<]*"|'[^'<]*'))*)\\s*(/?)>|<`,
  "g",
);
const BAD_REFERENCE = /&(?!(?:amp|lt|gt|quot|apos|#\d+|#x[0-9A-Fa-f]+);)/;

/**
 * A small well-formedness check sufficient for generated sitemaps: every tag
 * is balanced and correctly nested, there is one root element, and text and
 * attribute values contain no raw `<` or unescaped `&`.
 */
export function sitemapXmlErrors(xml: string): string[] {
  const errors: string[] = [];
  const stack: string[] = [];
  let roots = 0;
  let last = 0;
  const lineOf = (index: number) => xml.slice(0, index).split("\n").length;
  const checkText = (text: string, index: number) => {
    if (BAD_REFERENCE.test(text)) {
      errors.push(`line ${lineOf(index)}: unescaped "&"`);
    }
  };
  for (const match of xml.matchAll(TOKEN)) {
    const index = match.index ?? 0;
    checkText(xml.slice(last, index), last);
    last = index + match[0].length;
    if (match[0] === "<") {
      errors.push(`line ${lineOf(index)}: raw "<" that does not start a tag`);
      continue;
    }
    if (match[0].startsWith("<?") || match[0].startsWith("<!--")) continue;
    const [, closing, name, attributes, selfClosing] = match;
    if (attributes) checkText(attributes, index);
    if (closing) {
      const open = stack.pop();
      if (open !== name) {
        errors.push(`line ${lineOf(index)}: </${name}> closes <${open ?? "nothing"}>`);
      }
    } else if (!selfClosing) {
      if (stack.length === 0) roots += 1;
      stack.push(name!);
    } else if (stack.length === 0) {
      roots += 1;
    }
  }
  checkText(xml.slice(last), last);
  if (stack.length > 0) errors.push(`unclosed <${stack.join("> <")}>`);
  if (roots !== 1) errors.push(`expected one root element, found ${roots}`);
  return errors;
}
