# CLM-014 evidence — honest editorial-illustration disclosure

## Outcome

Civica now identifies country and territory engravings as AI-assisted, non-documentary editorial illustrations at the point of display, from About, and in a canonical Licensing policy. The policy states the current truth: the launch corpus lacks complete per-asset generation records, forward-created or replaced assets retain records, automated and human QA remain limited, landmark/caption errors can be reported through Contact, and no separate third-party reuse license is granted while provenance and legal review remain pending.

The country caption is structural rather than copied into hundreds of caption strings. It renders whenever an engraving exists, links to `/licensing#imagery`, and occupies a dedicated final masthead row so map and image tiles cannot obscure it.

## Contract surface

- `src/app/licensing/page.tsx` — canonical imagery policy and licensing-table posture
- `content/about.md` — short link-only disclosure
- `src/components/factbook/FactbookHeaderStrip.tsx` — always-on country/territory caption disclosure
- `src/app/factbook.css` — restrained, responsive, clickable caption treatment with no tile overlap
- `src/lib/claims/public-claims.ts` and `src/lib/docs/doc-concepts.ts` — registered claim and canonical-source ownership
- `src/lib/illustrations/editorial-illustration-disclosure.ts` — pure policy/surface checks
- `scripts/validate-editorial-illustration-disclosure.ts` — DB-free, fail-closed build guard
- `src/lib/illustrations/__tests__/editorial-illustration-disclosure.test.ts` — adversarial fixtures

## What the guard proves

- the canonical policy contains non-documentary, tools, incomplete launch-records, forward-retention, automated/human QA, correction, display-authorization, and conservative reuse statements;
- false complete-manifest or complete-QA claims, documentary-photo language, and permissive reuse grants fail;
- About remains a short link-only pointer;
- the country/territory disclosure cannot be gated on a landmark caption;
- the caption link, visible copy, hover/focus treatment, and pointer-event repair remain present;
- a manifest filename alone cannot unlock a completeness claim; coverage stays fail-closed until a later validator proves every published asset is represented.

## Verification

- focused adversarial fixtures: **38/38**
- full suite: **275/275**
- `npm run validate:editorial-illustrations`: pass, zero issues across all four checked surfaces
- public claims: 32 claims, 14/14 surfaces, 36 markers, zero authority/grade/unregistered leaks
- docs, content templates, design tokens, numeric claims, metadata, API docs, replication, freshness, TypeScript, targeted ESLint, and diff checks: pass
- production build: pass, 85 static pages; known pre-existing Turbopack broad-trace warning only
- clean production Chrome: HTTP 200, zero console/page errors, zero horizontal overflow, no caption/title/tile overlap, working anchor and keyboard focus; see `browser-checks.md`

## Independent work and review

- `FB5 CLM-014 disclosure design` — Fable 5, binding read-only information-architecture and presentation decision
- `OP48 CLM-014 provenance contract` — Claude Opus 4.8, independent truth/rights/acceptance architecture
- `SN5 CLM-014 policy surfaces` — Claude Sonnet 5, bounded UI/policy implementation
- `SN5 CLM-014 disclosure validator` — Claude Sonnet 5, partial contract/fixture implementation; stopped after ten minutes of expansion, then hardened and completed by primary Codex
- `FB5 CLM-014 placement correction` — Fable 5, screenshot-grounded correction after browser QA reproduced the map/image-tile obstruction
- Primary Codex — contract repair, fail-closed coverage gate, build/browser QA, evidence, and closure
- `OP48 CLM-014 final acceptance` — Claude Opus 4.8, independent final review: **ACCEPT, no blockers**

## Deliberate boundary

CLM-014 publishes the truthful disclosure policy; it does not pretend the missing launch-corpus manifest has been reconstructed. Country-wide asset-manifest backfill and automated QA belong to EXP-010/EXP-011, while final copyright/reference/reuse determinations remain gated by BRD legal review.
