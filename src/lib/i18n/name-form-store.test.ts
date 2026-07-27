import assert from "node:assert/strict";
import test from "node:test";
import {
  entityNameFormIdentity,
  normalizeEntityNameForms,
  sameEntityNameForm,
} from "./name-form-store";
import {
  ENTITY_NAME_FORM_CONTRACT,
  type EntityNameForm,
} from "./name-forms";

const form: EntityNameForm = {
  contractVersion: ENTITY_NAME_FORM_CONTRACT,
  entityType: "jurisdiction",
  entityId: "11111111-1111-4111-8111-111111111111",
  value: "Côte d’Ivoire",
  languageTag: "fr",
  scriptCode: "Latn",
  nameRole: "official",
  sourceId: "fixture",
  sourceUrl: "https://example.test/names",
  retrievedAt: "2026-07-23T12:00:00.000Z",
  upstreamVintage: "2026-07",
  translationStatus: "not_translated",
  transliterationStatus: "not_transliterated",
};

test("name-form normalization rejects empty and duplicate source identities", () => {
  assert.throws(() => normalizeEntityNameForms([]), /produced zero rows/);
  assert.throws(
    () => normalizeEntityNameForms([form, { ...form }]),
    /Duplicate entity name-form identity/,
  );
  assert.deepEqual(normalizeEntityNameForms([form]), [form]);
});

test("name-form identity is stable and includes source and language", () => {
  assert.equal(
    entityNameFormIdentity(form),
    "jurisdiction:11111111-1111-4111-8111-111111111111:official:fr:fixture",
  );
});

test("identical replay detection includes retrieval time and evidence fields", () => {
  assert.equal(
    sameEntityNameForm(
      { ...form, retrievedAt: new Date(form.retrievedAt) },
      form,
    ),
    true,
  );
  assert.equal(
    sameEntityNameForm(
      {
        ...form,
        retrievedAt: new Date("2026-07-24T12:00:00.000Z"),
      },
      form,
    ),
    false,
  );
  assert.equal(
    sameEntityNameForm(
      { ...form, value: "Ivory Coast", retrievedAt: form.retrievedAt },
      form,
    ),
    false,
  );
});
