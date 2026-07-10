# CLM-013 evidence — executable public metadata contract

## Outcome

Civica now has one executable metadata policy for the apex origin, canonical URLs, Open Graph/Twitter cards, sitemap dates, experimental labels, and Dataset JSON-LD. A production crawler fetches every sitemap URL and fails on missing, duplicate, off-route, off-domain, noindex, malformed, or epistemically mislabeled metadata.

The final production sitemap contains 843 canonical URLs: all 253 country Factbook pages, all 253 Civica Data pages, all 253 Constitution pages, 23 organization detail pages, 10 comparison URLs, the blog archive/posts, and the public static surfaces. The redirect-only `/organizations` route is deliberately excluded in favor of its canonical detail pages.

## Contract surface

- `src/lib/site.ts` — hardcoded apex origin, absolute-URL helper, and checked-in metadata content release date
- `src/lib/seo/metadata-contract.ts` — shared HTML/JSON-LD parser and pure validation rules
- `src/lib/seo/__tests__/metadata-contract.test.ts` — adversarial contract fixtures
- `scripts/validate-metadata.ts` — DB-free build guard for host/date/Dataset/root-OG/sitemap-source invariants
- `scripts/crawl-public-metadata.ts` — bounded live crawler over every `<loc>` in `sitemap.xml`
- `src/app/sitemap.ts` — stable source-backed dates: stored jurisdiction timestamps, blog dates, comparison-country maxima, or the checked-in content release date

## What the crawler proves

For every sitemap URL:

- HTTP 200, with no duplicate sitemap locations
- exactly one absolute apex canonical equal to the sitemap location
- exactly one `og:url` equal to the canonical, including query-string comparisons
- apex Open Graph and Twitter images plus `summary_large_image`
- no `noindex`, preview, `www`, Vercel, localhost, HTTP, or unrelated canonical host
- every JSON-LD block parses
- Index-facing metadata—not body chips—states research-Beta/Beta/research-experiment status
- Pulse-facing metadata states experimental or archived-diagnostic status
- `/civica-index` carries exactly one strict, apex-linked Dataset node with the research-Beta and independent-review disclosures

## Verification

- first production crawl — diagnostic success: 830/844 routes passed and the guard found 14 real closure cases (three unqualified Index metadata descriptions, one redirect-only sitemap route, and HTML-escaped comparison canonicals)
- final production crawl — pass: **843/843** routes satisfy the complete metadata contract
- focused metadata fixtures — **53/53**, including wrong/missing/duplicate canonicals and OG URLs, unrelated HTTPS hosts, body-only Beta text, malformed JSON-LD, every required Dataset field, stale-host source literals, and wall-clock sitemap dates
- `npm run validate:metadata` — all five DB-free build checks pass across 53 metadata-emitting app files and core SEO modules
- `npm run validate:public-claims` — 31 claims, 14/14 required surfaces, 35 markers, zero unregistered/authority/grade leaks
- `npm test` — 237/237
- `npm run build` — pass: all build guards, TypeScript, and 85 static pages; known pre-existing Turbopack broad-trace warning only
- production Chrome QA — pass across home, Index, Pulse methodology, query comparison, country Civica Data, and country Constitution; see `browser-checks.md`

## Independent work and review

- `SP53 CLM-013 metadata inventory` — GPT-5.3 Codex Spark CLI; terminated after an unbounded 85-command read-only expansion without a concise verdict
- `OP48 CLM-013 metadata contract` — Claude Opus 4.8, read-only acceptance architecture
- `SN5 CLM-013 core contract` — Claude Sonnet 5, bounded metadata/crawler implementation
- `SN5 CLM-013 routes and copy` — Claude Sonnet 5, sitemap coverage and research-posture metadata
- `SN5 CLM-013 contract hardening` — Claude Sonnet 5, metadata-only status and strict Dataset/host fixtures
- Primary Codex — route-universe correction, marker integration, unrelated-host hardening, two-pass live crawl, production browser QA, and closure evidence
- `OP48 CLM-013 final acceptance` — Claude Opus 4.8, independent final review

## Deliberate boundary

Per-route generated social artwork is an enhancement, not a CLM-013 requirement; the validated 1200×630 default card remains canonical. A web manifest/favicon program and the eventual omnibus claims/documentation CI command remain assigned to later checklist tasks.
