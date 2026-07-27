# GOV-002 — accountable authorship and contributor identity

Completed 2026-07-11.

## Outcome

`civica-authorship-contributions/v1` identifies Fernando Baliño as the responsible human author and Civica Atlas as the organizational publisher. The record includes:

- independent status with no institutional affiliation claimed;
- the public Civica Atlas contact route;
- nine defined contribution roles;
- three contribution-history periods linked to Git and plan evidence;
- an explicit null ORCID with the reason that none was supplied and no reliable public match was located; and
- rules for consented contributor additions and preservation of prior roles.

The root citation, frozen Atlas release-candidate citation, and Governance Evidence/Index packet citation all name Fernando personally. The generated G2 archive, checksums, review-packet inventories, and hashes were rebuilt after the metadata change. Fifteen blog posts no longer use the anonymous “Civica Team” byline.

Local browser QA on `/blog/anatomy-of-a-modern-coup` confirmed the byline in the article header, author rail, and author card. That check also found a pre-existing hydration mismatch caused by testing `navigator.share` during render. `ShareButtons` now detects native-share support after mount, so server and first-client output agree; the retest showed zero console warnings or errors.

## Artifacts

- `plan/research/authorship-and-contributor-identity-v1.md`
- `data/research/authorship-and-contributions-v1.json`
- `src/lib/research/authorship.ts`
- `CITATION.cff`
- `data/releases/atlas-2026-07-11/g2-rc1/CITATION.cff`
- `data/releases/governance-evidence-review-packet-2026-07-v4/CITATION.cff`
- `plan/evidence/GOV-002/author-name-correction-2026-07-26/README.md`

## Verification

- `npm run validate:authorship-record`
- `npm run validate:governance-evidence-review-packet`
- `npm run validate:g2-atlas`
- `npm run validate:atlas-review-packet`
- `npm run validate:index-review-packet`
- `npx tsc --noEmit`
- `npm run validate:design-tokens`
- `node plan/tools/validate-master-plan.mjs`
- `npm run build`
- Local browser: `/blog/anatomy-of-a-modern-coup`, named byline present, zero console warnings/errors

The byline establishes human accountability. GOV-004 separately owns the detailed disclosure of agent, model, and tool assistance.
