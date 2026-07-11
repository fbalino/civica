import { and, eq } from "drizzle-orm";
import {
  countryFactbookSections,
  countryFacts,
  jurisdictions,
  statements,
} from "@/lib/db/schema";
import { validateFactNumeric } from "@/lib/factbook/numeric-validation";

type Db = typeof import("@/lib/db").db;
export type AtlasJurisdictionInput = typeof jurisdictions.$inferInsert;
export type AtlasFactInput = Omit<typeof countryFacts.$inferInsert, "jurisdictionId" | "sourceId">;
export interface AtlasSectionInput {
  sectionName: string;
  sectionData: object;
  displayOrder: number;
}

export async function writeAtlasCountry(
  db: Db,
  input: {
    existingId?: string | null;
    jurisdiction: AtlasJurisdictionInput;
    sections: AtlasSectionInput[];
    facts: AtlasFactInput[];
  },
  options: { dryRun?: boolean } = {},
) {
  if (!input.jurisdiction.slug || input.sections.length === 0 || input.facts.length === 0) {
    throw new Error(`Malformed/empty Factbook country: ${input.jurisdiction.slug}`);
  }
  const factKeys = new Set<string>();
  for (const fact of input.facts) {
    if (!fact.factKey || factKeys.has(fact.factKey)) throw new Error(`Duplicate Factbook fact: ${fact.factKey}`);
    factKeys.add(fact.factKey);
  }
  if (options.dryRun) {
    return {
      jurisdictionId: input.existingId ?? `dry:${input.jurisdiction.slug}`,
      sections: input.sections.length,
      facts: input.facts.length,
      rejectedFacts: input.facts.filter((fact) => !validateFactNumeric(fact.factKey, fact.factValueNumeric).accepted).length,
      written: 0,
    };
  }

  let jurisdictionId = input.existingId ?? null;
  if (jurisdictionId) {
    await db.update(jurisdictions).set({ ...input.jurisdiction, updatedAt: new Date() }).where(eq(jurisdictions.id, jurisdictionId));
  } else {
    const row = await db.insert(jurisdictions).values(input.jurisdiction).returning({ id: jurisdictions.id });
    jurisdictionId = row[0].id;
  }

  for (const section of input.sections) {
    await db.insert(countryFactbookSections).values({ jurisdictionId, importPhase: 1, ...section }).onConflictDoUpdate({
      target: [countryFactbookSections.jurisdictionId, countryFactbookSections.sectionName],
      set: { ...section, updatedAt: new Date() },
    });
  }

  let rejectedFacts = 0;
  for (const fact of input.facts) {
    const validation = validateFactNumeric(fact.factKey, fact.factValueNumeric);
    const lifecycle = validation.accepted
      ? { status: "active", statusReason: null }
      : { status: "rejected", statusReason: validation.reason };
    if (!validation.accepted) rejectedFacts += 1;
    await db.insert(countryFacts).values({ jurisdictionId, sourceId: "cia_factbook", ...fact, ...lifecycle }).onConflictDoUpdate({
      target: [countryFacts.jurisdictionId, countryFacts.factKey, countryFacts.sourceId],
      set: { ...fact, ...lifecycle, retrievedAt: new Date() },
    });
  }

  const existing = await db.select({ id: statements.id }).from(statements).where(and(
    eq(statements.subjectTable, "jurisdictions"),
    eq(statements.subjectId, jurisdictionId),
    eq(statements.predicate, "factbook_import"),
    eq(statements.sourceId, "cia_factbook"),
  )).limit(1);
  const provenance = {
    objectValue: "Imported from CIA World Factbook archive",
    sourceId: "cia_factbook",
    sourceLicense: "public_domain",
    retrievedAt: new Date("2026-01-23"),
  };
  if (existing[0]) await db.update(statements).set(provenance).where(eq(statements.id, existing[0].id));
  else await db.insert(statements).values({ subjectTable: "jurisdictions", subjectId: jurisdictionId, predicate: "factbook_import", ...provenance });

  return {
    jurisdictionId,
    sections: input.sections.length,
    facts: input.facts.length,
    rejectedFacts,
    written: 1 + input.sections.length + input.facts.length,
  };
}
