# Amnesty retrieval block and the Firecrawl fallback — 2026-08-18

## The block

Amnesty International returns **HTTP 403 to every request for its entire
domain** — the RSS feed, the news index, and the homepage — from both this
project's servers and an ordinary residential machine, and regardless of user
agent (tested: none, a current desktop-browser string, and an identified
Civica bot string). It is an edge bot/WAF block, not a Civica-specific
denial, and nothing in the connector code is at fault.

Consequence before the fix: the amnesty connector failed on every run, so the
ingest stage recorded `partial` every day and could never produce the
`completed` run that PUL-040's start prerequisite requires.

## The fallback

`src/lib/pulse/v2/firecrawl-fetch.ts` retrieves the same public URL through
Firecrawl and returns the raw bytes to the existing RSS parser. Properties:

- **Fallback only.** The direct fetch runs first; Firecrawl is used only when
  the publisher answered 401/403/429. Timeouts and 5xx are NOT retried, so a
  publisher having a bad day costs nothing.
- **Nothing downstream changes.** Same URL, same bytes, same parser, same
  provenance row, same source-rights record. Only the transport differs.
- **Inert without a key.** With `FIRECRAWL_API_KEY` unset the module does
  nothing and the original failure stands — a blocked feed keeps failing
  visibly rather than disappearing from the run.
- Cost: roughly 30 credits/month at one Amnesty fetch per day.

Verified 2026-08-18: `fetchRss` returned 12 live Amnesty items through the
fallback, and a real `pulse:v2:ingest` inserted 12 Amnesty rows
(`amnesty 12 fetched / 12 inserted`). Unit tests cover the block-vs-ordinary
failure distinction, the no-key inert path, and the empty/HTTP-error
fail-closed paths.

## Owner decision (2026-08-18): ask, do not route around

Fernando: "I would prefer to ask Amnesty to allowlist Civica. Civica cannot be
breaking any rules."

Research into Amnesty's own published rules then found the question is wider
than the Firecrawl fallback:

- **robots.txt permits it.** `/en/feed/` is not disallowed; the only `*`
  rules cover `/search/` and `/wp-admin/`. No crawl-delay applies to `*`.
- **The Terms of Use do not.** §3 (page `dateModified` **2026-08-13**, five
  days before the block was observed) forbids "using automated tools,
  scraping, data-mining or similar technologies to access, copy, monitor or
  extract content or data from the site unless we have allowed this", and
  separately forbids "trying to bypass security controls, access controls,
  rate limits or other protective measures... You must not try to evade those
  controls." §7 repeats the scraping prohibition.
- Content is otherwise CC BY-NC-ND 4.0 per their permissions page, but that
  licence governs *reuse*, not *automated access*.

The terms are the stricter instrument, so Civica follows them. Two
consequences, both implemented:

1. **The Firecrawl fallback is off for amnesty.org** — enforced by the
   `publisher-fallback-permission/v1` registry, not by whether an API key is
   set. A host absent from the registry is refused; `granted` cannot be
   written without evidence.
2. **The connector no longer requests Amnesty at all.** Under §3 even an
   ordinary daily feed fetch needs their permission, and a request we believe
   is disallowed should not be sent even once. `fetchAmnesty` reports a
   legitimate skip (`ran: false`, no error) via `PUBLISHER_DIRECT_RETRIEVAL`.

Amnesty publishes no API, data portal, developer programme or syndication
scheme, so there is no cleaner official route to use instead.

The outreach draft, with the contact routes verified from Amnesty's own
pages, is `amnesty-permission-request-draft-2026-08-18.md`. It is unsent.

### Retained rows from the 2026-08-18 fallback test

Before this decision, testing the fallback retrieved and stored 12 Amnesty
items (raw_events, 2026-08-18T11:51Z). They never clustered, never became
events, and were never published. They are NOT deleted: `raw_events` is
append-only under the DAT-016 research-evidence-retention triggers, and
deleting them to tidy up would break one rule to satisfy another. They are
recorded here instead. If Amnesty refuses permission, ask them whether they
would like those 12 rows removed and, if so, seek the retention-contract
exception explicitly rather than quietly.

### Side effect worth naming

Amnesty becoming a recorded non-retrieval means ingest can once again record a
clean `completed` run, which is one of PUL-040's start prerequisites. That is
a consequence of the rights decision, not a reason for it.
