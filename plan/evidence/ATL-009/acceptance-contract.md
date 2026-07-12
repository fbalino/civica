# ATL-009 implementation acceptance contract

This contract turns the pre-implementation audit into objective release gates.
It is intentionally stricter than a page that merely returns matching HTML.

## Required data boundary

Search a normalized, versioned passage relation rather than scanning
`constitutions.full_text_html` or `structured_articles` JSON. Each passage must
retain an immutable passage/version identity, constitution and jurisdiction
identity, Constitute document identifier, raw section identifier, heading,
plain text, topic keys, content language, translation status, source URL,
retrieval time, reviewed rights posture, and content/source hash.

The initial corpus may be labelled only as publisher-supplied English. Original
language and translation status remain unknown until captured from reviewed
source metadata. Unknown is a value, not a blank and not an inferred
translation.

Current section IDs can support immediate deep links because all 96,127 are
present and unique within their document and their generated DOM IDs have zero
collisions. A citation is not stable across releases, however, unless an old
document/passage version remains resolvable after a resync.

## Query and result gates

- Use indexed PostgreSQL full-text search over normalized plain text. Do not
  run request-time `ILIKE` over the full HTML corpus.
- Support documented term and phrase semantics, jurisdiction and topic filters,
  deterministic ordering, and 20-result pagination with no duplicate or
  missing result when ranks tie.
- Return short, escaped highlighted passages. Source HTML and user query text
  must never cross the highlight seam unsanitized.
- Every result exposes jurisdiction, document year/version, heading or an
  explicit unavailable heading, passage anchor, language/translation context,
  source URL, retrieval date, and reviewed rights wording.
- No-result, invalid/empty query, unavailable filter combination, partial
  metadata, database outage, and timeout are distinct states.
- Bulk export remains unavailable while Constitute public-export terms remain
  pending/non-commercial-only. Search pagination must not become an accidental
  unrestricted corpus export.

## Performance gates

Measured on a representative production-like corpus and recorded with the
release evidence:

- warm p95 database execution at or below 100 ms;
- warm p95 API/server response at or below 300 ms;
- cold p95 API/server response at or below 750 ms;
- at most 250 KB returned for a 20-result page; and
- a hard one-second database query timeout, with a visible timeout/error state.

Measure database execution separately from API/network time. Include broad,
rare, filtered, phrase, no-result, and pagination queries. Do not use an
`EXPLAIN` timing for a multi-megabyte reader payload as evidence of its actual
delivery time.

## Automated fixtures

| Fixture | Acceptance behavior |
| --- | --- |
| United Kingdom | Largest/composite corpus: 3,926 sections and a 1215–2013 document range do not time out or imply a single codified constitution. |
| India | A roughly 1 MB structured document returns bounded passages, never the full document in search results. |
| Denmark | The smallest structured/topic corpus (70 sections, 19 excerpts) remains searchable without a low-coverage quality judgment. |
| Belgium | A sovereign state with no captured constitution produces an explicit corpus-noncoverage state. |
| Kosovo | Limited-recognition status and its sourced neutral note survive filtering and result display. |
| Mexico `section/896` | Empty section HTML cannot produce a blank result or broken citation. |
| United States / North Macedonia / Tunisia | Missing headings render an explicit fallback; they never collapse passage identity. |
| Tunisia `god` / `section/ddd` | Missing article label is distinct from missing passage text. |
| Bangladesh / Nigeria | A stale statement URL cannot be presented as the current document's provenance. |
| Topic `amend` | Broad filter spanning 181 jurisdictions remains within the performance ceiling. |
| Topics `civilmil` / `prisonrg` | One-jurisdiction results remain valid and do not imply global absence elsewhere. |
| Phrase `freedom of expression` | Phrase semantics and highlighting are deterministic and documented. |
| Empty and nonsense queries | Empty input is rejected; a valid zero-match query renders no results, not an outage. |
| Punctuation and diacritics | Search behavior is deterministic and covered by tests without silently rewriting legal meaning. |
| Rank ties across pages | Keyset/page traversal yields no duplicates or omissions. |
| Hostile query/source markup | Script, event-handler, and tag injection remain escaped after highlighting. |
| Simulated resync | Existing cited passage/version URLs continue resolving after a new document version is ingested. |
| Rights pending | Results show conservative reviewed wording and export remains blocked. |
| Database timeout/outage | Error state is observable and cannot masquerade as zero matches. |

## Browser gates

Test desktop and mobile in light and dark themes. Verify keyboard submission,
filter operation, focus return after pagination, visible result counts and
scope, deep-link restoration, highlighted-text contrast, source/citation links,
and all empty/error states. Browser QA must include the United Kingdom, Denmark,
Belgium, Kosovo, and a simulated outage.
