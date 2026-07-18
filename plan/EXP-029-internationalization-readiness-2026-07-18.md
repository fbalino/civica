# EXP-029 — English-first and localization readiness

**Status:** blocked on a versioned source-language/name-form contract; the
product must not be described as localization-ready yet.

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

## Why EXP-029 remains unchecked

An English page shell and a correctly qualified constitution corpus do not
establish that all entity names retain their source form, nor that the product
can distinguish publisher text from a Civica translation. Adding a blanket
English-only statement now would be useful disclosure but would not cure the
missing data contract or prove right-to-left behavior. Calling the product
internationalized or translated would be inaccurate.

## Required completion path

1. Publish a concise English-first scope notice: interface and editorial copy
   are English; the site offers no translated interface; upstream text is not a
   Civica translation unless a visible record says otherwise.
2. Adopt a versioned display-name relation for jurisdictions, people, offices,
   and parties. Each relation needs the rendered string, BCP 47 language tag,
   script when known, name role (source/native/official/transliterated/English
   display), source row or URL, retrieval/vintage, and an explicit
   translation/transliteration status. Do not infer any of those from text.
3. Write/read that relation through the relevant source adapters and expose a
   name-form choice that preserves the source string while retaining an
   accessible English navigation label where necessary. Absent records must be
   visibly absent, not fabricated.
4. Create one shared English presentation contract for public dates, numbers,
   and display-name collation, and migrate reader surfaces to it. Stable
   machine/release ordering remains bytewise and must not be changed by a UI
   locale.
5. Add `dir="auto"`/`bdi` handling where source-form text can be displayed and
   add browser fixtures with Arabic/Hebrew right-to-left strings, CJK text,
   accented names, and long unbroken source titles at the supported viewport
   matrix.
6. Replace hard-coded constitutional wording with labels derived from the
   source-language/translation fields, then add equivalent labels for other
   multilingual source text such as bills and source documents.

## Safety boundary

This assessment ran only source-code and contract inspection on 2026-07-18.
No source refresh, migration, content translation, or production database write
was performed.
