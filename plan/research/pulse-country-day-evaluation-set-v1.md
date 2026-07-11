# Pulse country-day evaluation set v1

**Contract:** `pulse-country-day-evaluation-set/v1`

**Status:** captured and unlabeled

## Purpose

The set operationalizes the country-day probability frame in `pulse-evaluation-sampling-frame/v1`. Its 536 packets contain 482 analysis candidates and 54 same-stratum reserves. A packet can later be coded as a qualifying event, true negative, retrieval miss, insufficient observation, or out of scope. None of those labels is assigned during sampling or search capture.

## Evidence packet

Each packet contains its sovereign jurisdiction and UTC date, geography and BR/CGV regime tags, retained media-evidence environment, primary stratum, selection probability and base weight, analysis/reserve state, retained Pulse evidence identities, and three frozen search traces.

Retained Pulse documents remain in the private `raw_events` evidence snapshots. The checked sample carries only their immutable evidence identities. Search traces contain each exact query, provider and CLI version, capture time, result rank, title, URL, reported publication date, and trace hash. Snippets, images, page bodies, and scraped publisher content are excluded.

## Search protocol

Three frozen query families are bounded by the sampled date and following date. The first combines the canonical country name with government, parliament, election, court, constitution, minister, and president terms. The second covers coup, protest, corruption, emergency, rights, media, arrest, and law. The third is a broad country-day query. Firecrawl news search returns at most five results per family; unusable provider-relative links receive a web-search fallback. Results outside the intended date or topic remain visible for coder assessment rather than being silently removed.

A zero-result search is evidence only that this provider returned no result for this query at capture time. It cannot establish a true negative. Likewise, irrelevant results, missing retained documents, source outages, and thin media environments support an `insufficient_observation` judgment when the codebook requires it; they never default to event absence.

## Reproducibility and replacement

The country-day draw uses the preregistered seed and preserves continent-by-month primary quotas. Deterministic same-primary-stratum swaps ensure the declared media-evidence margins: every five-document/two-family day is included because that population has only five cases, and at least 30 below-threshold observed days are included. The artifact retains primary-stratum draw fractions and base weights. These are not final analysis weights: later estimates must calibrate them to the frozen media-evidence population totals and show sensitivity to unweighted and uncalibrated results. Within each primary stratum, the next reserve replaces unusable evidence without changing the target population.

Search captures are resumable. A completed trace is never reissued during the same release. Every trace and the complete set carry content hashes, and the public repository stores only the rights-safe derived metadata.

## Boundary

This is an unlabeled evaluation input. PUL-016 defines coder instructions and PUL-017 enforces blind double coding. PUL-018 and PUL-019 own performance estimates. The set itself provides no evidence that Pulse is accurate.
