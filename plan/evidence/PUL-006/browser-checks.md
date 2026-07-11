# PUL-006 browser checks

Checked `http://localhost:3000/civica-index/methodology/pulse` in the in-app browser on 2026-07-11.

| View        | Theme | Result                                                                                                        |
| ----------- | ----- | ------------------------------------------------------------------------------------------------------------- |
| 1440 × 1000 | light | PASS — `pulse-v2.2-beta`, clustering method, coverage section, and report link render; no horizontal overflow |
| 1440 × 1000 | dark  | PASS — theme resolves to `dark`; no horizontal overflow                                                       |
| 390 × 844   | light | PASS — coverage section remains visible; no horizontal overflow                                               |
| 390 × 844   | dark  | PASS — theme resolves to `dark`; no horizontal overflow                                                       |

The hydrated localhost origin produced zero browser warnings or errors. The `127.0.0.1` dev origin was excluded from theme evidence because Next.js blocked its development resources as cross-origin; the page itself reported that warning in `.next/dev/logs/next-development.log`.

The report link is present and uniquely named `cluster coverage report`. The browser client blocked direct JSON navigation, so `GET /api/v1/pulse/cluster-coverage` was verified with `curl -fsS`; it returned the frozen `pulse-cluster-coverage/v1` report, `descriptive_not_validation`, five named distributions, two separated method versions, and a 64-character report hash.

Screenshots:

- `methodology-desktop-light.png`
- `methodology-desktop-dark.png`
- `methodology-mobile-light.png`
- `methodology-mobile-dark.png`
