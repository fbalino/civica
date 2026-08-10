# EXP-029 evidence — English-first and localization readiness

Date: 2026-07-23

Contracts:

- `civica-public-english-collation/v1`
- `civica-entity-name-form/v1`
- `exp-029-browser-verification/v1`

Status: complete — production activation ran 2026-08-09/10 under the authorized named-release refresh; see `production-activation-2026-08-09.md`

## What is complete

- `/about#language` now says that Civica Atlas has an English interface and
  English editorial copy, offers no translated interface, and does not treat
  retained upstream text as a Civica translation without an explicit label.
- Public dates, numbers, and display-name sorting have one explicit `en-US`
  presentation contract. Six shared high-use reader paths use the deterministic
  collation helper; the leaders directory also uses the shared UTC date helper.
- `entity_name_forms` is a versioned, source-backed relation for jurisdiction,
  person, office, and political-party forms. Language, optional script, role,
  retrieval/vintage, translation status, and transliteration status are all
  explicit and closed; none are inferred from the string.
- The repeat-safe writer rejects empty and duplicate batches, supersedes
  changed current forms without deletion, writes source freshness only after
  committed rows, and leaves identical replays untouched. The read helper
  returns only current explicit forms.
- Updates and retirement are captured by the
  `research-evidence-retention/v1` history trigger. The checked dictionary now
  documents 103 tables and 1,428 columns.
- `<SourceText>` isolates source strings with `<bdi dir="auto" lang="…">` and
  exposes a visible neutral status label. The canonical design-system fixture
  covers Arabic, Hebrew, Japanese, accented Latin text, and a long Spanish
  official form.
- `validate:internationalization` runs seven unit/contract fixtures and is
  included in `build:core`.

## Browser verification

Real Chromium against the local Next.js app passed four fixture variants:
1,440 × 1,000 and 390 × 844, each in light and dark themes.

- Arabic and Hebrew resolved to `rtl`.
- Japanese and Spanish resolved to `ltr`.
- All four source forms and status labels were present.
- The long Spanish form wrapped without document-level horizontal overflow.
- `/about#language` rendered the public English-only disclosure.

Focused screenshots and the generated run artifact are under
`output/playwright/EXP-029/`. The durable machine-readable result is
`browser-verification.json`.

## Production boundary

Authoritative migration `0048_entity_name_forms` is additive, contains five
statements and no destructive statement, and has SHA-256
`9eafb5c92efbe965a6289f31ac67ae7df55f37b7716ba1cd99cd7c69868364e0`.
The zero-write live plan confirms that `entity_name_forms` is not present and
that no write occurred.

Production activation is complete: migration 0048 is live, the registered
`atlas.entity-name-forms` adapter populated 1,184 reviewed source-form rows
through the checked writer, and stored jurisdiction/person/office forms are
verified on the country masthead and world-leaders directory
(`production-activation-2026-08-09.md`). Political parties retain no
publisher identity, so party forms remain an explicit zero scope. English
display names remain authoritative; no source language, translation, or
transliteration is fabricated.

## Verification

```text
npm run validate:internationalization
npm run verify:internationalization:browser
npm run validate:research-evidence-retention
npm run validate:data-dictionary
npm run validate:authoritative-migrations
npm run validate:migrations
npm run validate:sync-freshness
npm run validate:design-tokens
npm run validate:content-templates
npm run validate:ci-workflow
npm run validate:doc-references
npx tsc --noEmit
npm run db:plan -- --id=0048_entity_name_forms --live
```
