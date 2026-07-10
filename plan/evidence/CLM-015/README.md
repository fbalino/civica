# CLM-015 evidence — canonical research terminology

## Outcome

Civica now has one typed, public research-language contract for the 14 required concepts: source, observation, fact, reconciliation, estimate, indicator, index, signal, event, confidence, uncertainty, validation, replication, and peer review. The public `/glossary` entries are generated from that contract, so the displayed definitions cannot drift from the validator.

The terminology guard is deliberately narrow and high-precision. It does not ban ordinary academic vocabulary. It rejects unsupported affirmative claims that a Civica output is validated, peer reviewed, a calibrated confidence interval, or independently replicated, while allowing explicit negation, implementation/schema discussion, external scholarship, and accurately qualified status language.

## Contract surface

- `src/lib/research-terminology.ts` — canonical definitions, methodology links, registered public surfaces, and pure lint rules
- `src/lib/data/glossary.ts` — generated public glossary entries
- `src/lib/research-terminology.test.ts` — structural, violation, and false-positive-resistance fixtures
- `scripts/validate-research-terminology.ts` — deterministic DB/network-free publication and conformance guard
- `src/lib/docs/doc-concepts.ts` — canonical-source and public-surface registration
- `package.json` — `validate:terminology` and build-gate integration

## What the guard proves

- the registry contains exactly the 14 required unique terms with definitions and methodology links;
- every canonical term appears exactly once in the public glossary with the same text and a stable deep-link anchor;
- the eight registered research surfaces exist and either link to the glossary or conform to the terminology rules;
- affirmative Civica validation, peer-review, confidence-interval, and independent-replication overclaims fail;
- negated status, external literature, implementation/schema discussion, and ordinary scholarly uses remain permitted.

## Verification

- focused terminology fixtures: **15/15**
- full suite: **290/290**
- `npm run validate:terminology`: pass; 14 canonical terms, 72 public glossary entries, 8/8 registered surfaces conformant
- docs, content templates, public claims, design tokens, TypeScript, targeted ESLint, diff checks, and production build: pass
- production browser: desktop light and mobile dark, stable deep links, 72 rendered entries, no horizontal overflow, and no warning/error logs; see `browser-checks.md`

## Independent work and review

- `SN5 CLM-015 terminology inventory` — Claude Sonnet 5, bounded read-only gap inventory
- `OP48 CLM-015 terminology contract` — Claude Opus 4.8, stopped after exceeding the bounded review window without returning a result
- `SN5 CLM-015 terminology implementation` — Claude Sonnet 5, stopped after an unbounded run left a partial registry/glossary implementation; primary Codex audited, repaired, tested, and completed it
- Primary Codex — contract hardening, validator, fixtures, documentation registry, build/browser QA, and closure
- `SN5 CLM-015 final acceptance` — Claude Sonnet 5, independent read-only review: **ACCEPT, no blockers**

## Deliberate boundary

CLM-015 establishes enforceable meanings and blocks four especially misleading claim shapes. It is not a general-purpose prose style checker or proof that every future epistemic overclaim is machine-detectable. New load-bearing claims must extend the canonical registry and targeted fixtures when needed.
