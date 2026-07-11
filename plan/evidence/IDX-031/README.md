# IDX-031 evidence

- Reader dashboard: `src/app/governance-evidence/page.tsx`
- Source-native contract and rights-safe export: `src/lib/ci/governance-evidence.ts`
- Exact release query: `src/lib/db/queries-governance-evidence.ts`
- Experimental download route: `src/app/api/governance-evidence/[slug]/route.ts`
- Frozen source-file fidelity validator: `scripts/validate-governance-evidence-dashboard.ts`
- Pure contract fixtures: `src/lib/ci/governance-evidence.test.ts`

The release contains five observations for each of 194 sovereign states: V-Dem Liberal Democracy, WGI Voice and Accountability, WGI Rule of Law, Freedom House combined political-rights and civil-liberties rating, and Transparency International CPI. The validator compares all 970 cells with the immutable release artifact and separately pins Japan's exact values and Freedom House's lower-is-freer direction.

The dashboard never aggregates the rows. Publisher intervals appear only where supplied, and absence is explicit. The JSON download retains values only when the rights manifest permits public export; restricted rows preserve definitions, status, and publisher links but withhold observations and bounds. The endpoint intentionally sits outside `/api/v1` because this research fixture has no stable-API compatibility promise.

Browser verification on `http://127.0.0.1:3000` confirmed Japan and Uruguay, six table rows including the header, canonical navigation, human-readable uncertainty labels, and the rights-safe download. The downloaded Japan fixture retained the two WGI observations and withheld V-Dem, Freedom House, and CPI as declared.

```sh
npm run validate:governance-evidence
npx tsx --test src/lib/ci/governance-evidence.test.ts
npx tsc --noEmit
npm run validate:design-tokens
npm run validate:claims-docs
node plan/tools/validate-master-plan.mjs
```
