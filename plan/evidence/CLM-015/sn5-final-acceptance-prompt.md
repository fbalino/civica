# SN5 CLM-015 final acceptance review

Project root: `/Users/fernandobalino/Projects/civica`

Role: independent, read-only acceptance reviewer for CLM-015.

Bounded objective: inspect only the CLM-015 implementation and determine whether it satisfies this checklist item:

> Create and enforce a research terminology glossary for source, observation, fact, reconciliation, estimate, indicator, index, signal, event, confidence, uncertainty, validation, replication, and peer review. Done when: glossary published, registered public docs link or conform, terminology lint catches prohibited ambiguous usages.

Files in scope:

- `src/lib/research-terminology.ts`
- `src/lib/research-terminology.test.ts`
- `src/lib/data/glossary.ts`
- `scripts/validate-research-terminology.ts`
- `src/lib/docs/doc-concepts.ts`
- `package.json`

You may read directly necessary rendering code for `/glossary` and the eight surfaces listed in `RESEARCH_TERMINOLOGY_SURFACES`, but do not broaden into a site-wide audit.

Forbidden actions:

- Do not edit any file.
- Do not run a dev server or browser.
- Do not inspect unrelated untracked `plan/` files.
- Do not redesign the feature or propose work beyond CLM-015.
- Use no more than 20 tool calls.

Acceptance criteria:

1. The registry contains exactly the 14 required concepts with precise, academically cautious definitions.
2. `/glossary` derives those definitions from the registry rather than duplicating them.
3. The validator is deterministic and network/DB-free, confirms publication/integration, and checks all registered surfaces.
4. The lint catches affirmative claims that Civica outputs are validated, peer reviewed, calibrated confidence intervals, or independently replicated when those states are not established, without broadly banning ordinary scholarly discussion.
5. Tests cover useful positive and false-positive-resistant fixtures.
6. The build integration and documentation-concept registration are coherent.

Expected result envelope: return exactly one concise Markdown report with:

- `Verdict: ACCEPT` or `Verdict: REJECT`
- `Blocking findings:` followed by `None` or numbered findings with file and line references
- `Non-blocking notes:` followed by at most three notes
- `Checks run:` listing only commands actually run

Do not implement fixes. If uncertain, distinguish a blocker from a non-blocking improvement.
