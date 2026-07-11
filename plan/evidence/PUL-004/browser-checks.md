# PUL-004 browser checks

**Route:** `http://127.0.0.1:3000/civica-index/methodology/pulse#version-identity`

**Browser runner:** `agent-browser`, local development server

## Results

| Viewport | Theme | Evidence | Result |
| --- | --- | --- | --- |
| 1440 × 1000 | Light | `version-identity-desktop-light.png` | Sidebar anchor, heading, lineage rules, and legacy boundary render clearly; no horizontal overflow. |
| 1440 × 1000 | Dark | `version-identity-desktop-dark.png` | Canonical dark tokens remain readable; no horizontal overflow. |
| 390 × 844 | Light | `version-identity-mobile-light.png` | The section wraps cleanly in the mobile reader layout; no horizontal overflow. |
| 390 × 844 | Dark | `version-identity-mobile-dark.png` | Dark mobile text and code fragments remain legible; no horizontal overflow. |

The mobile measurement reported a 390-pixel viewport and 379-pixel document
width. The page produced no browser errors. The only console line was the
normal Next.js development-mode React DevTools notice.
