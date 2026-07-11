# Civica Index tournament results package v1

This package is the canonical reproducible bundle for the preregistered K0–K5 tournament evidence available before human and external-expert gates. It does not select a winner.

Run the complete workflow from the repository root:

```sh
npm run reproduce:index-tournament-package
npm run validate:index-tournament-package
```

The reproduction command validates the K0 Governance Evidence Dashboard; regenerates the frozen baselines, K1–K5 manifests, shared evaluation envelope, and every registered analysis; records one canonical log per stage; and rewrites the artifact inventory, error ledger, code/environment lock, and manifest. Restricted country-level source values are never copied into this package.

`manifest.v1.json` separates preregistered confirmatory artifacts from exploratory work. V1 contains no exploratory artifact. A new analysis or changed threshold must ship under a separately labelled exploratory release and cannot overwrite these files.

`error-ledger.v1.json` preserves failures, insufficient-evidence states, and gates that still require qualified humans. Those entries are evidence, not workflow errors, and no pending gate is converted into a pass by this package.
