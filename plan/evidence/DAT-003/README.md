# DAT-003 evidence — source and export rights manifest

Status: implementation complete on 2026-07-10.

## Outcome

`rights-manifest/v1` is now the canonical machine-readable contract for source,
field-class, product, and release-artifact rights. It is available to readers
at `/licensing#rights-manifest` and as JSON at `/api/rights-manifest`.

The manifest closes all 43 external production source specifications from
DAT-002. Six records have verified official terms: CIA Factbook and World
Leaders as United States public-domain information, Wikidata structured data
under CC0, and three World Bank source identities under CC BY 4.0. The other 37
records remain pending, non-commercial, restricted, or blocked. None can
silently become export permission.

## Export enforcement

- `evaluatePublicExport()` rejects unknown products, unknown sources, pending
  terms, incompatible rights, and products whose field classes are incomplete.
- The legacy country JSON/CSV route is intentionally withheld with HTTP 503.
  Its cached, derived, and source-backed fields cannot all trace to verified
  allowed terms. DAT-017 and DAT-027 own the replacement.
- The frozen `ci-beta-2024-Q4` release artifact includes the checked input
  metadata manifest and explicitly excludes every publisher payload. It does
  not claim that an Atlas dataset or Index score package has been released.
- API documentation exposes the blocked response and states that there is no
  supported bulk-download workaround.

## Executable contract

- `src/lib/rights/manifest.ts` — canonical source/product/field/artifact model
  and fail-closed export evaluator
- `src/app/api/rights-manifest/route.ts` — machine-readable public route
- `src/app/licensing/page.tsx` — reader-facing rights registry
- `scripts/validate-rights-manifest.ts` — build gate for manifest closure and
  export enforcement
- `src/lib/rights/__tests__/manifest.test.ts` — six positive and adversarial
  fixtures
- `src/app/api/countries/[slug]/export/route.ts` — explicit legacy-export block

## Verification

- 43/43 production sources have one rights record
- 6 verified and 37 pending/restricted source records
- 2 export product records and 1 release-artifact record
- 375/375 repository tests passed
- TypeScript, focused ESLint, design-token validation, rights claims, API docs,
  the aggregate claims/docs gate, production build, and master-plan validation
  passed
- Desktop and 390×844 browser checks passed after repairing shared table
  scrolling; see `browser-checks.md`

This is a technical reuse-control record, not legal advice. BRD-007/008 still
own the repository code-license choice and final release-specific publication
terms.
