# PUL-003 browser checks

**Route:** `http://127.0.0.1:3000/civica-index/methodology/pulse#event-categories`

**Browser runner:** `agent-browser`, local development server

## Results

| Viewport | Theme | Evidence | Result |
| --- | --- | --- | --- |
| 1440 × 1000 | Light | `ontology-desktop-light.png` | Heading, version, runtime boundary, and severity introduction render; no horizontal overflow. |
| 1440 × 1000 | Dark | `ontology-desktop-dark.png` | Dark tokens apply with body background `rgb(22, 20, 15)`; no horizontal overflow. |
| 390 × 844 | Light | `ontology-mobile-light.png` | Heading wraps cleanly, body remains readable, and the viewport has no horizontal overflow. |
| 390 × 844 | Dark | `ontology-mobile-dark.png` | Dark mobile layout remains readable with no horizontal overflow. |

The accessibility snapshot exposes `Event ontology` in the methodology sidebar and renders `Event ontology — pulse-event-ontology/v3.0` at the target anchor. The page produced no browser errors. The only console line was the normal Next.js development-mode React DevTools notice.
