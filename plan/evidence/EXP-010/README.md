# EXP-010 — complete editorial illustration manifest

- Contract: `civica-editorial-illustration-manifest/v1`.
- Generated artifact: `src/lib/illustrations/illustration-manifest.generated.json`.
- Generator/checker: `scripts/generate-illustration-manifest.ts`.
- Commands: `npm run generate:illustration-manifest` and `npm run validate:illustration-manifest`.

## Coverage

- 550 tracked WebP assets.
- 394 country assets (197 exact light/dark pairs).
- 112 territory/special-jurisdiction assets (56 exact pairs).
- 14 page assets (7 exact pairs).
- 30 shared assets (15 exact pairs).
- Zero missing partners and zero missing intended-subject captions.

Each row records an entity identifier, route(s), intended subject/caption, theme partner, URL, byte count, dimensions, aspect ratio, color space, SHA-256, first tracked Git commit/time, known edit history, imagery disclosure/policy, source-evidence prohibition, and file/caption/color/semantic QA state. The manifest also binds the corpus to the BRD-010 rights policy and its Git/frozen-release retention rule.

## Honest provenance limit

The original sessions did not retain model, tool, prompt, seed, or source-reference metadata. The manifest marks these fields `unknown-not-retained` and the session `partial-irrecoverable-generation-session`; it does not convert a Git commit date into a generation date. Current strength-60 country grading is linked to its checked report. The two deterministic source-logo strips are classified separately with model/prompt `not-applicable`.

The validator rebuilds the artifact from current bytes, caption registries, Git introduction history, route mappings, and known grading policy. Any new, removed, modified, unpaired, or uncaptained asset makes the checked artifact drift and fails the editorial-illustration build gate.
