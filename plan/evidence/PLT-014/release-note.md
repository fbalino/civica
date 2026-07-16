# PLT-014 release note

Civica now distinguishes live observations, checked build artifacts, and
frozen research releases throughout its cache and API contracts.

For API readers, Index responses add an explicit release identity and identify
which components are frozen with that release versus read live at request time.
Pulse dimension responses distinguish frozen deltas/contributor IDs from live
article evidence context. Retained Pulse rows whose event inputs predate full
method/prompt/taxonomy versioning expose `legacy_input_lineage` and exact
derivation envelopes; they are never relabeled as current. Atlas release
downloads remain immutable and can be reproduced without consulting current
production fact tables.

An incompatible or incomplete Index/Pulse release no longer falls back to a
plausible mixed response. It fails with stable `RELEASE_INCONSISTENT` behavior
and a noncacheable response. Mutable routes and database-backed pages are
request-live; checked artifacts must revalidate and immutable downloads are
replaced only through a new versioned URL.

No existing R3/R4/R5 score is recalculated by this change. The retired
general-country composite row is no longer shown alongside unrelated live
metrics; dedicated Civica Index surfaces continue to show the selected
experimental release.

The checked `source-input-manifest/v1` was regenerated after a code-derived
adapter-version change. R3, R4, and R5 now bind its new exact byte hash while
retaining the same publisher-byte source hashes, score rows, ranks, and
semantic release hashes.
