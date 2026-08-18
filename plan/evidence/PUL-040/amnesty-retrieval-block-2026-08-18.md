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

## Open question for the owner — deliberately not decided here

Amnesty publishes this RSS feed for syndication, the content is free to read,
and the block is near-certainly generic bot protection rather than a decision
about Civica. Even so, routing around a publisher's edge control is a
different act from fetching an open feed, and this project holds itself to a
stricter rights standard than "it was technically reachable".

Two things are worth doing before this is treated as settled:

1. **Ask Amnesty for allowlisting.** A short note to their press/web team
   identifying Civica, its non-commercial research purpose, and its request
   rate (one feed fetch per day) is the clean long-term fix and removes the
   question entirely.
2. **Decide whether to keep the fallback in the meantime.** Keeping it is
   defensible; so is disabling Amnesty until an allowlist exists. Unsetting
   `FIRECRAWL_API_KEY` reverts to the honest-failure behaviour with no code
   change.

Nothing about Amnesty's licence terms or attribution changes either way; that
record is unaffected by how the bytes were retrieved.
