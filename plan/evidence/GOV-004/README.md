# GOV-004 — AI and model-use disclosure

Completed 2026-07-11.

## Outcome

`civica-ai-use-disclosure/v1` records eight material uses with systems, role, controls, and limitations:

- code, planning, and documentation assistance;
- internal agent audits and critique;
- Pulse production classification, verification, and jurisdiction attribution;
- non-gold annotation/coding dry runs;
- bounded structured extraction and summaries;
- reader chat;
- editorial and methodological prose; and
- editorial illustrations.

The public About page names exact production models where the repository preserves them. It states that historical agent sessions and launch-corpus images have incomplete model metadata rather than inventing it. Agent audits are internal QA, Spark pilot labels remain permanently non-gold, and no model is described as an author, peer reviewer, or independent validator. Fernando Balino retains publication responsibility.

## Artifacts

- `src/lib/research/ai-use-disclosure.ts`
- `data/research/ai-use-disclosure-v1.json`
- `content/about.md#ai-use`
- `scripts/generate-ai-use-disclosure.ts`
- `scripts/validate-ai-use-disclosure.ts`

## Verification

- `npm run validate:ai-use-disclosure`
- `npm run validate:content-templates`
- `npm run validate:claims-docs` (841 tests)
- `npm run validate:design-tokens`
- `npx tsc --noEmit`
- `node plan/tools/validate-master-plan.mjs`
- `npm run build`
- Local browser: `/about#ai-use`, desktop light/dark, model names and responsibility/peer-review boundaries visible, zero console errors
