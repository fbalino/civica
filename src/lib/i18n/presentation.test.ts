import assert from "node:assert/strict";
import test from "node:test";

import {
  comparePublicLabels,
  formatPublicDate,
  formatPublicNumber,
  PUBLIC_COLLATION_VERSION,
  PUBLIC_CONTENT_LANGUAGE,
  PUBLIC_PRESENTATION_LOCALE,
} from "./presentation";
import {
  ENTITY_NAME_FORM_CONTRACT,
  entityNameFormLabel,
  entityNameFormSchema,
} from "./name-forms";

test("the public presentation contract is explicit English, not browser-default locale", () => {
  assert.equal(PUBLIC_CONTENT_LANGUAGE, "en");
  assert.equal(PUBLIC_PRESENTATION_LOCALE, "en-US");
  assert.equal(PUBLIC_COLLATION_VERSION, "civica-public-english-collation/v1");
  assert.equal(formatPublicNumber(1234567.5), "1,234,567.5");
  assert.equal(
    formatPublicDate("2026-07-23", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }),
    "July 23, 2026",
  );
});

test("English collation is deterministic across accents, punctuation, and numbers", () => {
  const values = ["Åland", "Albania", "Country 10", "Country 2", "Écuador"];
  assert.deepEqual(values.toSorted(comparePublicLabels), [
    "Åland",
    "Albania",
    "Country 2",
    "Country 10",
    "Écuador",
  ]);
});

test("name-form records retain multilingual source text without inference", () => {
  for (const [value, languageTag, scriptCode] of [
    ["الجمهورية التونسية", "ar", "Arab"],
    ["מדינת ישראל", "he", "Hebr"],
    ["日本国", "ja", "Jpan"],
    ["República Oriental del Uruguay", "es-UY", "Latn"],
  ] as const) {
    const parsed = entityNameFormSchema.parse({
      contractVersion: ENTITY_NAME_FORM_CONTRACT,
      entityType: "jurisdiction",
      entityId: "00000000-0000-4000-8000-000000000001",
      value,
      languageTag,
      scriptCode,
      nameRole: "official",
      sourceId: "fixture",
      sourceUrl: "https://example.org/entity",
      retrievedAt: "2026-07-23T00:00:00.000Z",
      upstreamVintage: "fixture-2026-07-23",
      translationStatus: "not_translated",
      transliterationStatus: "not_transliterated",
    });
    assert.match(entityNameFormLabel(parsed), new RegExp(languageTag));
    assert.equal(parsed.value, value);
  }
});

test("name-form records reject unknown fields and unsupported translation claims", () => {
  const base = {
    contractVersion: ENTITY_NAME_FORM_CONTRACT,
    entityType: "person",
    entityId: "00000000-0000-4000-8000-000000000001",
    value: "Fixture",
    languageTag: "fr",
    scriptCode: "Latn",
    nameRole: "source",
    sourceId: "fixture",
    sourceUrl: "https://example.org/entity",
    retrievedAt: "2026-07-23T00:00:00.000Z",
    upstreamVintage: "fixture-2026-07-23",
    translationStatus: "civica_translation",
    transliterationStatus: "not_transliterated",
  };
  assert.equal(entityNameFormSchema.safeParse(base).success, false);
  assert.equal(
    entityNameFormSchema.safeParse({ ...base, languageTag: "en", extra: true })
      .success,
    false,
  );
});
