# Dependency, vulnerability, and lockfile policy (PLT-005)

Adopted 2026-07-12; inventory refreshed 2026-07-23. Canonical policy for how
Civica manages its npm dependencies.

## Inventory
- **25 production** dependencies, **19 dev** dependencies (`package.json`).
- Full resolved tree: `package-lock.json` v3, 791 packages.
- Runtime baseline (from PLT-004): Next 16.2, React 19.2, Drizzle 0.45,
  `@neondatabase/serverless` 1.0, Tailwind v4. Node pinned via
  `engines.node: ">=22"` (matches CI).

## Licenses
Every installed direct dependency publishes a resolvable package-level license:
MIT (30), Apache-2.0 (5), BSD-3-Clause (3), ISC (3), BSD-2-Clause (1),
MPL-2.0 (1, file-level copyleft), and one `SEE LICENSE IN LICENSE.txt`.
That last package is `mapbox-gl`, whose supplied file contains Mapbox product
terms rather than a permissive license. Civica loads it only for the
token-gated Mapbox 3D view, so use and distribution remain subject to the
Mapbox account/product terms and its bundled notices. The root Civica LICENSE
does not relicense any dependency. No GPL, AGPL, or LGPL package appears in the
direct inventory. This is distinct from the *data/source* rights governed by
`src/lib/rights/manifest.ts`.

## Vulnerability scanning
- **Gate:** `npm run validate:deps` = `npm audit --audit-level=critical
  --omit=dev`, wired into CI (`.github/workflows/claims-docs.yml`). **Critical
  production findings block CI.**
- **Current state (2026-07-23):** nine production-tree advisories (seven high,
  two moderate), with **zero critical**, so the declared critical-only gate
  passes. The live audit identifies direct or transitive findings involving
  Next.js, Anthropic SDK, Transformers/ONNX/adm-zip, js-yaml, PostCSS,
  protobufjs, and sharp. This refreshed record does not reclassify those
  findings as acceptable release risk; ordinary dependency remediation remains
  required through reviewed upgrade tasks and the full CI/build gates.

## Lockfile integrity
- `package-lock.json` is committed and authoritative. CI and clean installs
  use `npm ci` (fails on any lockfile/`package.json` drift). The secret scanner
  (PLT-007) also covers the lockfile.

## Update cadence
- **Dependabot** (`.github/dependabot.yml`): weekly npm + github-actions PRs;
  minor/patch grouped into one PR, majors separate, labeled `dependencies`.
- Each Dependabot PR runs the full CI gate (typecheck, lint, deps audit,
  secrets, claims-docs) before merge.

## Emergency process (critical advisory)
1. Confirm exposure (is the vulnerable path reachable in production?).
2. Apply the minimal fix (`npm audit fix`, a pinned override, or an upgrade);
   if no fix exists, mitigate at the call site or remove the dependency.
3. `npm ci` + full build + affected tests must pass.
4. Deploy; record the advisory, fix, and verification in an evidence note.
5. If the credential/data was exposed rather than code, follow the PLT-007
   rotation path instead.
