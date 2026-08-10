import { isNotNull } from "drizzle-orm";

import { runSparql } from "@/lib/factbook/reconcile/wikidata-client";
import { jurisdictions, offices, persons, terms } from "@/lib/db/schema";
import { sql } from "drizzle-orm";

import { ENTITY_NAME_FORM_CONTRACT, type EntityNameForm } from "./name-forms";
import {
  writeEntityNameForms,
  type EntityNameFormsWriteSummary,
} from "./name-form-store";

type Db = typeof import("@/lib/db").db;

/**
 * EXP-029 — source-backed entity name-form capture (Wikidata).
 *
 * Captures only publisher-supplied monolingual-text statements whose language
 * tag is explicit in the source payload; nothing is inferred from the string:
 *
 * - jurisdictions: P1448 (official name) and P1705 (native label)
 * - persons in current principal-office terms: P1559 (name in native language)
 * - offices with a retained Wikidata identity: P1448 and P1705
 *
 * Political parties currently retain no publisher identity
 * (`political_parties.identity_source_id` is unpopulated), so party forms are
 * reported as an explicit zero scope rather than being fabricated from
 * English canonical names.
 *
 * Truthy `wdt:` paths follow the Wikidata rank contract: preferred-rank
 * statements win when present, deprecated statements never appear. Multiple
 * distinct values for one (entity, role, language) identity are ambiguous and
 * fail closed as skipped identities.
 */

export const NAME_FORM_PROPERTIES = [
  { entityType: "jurisdiction", pid: "P1448", nameRole: "official" },
  { entityType: "jurisdiction", pid: "P1705", nameRole: "native" },
  { entityType: "person", pid: "P1559", nameRole: "native" },
  { entityType: "office", pid: "P1448", nameRole: "official" },
  { entityType: "office", pid: "P1705", nameRole: "native" },
] as const;

export type NameFormPropertyConfig = (typeof NAME_FORM_PROPERTIES)[number];

export interface NameFormEntity {
  entityType: "jurisdiction" | "person" | "office";
  entityId: string;
  wikidataQid: string;
}

export interface MonolingualClaim {
  qid: string;
  value: string;
  languageTag: string;
}

export type MonolingualClaimFetcher = (
  qids: readonly string[],
  pid: string,
) => Promise<MonolingualClaim[]>;

export interface NameFormSyncOptions {
  dryRun?: boolean;
  /** Test seams. Production uses the canonical DB scopes and SPARQL client. */
  entities?: readonly NameFormEntity[];
  getMonolingualClaims?: MonolingualClaimFetcher;
  write?: typeof writeEntityNameForms;
  retrievedAt?: Date;
  onProgress?: (line: string) => void;
  sparqlBatchSize?: number;
}

export interface NameFormSyncSummary {
  startedAt: string;
  finishedAt: string;
  dryRun: boolean;
  entitiesInScope: {
    jurisdiction: number;
    person: number;
    office: number;
    political_party: 0;
  };
  claimsRetrieved: number;
  proposedForms: number;
  skippedAmbiguousIdentities: number;
  skippedUnusableLanguage: number;
  write: EntityNameFormsWriteSummary;
  errors: string[];
}

/** Wikidata special codes that do not identify a language. */
const NON_LANGUAGE_TAGS = new Set(["und", "zxx", "mis", "mul"]);

const LANGUAGE_TAG_PATTERN = /^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{1,8})*$/;

/**
 * Mechanical BCP-47 handling only: surface an explicit script subtag already
 * present in the publisher's language tag (e.g. `zh-hant` → `Hant`). No
 * script is ever inferred from the string value itself.
 */
export function scriptCodeFromLanguageTag(languageTag: string): string | null {
  const subtags = languageTag.split("-").slice(1);
  for (const subtag of subtags) {
    if (/^[A-Za-z]{4}$/.test(subtag)) {
      return (
        subtag[0].toUpperCase() + subtag.slice(1).toLowerCase()
      );
    }
  }
  return null;
}

async function fetchMonolingualClaims(
  qids: readonly string[],
  pid: string,
): Promise<MonolingualClaim[]> {
  const values = qids.map((qid) => `wd:${qid}`).join(" ");
  const query = `
    SELECT ?entity ?value WHERE {
      VALUES ?entity { ${values} }
      ?entity wdt:${pid} ?value .
    }
  `;
  const result = await runSparql(query);
  const rows: MonolingualClaim[] = [];
  for (const binding of result.results.bindings) {
    const entity = binding.entity?.value ?? "";
    const qid = entity.split("/").pop() ?? "";
    const value = binding.value?.value?.trim() ?? "";
    const languageTag = binding.value?.["xml:lang"]?.trim() ?? "";
    if (!qid || !value || !languageTag) continue;
    rows.push({ qid, value, languageTag });
  }
  return rows;
}

/** Retained identifiers that are not well-formed QIDs never reach SPARQL. */
const QID_PATTERN = /^Q\d+$/;

async function loadEntityScopes(db: Db): Promise<NameFormEntity[]> {
  const scoped: NameFormEntity[] = [];

  const jurisdictionRows = await db
    .select({ id: jurisdictions.id, qid: jurisdictions.wikidataQid })
    .from(jurisdictions)
    .where(isNotNull(jurisdictions.wikidataQid));
  for (const row of jurisdictionRows) {
    if (row.qid && QID_PATTERN.test(row.qid)) {
      scoped.push({
        entityType: "jurisdiction",
        entityId: row.id,
        wikidataQid: row.qid,
      });
    }
  }

  // Persons: current principal-office holders (the leaders scope), the
  // representative person surface named by EXP-029.
  const personRows = await db
    .selectDistinct({ id: persons.id, qid: persons.wikidataQid })
    .from(persons)
    .innerJoin(terms, sql`${terms.personId} = ${persons.id}`)
    .innerJoin(offices, sql`${offices.id} = ${terms.officeId}`)
    .where(
      sql`${terms.isCurrent} = true AND ${persons.wikidataQid} IS NOT NULL AND ${offices.officeType} IN ('head_of_state', 'head_of_government')`,
    );
  for (const row of personRows) {
    if (row.qid && QID_PATTERN.test(row.qid)) {
      scoped.push({
        entityType: "person",
        entityId: row.id,
        wikidataQid: row.qid,
      });
    }
  }

  const officeRows = await db
    .select({ id: offices.id, qid: offices.wikidataQid })
    .from(offices)
    .where(isNotNull(offices.wikidataQid));
  for (const row of officeRows) {
    if (row.qid && QID_PATTERN.test(row.qid)) {
      scoped.push({
        entityType: "office",
        entityId: row.id,
        wikidataQid: row.qid,
      });
    }
  }

  return scoped;
}

export async function syncEntityNameForms(
  db: Db,
  options: NameFormSyncOptions = {},
): Promise<NameFormSyncSummary> {
  const startedAt = new Date().toISOString();
  const log = options.onProgress ?? (() => {});
  const errors: string[] = [];
  const retrievedAt = options.retrievedAt ?? new Date();
  const batchSize = options.sparqlBatchSize ?? 80;
  const getClaims = options.getMonolingualClaims ?? fetchMonolingualClaims;

  const entities = options.entities ?? (await loadEntityScopes(db));
  const byType = {
    jurisdiction: entities.filter((e) => e.entityType === "jurisdiction"),
    person: entities.filter((e) => e.entityType === "person"),
    office: entities.filter((e) => e.entityType === "office"),
  };
  log(
    `Name-form scope: ${byType.jurisdiction.length} jurisdictions, ` +
      `${byType.person.length} persons, ${byType.office.length} offices, ` +
      `0 political parties (no publisher identity retained).`,
  );

  const qidToEntity = new Map<string, NameFormEntity[]>();
  for (const entity of entities) {
    const list = qidToEntity.get(entity.wikidataQid) ?? [];
    list.push(entity);
    qidToEntity.set(entity.wikidataQid, list);
  }

  let claimsRetrieved = 0;
  let skippedUnusableLanguage = 0;
  let skippedAmbiguousIdentities = 0;

  /** identity key → single agreed value, or null when ambiguous */
  const candidates = new Map<
    string,
    { form: EntityNameForm; distinctValues: Set<string> }
  >();

  for (const config of NAME_FORM_PROPERTIES) {
    const scope = byType[config.entityType];
    if (scope.length === 0) continue;
    const qids = [...new Set(scope.map((entity) => entity.wikidataQid))];
    for (let i = 0; i < qids.length; i += batchSize) {
      const batch = qids.slice(i, i + batchSize);
      let claims: MonolingualClaim[] = [];
      try {
        claims = await getClaims(batch, config.pid);
      } catch (err) {
        const message = `${config.entityType} ${config.pid} batch ${i / batchSize}: SPARQL failure — ${
          err instanceof Error ? err.message : String(err)
        }`;
        errors.push(message);
        log(`! ${message}`);
        continue;
      }
      claimsRetrieved += claims.length;

      for (const claim of claims) {
        const targets = (qidToEntity.get(claim.qid) ?? []).filter(
          (entity) => entity.entityType === config.entityType,
        );
        if (targets.length === 0) continue;
        const languageTag = claim.languageTag;
        const bareLanguage = languageTag.split("-")[0].toLowerCase();
        if (
          !LANGUAGE_TAG_PATTERN.test(languageTag) ||
          NON_LANGUAGE_TAGS.has(bareLanguage)
        ) {
          skippedUnusableLanguage += 1;
          continue;
        }
        for (const entity of targets) {
          const identity = [
            entity.entityType,
            entity.entityId,
            config.nameRole,
            languageTag,
            "wikidata",
          ].join(":");
          const existing = candidates.get(identity);
          if (existing) {
            existing.distinctValues.add(claim.value);
            continue;
          }
          candidates.set(identity, {
            distinctValues: new Set([claim.value]),
            form: {
              contractVersion: ENTITY_NAME_FORM_CONTRACT,
              entityType: entity.entityType,
              entityId: entity.entityId,
              value: claim.value,
              languageTag,
              scriptCode: scriptCodeFromLanguageTag(languageTag),
              nameRole: config.nameRole,
              sourceId: "wikidata",
              sourceUrl: `https://www.wikidata.org/wiki/${claim.qid}`,
              retrievedAt: retrievedAt.toISOString(),
              upstreamVintage: "Wikidata revision at retrieval",
              translationStatus: "not_translated",
              transliterationStatus: "not_transliterated",
            },
          });
        }
      }
    }
  }

  const forms: EntityNameForm[] = [];
  for (const candidate of candidates.values()) {
    if (candidate.distinctValues.size > 1) {
      skippedAmbiguousIdentities += 1;
      continue;
    }
    forms.push(candidate.form);
  }

  log(
    `${claimsRetrieved} publisher claims retrieved → ${forms.length} proposed ` +
      `forms (${skippedAmbiguousIdentities} ambiguous identities and ` +
      `${skippedUnusableLanguage} non-language tags failed closed).`,
  );

  let write: EntityNameFormsWriteSummary = {
    proposed: 0,
    written: 0,
    unchanged: 0,
    sourcesStamped: [],
  };
  if (forms.length === 0) {
    // Fail closed: an empty upstream result must never look like a
    // successful refresh, and never advances source freshness.
    errors.push("Wikidata returned zero usable name forms; nothing written.");
  } else {
    write = await (options.write ?? writeEntityNameForms)(db, forms, {
      dryRun: options.dryRun,
      recordedAt: retrievedAt,
    });
  }

  return {
    startedAt,
    finishedAt: new Date().toISOString(),
    dryRun: options.dryRun ?? false,
    entitiesInScope: {
      jurisdiction: byType.jurisdiction.length,
      person: byType.person.length,
      office: byType.office.length,
      political_party: 0,
    },
    claimsRetrieved,
    proposedForms: forms.length,
    skippedAmbiguousIdentities,
    skippedUnusableLanguage,
    write,
    errors,
  };
}
