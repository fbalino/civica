# PUL-002 evidence

## Outcome

PUL-002 adopts `pulse-ledger-charter/v1`.

The charter defines:

- one documented, evidence-linked domestic institutional event record as the ledger unit;
- researchers, journalists, civic educators, reviewers, and uncertainty-preserving data users as intended users;
- prohibited automated decisions, country scoring/ranking, and specialist-dataset substitution;
- six admission and six exclusion rules;
- eligible source classes and the generated runtime basket boundary;
- jurisdiction, attribution, temporal, and language scope;
- five explicit non-claims and four observability limitations;
- five noncompensating success criteria and five suspension/retirement criteria;
- a version rule and a valid no-value outcome.

The citable public record is `/civica-index/methodology/pulse#research-charter`. The adopted resolution is `plan/research/pulse-ledger-research-charter-v1.md`; the executable contract is `src/lib/pulse/v2/research-charter.ts`.

## Adoption snapshot

The read-only live check found 384 retained `pulse_events_v2` rows across 89 jurisdictions. The earliest stored event date is 2026-04-13. The charter names this only as the adoption snapshot&rsquo;s earliest retained event, not the start of complete observation.

## Verification

The scoped commit is named `research: adopt bounded Pulse ledger charter`; its hash is available in Git history beside this evidence directory.

```sh
npm run validate:pulse-ledger-charter
npm run validate:pulse-ledger-charter:live
node --import tsx --test src/lib/pulse/v2/research-charter.test.ts
npm run validate:content-templates
npm run validate:doc-sources
npm run validate:claims-docs
npm run validate:design-tokens
npx tsc --noEmit
npm run build
node plan/tools/validate-master-plan.mjs
```

Four contract tests pass, including a seeded incomplete-charter failure. The live adoption snapshot, citable anchor, public prose, resolution sections, and machine-readable contract are bound by `npm run validate:pulse-ledger-charter`.

## Browser evidence

See `browser-checks.md` and the four viewport screenshots in this directory.

## Remaining limitations

The charter fixes the research question and stopping rules; it does not validate the current ontology, sources, retrieval, clustering, attribution, classifier, publication gate, or numeric effects. Those remain assigned to later Pulse tasks. No human or external result is claimed.
