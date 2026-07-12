# GOV-011 — Personalized reviewer dossiers and bounded asks

Completed 2026-07-11.

## Outcome

`civica-reviewer-dossiers/v1` generates 18 one-page dossiers: every proposed primary and alternate in the three core scholarly lanes. Each dossier contains:

- a candidate-specific fit rationale;
- one exact bounded review question;
- the packet and four versioned artifact paths;
- an 8–12 or 12–16 hour estimate and review window;
- a concrete structured deliverable;
- candidate-specific conflict/dependency language and recusal terms;
- preservation, author-response, consented-publication, nonendorsement, and withdrawal terms;
- an honorarium posture that remains pending GOV-012 and is never outcome-contingent;
- a respectful personalized contact draft that permits a decline without explanation.

Pulse dossiers explicitly wait for the completed GOV-015 post-prospective-evaluation packet. The drafts do not pretend that unavailable artifacts are ready.

## Verification

- `npm run generate:reviewer-dossiers`
- `npm run validate:reviewer-dossiers`
- `npx eslint src/lib/research/reviewer-dossiers.ts src/lib/research/reviewer-dossiers.test.ts scripts/generate-reviewer-dossiers.ts scripts/validate-reviewer-dossiers.ts`
- `npx tsc --noEmit`
- `node plan/tools/validate-master-plan.mjs`
- `npm run build`

Semantic hash: `10a1827b907383f924736405948afd784754b7cdab27b3f3e612be8f54db8ee6`.

No draft was sent, no candidate was contacted, and no honorarium was offered.
