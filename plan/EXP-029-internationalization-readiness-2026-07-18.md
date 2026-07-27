# EXP-029 — English-first and localization readiness

**Status:** agent preparation complete; production activation pending. The
product is explicitly English-first and must not be described as translated or
localization-ready.

## Scope tested

The acceptance condition covers the public reader UI, country/person/office/
party names, date/number/collation behavior, right-to-left and long-text
rendering, and labels for source language and translation provenance.

## Evidence reviewed (2026-07-18)

- The document root declares `lang="en"`; metadata declares `en_US`. This is an
  English-first interface, but the site does not currently disclose that scope
  to readers.
- Constitution search correctly limits its query to upstream English-language
  texts and visibly says that the original language and translation status are
  unverified. Its search contract likewise pins the corpus to `en` and records
  that the publisher-supplied language version has unknown translation status.
- The source schema has one `name` field for each jurisdiction, person, office,
  and political party. There is no source-form/native-name field, language tag,
  script tag, transliteration relation, translator, or source-language
  provenance attached to those display names.
- Homepage and map card components contain optional `nativeName`/`officialName`
  presentation slots, but the homepage's current data loader does not supply a
  native name. A dormant display slot is not a verified native-name record.
- Reader-facing dates and numbers are formatted independently in many modules,
  using a mixture of default locale, `en-US`, and `en-GB`; display-name sorting
  commonly uses `localeCompare` without a declared product collation contract.
- No right-to-left or long-source-text browser fixture exists. The app font
  files are requested with the Latin subset, so other scripts depend on a
  browser fallback without a tested layout contract.

## What changed on 2026-07-23

- `/about#language` publishes the English-interface and no-translated-interface
  boundary.
- `civica-public-english-collation/v1` fixes deterministic `en-US` dates,
  numbers, and display-name collation for reader presentation.
- `civica-entity-name-form/v1` and authoritative migration
  `0048_entity_name_forms` define versioned, source-backed jurisdiction,
  person, office, and political-party forms with explicit language, script,
  role, source, vintage, translation, and transliteration fields.
- The writer/read adapter is repeat-safe, history-preserving, and uses the
  sanctioned source-freshness path only after committed writes.
- `<SourceText>` renders source strings through `<bdi dir="auto" lang="…">`
  with visible status labels.
- Real Chromium passed Arabic/Hebrew/Japanese/Spanish and long-text fixtures at
  desktop/mobile widths in both themes. Evidence:
  `plan/evidence/EXP-029/`.

## Why EXP-029 remains unchecked

The production database does not yet contain `entity_name_forms`. Applying
0048 and refreshing publisher data are production mutations requiring owner
authority. Until those happen, no representative stored source forms can be
verified on country/person/office/party reader surfaces, and the existing
English display names remain in place. No language, script, native-name,
translation, or transliteration property may be inferred to fill the gap.

## Safety boundary

The live database action in this work was a zero-write migration plan. No
source refresh, content translation, or production database write was
performed.
