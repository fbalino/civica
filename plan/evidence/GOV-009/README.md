# GOV-009 — Public-evidence reviewer longlist

Completed 2026-07-11.

## Outcome

`civica-reviewer-longlist/v1` records 24 independently checked candidates under the GOV-008 criteria:

- eight governance-measurement candidates;
- eight political-event-data candidates;
- eight research-data-curation/open-science candidates.

Each record includes current affiliation and institutional base, one current/recent work product, methodological contribution, exact Civica task fit, provisional conflict tier and dependencies, geographic/method perspective, and public institutional or professional page. Every lane contains an outside-US/EU/UK perspective and at least three distinct methodological perspectives.

Claude's 914-line `plan/research/reviewer-longlist-draft-2026-07-11.md` was the research starting corpus. The adopted list is a separate generated report and machine-readable artifact. Entries with unresolved current affiliation, no institutional professional page, stale activity, or excess source-project concentration were not carried into v1. Their omission is not a negative judgment and they remain research leads for a later pass.

Affiliation pages were scraped independently with Firecrawl on 2026-07-11. A direct-link pass reached 35 of 45 unique pages; nine publisher/institution pages returned anti-bot HTTP 403 responses to the plain checker but were supported by Firecrawl/public search evidence. The University of Zurich profile for Enzo Nussio hit a Firecrawl tunnel failure during direct scraping, while Firecrawl search returned the official current profile and the 2025 LYLA publication. This transport limitation is recorded instead of being presented as stronger verification.

## Privacy and contact boundary

No candidate was contacted. The artifacts store public professional page URLs, not direct email addresses, phone numbers, home addresses, personal accounts, inferred protected traits, or availability guesses. Availability, willingness, and complete conflict disclosure remain unknown. GOV-010 may rank; GOV-011 may draft asks; GOV-016 and owner approval still block all contact.

## Verification

- `npm run generate:reviewer-longlist`
- `npm run validate:reviewer-longlist`
- `npx eslint src/lib/research/reviewer-longlist.ts src/lib/research/reviewer-longlist.test.ts scripts/generate-reviewer-longlist.ts scripts/validate-reviewer-longlist.ts`
- `npx tsc --noEmit`
- `node plan/tools/validate-master-plan.mjs`
- `npm run build`

Semantic hash: `c26e149d2c54f870712a478639a5bbe1af33cc31bdce766a82977c5e11a9011c`.
