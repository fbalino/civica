import { and, eq, inArray } from "drizzle-orm";

import { db } from "@/lib/db";
import {
  governmentBodies,
  jurisdictions,
  offices,
  persons,
  sources,
  statements,
  terms,
} from "@/lib/db/schema";
import { getCurrentEntityNameFormsForEntities } from "@/lib/i18n/name-form-store";
import { publicLanguageName } from "@/lib/i18n/presentation";
import {
  annotateLeaderDirectory,
  PRINCIPAL_LEADER_OFFICE_TYPES,
  type LeaderDirectoryInput,
  type LeaderDirectoryRow,
  type LeaderNameForm,
  type PrincipalLeaderOfficeType,
} from "./directory";

function iso(value: string | Date | null): string | null {
  if (value === null) return null;
  return value instanceof Date ? value.toISOString() : value;
}

/** Verified current principal officeholders only. A retained Wikidata term
 * statement is required, so a person/office row alone cannot enter the
 * directory. */
export async function getWorldLeadersDirectory(): Promise<
  LeaderDirectoryRow[]
> {
  const rows = await db
    .select({
      termId: terms.id,
      personId: persons.id,
      personName: persons.name,
      personWikidataQid: persons.wikidataQid,
      officeId: offices.id,
      officeName: offices.name,
      officeType: offices.officeType,
      startDate: terms.startDate,
      jurisdictionId: jurisdictions.id,
      jurisdictionName: jurisdictions.name,
      jurisdictionSlug: jurisdictions.slug,
      jurisdictionWikidataQid: jurisdictions.wikidataQid,
      jurisdictionStatus: jurisdictions.type,
      continent: jurisdictions.continent,
      sourceId: statements.sourceId,
      sourceUrl: statements.sourceUrl,
      sourceLicense: statements.sourceLicense,
      sourceRetrievedAt: statements.retrievedAt,
      sourceLastSyncAt: sources.lastSyncAt,
    })
    .from(terms)
    .innerJoin(persons, eq(terms.personId, persons.id))
    .innerJoin(offices, eq(terms.officeId, offices.id))
    .innerJoin(governmentBodies, eq(offices.bodyId, governmentBodies.id))
    .innerJoin(
      jurisdictions,
      eq(governmentBodies.jurisdictionId, jurisdictions.id),
    )
    .innerJoin(
      statements,
      and(
        eq(statements.subjectTable, "terms"),
        eq(statements.subjectId, terms.id),
        eq(statements.sourceId, "wikidata"),
        eq(statements.predicate, offices.officeType),
      ),
    )
    .innerJoin(sources, eq(statements.sourceId, sources.id))
    .where(
      and(
        eq(terms.isCurrent, true),
        inArray(offices.officeType, [...PRINCIPAL_LEADER_OFFICE_TYPES]),
      ),
    );

  // EXP-029: attach stored, source-backed name forms. Missing forms remain
  // missing; the English display name is never used to fabricate one.
  const [personForms, officeForms] = await Promise.all([
    getCurrentEntityNameFormsForEntities(
      db,
      "person",
      rows.map((row) => row.personId),
    ),
    getCurrentEntityNameFormsForEntities(
      db,
      "office",
      rows.map((row) => row.officeId),
    ),
  ]);
  const compactForms = (
    stored:
      | Awaited<ReturnType<typeof getCurrentEntityNameFormsForEntities>>
      | undefined,
    id: string,
  ): LeaderNameForm[] | undefined => {
    const forms = stored?.get(id);
    if (!forms || forms.length === 0) return undefined;
    return forms.map((form) => ({
      value: form.value,
      languageTag: form.languageTag,
      languageLabel: publicLanguageName(form.languageTag),
      nameRole: form.nameRole,
    }));
  };

  const verified = rows.flatMap((row): LeaderDirectoryInput[] => {
    if (
      !PRINCIPAL_LEADER_OFFICE_TYPES.includes(
        row.officeType as PrincipalLeaderOfficeType,
      ) ||
      row.sourceId !== "wikidata" ||
      !row.sourceUrl ||
      !row.sourceLicense
    ) {
      return [];
    }
    return [
      {
        ...row,
        officeType: row.officeType as PrincipalLeaderOfficeType,
        sourceId: "wikidata",
        sourceUrl: row.sourceUrl,
        sourceLicense: row.sourceLicense,
        startDate: iso(row.startDate),
        sourceRetrievedAt: iso(row.sourceRetrievedAt)!,
        sourceLastSyncAt: iso(row.sourceLastSyncAt),
        personNameForms: compactForms(personForms, row.personId),
        officeNameForms: compactForms(officeForms, row.officeId),
      },
    ];
  });
  return annotateLeaderDirectory(verified).sort(
    (a, b) =>
      a.jurisdictionName.localeCompare(b.jurisdictionName) ||
      a.officeType.localeCompare(b.officeType) ||
      a.personName.localeCompare(b.personName),
  );
}
