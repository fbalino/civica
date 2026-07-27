# EXP-026 — Reader visual-performance budgets

Completed 2026-07-18 through the shared QA-014 implementation.

The checked `civica-reader-performance-budget/v1` declares and tests LCP,
CLS, interaction timing, JavaScript/CSS/image/font/RSC bytes, request count,
long tasks, server response, and Atlas map initialization on four production
reader fixtures. The fixed route set covers home, source-native Atlas,
constitution reading, and a visually rich Record article. Its browser test
attaches every measured result plus the declared ceiling, and a pure seeded
payload breach fails closed.

The final controlled production run passed all four fixtures; the
credential-free CI mode passed the database-independent home and Record routes
while honestly skipping the two data-backed fixtures. Query execution p95 and
result bounds remain linked to the existing `civica-query-budget/v1` contract.
Full commands, measurements, source review, and the separate unrelated
full-build blocker are recorded in `plan/evidence/QA-014/README.md`.
