# DAT-001 browser checks

Checked locally on 2026-07-10 at `http://localhost:3001` with the in-app browser.

## Methodology disclosure

- Desktop inspection of `/civica-index/methodology#normalization` showed the
  generated World Bank Voice & Accountability fallback row and the explanatory
  prose identifying it as a construct substitution.
- The page did not claim that WGI Voice & Accountability is equivalent to
  V-Dem or conceal its source identity.
- At 390×844, the fallback row and substitution disclosure remained present.
  Document width and scroll width were both 379px, so the new table/prose caused
  no horizontal overflow.

## Runtime health

- The methodology route returned HTTP 200.
- The local Next.js process reported no page render/runtime failure during the
  desktop or mobile checks.
