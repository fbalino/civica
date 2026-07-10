# DAT-004 browser checks

Checked locally on 2026-07-10 at `http://localhost:3001` with the in-app browser.

## Sovereign-state catalog

- `/country` returned HTTP 200, rendered France, and did not render Puerto Rico
  in the sovereign-state catalog.
- The desktop document stayed within the 1280px viewport.
- `GET /api/v1/countries?limit=250` returned 194 rows with `meta.total = 194`,
  included France, and excluded Puerto Rico.

## Non-sovereign reference continuity

- `/country/cook-islands` remained directly available and rendered its country
  profile after the database type changed to `associated_state`.
- No status-label UI was added in DAT-004. The canonical display policy is data;
  ATL-006 owns its Fable-led application across public surfaces.

## Runtime health

- Browser logs contained no warnings or errors.
- The local Next.js process reported successful responses for the catalog,
  associated-state profile, and countries API.
