# PUL-033 change-control follow-up

The v15 snapshot introduced the review-SLA contract. The full claims gate then
showed that the strict methodology API schema did not yet admit the new
top-level `reviewServiceLevel` section. The same review exposed a semantic
boundary in the public changelog: pre-contract quarantine needed its own
publication origin instead of falling through to `queued`.

This follow-up adds the runtime section to the strict API schema and adopts
`legacy_quarantined` as a distinct API and reader state. The event card says
`Legacy quarantine · not reviewed`, and the filter copy explains that these
rows are neither active review candidates nor human decisions. A contract
test covers the mapping, and the PUL-033 validator now fails if the API or card
collapses quarantine back into review.

The SLA targets, migration, live data, and legacy-quarantine count did not
change. This v16 entry records the API and presentation closure without
rewriting v15.
