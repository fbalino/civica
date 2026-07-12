# Dependency, vulnerability, and lockfile policy (PLT-005)

Adopted 2026-07-12. Canonical policy for how Civica manages its npm
dependencies.

## Inventory
- **23 production** dependencies, **16 dev** dependencies (`package.json`).
- Full resolved tree: `package-lock.json` v3, 771 packages.
- Runtime baseline (from PLT-004): Next 16.2, React 19.2, Drizzle 0.45,
  `@neondatabase/serverless` 1.0, Tailwind v4. Node pinned via
  `engines.node: ">=22"` (matches CI).

## Licenses
Every direct dependency resolves to a permissive/standard license — no
copyleft (GPL/AGPL/LGPL) obligations enter the tree:
MIT (20), BSD-3-Clause (3), ISC (3), BSD-2-Clause (1), Apache-2.0 (1),
MPL-2.0 (1, file-level copyleft only, compatible), and one "SEE LICENSE IN
LICENSE.txt" (reviewed permissive). Nine type-only/scoped packages do not
publish a resolvable `license` field and inherit their monorepo's permissive
terms. This is distinct from the *data/source* rights governed by
`src/lib/rights/manifest.ts`.

## Vulnerability scanning
- **Gate:** `npm run validate:deps` = `npm audit --audit-level=critical
  --omit=dev`, wired into CI (`.github/workflows/claims-docs.yml`). **Critical
  production findings block CI.**
- **Current state (2026-07-12):** 11 advisories total (1 high, 9 moderate,
  1 low); 5 touch the production tree. **Zero critical**, so the gate passes.
- **Known high — tracked, not blocking:** `protobufjs` (transitive) — DoS via
  recursive JSON descriptor expansion, `fixAvailable: true`. Practical risk is
  low: Civica never parses untrusted protobuf descriptors. It will be resolved
  by the next Dependabot bump (or `npm audit fix`); it does not warrant an
  emergency force-fix.

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
