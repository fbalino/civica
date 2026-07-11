# PUL-005 browser checks

**Route:** `http://127.0.0.1:3000/civica-index/methodology/pulse#evidence-identity`

**Browser runner:** `agent-browser`, local development server

## Results

| Viewport | Theme | Evidence | Result |
| --- | --- | --- | --- |
| 1440 × 1000 | Light | `evidence-identity-desktop-light.png` | Sidebar anchor, evidence fields, limitations, and rights boundary render clearly; no horizontal overflow. |
| 1440 × 1000 | Dark | `evidence-identity-desktop-dark.png` | Canonical dark tokens remain readable; no horizontal overflow. |
| 390 × 844 | Light | `evidence-identity-mobile-light.png` | The section and inline identifiers wrap cleanly; no horizontal overflow. |
| 390 × 844 | Dark | `evidence-identity-mobile-dark.png` | Dark mobile text remains legible; no horizontal overflow. |

The mobile measurement reported a 390-pixel viewport and 379-pixel document
width. The page produced no browser errors. The only console line was the
normal Next.js development-mode React DevTools notice.
