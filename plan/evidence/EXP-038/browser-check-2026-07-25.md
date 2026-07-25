# EXP-038 browser check

Date: 2026-07-25

Status: pass

The approved English-copy subset was checked against the local application at
desktop (1440 × 1000) and mobile (390 × 844) widths.

Routes:

- `/`
- `/about`
- `/methodology`
- `/country/andorra`
- `/country/andorra/constitution`
- `/governance-evidence?country=andorra`
- `/licensing`
- `/contact`
- `/about/advisory-board/apply`

All 18 route-and-viewport checks returned HTTP 200 and rendered the expected
approved phrase. None produced horizontal overflow, a page error, a failed
request, or a product console error. The unchanged home label
`Independent & nonpartisan` and the held About sentence
`We are not these institutions.` also remained rendered at both widths.

The local Next.js development server emitted only its known hot-reload WebSocket
handshake noise. That local-development transport noise was identified
separately and excluded from the product-console-error result.

Screenshots were retained as uncommitted local test output under
`output/playwright/exp038/`.
