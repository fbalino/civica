import { PGlite } from "@electric-sql/pglite";

import {
  DATA_VALUE_STATUSES,
  type DataValueStatus,
  validateDataValueState,
} from "@/lib/data/value-state";
import {
  JURISDICTION_STATUS_TYPES,
  type JurisdictionStatusType,
} from "@/lib/jurisdictions/status-taxonomy";

/** QA-003 — a credential-free, synthetic PostgreSQL fixture contract. */
export const FIXTURE_DATABASE_SCHEMA_VERSION =
  "civica-qa-database-fixture/v1" as const;

export type FixtureSource = {
  id: string;
  label: string;
  licenseUrl: string;
  lastSyncAt: string;
};

export type FixtureJurisdiction = {
  id: string;
  slug: string;
  name: string;
  iso3: string;
  status: JurisdictionStatusType;
};

export type FixtureFact = {
  id: string;
  jurisdictionId: string;
  factKey: string;
  value: number | null;
  valueStatus: DataValueStatus;
  reason: string | null;
  sourceId: string;
  observedAt: string | null;
};

export interface FixtureDatabaseSeed {
  schemaVersion: typeof FIXTURE_DATABASE_SCHEMA_VERSION;
  rights: {
    classification: "synthetic_test_data";
    license: "CC0-1.0";
    statement: string;
  };
  referenceTime: string;
  sources: readonly FixtureSource[];
  jurisdictions: readonly FixtureJurisdiction[];
  facts: readonly FixtureFact[];
  disputes: readonly {
    id: string;
    factId: string;
    status: "open" | "resolved";
    summary: string;
  }[];
  constitutions: readonly {
    id: string;
    jurisdictionId: string;
    title: string;
    status: "in_force" | "superseded";
    sourceId: string;
  }[];
  elections: readonly {
    id: string;
    jurisdictionId: string;
    date: string;
    status: "completed" | "scheduled";
    sourceId: string;
  }[];
  organizations: readonly {
    id: string;
    slug: string;
    name: string;
    sourceId: string;
  }[];
  organizationMemberships: readonly {
    id: string;
    organizationId: string;
    jurisdictionId: string;
    status: "member" | "observer" | "former_member";
    sourceId: string;
  }[];
  indexCandidates: readonly {
    id: string;
    jurisdictionId: string;
    candidate: "K1" | "K2" | "K3" | "K4" | "K5";
    state: "evaluated" | "insufficient_evidence";
    score: number | null;
  }[];
  pulseEvents: readonly {
    id: string;
    jurisdictionId: string;
    sourceId: string;
    disposition: "pending" | "non_governance" | "invalid" | "event";
    title: string;
  }[];
  pulseClusters: readonly {
    id: string;
    eventId: string;
    state: "pending_classification" | "classified";
    version: string;
  }[];
}

export type FixtureDatabaseCounts = {
  sources: number;
  jurisdictions: number;
  facts: number;
  disputes: number;
  constitutions: number;
  elections: number;
  organizations: number;
  organizationMemberships: number;
  indexCandidates: number;
  pulseEvents: number;
  pulseClusters: number;
};

const BASELINE_SQL = `
  CREATE TABLE fixture_sources (
    id text PRIMARY KEY,
    label text NOT NULL,
    license_url text NOT NULL,
    last_sync_at timestamptz NOT NULL
  );
  CREATE TABLE fixture_jurisdictions (
    id uuid PRIMARY KEY,
    slug text NOT NULL UNIQUE,
    name text NOT NULL,
    iso3 text NOT NULL UNIQUE,
    status text NOT NULL
  );
  CREATE TABLE fixture_facts (
    id uuid PRIMARY KEY,
    jurisdiction_id uuid NOT NULL REFERENCES fixture_jurisdictions(id),
    fact_key text NOT NULL,
    value numeric,
    value_status text NOT NULL,
    reason text,
    source_id text NOT NULL REFERENCES fixture_sources(id),
    observed_at date,
    UNIQUE (jurisdiction_id, fact_key)
  );
  CREATE TABLE fixture_disputes (
    id uuid PRIMARY KEY,
    fact_id uuid NOT NULL REFERENCES fixture_facts(id),
    status text NOT NULL,
    summary text NOT NULL
  );
  CREATE TABLE fixture_constitutions (
    id uuid PRIMARY KEY,
    jurisdiction_id uuid NOT NULL REFERENCES fixture_jurisdictions(id),
    title text NOT NULL,
    status text NOT NULL,
    source_id text NOT NULL REFERENCES fixture_sources(id)
  );
  CREATE TABLE fixture_elections (
    id uuid PRIMARY KEY,
    jurisdiction_id uuid NOT NULL REFERENCES fixture_jurisdictions(id),
    election_date date NOT NULL,
    status text NOT NULL,
    source_id text NOT NULL REFERENCES fixture_sources(id)
  );
  CREATE TABLE fixture_organizations (
    id uuid PRIMARY KEY,
    slug text NOT NULL UNIQUE,
    name text NOT NULL,
    source_id text NOT NULL REFERENCES fixture_sources(id)
  );
  CREATE TABLE fixture_organization_memberships (
    id uuid PRIMARY KEY,
    organization_id uuid NOT NULL REFERENCES fixture_organizations(id),
    jurisdiction_id uuid NOT NULL REFERENCES fixture_jurisdictions(id),
    status text NOT NULL,
    source_id text NOT NULL REFERENCES fixture_sources(id)
  );
  CREATE TABLE fixture_index_candidates (
    id uuid PRIMARY KEY,
    jurisdiction_id uuid NOT NULL REFERENCES fixture_jurisdictions(id),
    candidate text NOT NULL,
    state text NOT NULL,
    score numeric
  );
  CREATE TABLE fixture_pulse_events (
    id uuid PRIMARY KEY,
    jurisdiction_id uuid NOT NULL REFERENCES fixture_jurisdictions(id),
    source_id text NOT NULL REFERENCES fixture_sources(id),
    disposition text NOT NULL,
    title text NOT NULL
  );
  CREATE TABLE fixture_pulse_clusters (
    id uuid PRIMARY KEY,
    event_id uuid NOT NULL REFERENCES fixture_pulse_events(id),
    state text NOT NULL,
    version text NOT NULL
  );
`;

function unique(values: readonly string[], label: string, errors: string[]) {
  if (new Set(values).size !== values.length) errors.push(`${label} contains duplicate ids`);
}

function requireReference(
  value: string,
  values: ReadonlySet<string>,
  label: string,
  errors: string[],
) {
  if (!values.has(value)) errors.push(`${label} references unknown ${value}`);
}

/**
 * Validates the shareability and required-test-state envelope before a seed
 * reaches the disposable in-memory PostgreSQL instance.
 */
export function fixtureDatabaseSeedErrors(seed: FixtureDatabaseSeed): string[] {
  const errors: string[] = [];
  if (seed.schemaVersion !== FIXTURE_DATABASE_SCHEMA_VERSION) {
    errors.push("fixture schema version drifted");
  }
  if (
    seed.rights.classification !== "synthetic_test_data" ||
    seed.rights.license !== "CC0-1.0" ||
    !seed.rights.statement.trim()
  ) {
    errors.push("fixture rights must declare CC0 synthetic test data");
  }
  if (!Number.isFinite(new Date(seed.referenceTime).getTime())) {
    errors.push("fixture reference time is invalid");
  }
  unique(seed.sources.map(({ id }) => id), "sources", errors);
  unique(seed.jurisdictions.map(({ id }) => id), "jurisdictions", errors);
  unique(seed.facts.map(({ id }) => id), "facts", errors);
  const sourceIds = new Set(seed.sources.map(({ id }) => id));
  const jurisdictionIds = new Set(seed.jurisdictions.map(({ id }) => id));
  const factIds = new Set(seed.facts.map(({ id }) => id));
  const organizationIds = new Set(seed.organizations.map(({ id }) => id));
  const eventIds = new Set(seed.pulseEvents.map(({ id }) => id));
  if (seed.sources.length < 2) errors.push("fixture needs multiple sources");
  if (!seed.sources.every(({ licenseUrl }) => licenseUrl.startsWith("https://"))) {
    errors.push("fixture source license URLs must be absolute HTTPS URLs");
  }
  const staleCutoff = new Date(seed.referenceTime).getTime() - 365 * 86_400_000;
  if (!seed.sources.some(({ lastSyncAt }) => new Date(lastSyncAt).getTime() < staleCutoff)) {
    errors.push("fixture needs a stale source");
  }
  for (const jurisdiction of seed.jurisdictions) {
    if (!JURISDICTION_STATUS_TYPES.includes(jurisdiction.status)) {
      errors.push(`jurisdiction ${jurisdiction.id} has an unknown status`);
    }
  }
  for (const fact of seed.facts) {
    requireReference(fact.jurisdictionId, jurisdictionIds, `fact ${fact.id}`, errors);
    requireReference(fact.sourceId, sourceIds, `fact ${fact.id}`, errors);
    if (!DATA_VALUE_STATUSES.includes(fact.valueStatus)) {
      errors.push(`fact ${fact.id} has an unknown value status`);
      continue;
    }
    errors.push(
      ...validateDataValueState({
        status: fact.valueStatus,
        hasValue: fact.value !== null,
        reason: fact.reason,
      }).map((error) => `fact ${fact.id}: ${error}`),
    );
  }
  for (const state of ["observed", "missing", "disputed"] as const) {
    if (!seed.facts.some(({ valueStatus }) => valueStatus === state)) {
      errors.push(`fixture lacks ${state} fact state`);
    }
  }
  for (const dispute of seed.disputes) {
    requireReference(dispute.factId, factIds, `dispute ${dispute.id}`, errors);
  }
  if (!seed.disputes.some(({ factId }) => seed.facts.find(({ id }) => id === factId)?.valueStatus === "disputed")) {
    errors.push("fixture needs a dispute attached to a disputed fact");
  }
  for (const constitution of seed.constitutions) {
    requireReference(constitution.jurisdictionId, jurisdictionIds, `constitution ${constitution.id}`, errors);
    requireReference(constitution.sourceId, sourceIds, `constitution ${constitution.id}`, errors);
  }
  for (const election of seed.elections) {
    requireReference(election.jurisdictionId, jurisdictionIds, `election ${election.id}`, errors);
    requireReference(election.sourceId, sourceIds, `election ${election.id}`, errors);
  }
  for (const organization of seed.organizations) {
    requireReference(organization.sourceId, sourceIds, `organization ${organization.id}`, errors);
  }
  for (const membership of seed.organizationMemberships) {
    requireReference(membership.organizationId, organizationIds, `membership ${membership.id}`, errors);
    requireReference(membership.jurisdictionId, jurisdictionIds, `membership ${membership.id}`, errors);
    requireReference(membership.sourceId, sourceIds, `membership ${membership.id}`, errors);
  }
  for (const candidate of seed.indexCandidates) {
    requireReference(candidate.jurisdictionId, jurisdictionIds, `candidate ${candidate.id}`, errors);
  }
  for (const candidate of ["K1", "K3"] as const) {
    if (!seed.indexCandidates.some((row) => row.candidate === candidate)) {
      errors.push(`fixture lacks Index ${candidate} candidate`);
    }
  }
  for (const event of seed.pulseEvents) {
    requireReference(event.jurisdictionId, jurisdictionIds, `Pulse event ${event.id}`, errors);
    requireReference(event.sourceId, sourceIds, `Pulse event ${event.id}`, errors);
  }
  if (!seed.pulseEvents.some(({ disposition }) => disposition === "non_governance")) {
    errors.push("fixture lacks a retained Pulse negative");
  }
  for (const cluster of seed.pulseClusters) {
    requireReference(cluster.eventId, eventIds, `Pulse cluster ${cluster.id}`, errors);
  }
  if (!seed.pulseClusters.length) errors.push("fixture lacks a Pulse cluster");
  return errors;
}

/** Creates a fresh in-memory PostgreSQL database; it never reads process env. */
export async function createFixtureDatabase(seed: FixtureDatabaseSeed): Promise<PGlite> {
  const errors = fixtureDatabaseSeedErrors(seed);
  if (errors.length) throw new Error(errors.join("\n"));
  const database = await PGlite.create("memory://");
  try {
    await database.exec(BASELINE_SQL);
    await database.transaction(async (tx) => {
      for (const source of seed.sources) {
        await tx.query(
          "INSERT INTO fixture_sources (id,label,license_url,last_sync_at) VALUES ($1,$2,$3,$4)",
          [source.id, source.label, source.licenseUrl, source.lastSyncAt],
        );
      }
      for (const jurisdiction of seed.jurisdictions) {
        await tx.query(
          "INSERT INTO fixture_jurisdictions (id,slug,name,iso3,status) VALUES ($1,$2,$3,$4,$5)",
          [jurisdiction.id, jurisdiction.slug, jurisdiction.name, jurisdiction.iso3, jurisdiction.status],
        );
      }
      for (const fact of seed.facts) {
        await tx.query(
          "INSERT INTO fixture_facts (id,jurisdiction_id,fact_key,value,value_status,reason,source_id,observed_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)",
          [fact.id, fact.jurisdictionId, fact.factKey, fact.value, fact.valueStatus, fact.reason, fact.sourceId, fact.observedAt],
        );
      }
      for (const dispute of seed.disputes) {
        await tx.query(
          "INSERT INTO fixture_disputes (id,fact_id,status,summary) VALUES ($1,$2,$3,$4)",
          [dispute.id, dispute.factId, dispute.status, dispute.summary],
        );
      }
      for (const constitution of seed.constitutions) {
        await tx.query(
          "INSERT INTO fixture_constitutions (id,jurisdiction_id,title,status,source_id) VALUES ($1,$2,$3,$4,$5)",
          [constitution.id, constitution.jurisdictionId, constitution.title, constitution.status, constitution.sourceId],
        );
      }
      for (const election of seed.elections) {
        await tx.query(
          "INSERT INTO fixture_elections (id,jurisdiction_id,election_date,status,source_id) VALUES ($1,$2,$3,$4,$5)",
          [election.id, election.jurisdictionId, election.date, election.status, election.sourceId],
        );
      }
      for (const organization of seed.organizations) {
        await tx.query(
          "INSERT INTO fixture_organizations (id,slug,name,source_id) VALUES ($1,$2,$3,$4)",
          [organization.id, organization.slug, organization.name, organization.sourceId],
        );
      }
      for (const membership of seed.organizationMemberships) {
        await tx.query(
          "INSERT INTO fixture_organization_memberships (id,organization_id,jurisdiction_id,status,source_id) VALUES ($1,$2,$3,$4,$5)",
          [membership.id, membership.organizationId, membership.jurisdictionId, membership.status, membership.sourceId],
        );
      }
      for (const candidate of seed.indexCandidates) {
        await tx.query(
          "INSERT INTO fixture_index_candidates (id,jurisdiction_id,candidate,state,score) VALUES ($1,$2,$3,$4,$5)",
          [candidate.id, candidate.jurisdictionId, candidate.candidate, candidate.state, candidate.score],
        );
      }
      for (const event of seed.pulseEvents) {
        await tx.query(
          "INSERT INTO fixture_pulse_events (id,jurisdiction_id,source_id,disposition,title) VALUES ($1,$2,$3,$4,$5)",
          [event.id, event.jurisdictionId, event.sourceId, event.disposition, event.title],
        );
      }
      for (const cluster of seed.pulseClusters) {
        await tx.query(
          "INSERT INTO fixture_pulse_clusters (id,event_id,state,version) VALUES ($1,$2,$3,$4)",
          [cluster.id, cluster.eventId, cluster.state, cluster.version],
        );
      }
    });
    return database;
  } catch (error) {
    await database.close();
    throw error;
  }
}

export async function fixtureDatabaseCounts(
  database: PGlite,
): Promise<FixtureDatabaseCounts> {
  const result = await database.query<{ label: string; count: number }>(`
    SELECT 'sources' AS label, count(*)::int AS count FROM fixture_sources
    UNION ALL SELECT 'jurisdictions', count(*)::int FROM fixture_jurisdictions
    UNION ALL SELECT 'facts', count(*)::int FROM fixture_facts
    UNION ALL SELECT 'disputes', count(*)::int FROM fixture_disputes
    UNION ALL SELECT 'constitutions', count(*)::int FROM fixture_constitutions
    UNION ALL SELECT 'elections', count(*)::int FROM fixture_elections
    UNION ALL SELECT 'organizations', count(*)::int FROM fixture_organizations
    UNION ALL SELECT 'organizationMemberships', count(*)::int FROM fixture_organization_memberships
    UNION ALL SELECT 'indexCandidates', count(*)::int FROM fixture_index_candidates
    UNION ALL SELECT 'pulseEvents', count(*)::int FROM fixture_pulse_events
    UNION ALL SELECT 'pulseClusters', count(*)::int FROM fixture_pulse_clusters
  `);
  return Object.fromEntries(
    result.rows.map(({ label, count }) => [label, Number(count)]),
  ) as FixtureDatabaseCounts;
}

export function fixtureSeedCounts(seed: FixtureDatabaseSeed): FixtureDatabaseCounts {
  return {
    sources: seed.sources.length,
    jurisdictions: seed.jurisdictions.length,
    facts: seed.facts.length,
    disputes: seed.disputes.length,
    constitutions: seed.constitutions.length,
    elections: seed.elections.length,
    organizations: seed.organizations.length,
    organizationMemberships: seed.organizationMemberships.length,
    indexCandidates: seed.indexCandidates.length,
    pulseEvents: seed.pulseEvents.length,
    pulseClusters: seed.pulseClusters.length,
  };
}
