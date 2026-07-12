# EXP-037 — independent country map controls

The country masthead map no longer places MapLibre-generated links inside its activation button. The tile now has three sibling responsibilities:

- a noninteractive map preview with injected controls disabled;
- one native, full-tile button named for the country;
- a separate attribution group with independently named OpenStreetMap and Protomaps/OpenFreeMap links.

Closing the interactive map restores focus to the activation button. The button retains native semantics and handles Enter and Space explicitly.

## Proof

- `src/components/factbook/CountryMapTile.test.ts` rejects attribution links nested in the activation, missing independent names, missing keyboard semantics, or missing focus restoration.
- `src/components/factbook/CountryMap.tsx` keeps MapLibre attribution in interactive maps and disables it only in the masthead preview.
- The live Japan browser result is recorded in `browser-contract.json`: the tile center targets the activation button, each attribution center targets its own link, pointer activation opened the dialog, focus returned to the country-specific activation, Enter reopened it, zero controls were nested, and two attribution links were present.
- `node --import tsx --test src/components/factbook/CountryMapTile.test.ts`, `npm run typecheck`, and `npm run validate:design-tokens` pass.

No data, route, or asset migration is required. A rollback must retain valid sibling controls and map attribution; restoring a button around the MapLibre preview is not acceptable.
