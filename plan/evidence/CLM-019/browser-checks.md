# CLM-019 browser checks

Checked locally on 2026-07-10 at `http://localhost:3001` with the in-app browser runtime.

## Desktop (1440×900)

- `/methodology/approach#reader-pages`: generated **4 of 10 (40%)** compact
  renderer-class coverage, complete-class labels, six named exceptions, and the
  DAT-005 boundary were visible; no universal per-value claim or horizontal
  overflow.
- `/about`: the same generated coverage and limitations pointer were visible;
  no horizontal overflow.
- `/rankings`: the point-of-use provenance notice, Licensing link, methodology
  audit link, and metric-cell source dots rendered; no horizontal overflow.
- `/api-docs#bulk-data`: supported headline-field provenance, missing facts[]
  per-row provenance, CSV limits, and DAT-027 ownership were visible.
- `/atlas`: four map layers rendered; the map and hover surface had no inline
  source dot, confirming the registered exception; no horizontal overflow.

## Mobile (390×844)

- Methodology, About, API docs, home, and rankings retained the required
  coverage/limitation language and had no horizontal overflow.
- Rankings retained the provenance notice, audit link, and metric-cell source
  dots at the narrow viewport.

## Embed

- `/embed/denmark?size=sm` at 300×160: the 300×80 card fit without overflow and
  displayed `CI 91.0 · Q4 · 2024 · BETA`; canonical machine-readable rights
  metadata and normalization-table-derived Index source metadata were present.

## Runtime health

Fresh isolated loads of methodology, About, rankings, API docs, the small
embed, and Atlas reported zero console warnings or errors.

After the visual pass, direct response inspection confirmed that the small
embed emits `civica:sources` with all four normalization-table source labels
and `civica:rights` with the canonical Licensing anchor.

## Visual evidence

- `coverage-methodology-mobile.png`
- `embed-small-vintage.png`
