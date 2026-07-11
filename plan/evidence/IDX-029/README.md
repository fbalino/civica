# IDX-029 evidence

## Outcome

`data/releases/civica-index-research-archive-2026-07-v1/` preserves the rejected and inconclusive Index research without keeping it live as a recommended product.

- The archive's semantic SHA-256 is `4ae82eda809342a44574a3cf3142ecc6df440f2047b64a5b268114f2112b465a`.
- `code-snapshot.v1.tar.gz` contains 72 exact tournament source files from commit `577dca29d816a0c781281ba843ad577e326e3d67`; every extracted file matches its frozen SHA-256.
- All 22 tournament artifacts retain path, size, role, analysis class, and hash.
- K1's originality failure and K2's drop-one-rater stability failure remain explicit.
- Fourteen insufficient-evidence results remain null or insufficient rather than becoming passes.
- K1–K5 each retain their code/result artifact map, reason, and `not_recommended` standing.
- No restricted country-level publisher values are copied into the archive.
- Revival requires a new version, rerun gates, retained adverse/null results, a new disposition resolution, and passing public quarantine/claims checks.

## Verification

```sh
npm run validate:index-research-archive
npm run validate:index-quarantine
node --import tsx --test src/lib/ci/index-research-archive.test.ts
npx tsc --noEmit
npm run build
node plan/tools/validate-master-plan.mjs
```

The validator reads the checked-in tarball, compares its inventory with the frozen code manifest, extracts and hashes every file, checks all current tournament artifacts and verification manifests, and confirms the adopted source-native disposition. Negative tests prove that recommendation revival, dropped failures, and ambiguous standing fail closed.
