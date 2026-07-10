# CLM-018 evidence — mixed-source access and reuse rights

Status: implementation complete on 2026-07-10; independent final review recorded below.

## Outcome

Civica now separates free, no-account access from permission to redistribute,
republish, or build derivative products. One typed interim registry covers seven
artifact classes: upstream source data, Civica-derived outputs, downloads/API,
hosted embeds, repository code, editorial imagery, and future frozen releases.

The registry is deliberately not DAT-003's future complete source/field/product/
release manifest. It states that the complete manifest has not shipped, that
the public repository has no root `LICENSE` and therefore carries no current
open-source grant, that citation is credit rather than permission, and that
hosted-widget permission does not license the underlying data.

Footer, About, Licensing, Terms, Dataset metadata, download/API documentation,
embed HTML and gallery, citation UI, `CITATION.cff`, README, and the launch blog
now use that posture. Dataset JSON-LD keeps `isAccessibleForFree: true` as an
access fact while adding the explicit boundary under `conditionsOfAccess` and
the canonical `/licensing#reuse` rights URL.

## Executable contract

- `src/lib/claims/reuse-rights.ts` — canonical interim registry, boundary,
  code/release state, required-surface registry, and prohibited-language helpers
- `scripts/validate-rights-claims.ts` — DB/network-free gate covering required
  pointers plus 308 additional reader-facing source files
- `src/lib/claims/__tests__/reuse-rights.test.ts` — 23 adversarial fixtures,
  including silent/missing surfaces, dead imports, negation handling, false
  blanket-open/code-license/complete-manifest claims, and honest denials
- `src/lib/ci/claims-docs-gate.ts` — registers `rights-claims` as the twelfth
  aggregate child under the terminology/policy category
- `src/lib/seo/metadata-contract.ts` — requires the exact rights URL and a
  meaningful access-vs-reuse `conditionsOfAccess` statement

## Verification

- focused rights suite: **23/23**
- full suite through `npm run validate:claims-docs`: **349/349**
- aggregate gate: all 12 children across all seven categories passed
- public claims: 40 claims, 14/14 required surfaces, 45 markers, zero
  authority/grade/unregistered leaks
- rights validator: all required surfaces passed; 308 additional reader-facing
  files passed the prohibited-language sweep; root-license state matched
- content templates, documentation sources/references, API contracts, metadata,
  Pulse runtime, terminology, policy, design tokens, TypeScript, targeted
  ESLint, README regeneration, and diff checks: passed
- production build: passed; 86/86 static pages, with only the known existing
  Turbopack broad-trace warning
- browser QA: desktop and mobile surfaces had no horizontal overflow; the
  seven-row interim registry rendered; fresh isolated loads were console-clean;
  small/medium/large embed rights metadata passed; the medium embed was
  compacted so its visible reuse pointer fits its exact 320×180 frame. See
  `browser-checks.md` and the three PNGs in this directory.

## Worker routing and review

- `SN5 CLM-018 rights inventory` — exact Claude Sonnet 5, subscription-first,
  read-only inventory; session `e6528f52-9ca1-460f-ad17-5c020cdff931`.
- `OP48 CLM-018 rights contract` — exact Claude Opus 4.8, subscription-first,
  read-only adjudication; session `dc003725-55c2-4514-9ce5-5522b037257b`;
  verdict `CLOSE_WITH_INTERIM_REGISTRY`.
- First Sonnet implementation attempt — exact Claude Sonnet 5. The primary
  agent interrupted it after roughly seven minutes because of an invalid
  self-imposed elapsed-time heuristic. It left a useful partial implementation,
  but no completion result. This interruption was a process error, not a worker
  failure; the global preference now forbids stopping quiet Anthropic workers
  based only on elapsed time or sparse output.
- `SN5 CLM-018 rights finish` — exact Claude Sonnet 5, subscription-first;
  session `26cf58cf-fe10-40bf-8013-2fdb2214ae36`. Claude Code reached its own
  600-second background-task ceiling and returned a substantial partial result;
  primary Codex audited, completed, hardened, built, and browser-tested it.
- `OP48 CLM-018 final acceptance` — exact Claude Opus 4.8,
  subscription-first, read-only final review; session
  `8d2be085-ad96-47e2-b851-71097c9095cc`; verdict
  **ACCEPT_WITH_NONBLOCKING_NOTES**, no blockers. Primary Codex folded all four
  optional notes into the final tree: stricter constant-consumption checks,
  broader semantic blanket-claim fixtures, the stale home-CSS comment, and the
  launch-blog heading.

## Deliberate boundary

DAT-003 still owns a complete machine-readable source/field/product/release
rights manifest and export compatibility blocking. BRD-007/BRD-008 still own
the actual code-license choice and any future root `LICENSE`. CLM-018 does not
pretend either decision or artifact already exists.
