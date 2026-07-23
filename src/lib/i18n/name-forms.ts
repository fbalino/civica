import { z } from "zod";

export const ENTITY_NAME_FORM_CONTRACT =
  "civica-entity-name-form/v1" as const;

export const ENTITY_NAME_TYPES = [
  "jurisdiction",
  "person",
  "office",
  "political_party",
] as const;

export const ENTITY_NAME_ROLES = [
  "english_display",
  "source",
  "native",
  "official",
  "transliterated",
] as const;

export const NAME_TRANSLATION_STATUSES = [
  "not_translated",
  "publisher_supplied_translation",
  "civica_translation",
  "unknown",
] as const;

export const NAME_TRANSLITERATION_STATUSES = [
  "not_transliterated",
  "publisher_supplied_transliteration",
  "civica_transliteration",
  "unknown",
] as const;

const languageTag = z
  .string()
  .min(2)
  .max(35)
  .regex(/^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{1,8})*$/);

const scriptCode = z
  .string()
  .length(4)
  .regex(/^[A-Z][a-z]{3}$/);

export const entityNameFormSchema = z
  .object({
    contractVersion: z.literal(ENTITY_NAME_FORM_CONTRACT),
    entityType: z.enum(ENTITY_NAME_TYPES),
    entityId: z.string().uuid(),
    value: z.string().trim().min(1).max(500),
    languageTag,
    scriptCode: scriptCode.nullable(),
    nameRole: z.enum(ENTITY_NAME_ROLES),
    sourceId: z.string().trim().min(1).max(100),
    sourceUrl: z.string().url().refine((value) => value.startsWith("https://")),
    retrievedAt: z.string().datetime(),
    upstreamVintage: z.string().trim().min(1).max(200),
    translationStatus: z.enum(NAME_TRANSLATION_STATUSES),
    transliterationStatus: z.enum(NAME_TRANSLITERATION_STATUSES),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      value.nameRole === "transliterated" &&
      value.transliterationStatus === "not_transliterated"
    ) {
      context.addIssue({
        code: "custom",
        path: ["transliterationStatus"],
        message: "A transliterated name must identify its transliteration status",
      });
    }
    if (
      value.translationStatus === "civica_translation" &&
      value.languageTag !== "en"
    ) {
      context.addIssue({
        code: "custom",
        path: ["languageTag"],
        message: "The English-first v1 contract records Civica translations as en",
      });
    }
  });

export type EntityNameForm = z.infer<typeof entityNameFormSchema>;
export type EntityNameType = (typeof ENTITY_NAME_TYPES)[number];

export function entityNameFormLabel(form: EntityNameForm): string {
  const role = form.nameRole.replaceAll("_", " ");
  const translation =
    form.translationStatus === "not_translated"
      ? "not translated"
      : form.translationStatus.replaceAll("_", " ");
  return `${role} · ${form.languageTag} · ${translation}`;
}
