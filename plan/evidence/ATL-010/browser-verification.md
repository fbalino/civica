# ATL-010 browser verification

Verified 2026-07-23 with system Chrome against `localhost:3000`.

## Prepared directory implementation

Before public-data gating, the implementation rendered HTTP 200 with 314 rows,
314 source dots, 314 stable-record links, and zero page overflow. Searching
`Uruguay` reduced the table to Yamandú Orsi only. The head-of-state role filter
returned 159 rows and the first ten inspected rows all carried that role.
Clicking the country column produced descending order with Zimbabwe first.
The theme control switched the document to dark mode. A 360x800 reload
preserved dark mode, rendered the page H1, and had zero root overflow. No
console warnings, errors, or page errors occurred when loaded through
`localhost`.

An initial `127.0.0.1` run produced only Next development HMR WebSocket
handshake failures and no hydration; rerunning at the server's canonical
`localhost` origin eliminated those failures. That was a dev-origin artifact,
not accepted interaction evidence.

## Publication-paused state

After the live source audit found 89 discrepancies, the checked release was
marked `blocked_source_refresh`. The final browser pass verifies HTTP 200,
the publication-paused notice, zero table rows, zero stale officeholder names,
light/dark rendering, 360px zero-overflow behavior, and no console errors.
