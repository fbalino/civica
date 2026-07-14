import "server-only";

import sanitizeHtml from "sanitize-html";

/**
 * Versioned trust contract for HTML that may cross the constitution
 * server-to-client/API boundary.
 */
export const CONSTITUTION_HTML_SCHEMA_VERSION = "constitution-html/v1" as const;

declare const constitutionHtmlBrand: unique symbol;

/** HTML accepted by the constitution-html/v1 server-side allowlist. */
export type SanitizedConstitutionHtml = string & {
  readonly [constitutionHtmlBrand]: typeof CONSTITUTION_HTML_SCHEMA_VERSION;
};

/*
 * Constitute's parsed article/excerpt vocabulary. Generic div/span wrappers
 * remain useful for document structure, but no source attributes survive on
 * them. In particular, style, id, class, data-*, and event attributes are not
 * part of this contract.
 */
const ALLOWED_TAGS = [
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
] as const;

/*
 * Content inside active, embedded, or interactive elements is not
 * constitutional prose. Drop the whole subtree rather than unwrapping it.
 */
const NON_TEXT_TAGS = [
  "script",
  "style",
  "title",
  "textarea",
  "option",
  "xmp",
  "noscript",
  "noembed",
  "noframes",
  "iframe",
  "object",
  "embed",
  "svg",
  "math",
  "template",
  "form",
  "input",
  "button",
  "select",
  "datalist",
  "fieldset",
  "legend",
  "label",
  "details",
  "summary",
  "dialog",
  "audio",
  "video",
  "source",
  "track",
  "canvas",
] as const;

const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;
const ABSOLUTE_HTTP_URL = /^https?:\/\//i;
const TABLE_SPAN = /^(?:[1-9]|[1-9][0-9]|100)$/;
const TABLE_SCOPES = new Set(["row", "col", "rowgroup", "colgroup"]);

/**
 * Links are deliberately narrower than sanitize-html's relative-URL default:
 * only an in-document fragment or an explicit, parseable HTTP(S) URL survives.
 */
function isSafeConstitutionHref(rawHref: string): boolean {
  const href = rawHref.trim();
  if (!href || CONTROL_CHARACTERS.test(href)) return false;
  if (href.startsWith("#")) return true;
  if (!ABSOLUTE_HTTP_URL.test(href)) return false;

  try {
    const parsed = new URL(href);
    return (
      (parsed.protocol === "http:" || parsed.protocol === "https:") &&
      parsed.hostname.length > 0
    );
  } catch {
    return false;
  }
}

function sanitizeTableSpan(rawValue: string | undefined): string | undefined {
  const value = rawValue?.trim();
  return value && TABLE_SPAN.test(value) ? value : undefined;
}

/**
 * Establish the constitution-html/v1 trust boundary on the server. Raw stored
 * HTML must pass through this helper before it is placed in a server component
 * prop or public API response.
 */
export function sanitizeConstitutionHtml(
  input: string | null | undefined,
): SanitizedConstitutionHtml {
  if (!input) return "" as SanitizedConstitutionHtml;

  return sanitizeHtml(input, {
    allowedTags: [...ALLOWED_TAGS],
    allowedAttributes: {
      a: ["href"],
      td: ["colspan", "rowspan"],
      th: ["colspan", "rowspan", "scope"],
    },
    allowedSchemes: ["http", "https"],
    allowProtocolRelative: false,
    disallowedTagsMode: "discard",
    nonTextTags: [...NON_TEXT_TAGS],
    nestingLimit: 50,
    // No style attribute is allowed. Avoid parsing CSS altogether as an
    // additional guard against accidentally broadening the policy later.
    parseStyleAttributes: false,
    transformTags: {
      a: (tagName, attribs) => {
        if (!attribs.href || !isSafeConstitutionHref(attribs.href)) {
          delete attribs.href;
        } else {
          attribs.href = attribs.href.trim();
        }
        return { tagName, attribs };
      },
      td: (tagName, attribs) => {
        const colspan = sanitizeTableSpan(attribs.colspan);
        const rowspan = sanitizeTableSpan(attribs.rowspan);
        if (colspan) attribs.colspan = colspan;
        else delete attribs.colspan;
        if (rowspan) attribs.rowspan = rowspan;
        else delete attribs.rowspan;
        return { tagName, attribs };
      },
      th: (tagName, attribs) => {
        const colspan = sanitizeTableSpan(attribs.colspan);
        const rowspan = sanitizeTableSpan(attribs.rowspan);
        const scope = attribs.scope?.trim().toLowerCase();
        if (colspan) attribs.colspan = colspan;
        else delete attribs.colspan;
        if (rowspan) attribs.rowspan = rowspan;
        else delete attribs.rowspan;
        if (scope && TABLE_SCOPES.has(scope)) attribs.scope = scope;
        else delete attribs.scope;
        return { tagName, attribs };
      },
    },
  }) as SanitizedConstitutionHtml;
}
