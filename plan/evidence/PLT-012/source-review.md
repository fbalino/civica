# PLT-012 current security-source review

Checked 2026-07-14 before adopting the sanitizer, SSRF boundary, and CSV
neutralization rules.

- [sanitize-html 2.17.6](https://www.npmjs.com/package/sanitize-html) and its
  [maintainer documentation](https://github.com/apostrophecms/sanitize-html)
  support explicit tag/attribute/scheme allowlists, whole-subtree removal for
  non-text elements, nesting limits, and server-side use. Civica pins 2.17.6
  and applies a narrower `constitution-html/v1` policy.
- The [OWASP Cross Site Scripting Prevention Cheat
  Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html)
  treats HTML sanitization as the boundary for intentionally rendered
  user-controlled markup and warns that later mutation can void the guarantee.
  Civica sanitizes before server-to-client/API egress and client components do
  not mutate or resanitize the branded value.
- The [OWASP Server Side Request Forgery Prevention Cheat
  Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html)
  prefers allowlists and, where arbitrary public URLs are necessary, requires
  protocol/domain/IP validation and redirect control. Pulse must retrieve
  arbitrary news outlets, so Civica accepts only HTTP(S), rejects every
  non-public resolved address, pins the validated address into the connection,
  manually revalidates each redirect, forwards only a closed set of harmless
  caller headers, disables shared socket pooling, and applies separate wire and
  decoded-body ceilings before any response is retained.
- [OWASP CSV Injection](https://owasp.org/www-community/attacks/CSV_Injection)
  documents spreadsheet formula execution from cells beginning with formula
  metacharacters, including after separators or control whitespace. Civica
  prefixes risky string cells with an apostrophe before RFC-4180 quoting and
  leaves typed numeric negatives numeric.
- The bundled official Next.js 16.2 Route Handler and `unstable_rethrow`
  documentation was checked before adding the shared unknown-error boundary.
  The adapter preserves framework control-flow and dynamic-rendering signals,
  while ordinary application exceptions become fixed API problems. Redirects
  remain outside application `try` blocks where a route uses the throwing
  navigation API; `NextResponse.redirect` responses remain ordinary values.

No source above is treated as a license grant for Civica data. This review
governs application security behavior only.
