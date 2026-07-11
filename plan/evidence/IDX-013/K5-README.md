# IDX-013 evidence — K5 isolated candidate implementation

`k5-institutional-constraint-map/v1` is an isolated, reproducible candidate extractor over the Constitution Explorer's sovereign-state excerpts. Its closed candidate taxonomy covers formal selection, removal, legislation approval/veto, veto override, legislature dismissal, constitutional review, and emergency powers.

The release contains 2,138 private passage candidates across 181 jurisdictions: 1,488 development, 383 validation, and 267 sealed final-holdout rows under the preregistered geographic hash. The output SHA-256 is `007b297d145c5bf453e8b450bb9aeb9d8649d5de420abbd3d3c52db53d8c978e`.

No topic tag becomes a legal finding. Every row remains `pending_double_blind_relation_coding`, unspecified endpoints remain unspecified, and the release asserts zero directed graph edges. It contains no relation count, weighted total, score, grade, quality field, rank, or traffic light.

The checked codebook freezes coder fields and the preregistered alpha, expert-fairness, citation-verifiability, and zero-quality-output gates. Double coding, expert review, and the citation audit remain pending.

`npm run validate:k5-relation-candidates`, focused tests, and `npx tsc --noEmit` pass. IDX-013 remains open until all candidates and baselines conform to the shared evaluation interface.
