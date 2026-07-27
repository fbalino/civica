# BRD-008 — release-specific data rights and attribution

Completed 2026-07-12. Data rights are published per source/field, not as one
blanket dataset license. Verified by `src/lib/rights/release-rights.test.ts`.

## How the Done-when is met (composed from shipped work)
- **DAT-003 manifest is reader-accessible:** `/licensing` (page) +
  `/licensing#rights-manifest` + `/api/rights-manifest`.
- **Each bulk table/field/source has reuse terms + attribution:** the frozen
  Atlas export (`src/lib/exports/atlas-release.ts`, DAT-017) joins every fact
  row to its `SOURCE_RIGHTS` record — `licenseId`, `termsUrl`, `publicExport`,
  `commercialUse`, `derivatives`, **`attributionRequired`**, `shareAlikeRequired`,
  and `restrictions` — and the codebook documents each field.
- **Excluded/restricted inputs are named:** the export description states
  "Civica Index, Pulse, alternates, restricted source rows, images, and
  publisher payloads are excluded."
- **Machine-readable metadata agrees:** `src/lib/seo/metadata-contract.ts`
  (CLM-013/018) forces `Dataset.license` to equal the canonical rights-registry
  URL (`/licensing#reuse`) — never a blanket CC license — and requires
  `conditionsOfAccess` to disclose that free access is not a reuse license,
  with `isAccessibleForFree` a boolean.
- **Download acceptance does not misstate rights:** the reuse-rights registry
  (CLM-018) already replaced any "all data is open" language; the export payload
  carries the per-source rights and exclusion notes, and the download is linked
  from the rights-aware licensing/API surfaces.

## Verification
- `release-rights.test.ts` — 3 tests: every source carries an explicit
  export decision + attribution flag + restrictions list (no blanket grant);
  the export module embeds `SOURCE_RIGHTS`/`attributionRequired` and names
  exclusions; the metadata contract binds `Dataset.license` to the rights
  registry with an access-≠-reuse disclosure. All pass.

## Note
The remaining decision — whether/when to grant a broader reuse license — is
owner/legal (BRD-003/007). This task ensures the *current* posture is published
release-specific and honest, not blanket.
