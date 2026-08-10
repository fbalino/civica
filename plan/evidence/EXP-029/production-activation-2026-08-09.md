# EXP-029 — production activation (2026-08-09/10 UTC)

Authority: `plan/evidence/QA-018/OWNER-SIGNOFF-2026-08-09.md` (named-release
Wikidata refresh and migration 0048). Migration `0048_entity_name_forms` was
already active in production (applied 2026-07-29 within the authoritative
tail through `0051`; `entity_name_forms` existed empty).

## Adapter activation

- New registered manual pipeline `atlas.entity-name-forms`
  (`npm run sync:entity-name-forms` → `src/lib/i18n/name-form-sync.ts`),
  closed in the production-adapter registry, ingestion-contract fixture
  witnesses, source-input manifest (51 pipelines), the verification matrix,
  and pipeline observability (the canonical script routes through
  `run:production-pipeline`). This wave's initial population run was invoked
  directly before the observability wiring landed, so it has no recorded
  pipeline-run row; future runs are observed.
- The adapter captures only publisher-supplied monolingual statements whose
  language tag is explicit in the payload: jurisdictions P1448 (official) and
  P1705 (native), current principal-office holders P1559 (name in native
  language), and Wikidata-identified offices P1448/P1705. Script subtags are
  surfaced mechanically from the tag; nothing is inferred from strings.
- Ambiguous identities (multiple distinct values for one entity/role/language)
  and non-language tags (`und`, `zxx`, `mis`, `mul`) fail closed and are
  counted. Political parties retain no publisher identity anywhere in the
  database (0 of 1,548 legislature rows, 0 political_parties identity rows),
  so party forms are an explicit zero scope — no form is fabricated from
  English canonical names.
- The checked store writer was reworked to a single-statement CTE
  supersede-and-insert per identity: the Neon HTTP driver rejects interactive
  `db.transaction()` (verified by probe), and the partial unique index on the
  current identity prevents forked history. Freshness stamps only through
  `markSourcesSynced` after committed rows; identical same-batch replays
  write nothing.

## Production run (after the ATL-010 roster refresh)

Scope 197 jurisdictions / 327 current principal officeholders / 351 offices
with QIDs; 1,498 publisher claims retrieved → **1,184 forms written**
(158 ambiguous identities and 2 non-language tags failed closed; zero
errors; `wikidata` freshness stamped). Current stored forms: 750
jurisdiction, 261 person, 173 office. Representative rows verified directly
in the database: Japan official `ja` 日本国; Russia official `ru`
Российская Федерация (after the Q159 identity repair); Switzerland's
national-language set including `rm` Confederaziun svizra; Volodymyr
Zelenskyy native `uk` Володимир Зеленський.

## Reader surfaces

- Country masthead: stored official-name forms render under the H1 through
  `<SourceText>` with a visible "Official name (source language)" label
  (`FactbookHeaderStrip`, tokenized `.factbook-hero-official-names`).
- World-leaders directory: person and office forms render with visible
  role/language/translation labels; forms byte-identical to the displayed
  English name are suppressed as presentation noise (the stored rows remain).
- Language display names are computed once at the server boundary
  (`publicLanguageName`, `en-US` `Intl.DisplayNames`) and shipped in props so
  labels never depend on the viewer's ICU data — a client/server mismatch for
  `bo` (Tibetan) surfaced in browser QA and was fixed this way.
- `/about#language` remains the public disclosure; the checked Playwright
  fixture run (`browser-verification.json`, 2026-08-10, four viewport/theme
  variants) passed against the refreshed build, and desktop/mobile
  light/dark checks of `/leaders`, `/country/japan`, and
  `/country/switzerland` showed labeled source forms with no horizontal
  overflow and no console errors.
