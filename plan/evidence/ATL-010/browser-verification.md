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

## Activated-directory pass (2026-08-10, worktree dev server, in-app Chromium)

After the authorized production refresh and release `leaders-2026-08-10`
(`publicationStatus: ready`), the live `/leaders` route rendered 389 rows on a
fresh tab with zero console errors. Searching `Uruguay` reduced the table to
Yamandú Orsi's two dual-office rows; `Russia` returned Putin and Mishustin
(restored after the identity repair); `Samoa` returned only the verified head
of state, with the ambiguous head-of-government role absent as explicit
noncoverage and the exclusion policy stated in the info banner. The
head-of-state role filter returned 199 rows (co-leadership rows included),
all carrying that role in the first ten inspected rows. Country-column
sorting produced Zimbabwe first in descending order and Afghanistan first
ascending. The theme toggle switched dark → light; a 360 × 800 reload
preserved the theme, rendered the H1, and had zero root/body horizontal
overflow.

EXP-029 surfaces on the same server: person and office source forms render
in the directory through `<SourceText>` with visible
"Name in native language / Official source form · language · not translated"
labels (Pashto, Arabic, Russian, Samoan, Spanish inspected); forms
byte-identical to the displayed English name are suppressed as noise. A
hydration mismatch found during this pass (client ICU lacking the Tibetan
language display name) was fixed by computing language labels once at the
server boundary; a fresh tab afterwards loaded with zero console errors.
Country mastheads showed "Official name (source language) · 日本国" for Japan
and a seven-form wrapped row for Switzerland in both themes with no
horizontal overflow, and `/about#language` rendered the English-interface
disclosure. The footer "World Leaders" link is present.
