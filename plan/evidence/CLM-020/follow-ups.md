# CLM-020 follow-ups

This file lists the gaps CLM-020 found and did not close. It is a working
list, not Index change-control evidence, so it may be edited later without a
new change-control record. The `### F<n>` headings are anchors: the
publisher-attribution registry (`src/lib/provenance/publisher-attribution-registry.ts`)
points registered exceptions at them, and `npm run validate:publisher-attribution`
fails if a referenced heading disappears. Removing a heading therefore requires
removing or resolving the exception that cites it.

Rule (c) is still not met everywhere after CLM-020. The places below keep a
Civica calculation or an unlabeled Civica clock beside a publisher's name
until their follow-up lands, and the CLM-021 Human Development year label stays
wrong until the owner approves a corrected Conditions release.

### F1

Governance Evidence shows the sum of Freedom House's political rights and civil
liberties ratings (2 to 14) as "Freedom in the World combined rating" (Uruguay
2.0). Freedom House publishes the two ratings and their average, not this sum,
so the displayed number is a Civica calculation. The same section labels the
Freedom in the World 2024 data "Reference year 2024", while that edition covers
calendar year 2023; the K1 research panel files the edition under
`period_year` 2024. The Governance Evidence files are bound by hash to the
governance-evidence review packet, so the fix belongs to the packet's next
version: show Freedom House's own figures (the two ratings, or the average
Freedom Rating, or the Total Score) or mark the sum with `ValueOriginNote`, and
name the covered year. Registry exception: `governance-evidence.fh-combined-rating`.

### F2

The legislature and compare-chamber views show seat shares, the top-two
combined share, and the majority line. Seat counts come from the publisher; the
shares and the majority threshold are Civica arithmetic. Another workstream owns
those components (seat colours), so the markers wait for that work. Registry
exception: `legislature.seat-shares`.

### F3

The party browser shows a seat share (Civica arithmetic on seat counts) and
ideology labels that bucket V-Party positions into Civica categories. Either
show V-Party's own ordinal categories or mark both with `ValueOriginNote`.
Registry exception: `parties.seat-share-and-ideology`.

### F4

`GET /api/metrics/:metricId/strip-data` returns Civica group aggregates and a
peer cohort beside the metric's source name. Its only reader-facing consumer is
unmounted. Add an origin field to the response or retire the endpoint. Registry
exception: `api.metrics-strip-data`.

### F5

The legacy `country_metrics` table stores ranks whose origin was never recorded,
and its writers (`scripts/sync-transparency-cpi.ts`,
`scripts/derive-country-metric-hdi.ts`) compute Civica competition ranks. Peru's
stored 2023 Corruption Perceptions Index value is 36, while Transparency
International's published figure, retained in Civica's own series, is 33. No
reader surface shows these rows after CLM-020, and the scan fails on any new
reader of the table, but the citation resolver and the Atlas change-history
field list still read it. Correct or retire the table's values and ranks.

### F6

`/api/v1/countries/:code` returns `democracyIndex`, a Civica 1-to-4 ordinal
mapped from V-Dem's Regimes of the World label, and its API example shows 7.99,
which looks like an Economist Intelligence Unit score. `/api/countries/:slug/democracy`
returns the same ordinal plus a regional comparison, and its
`freedomHouseFacts` list is empty for every country. Decide whether to retire
the field and the endpoint or document the ordinal as a Civica calculation.

### F7

Capture Freedom House's own Status column at the next Freedom in the World
capture. The Rankings row's origin can then become `publisher_published`, and
the applied-rule note can go.

### F8

Section Sources strips on the country Civica Data tab and the Factbook right
rail show Civica's last sync date beside each source name with no label, so a
reader can take it for a publisher date. Label it "Last synced YYYY-MM-DD" and
pass `null`, not a placeholder string, when a source was never synced. The
Rankings section no longer shows a Sources strip (its rows carry their own
edition and retrieval time).

### F9

`formatSourceTimestamp` turns a bare year, quarter, or year-month string into
a clock time (for example "2024" becomes midnight on January 1). No Rankings
row passes such a string after CLM-020. Harden the formatter so any string
without a clock time and not a full date renders "Unknown timestamp", then
review the call sites.

### F10

After CLM-020 the country section named "Rankings" holds no ranks, and its
V-Dem value repeats the one in Governance Evidence. The owner decides the name
in the screen-by-screen review of the Civica Data page. The page is an
Index-protected file, so a rename needs its own Index change-control record.

### F11

Blog posts that quote Economist Intelligence Unit or Freedom House figures need
a manual fact check against the publishers. The scan cannot read prose.

### F12

The owner decides whether to publish a correction note for the former Freedom
House value ("Free (100/100)" and the other Civica 0 to 100 values shown as
Freedom House's). Under `content/policies.md` it is a Major correction: a
non-headline value was wrong.
