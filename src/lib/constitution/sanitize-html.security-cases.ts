import assert from "node:assert/strict";
import test from "node:test";
import { parse } from "node-html-parser";
import {
  CONSTITUTION_HTML_SCHEMA_VERSION,
  sanitizeConstitutionHtml,
} from "./sanitize-html";

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

const ALLOWED_ATTRIBUTES: Record<string, Set<string>> = {
  a: new Set(["href"]),
  td: new Set(["colspan", "rowspan"]),
  th: new Set(["colspan", "rowspan", "scope"]),
};

function assertOnlyContractMarkup(html: string, label: string): void {
  const root = parse(html);
  for (const element of root.querySelectorAll("*")) {
    const tag = element.rawTagName.toLowerCase();
    assert.ok(ALLOWED_TAGS.has(tag), `${label}: disallowed <${tag}> survived`);
    const allowedAttributes = ALLOWED_ATTRIBUTES[tag] ?? new Set<string>();
    for (const attribute of Object.keys(element.attributes)) {
      assert.ok(
        allowedAttributes.has(attribute.toLowerCase()),
        `${label}: disallowed ${attribute} attribute survived on <${tag}>`,
      );
    }
  }
}

test("constitution-html/v1 keeps the required prose structure only", () => {
  assert.equal(CONSTITUTION_HTML_SCHEMA_VERSION, "constitution-html/v1");
  const dirty = [
    '<div class="section" id="section/8" data-topics="rights">',
    '<h3 class="upper">ARTICLE 8</h3>',
    "<p>The law protects <strong>equal rights</strong>.<br>",
    '<a href="#sec-section-9" title="Next" target="_blank">Continue</a></p>',
    '<ol style="list-style-type:lower-alpha"><li><em>First clause</em></li></ol>',
    "</div>",
  ].join("");

  assert.equal(
    sanitizeConstitutionHtml(dirty),
    '<div><h3>ARTICLE 8</h3><p>The law protects <strong>equal rights</strong>.<br /><a href="#sec-section-9">Continue</a></p><ol><li><em>First clause</em></li></ol></div>',
  );
});

test("HTML-entity and control-character URL obfuscation cannot restore a script scheme", () => {
  const entityMarker = String.fromCharCode(35);
  const dangerousHrefs = [
    "javascript:alert(1)",
    "JaVaScRiPt:alert(1)",
    "jav&#97;script:alert(1)",
    "jav&#x61;script:alert(1)",
    `java&${entityMarker}115;cript&colon;alert(1)`,
    "&#x6a;&#x61;&#x76;&#x61;&#x73;&#x63;&#x72;&#x69;&#x70;&#x74;&#x3a;alert(1)",
    "java&Tab;script:alert(1)",
    "java&NewLine;script:alert(1)",
    "java&#x09;script:alert(1)",
    "java&#x0a;script:alert(1)",
    "java&#x0d;script:alert(1)",
    "&#32;javascript:alert(1)",
    "javascript&#58;alert(1)",
    "javas%63ript:alert(1)",
    "%6a%61%76%61%73%63%72%69%70%74:alert(1)",
  ];

  for (const href of dangerousHrefs) {
    assert.equal(
      sanitizeConstitutionHtml(`<a href="${href}">link</a>`),
      "<a>link</a>",
      href,
    );
  }
});

test("only explicit HTTP(S) and in-document fragment links survive", () => {
  const rejectedHrefs = [
    "data:text/html,<script>alert(1)</script>",
    "vbscript:msgbox(1)",
    "file:///etc/passwd",
    "blob:https://example.test/id",
    "//example.test/path",
    "/constitution?c=uruguay",
    "constitution?c=uruguay",
    "mailto:reader@example.test",
    "tel:+598000000",
    "https:example.test/path",
    "http://",
    "ftp://example.test/file",
  ];

  for (const href of rejectedHrefs) {
    assert.equal(
      sanitizeConstitutionHtml(`<a href="${href}">link</a>`),
      "<a>link</a>",
      href,
    );
  }

  assert.equal(
    sanitizeConstitutionHtml(
      '<a href="https://example.test/path?x=1&y=2#part">HTTPS</a>',
    ),
    '<a href="https://example.test/path?x=1&amp;y=2#part">HTTPS</a>',
  );
  assert.equal(
    sanitizeConstitutionHtml('<a href="HTTP://EXAMPLE.test/path">HTTP</a>'),
    '<a href="HTTP://EXAMPLE.test/path">HTTP</a>',
  );
  assert.equal(
    sanitizeConstitutionHtml('<a href="#section-8">Fragment</a>'),
    '<a href="#section-8">Fragment</a>',
  );
  assert.equal(
    sanitizeConstitutionHtml(
      '<a href="  https://example.test/trimmed  ">Trimmed</a>',
    ),
    '<a href="https://example.test/trimmed">Trimmed</a>',
  );
});

test("CSS, DOM-clobbering identifiers, data attributes, and handlers are removed", () => {
  const dirty = [
    '<div id="app" class="section" data-topics="x" ',
    'style="position:fixed;inset:0;background:url(https://attacker.test/pixel)">',
    '<span name="location" aria-label="trap" onmouseover="alert(1)" ',
    'style="animation-name:x">Constitutional text</span>',
    '<img src="https://attacker.test/track" onerror="alert(2)">',
    "</div>",
  ].join("");
  const clean = sanitizeConstitutionHtml(dirty);

  assert.equal(clean, "<div><span>Constitutional text</span></div>");
  assert.doesNotMatch(clean, /attacker[.]test|style=|class=|id=|data-|on\w+=/i);
  assertOnlyContractMarkup(clean, "CSS/attribute fixture");
});

test("active, embedded, namespace, and interactive subtrees are removed with their content", () => {
  const dirty = [
    "<script><p>script child</p></script>",
    "<style><p>style child</p></style>",
    '<iframe srcdoc="<script>alert(1)</script>"><p>frame child</p></iframe>',
    '<object data="data:text/html,bad"><p>object child</p></object>',
    "<svg><a><text>svg child</text></a></svg>",
    "<math><mtext><p>math child</p></mtext></math>",
    "<template><p>template child</p></template>",
    "<form><button formaction=javascript:alert(1)>form child</button></form>",
    "<details open><summary>interactive child</summary></details>",
    "<p>safe prose</p>",
  ].join("");

  assert.equal(sanitizeConstitutionHtml(dirty), "<p>safe prose</p>");
});

test("table attributes are narrowly bounded and normalized", () => {
  const dirty = [
    '<table style="position:fixed"><thead><tr>',
    '<th scope="ROW" colspan="2" rowspan="100" onclick="alert(1)">H</th>',
    '<th scope="column" colspan="101" rowspan="0">Invalid</th>',
    "</tr></thead><tbody><tr>",
    '<td colspan="03" rowspan="-1" class="cell">Value</td>',
    "</tr></tbody></table>",
  ].join("");

  assert.equal(
    sanitizeConstitutionHtml(dirty),
    '<table><thead><tr><th scope="row" colspan="2" rowspan="100">H</th><th>Invalid</th></tr></thead><tbody><tr><td>Value</td></tr></tbody></table>',
  );
});

test("malformed and mutation-XSS families remain inert and idempotent", () => {
  const fixtures = [
    "<p><scr<script>ipt>alert(1)</scr</script>ipt></p>",
    "<svg><g/onload=alert(1)//<p>payload</p></svg><p>safe</p>",
    '<math><mtext><table><mglyph><style><!--</style><img title="--><img src=1 onerror=alert(1)>"></table></mtext></math><p>safe</p>',
    "<form><math><mtext></form><form><mglyph><style></math><img src=x onerror=alert(1)>",
    '<noscript><p title="</noscript><img src=x onerror=alert(1)>">bad</p></noscript><p>safe</p>',
    "<table><caption><svg><desc><table><tbody></table></desc><title><style></style></title></svg></caption><p>safe</p>",
    "<!--><img src=x onerror=alert(1)>--><p onclick=alert(1)>safe</p>",
    '<a href="jav&#x00000061;script:alert(1)" autofocus onfocus=alert(2)>link</a>',
    "<div><span><b><i><u><div><script>alert(1)</script></u></i></b></span></div>",
  ];

  for (const [index, dirty] of fixtures.entries()) {
    const label = `mXSS fixture ${index + 1}`;
    const clean = sanitizeConstitutionHtml(dirty);
    assertOnlyContractMarkup(clean, label);
    assert.equal(
      sanitizeConstitutionHtml(clean),
      clean,
      `${label}: not idempotent`,
    );
    assert.doesNotMatch(
      clean,
      /<(?:script|style|iframe|object|embed|svg|math|form|template|img)\b/i,
      label,
    );
    assert.doesNotMatch(
      clean,
      /<[^>]+\s(?:on[a-z0-9_-]+|style|id|class|data-[a-z0-9_-]+)\s*=/i,
      label,
    );
  }
});

test("null, undefined, and empty input produce branded empty HTML", () => {
  assert.equal(sanitizeConstitutionHtml(null), "");
  assert.equal(sanitizeConstitutionHtml(undefined), "");
  assert.equal(sanitizeConstitutionHtml(""), "");
});

test("route-facing strict mode preserves legitimate empty query results", async () => {
  const { getNotableTopicPeers, getTopicExcerpts } =
    await import("../db/queries-constitution");

  assert.deepEqual(
    await getTopicExcerpts("dignity", [], { throwOnError: true }),
    [],
  );
  assert.deepEqual(
    await getTopicExcerpts("", ["jurisdiction-id"], {
      throwOnError: true,
    }),
    [],
  );
  assert.deepEqual(
    await getNotableTopicPeers("", "jurisdiction-id", 3, {
      throwOnError: true,
    }),
    [],
  );
});
