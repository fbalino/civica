# Clean-room reproduction

**Contract:** `civica-clean-room-fixture/v2`

This fixture proves that Civica's published Atlas export logic can be installed
and run from a clean checkout using only checked, legally shareable inputs. It
does not claim to reconstruct source records that Civica never captured for a
frozen release.

## What the fixture contains

`data/fixtures/clean-room/atlas-input.v1.json` contains three jurisdiction rows
and three frozen canonical facts, one each from CIA Factbook, Wikidata, and
World Bank. These rows come from the public `atlas-2026-07-11` package and
retain their stable IDs, source IDs, vintage labels, cutoffs, values, and hashes.

No publisher workbook, restricted text, image, Index score, Pulse record,
private submission, database dump, or credential is included.

## Requirements

- Git
- Node.js 25.4.0 (the release BOM records the exact tool version)
- npm and network access to the public npm registry for `npm ci`
- no database, model-provider, or publisher credential

## Fresh-checkout procedure

```bash
git clone <public-repository-url> civica-clean-room
cd civica-clean-room
git checkout <commit-containing-DAT-019>
npm ci
npm run reproduce:clean-room -- --strict-clean
npm test
npm run build
```

Do not copy `.env.local`, `node_modules`, `.next`, `.turbo`, `.cache`, downloaded
publisher files, or files from another branch into the checkout. `npm ci` must
create `node_modules` from the checked lockfile.

The strict reproduction command refuses database/model credentials, a local
environment file, and framework/cache output. It builds the normalized export
in memory, verifies relational joins and source rights through the production
export builder, and compares exact bytes to the checked expectation.

## Expected result

- fixture SHA-256:
  `78d1bf5d5fa335aa98f8424f9387cb45b1d5bbc1158dff9d8686a3bd4a6f8113`
- normalized export SHA-256:
  `8ff633f5447f59b6771c7ae10b63b407df9af99aab632889967a073c6386e639`
- rows: 3 jurisdictions, 3 facts, 3 source-rights records
- tolerance: exact canonical JSON bytes
- credentials used: none
- runtime network requests after `npm ci`: zero

Any mismatch is a failed reproduction. Do not update the expected hash unless a
reviewed fixture or export-contract change intentionally changes the bytes.
