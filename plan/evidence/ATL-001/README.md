# ATL-001 evidence

ATL-001 establishes `civica-atlas-surface-data-matrix/v1` as the canonical
inventory of public Atlas data surfaces and unified-country modules.

## Result

- 37 route/module rows cover 14 top-level data surfaces and all 23 shared or
  tab-specific country modules.
- Every row records renderer, query/loader, tables and fields, provenance,
  coverage, seven UI/data states, existing tests or a named test gap, owner,
  and frozen-release relation.
- The validator binds the 13 Factbook section IDs and seven Civica Data section
  IDs to the actual page sources, verifies every referenced file/symbol/test,
  and compares the checked JSON byte-for-byte with the deterministic generator.
- The export relation follows `civica-atlas-export/v3`: route visibility never
  grants permission to redistribute restricted or experimental data.
- Current state gaps are assigned to ATL-018 rather than silently accepted.

## Verification

```sh
npm run generate:atlas-surface-data-matrix
npm run validate:atlas-surface-data-matrix
npx eslint src/lib/atlas/surface-data-matrix.ts src/lib/atlas/surface-data-matrix.test.ts scripts/generate-atlas-surface-data-matrix.ts scripts/validate-atlas-surface-data-matrix.ts
npx tsc --noEmit
node plan/tools/validate-master-plan.mjs
npm run build
```

The SP ATL surface audit was read-only and supplied a second route/import
inventory. The controller independently checked the query and release scope.
No database row, public route, or UI was changed.
