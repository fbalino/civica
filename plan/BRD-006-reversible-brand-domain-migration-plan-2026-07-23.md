# BRD-006 — reversible brand and domain migration plan

**Prepared:** 2026-07-23
**Decision state:** No rename decision; placeholders only
**Inputs:** BRD-001 landscape, BRD-002 registry packet, BRD-003 professional
review gate, BRD-004 decision criteria

## Goal and success criteria

This plan makes either outcome reversible:

1. **Keep:** Civica Atlas remains the public name and no migration work is
   performed beyond recording the legal/owner disposition and any approved
   risk controls.
2. **Rename:** a professionally cleared replacement can be introduced without
   breaking public routes, APIs, downloads, citations, release checksums,
   correction history, security contacts, or the ability to roll back.

A rename is complete only when:

- the old domain keeps resolving every valid public path and query;
- frozen releases, DOI deposits, citations, schema/version identifiers, and
  checksums retain their historical identity;
- new canonical, structured-data, sitemap, social, status, security, email,
  and repository identities agree;
- APIs/downloads have a documented compatibility window and tested successor;
- no secret, user session, local browser data, or production database row is
  copied merely to carry the brand change; and
- the rollback drill proves the old apex can resume canonical service without
  data restoration.

## Constraints

- BRD-003 and an owner disposition are hard prerequisites. This plan does not
  select a replacement, file a mark, contact a namesake, buy a domain, rename
  an account, or authorize deployment.
- BRD-005 controls candidate generation and screening if a rename is warranted.
  This document uses `NEW_NAME`, `NEW_SLUG`, and `https://new.example` only.
- The existing source/data rights posture does not change with the name.
- Frozen artifacts are evidence. Their bytes, titles, publisher strings,
  filenames, URLs, checksums, and citation records are not silently rewritten.
- The design system remains canonical. A new visual identity must be introduced
  as tokens/assets/components before page-level use.
- Production migrations, DNS, OAuth, email, status-page, repository, social,
  DOI, and deployment changes require their respective owner/platform
  authority.

## Current-state inventory

The reproducible snapshot in
`plan/evidence/BRD-006/brand-migration-inventory.v1.json` records the following
whole-tree counts on 2026-07-23:

- 353 tracked files contained one or more scoped name/domain/repository/status
  strings after excluding the BRD-001/002 research packet from the file list;
- 189 tracked files referenced `civicaatlas.org`;
- 217 tracked files referenced the exact phrase `Civica Atlas`;
- 12 tracked files referenced `admin@civicaatlas.org`;
- 20 tracked files referenced `github.com/fbalino/civica`;
- 13 tracked files referenced the Incident.io `civica-atlas` status slug; and
- `package.json` plus both package-lock roots use package name `civica`.

These counts are planning evidence, not a bulk-replacement instruction.
Several occurrences are immutable historical identifiers or prose whose
meaning would be damaged by mechanical replacement.

### Surface matrix

| Surface | Current anchors | Rename treatment | Keep treatment |
| --- | --- | --- | --- |
| Public identity | `Civica Atlas`, `Civica`, Ask Civica, Civica Index, Civica Pulse, Civica Conditions | Adopt an owner/counsel-approved naming hierarchy; update reader copy, nav, metadata, structured data, email templates, and generated docs from one identity contract | Preserve names; add only counsel-approved no-affiliation or trademark language |
| Canonical domain | `https://civicaatlas.org` in `src/lib/site.ts`; many page-level absolute URLs | Add new apex after control/TLS verification; point canonical/OG/sitemap/robots/JSON-LD to it only at cutover; preserve path/query on old-host redirects | Keep apex and `www` redirect; renew and monitor |
| Hosting / DNS | Cloudflare-registered domain; Vercel production; `www` → apex | Add new domain before cutover, validate DNS/TLS/headers, retain old apex, stage host-aware redirects outside pathname-only app redirects | No change; verify renewal, DNS, and TLS |
| Repository / package | `github.com/fbalino/civica`; npm package name `civica`; workflow group `civica-ci-*` | Rename repository only after redirects/clone behavior are tested; keep package/internal workflow names through first cutover unless collision requires later change | No change |
| API | `/api/v1/*`, `X-Civica-*` headers, examples with old apex | Keep paths and schemas stable; serve old and new hosts in parallel; add standard deprecation/successor links before retiring any branded header | No change |
| Embed | Retired `/embed/[slug]` returns a semantic 410; legacy builder code is not mounted | Preserve the 410 on both hosts, update its successor/rights links at cutover, and do not revive or migrate a data-bearing widget as part of a rename | No change |
| Downloads | `/downloads/civica-atlas-2026-07-11*`, branded filenames and schemas | Frozen downloads keep exact URLs/bytes; future releases may use `NEW_SLUG`; old host continues serving or proxying old files | No change |
| Releases / checksums | G2 RC, review packets, manifests, release BOMs, `civica-atlas-export/v3` | Never rewrite deposited or frozen bytes; record successor brand in a new release note/metadata version | No change |
| DOI / citation | Root and release `CITATION.cff`; GOV-021 DOI is not yet complete | Deposit historical releases under their historical publisher/title; new versions cite the successor and link backward; retain old-domain resolution | Keep current title after BRD-003 disposition; no DOI claim before GOV-021 |
| Database | `civica_conditions_*`, `civica_*` functions/settings, `civica_publication_version`, historical labels | Do not rename during brand cutover. Treat as stable internal schema. Any later alias/migration is separately planned and hash/fingerprint tested | No change |
| Browser/session state | `civica_*` cookies, `civica.chat.*` local storage, rate-limit/session namespaces | Keep names initially. Domain-scoped sessions do not transfer; require fresh sign-in. Do not copy Ask Civica local history cross-domain | No change |
| OAuth / callbacks | Google callback example on `civicaatlas.org`; admin sessions | Register new callback before cutover; keep old callback during compatibility window; verify state/cookie domain behavior | No change |
| Email / security | `admin@civicaatlas.org`, contact form, `security.txt`, user-agent strings | Provision/verify new mail first; keep old address forwarding for at least 36 months; update SPF/DKIM/DMARC, contacts, security policy, and crawler user agents | Keep monitored delivery and renew mail/DNS controls |
| Status / monitoring | `statuspage.incident.io/civica-atlas`, health docs and footer | Rename existing page or create successor only with provider authority; old public URL must redirect or visibly link; update monitors after new health endpoint passes | Keep current page and complete PLT-020 checks |
| Social / public profiles | Exact ownership is not fully inventoried; incumbent identities dominate unqualified `Civica` | Reserve cleared handles before announcement; coordinate handle/display-name/bio updates; keep old bios/pinned posts pointing to successor where platforms allow | Keep; verify ownership and recovery controls |
| Search / discovery | canonicals, sitemap, robots, IndexNow, structured dataset metadata, backlinks | Verify both domains; new sitemap/canonicals at cutover; old path-preserving redirects; request recrawl; monitor stale previews without claiming removal | Keep current canonical and stale-preview policy |
| Visual assets | `public/civica-logo.svg`, favicon, `og-default.png`, name-bearing screenshots; engravings mostly name-neutral | Add approved logo/wordmark, favicon, OG/social set, PDF/slide assets, and design-system entry before use; retain historical release screenshots unchanged | Keep assets; no speculative redesign |
| Legal / policy | terms, privacy, licensing, accessibility/security, complaint handling, rights manifests | Update operator/publisher/contact/brand language while preserving source-specific rights; add transition notice and no-affiliation language only if approved | Record BRD-003 disposition; otherwise no change |
| Operations / docs / tests | README/template, AGENTS, runbooks, source user agents, validators, E2E, mockups, historical plans | Regenerate canonical docs and fixtures; preserve clearly labelled historical plans/mockups; update host/name guards and run every release/claims/browser gate | No change except disposition/evidence |

## Identity classification rule

Before editing any match, assign it to exactly one class:

1. **Public mutable:** current brand copy, canonical host, social metadata,
   active docs, email, status, live assets. Update at the approved phase.
2. **Compatibility alias:** old host, API headers, route aliases, repository
   redirects, email forwarding. Keep through the declared window.
3. **Stable technical identifier:** schema names, cookie/storage keys, API
   schema versions, database functions/settings, release IDs. Preserve unless
   a separate migration proves a material benefit.
4. **Immutable historical record:** frozen release bytes, checksums, deposited
   citations, signed review packets, archived screenshots, published version
   labels. Never rewrite; add successor metadata around them.
5. **Discardable local/history-only material:** obsolete mockups or plans may
   retain the old name with a clear historical label; do not spend release
   risk on cosmetic rewriting.

A migration review must reject any pull request that changes classes 3 or 4
through broad search-and-replace.

## Dependencies

```text
BRD-001 + BRD-002
        |
        v
BRD-003 counsel review + owner facts
        |
        +---- keep decision ----> keep-path record ----> BRD-016
        |
        v
BRD-005 candidate generation and clearance
        |
        v
owner selects NEW_NAME/domain/marks
        |
        v
inventory freeze -> compatibility implementation -> isolated preview
        -> owner go/no-go -> domain cutover -> observation -> deprecation
```

BRD-007, BRD-010, BRD-012, PLT-019/020, GOV-021, and GOV-026/027 must be
reconciled before their affected license, art, privacy, deployment, DOI,
communications, or discovery surfaces are changed.

## Keep path

| Task | Effort | Owner | Depends on | Done criteria |
| --- | ---: | --- | --- | --- |
| Record professional finding | 1–2 h | Counsel / owner | BRD-003 | Written advice or privileged summary identifies jurisdictions, scope, and residual risk |
| Apply BRD-004 rubric | 1 h | Owner | Professional finding | Keep decision and reasons are signed/versioned; no unsupported “cleared” language |
| Adopt approved controls | 2–8 h | Agent + owner | Decision | Any disclaimer, filing strategy, geography/service constraint, or monitoring task is explicit and tested |
| Close migration branch | 1 h | Agent | Controls | This plan is marked zero-change; no replacement domain/account/artifact was created |
| Refresh G6 memo | 1 h | Agent | All above | BRD-016 states the name outcome, open risks, and release constraints |

The keep path changes no domain, repository, package, database, API, cookie,
release, DOI, social handle, or visual asset unless the recorded professional
advice specifically requires a bounded control.

## Rename path

Timelines are relative to `T0`, the owner’s signed selection of a professionally
cleared `NEW_NAME`. Estimates include a 25% coordination/testing buffer but not
registry, platform, or counsel response time.

### Milestones

| Milestone | Target | Owner | Success criteria |
| --- | --- | --- | --- |
| R0 — authority and control | T0 | Owner / counsel | Name, verbal/visual marks, geography/services, domains, accounts, budget, and rollback authority are documented |
| R1 — migration candidate | T0 + 5 working days | Agent / platform | Identity contract, aliases, assets, docs, and preview build pass local/CI gates |
| R2 — isolated rehearsal | T0 + 8 working days | Platform / agent | New host works in protected Preview/staging; old host untouched; migration and rollback scripts/checklist pass |
| R3 — cutover | Approved window | Owner / platform | DNS/TLS/canonicals/status/email/repository/social sequence completes with no critical failure |
| R4 — stability | +14 days | Agent / platform | No critical redirect, API, auth, citation, delivery, or search issue; rollback window remains open |
| R5 — deprecation review | +12 months, then annually | Owner | Evidence supports retaining or narrowing aliases; frozen/cited paths remain resolvable |

### Phase 1 — authority, acquisition, and freeze

| Task | Effort | Owner | Depends on | Done criteria |
| --- | ---: | --- | --- | --- |
| Freeze exact identity inputs | 2 h | Owner / counsel | R0 | `NEW_NAME`, `NEW_SLUG`, legal owner, mark form, approved descriptor, geography/services, and forbidden claims are signed |
| Control domains and accounts | 2–6 h external | Owner / platform | Cleared name | New apex/`www`, email domain, repository target, status/social candidates, and recovery controls are verified without recording secrets |
| Snapshot current surfaces | 3 h | Agent | Inputs frozen | Inventory counts, current canonicals, routes, headers, assets, checksums, DNS/status identifiers, and rollback target are captured |
| Declare compatibility policy | 2 h | Owner / agent | Snapshot | 36-month minimum old-domain/email window, indefinite frozen-release resolution target, and API sunset criteria are adopted |

### Phase 2 — code and content compatibility

| Task | Effort | Owner | Depends on | Done criteria |
| --- | ---: | --- | --- | --- |
| Add identity contract | 4–6 h | Agent | R0 | Name, descriptor, canonical origin, contact, repository, status, and asset paths have one checked runtime/docs source |
| Migrate active public copy | 6–10 h | Agent / editor | Identity contract | Current pages/content/metadata/CFF/README/runbooks use approved identity; historical records untouched |
| Add domain compatibility | 4–8 h | Agent / platform | New host controlled | New apex is supported; old host preserves path/query; API/download exceptions are explicit |
| Add asset set | 4–8 h | Design / agent | Approved mark | Design-system logo/wordmark/favicon/OG assets exist in light/dark and accessible forms; no page-local approximation |
| Update external callback config | 2–4 h | Platform | New host preview | OAuth, email, cron/monitor, CSP/connect/image, IndexNow, and security contacts are configured in isolated environment |
| Regenerate derived artifacts | 4–8 h | Agent | Copy/assets complete | Sitemaps, metadata fixtures, docs, review packets not yet frozen, screenshots, and generated manifests agree |

### Phase 3 — isolated rehearsal

| Task | Effort | Owner | Depends on | Done criteria |
| --- | ---: | --- | --- | --- |
| Protected Preview/staging deployment | 2–4 h | Platform | Phase 2 | New host, certificates, env, callbacks, and noindex preview behavior are correct |
| Route/API/download matrix | 4–6 h | Agent | Preview | Every sitemap route and legacy redirect resolves once; API JSON/CSV, downloads, citations, and headers are byte/semantically checked |
| Browser/accessibility/performance suite | 3–5 h | Agent | Preview | Critical desktop/mobile/light/dark journeys, no-JS, keyboard, CSP, console, and budgets pass |
| Rollback rehearsal | 2 h | Platform / agent | Preview | Canonical host can switch back without DB restoration; old host stays fully functional |
| Owner go/no-go | 1 h | Owner | Evidence packet | Cutover checklist, announcement, support owner, monitoring window, and abort thresholds are approved |

### Phase 4 — cutover sequence

Perform in this order; stop on a failed gate:

1. confirm old apex, email, status, repository, and DNS renewal remain under
   control;
2. deploy the dual-host-capable build while old apex is still canonical;
3. verify new apex TLS, health, routes, API/downloads, OAuth, contact, security,
   and status checks;
4. switch application canonical origin and regenerated metadata/sitemap;
5. add host-level old → new path/query behavior, excluding API/download
   compatibility routes that remain served;
6. change DNS/apex assignment;
7. update email, status, repository, public profiles, and approved
   announcement;
8. submit new sitemap/IndexNow and request recrawl;
9. observe continuously for the first two hours, then at 24 hours, 72 hours,
   7 days, and 14 days; and
10. publish a versioned migration note listing what changed, what deliberately
    retained the historical name, and known limitations.

## Compatibility and deprecation policy

- **Old domain:** renew and maintain for at least 36 months after cutover;
  target indefinite retention while any DOI, citation, frozen artifact, API,
  or review packet depends on it.
- **HTML routes:** use one path/query-preserving 308 to the new apex after the
  new page is verified. No chains.
- **APIs:** old host continues serving compatible responses for at least
  24 months. Add standard `Deprecation`, `Sunset`, and
  `Link: rel="successor-version"` headers before any retirement. Do not rely
  on clients following a cross-host redirect.
- **Frozen downloads/citations:** old URLs continue returning the exact bytes
  or a transparent byte-identical proxy indefinitely; never redirect to a
  different release.
- **Email:** old addresses forward to verified new mailboxes for at least
  36 months, with periodic delivery checks.
- **Repository:** rely on provider redirect only after clone, issue, release,
  webhook, and citation links are tested; retain a visible former-name note.
- **Social:** retain old handle/bio pointers where a platform permits. Do not
  release a former handle while impersonation risk remains.
- **Internal/database names:** no deprecation clock at brand cutover. Rename
  only through a separate technical migration with measurable benefit.

## Rollback

### Abort thresholds

Rollback immediately if any of the following persists beyond the bounded
cutover troubleshooting window:

- apex/TLS/DNS failure or widespread 5xx;
- broken admin/OAuth/contact/security intake;
- altered frozen release bytes or checksum mismatch;
- API/download incompatibility, redirect loop, or lost query parameters;
- canonical/sitemap split that could index both hosts as independent content;
- status/monitoring blind spot during the cutover; or
- an unexpected legal instruction to stop.

### Rollback procedure

1. restore the prior deployment and `SITE_URL` identity contract;
2. restore old apex as canonical and disable new-host indexing;
3. remove old → new redirects, leaving the new host with a temporary 302 or
   noindex notice back to the old apex;
4. restore old OAuth callbacks, status links, email primary identity, and
   repository/profile pointers where changed;
5. verify old sitemap, metadata, APIs, downloads, security contact, and
   frozen hashes;
6. publish a bounded status update without legal speculation; and
7. retain the failed-candidate evidence and create corrective tasks before
   another attempt.

No database restore is part of rollback because the cutover deliberately does
not rename schema objects or rewrite data.

## Verification matrix

| Area | Required evidence |
| --- | --- |
| Identity | One approved identity contract; no mixed current names outside declared aliases/history |
| Domain | apex and `www`, TLS, HSTS, path/query preservation, no redirect chains |
| Metadata/search | canonical, OG, JSON-LD, sitemap, robots, Dataset metadata, IndexNow, no preview host |
| API/download/embed | old/new hosts, JSON/CSV, rate limits, CORS, deprecation headers, exact frozen hashes, and the same retired-embed 410 contract |
| Auth/forms | admin sign-in/out, OAuth callback, contact, advisory intake, correction intake |
| Email/security | new delivery plus old forwarding, `security.txt`, responsible disclosure, SPF/DKIM/DMARC confirmation |
| Status/monitoring | health checks, public component names, incident routing, alerts |
| Repository/release | clone, releases, issue links, webhooks, CFF, review packets, DOI metadata |
| UI/assets | design-system page, logo/wordmark, favicon, OG, screenshots, accessibility |
| Rights/privacy | legal entity, terms, privacy, licensing, complaint and illustration policies agree |
| Browser/quality | claims/docs, metadata, links, assets, design tokens, typecheck, unit/build, critical browsers |
| Rollback | prior deployment/canonical restored in rehearsal with no DB action |

## Risks and mitigations

| Risk | Impact | Probability | Mitigation |
| --- | --- | --- | --- |
| Mechanical replacement corrupts historical evidence | High | Medium | Five-class identity rule; immutable-release hash checks; staged review |
| Search authority fragments across hosts | High | Medium | One cutover canonical, path-preserving redirects, sitemap/recrawl, long old-domain retention |
| API clients fail on cross-host redirects | High | Medium | Parallel old-host serving plus standard deprecation window |
| Auth/session interruption | Medium | High | No session copying; announced fresh sign-in; callback rehearsal |
| Email/security report loss | High | Medium | Provision first, dual delivery tests, old forwarding, monitored `security.txt` |
| Social impersonation after handle release | Medium | Medium | Reserve before announcement; retain old handles/pointers |
| DOI/citation breakage | High | Low | Never rewrite deposited artifacts; indefinite old URL resolution target |
| Provider changes cannot be rolled back quickly | High | Low | Owner/platform runbook, captured prior config, staged sequence and abort thresholds |
| Rename creates new rights conflict | High | Medium | BRD-005 screening plus professional clearance before acquisition/announcement |

## Completion boundary

BRD-006 is complete when this plan and its inventory are versioned, validated,
and linked from the checklist. Execution remains dormant unless BRD-003 and
BRD-004 produce a rename disposition. A keep decision closes through the
zero-change path; a rename decision opens separately authorized implementation
tasks from the phase tables above.
