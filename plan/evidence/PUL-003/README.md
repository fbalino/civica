# PUL-003 evidence

## Outcome

PUL-003 adopts `pulse-event-ontology/v3.0` as the Pulse research annotation and evaluation codebook.

The machine contract and public record now provide:

- all 61 carried-forward event categories across five dimensions;
- several labels on one event when each label has a distinct facet, evidence set, and rationale;
- separate effect-direction and five-level nonnumeric severity fields;
- compatibility rules that prevent same-facet duplicates, mutually exclusive outcomes, and generic/specific double coding;
- explicit qualifying, non-qualifying, and insufficient-evidence dispositions;
- guidance for lawful, legitimate, normatively ambiguous, and unsupported cascade cases;
- six executable examples and counterexamples; and
- additive and breaking-change rules that preserve old annotation versions.

The scheduled production classifier still writes one taxonomy-v2.0 category per event. The public methodology and resolution state that the new ontology is not a completed production migration.

## Canonical artifacts

- Executable contract: `src/lib/pulse/v2/event-ontology.ts`
- Contract tests: `src/lib/pulse/v2/event-ontology.test.ts`
- Fail-closed validator: `scripts/validate-pulse-event-ontology.ts`
- Adopted resolution: `plan/research/pulse-event-ontology-v3.md`
- Public record: `/civica-index/methodology/pulse#event-categories`
- Durable decision: `APR-D111`

## Verification

```sh
npm run validate:pulse-event-ontology
node --import tsx --test src/lib/pulse/v2/event-ontology.test.ts
npm run validate:content-templates
npm run validate:doc-sources
npm run validate:claims-docs
npm run validate:design-tokens
npx tsc --noEmit
npm run validate:index-change-control
npm run build
node plan/tools/validate-master-plan.mjs
```

The ontology validator closes six fixtures, including a three-dimension event, an unresolved opposition-corruption case, a lawful non-qualifying emergency, generic/specific double coding, and an unsupported inferred cascade. The aggregate claims gate passes 756 tests. The new validator is part of the production build chain.

## Browser evidence

See `browser-checks.md` and the four viewport screenshots in this directory.

## Remaining limitation

This task adopts the codebook and its publication contract. It does not change stored rows or the scheduled classifier. PUL-004 and later pipeline tasks own the versioned schema and production migration.
