/**
 * Phase 5.5 — clustering / de-duplication.
 *
 * Pulls unclustered `raw_events` rows, normalizes report identity, embeds
 * title+body, and groups near-duplicate records into governance-event clusters:
 *
 *   - event dates within ±48h of each other
 *   - multilingual semantic or canonical-token similarity meets its threshold
 *   - a shared identity anchor prevents generic same-day stories from merging
 *
 * The ingest-time jurisdiction is diagnostic input, never a partition. Subject
 * country is resolved later from the combined cluster evidence. The global
 * union-find is O(N²) within a capped run and date-window pruning keeps it bounded.
 */

import { createHash, randomUUID } from "node:crypto";
import { and, asc, eq, isNull, lte, or } from "drizzle-orm";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
import { pulsePipelineRuns, rawEvents } from "@/lib/db/schema";
import type * as schema from "@/lib/db/schema";
import { tryEmbedBatch, cosineSimilarity } from "./embed";
import {
  compareEventIdentities,
  normalizeEventIdentity,
} from "./event-identity";
import {
  PULSE_INCIDENT_RESOLUTION_VERSION,
  planIncidentResolution,
  selectCanonicalIncident,
  type IncidentCandidate,
} from "./incident-resolution";
import {
  PULSE_INCIDENT_ASSIGNMENT_ALGORITHM_VERSION,
  PULSE_INCIDENT_ASSIGNMENT_SCHEMA_VERSION,
  buildIncidentAssignmentKey,
  buildIncidentResolutionKey,
  loadActiveIncidentCandidates,
  repairAssignedEvidenceForCurrentEvents,
  type AttachIncidentEvidencePlan,
  type IncidentAssignmentPlan,
  type IncidentResolutionRecordPlan,
  type NewIncidentPlan,
} from "./incident-store";
import {
  publishSemanticClusterPlan,
  type SemanticClusterAssignmentPlan,
  type SemanticClusterIncidentPlan,
  type SemanticClusterPublisher,
} from "./cluster-publish";
import {
  createPulsePipelineRunRef,
  finishPulsePipelineRun,
  preparePulsePipelineRun,
  pulseCronStageRunId,
  startPulsePipelineRun,
  type PulsePipelineRunRef,
} from "./pipeline-version";

type Db = NeonHttpDatabase<typeof schema>;

/** Date-window half-width in hours per spec §2.4. */
export const CLUSTER_DATE_WINDOW_HOURS = 48;

export interface ClusterRunSummary {
  runId: string;
  versionKey: string;
  /** Partial means lexical fallback replaced the semantic embedding model. */
  status: "completed" | "partial";
  /** All unclustered rows considered, including unresolved jurisdictions. */
  candidates: number;
  /** Rows that actually received a durable incident/cluster assignment. */
  clustered: number;
  /** Distinct durable incidents/clusters created. */
  clustersCreated: number;
  /** Rows the computed plan would assign if the semantic model is available. */
  wouldCluster: number;
  /** Distinct incidents/clusters the computed plan would create. */
  wouldCreateClusters: number;
  /** New reports attached to an already stable incident. */
  matchedPersistedIncidents: number;
  /** Reports the plan would attach to an existing incident. */
  wouldMatchPersistedIncidents: number;
  /** Possible collisions retained for review rather than auto-merged. */
  collisionCandidates: number;
  comparisonPairs: number;
  /** Clusters with more than one source id. */
  multiSourceClusters: number;
  /** Clusters with more than one independent source-family id. */
  multiSourceFamilyClusters: number;
  /** Clusters containing more than one declared evidence language. */
  multilingualClusters: number;
  /** Clusters whose members had different or missing provisional jurisdictions. */
  crossJurisdictionClusters: number;
  dryRun: boolean;
  assignments: Array<{
    clusterId: string;
    incidentId: string;
    memberIds: string[];
    matchKind: "new" | "persisted_match";
  }>;
  /** True when a delivery retry reused its already-completed stage run. */
  reused: boolean;
}

export interface CandidateRow {
  id: string;
  jurisdictionId: string | null;
  eventDate: string | null;
  title: string;
  body: string | null;
  sourceId: string;
  sourceType?: string;
  sourceUrl?: string | null;
  sourceFamilyId: string;
  language: string;
  ingestRunId: string;
  origin?: "new" | "persisted";
  incidentId?: string;
  eventId?: string | null;
  clusterId?: string | null;
  embedding?: number[] | null;
}

interface IncidentPersistence {
  insertIncident: (db: Db, plan: NewIncidentPlan) => Promise<string>;
  assignReport: (db: Db, plan: IncidentAssignmentPlan) => Promise<void>;
  attachEvidence: (db: Db, plan: AttachIncidentEvidencePlan) => Promise<void>;
  appendResolution: (
    db: Db,
    plan: IncidentResolutionRecordPlan,
  ) => Promise<void>;
}

export interface ClusterRunOptions {
  limit?: number;
  dryRun?: boolean;
  /** Fixture seam: bypasses the database candidate read. */
  candidates?: CandidateRow[];
  /** Fixture seam for already persisted stable incidents. */
  persistedIncidents?: IncidentCandidate[];
  /** Fixture seam: null forces lexical clustering; an array supplies vectors. */
  embeddingResult?: number[][] | null;
  now?: Date;
  clusterIdFactory?: (memberIds: readonly string[]) => string;
  runRef?: PulsePipelineRunRef;
  /** Stable logical cron delivery key injected by `withCronJob()`. */
  cronExecutionKey?: string;
  incidentPersistence?: IncidentPersistence;
  /** Fixture seam for observing or fault-injecting the one-shot publish plan. */
  publishPlan?: SemanticClusterPublisher;
  /** Integration-fixture seam for exercising production run persistence. */
  persistRun?: boolean;
}

function deterministicFixtureClusterId(memberIds: readonly string[]): string {
  const hash = createHash("sha256")
    .update([...memberIds].sort().join("\n"))
    .digest("hex");
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-8${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

function validateCandidates(candidates: readonly CandidateRow[]): void {
  const ids = new Set<string>();
  for (const [index, candidate] of candidates.entries()) {
    if (
      !candidate.id.trim() ||
      !candidate.title.trim() ||
      !candidate.sourceFamilyId.trim() ||
      !candidate.language.trim() ||
      !candidate.ingestRunId.trim()
    ) {
      throw new Error(
        `Invalid cluster candidate at index ${index}: id, title, sourceFamilyId, language, and ingestRunId are required`,
      );
    }
    if (ids.has(candidate.id)) {
      throw new Error(
        `Invalid cluster fixture: duplicate candidate id ${candidate.id}`,
      );
    }
    ids.add(candidate.id);
  }
}

function countValue(counts: Record<string, number>, key: string): number {
  const value = counts[key];
  return Number.isFinite(value) ? value : 0;
}

function reusedClusterSummary(input: {
  runId: string;
  versionKey: string;
  counts: Record<string, number>;
}): ClusterRunSummary {
  const { counts } = input;
  return {
    runId: input.runId,
    versionKey: input.versionKey,
    status: "completed",
    candidates: countValue(counts, "candidates"),
    clustered: countValue(counts, "clustered"),
    clustersCreated: countValue(counts, "clustersCreated"),
    wouldCluster: countValue(counts, "wouldCluster"),
    wouldCreateClusters: countValue(counts, "wouldCreateClusters"),
    matchedPersistedIncidents: countValue(counts, "matchedPersistedIncidents"),
    wouldMatchPersistedIncidents: countValue(
      counts,
      "wouldMatchPersistedIncidents",
    ),
    collisionCandidates: countValue(counts, "collisionCandidates"),
    comparisonPairs: countValue(counts, "comparisonPairs"),
    multiSourceClusters: countValue(counts, "multiSourceClusters"),
    multiSourceFamilyClusters: countValue(counts, "multiSourceFamilyClusters"),
    multilingualClusters: countValue(counts, "multilingualClusters"),
    crossJurisdictionClusters: countValue(counts, "crossJurisdictionClusters"),
    dryRun: false,
    assignments: [],
    reused: true,
  };
}

/**
 * Run the clustering pipeline against all unclustered rows. Returns
 * a summary of what changed.
 */
export async function runClustering(
  db: Db,
  opts: ClusterRunOptions = {},
): Promise<ClusterRunSummary> {
  const limit = opts.limit ?? 1000;
  const persistRun =
    !opts.dryRun && (opts.persistRun ?? (!opts.candidates && !opts.runRef));
  const cronRunId = opts.cronExecutionKey
    ? pulseCronStageRunId(opts.cronExecutionKey, "cluster")
    : null;
  if (cronRunId && opts.runRef && cronRunId !== opts.runRef.id) {
    throw new Error("cluster runRef conflicts with the cron delivery identity");
  }
  let runningCronRun: {
    versionKey: string;
    counts: Record<string, number>;
    startedAt: Date;
  } | null = null;

  // Check the delivery-stable run before reading the mutable queue. If the
  // domain publish committed but the outer cron ledger failed to finish, the
  // retry must reuse the completed run rather than derive a new version from
  // the now-empty queue.
  if (persistRun && cronRunId) {
    const existing = await db
      .select({
        stage: pulsePipelineRuns.stage,
        status: pulsePipelineRuns.status,
        versionKey: pulsePipelineRuns.versionKey,
        counts: pulsePipelineRuns.counts,
        startedAt: pulsePipelineRuns.startedAt,
      })
      .from(pulsePipelineRuns)
      .where(eq(pulsePipelineRuns.id, cronRunId))
      .limit(1);
    if (existing[0] && existing[0].stage !== "cluster") {
      throw new Error(`Pulse pipeline run identity collision: ${cronRunId}`);
    }
    if (existing[0]?.status === "completed") {
      return reusedClusterSummary({
        runId: cronRunId,
        versionKey: existing[0].versionKey,
        counts: existing[0].counts,
      });
    }
    if (existing[0] && existing[0].status !== "running") {
      throw new Error(
        `Terminal Pulse pipeline run cannot be resumed: ${cronRunId} (${existing[0].status})`,
      );
    }
    if (existing[0]?.status === "running") {
      runningCronRun = {
        versionKey: existing[0].versionKey,
        counts: existing[0].counts,
        startedAt: existing[0].startedAt,
      };
    }
  }
  const selectionCutoff = runningCronRun?.startedAt ?? opts.now ?? new Date();

  // A report can receive an incident assignment while classification is
  // publishing the incident's first event. It was correctly excluded from the
  // frozen model workset, but must converge into the event's source trail on a
  // later cluster delivery instead of remaining permanently pending.
  if (!opts.dryRun && !opts.candidates && !opts.runRef) {
    const repaired = await repairAssignedEvidenceForCurrentEvents(db, {
      limit,
    });
    if (repaired > 0) {
      console.info(
        `[cluster] attached ${repaired} late incident evidence row(s) without reclassification`,
      );
    }
  }

  // Pull every unclustered candidate. A provisional country must never prevent
  // two reports about the same event from meeting.
  const newCandidates: CandidateRow[] =
    opts.candidates ??
    (
      await db
        .select({
          id: rawEvents.id,
          jurisdictionId: rawEvents.jurisdictionId,
          eventDate: rawEvents.eventDate,
          title: rawEvents.title,
          body: rawEvents.body,
          sourceId: rawEvents.sourceId,
          sourceType: rawEvents.sourceType,
          sourceUrl: rawEvents.sourceUrl,
          embedding: rawEvents.embedding,
          evidenceLanguage: rawEvents.evidenceLanguage,
          evidencePublisher: rawEvents.evidencePublisher,
          ingestRunId: rawEvents.ingestRunId,
        })
        .from(rawEvents)
        .where(
          and(
            isNull(rawEvents.clusterId),
            // Legacy rows may predate a non-null created_at contract. Keep
            // them eligible; sanctioned ingest rows receive defaultNow and
            // are fenced by the durable run cutoff on retry.
            or(
              isNull(rawEvents.createdAt),
              lte(rawEvents.createdAt, selectionCutoff),
            ),
          ),
        )
        .orderBy(asc(rawEvents.createdAt), asc(rawEvents.id))
        .limit(limit)
    ).map((row) => ({
      id: row.id,
      jurisdictionId: row.jurisdictionId,
      eventDate: row.eventDate,
      title: row.title,
      body: row.body,
      sourceId: row.sourceId,
      sourceType: row.sourceType,
      sourceUrl: row.sourceUrl,
      sourceFamilyId: row.evidencePublisher.sourceFamilyId,
      language: row.evidenceLanguage,
      ingestRunId: row.ingestRunId,
      embedding: row.embedding,
      origin: "new" as const,
    }));

  validateCandidates(newCandidates);
  const run =
    opts.runRef ??
    createPulsePipelineRunRef("cluster", {
      id: cronRunId ?? undefined,
      sourceIds: newCandidates.length
        ? newCandidates.map(({ sourceId }) => sourceId)
        : undefined,
      upstreamRunIds: newCandidates.map(({ ingestRunId }) => ingestRunId),
    });
  if (persistRun) {
    const prepared = cronRunId
      ? runningCronRun
        ? await preparePulsePipelineRun(db, run)
        : (await db.insert(pulsePipelineRuns).values({
            id: run.id,
            stage: run.versions.stage,
            status: "running",
            versionKey: run.versionKey,
            versions: run.versions,
            startedAt: selectionCutoff,
          }),
          { state: "ready" as const })
      : (await startPulsePipelineRun(db, run), { state: "ready" as const });
    if (prepared.state === "completed") {
      return reusedClusterSummary({
        runId: run.id,
        versionKey: run.versionKey,
        counts: prepared.counts,
      });
    }
  }

  if (newCandidates.length === 0) {
    if (persistRun) {
      await finishPulsePipelineRun(db, run.id, {
        status: "completed",
        counts: { candidates: 0, clustered: 0, clustersCreated: 0 },
      });
    }
    return {
      runId: run.id,
      versionKey: run.versionKey,
      status: "completed",
      candidates: 0,
      clustered: 0,
      clustersCreated: 0,
      wouldCluster: 0,
      wouldCreateClusters: 0,
      matchedPersistedIncidents: 0,
      wouldMatchPersistedIncidents: 0,
      collisionCandidates: 0,
      comparisonPairs: 0,
      multiSourceClusters: 0,
      multiSourceFamilyClusters: 0,
      multilingualClusters: 0,
      crossJurisdictionClusters: 0,
      dryRun: opts.dryRun ?? false,
      assignments: [],
      reused: false,
    };
  }

  const dated = newCandidates
    .map(({ eventDate }) => eventDate)
    .filter((value): value is string => Boolean(value))
    .sort();
  const fallbackDate = (opts.now ?? new Date()).toISOString();
  const persistedIncidents =
    opts.persistedIncidents ??
    (opts.candidates
      ? []
      : await loadActiveIncidentCandidates(db, {
          windowStart: dated[0] ?? fallbackDate,
          windowEnd: dated.at(-1) ?? fallbackDate,
          comparisonWindowHours: CLUSTER_DATE_WINDOW_HOURS,
        }));
  const persistedCandidates: CandidateRow[] = persistedIncidents.map(
    (candidate) => ({
      id: `persisted:${candidate.incidentId}`,
      jurisdictionId: candidate.jurisdictionId,
      eventDate: candidate.eventDate,
      title: candidate.headline,
      body: candidate.body,
      sourceId: `incident:${candidate.incidentId}`,
      sourceType: "incident",
      sourceUrl: null,
      sourceFamilyId: `incident:${candidate.incidentId}`,
      language: "und",
      ingestRunId: run.id,
      origin: "persisted",
      incidentId: candidate.incidentId,
      eventId: candidate.eventId,
      clusterId: candidate.clusterId,
      embedding: candidate.embedding,
    }),
  );
  const candidates = [...newCandidates, ...persistedCandidates];

  // Batch-embed all candidates in one pass — much faster than per-row.
  const texts = candidates.map((c) =>
    [c.title, c.body ?? ""].filter(Boolean).join(" — ").slice(0, 1500),
  );
  console.log(
    `[cluster] embedding ${candidates.length} candidates (this triggers model load on first run)…`,
  );
  // Semantic embeddings when the local model loads; null on serverless where
  // the ONNX native runtime is absent — then similarity is lexical (Jaccard).
  const embeddings =
    "embeddingResult" in opts
      ? (opts.embeddingResult ?? null)
      : await tryEmbedBatch(texts);
  const useEmbeddings = embeddings !== null;
  // Lexical fallback remains a diagnostic plan only. It cannot write durable
  // incident identity and then report a retryable partial failure: that would
  // let the retry see an empty queue and falsely finalize the same delivery.
  const applyAssignments = !opts.dryRun && useEmbeddings;
  if (useEmbeddings && embeddings.length !== candidates.length) {
    throw new Error(
      `Embedding result length ${embeddings.length} does not match ${candidates.length} incident candidates`,
    );
  }
  console.log(
    `[cluster] similarity mode: ${useEmbeddings ? "semantic embeddings" : "lexical (embedding model unavailable)"}`,
  );

  let clustered = 0;
  let clustersCreated = 0;
  let wouldCluster = 0;
  let wouldCreateClusters = 0;
  let multiSourceClusters = 0;
  let multiSourceFamilyClusters = 0;
  let multilingualClusters = 0;
  let crossJurisdictionClusters = 0;
  let matchedPersistedIncidents = 0;
  let wouldMatchPersistedIncidents = 0;
  const now = opts.now ?? new Date();
  const assignments: ClusterRunSummary["assignments"] = [];
  const persistedByIncident = new Map(
    persistedIncidents.map((candidate) => [candidate.incidentId, candidate]),
  );
  const incidentCandidates: IncidentCandidate[] = candidates.map(
    (candidate, index) => {
      if (candidate.origin === "persisted" && candidate.incidentId) {
        const persisted = persistedByIncident.get(candidate.incidentId);
        if (!persisted) {
          throw new Error(
            `Persisted incident ${candidate.incidentId} is missing its candidate projection`,
          );
        }
        return {
          ...persisted,
          embedding: useEmbeddings ? embeddings[index] : persisted.embedding,
        };
      }
      return {
        incidentId: `new:${candidate.id}`,
        eventId: `raw:${candidate.id}`,
        clusterId: candidate.clusterId ?? `new:${candidate.id}`,
        origin: "new",
        jurisdictionId: candidate.jurisdictionId,
        eventDate: candidate.eventDate ?? now.toISOString(),
        headline: candidate.title,
        body: candidate.body,
        sourceCount: 1,
        publicationStatus: "unpublished",
        reviewStatus: "unreviewed",
        categoryId: null,
        dimension: null,
        direction: null,
        severity: null,
        createdAt: now.toISOString(),
        embedding: useEmbeddings ? embeddings[index] : null,
      };
    },
  );
  const resolutionPlan = planIncidentResolution(incidentCandidates);
  const incidentIndex = new Map(
    incidentCandidates.map((candidate, index) => [candidate.incidentId, index]),
  );
  const comparisonPairs = resolutionPlan.findings.filter(
    ({ candidateIds }) => candidateIds.length === 2,
  ).length;
  const collisionFindings = resolutionPlan.findings.filter(
    ({ disposition }) => disposition === "candidate_merge",
  );

  // Global union-find: jurisdiction is deliberately not a bucket.
  const indexes = candidates.map((_, index) => index);
  const parent = new Map<number, number>();
  for (const i of indexes) parent.set(i, i);
  const find = (i: number): number => {
    let p = i;
    while (parent.get(p)! !== p) p = parent.get(p)!;
    // Path compression
    let q = i;
    while (parent.get(q)! !== q) {
      const next = parent.get(q)!;
      parent.set(q, p);
      q = next;
    }
    return p;
  };
  const union = (i: number, j: number) => {
    const ri = find(i);
    const rj = find(j);
    if (ri !== rj) parent.set(ri, rj);
  };

  for (const finding of resolutionPlan.findings) {
    if (
      finding.disposition !== "confirmed_merge" ||
      finding.candidateIds.length !== 2
    ) {
      continue;
    }
    const left = incidentIndex.get(finding.candidateIds[0]);
    const right = incidentIndex.get(finding.candidateIds[1]);
    if (left !== undefined && right !== undefined) union(left, right);
  }

  // Collect groups.
  const groups = new Map<number, number[]>();
  for (const i of indexes) {
    const r = find(i);
    const arr = groups.get(r) ?? [];
    arr.push(i);
    groups.set(r, arr);
  }

  const persistence = opts.incidentPersistence;
  const publisher = opts.publishPlan ?? publishSemanticClusterPlan;
  const useIncidentStore =
    !opts.candidates || Boolean(persistence) || Boolean(opts.publishPlan);
  const useAtomicPublisher = useIncidentStore && !persistence;
  const incidentPlans: SemanticClusterIncidentPlan[] = [];
  const assignmentPlans: SemanticClusterAssignmentPlan[] = [];
  const evidencePlans: AttachIncidentEvidencePlan[] = [];
  const resolutionPlans: IncidentResolutionRecordPlan[] = [];
  const provisionalToIncident = new Map<string, string>(
    persistedIncidents.map((candidate) => [
      candidate.incidentId,
      candidate.incidentId,
    ]),
  );

  // Assign stable incident ids and write back only the incoming reports.
  for (const [, members] of groups) {
    const newMembers = members.filter(
      (idx) => candidates[idx].origin !== "persisted",
    );
    if (!newMembers.length) continue;
    const memberIds = newMembers.map((idx) => candidates[idx].id).sort();
    const persistedMembers = members
      .map((idx) => incidentCandidates[idx])
      .filter((candidate) => candidate.origin === "persisted");
    const selectedPersisted = persistedMembers.length
      ? selectCanonicalIncident(persistedMembers)
      : null;
    let incidentId = selectedPersisted?.incidentId ?? null;
    if (!incidentId) {
      if (!applyAssignments || !useIncidentStore) {
        incidentId =
          opts.clusterIdFactory?.(memberIds) ??
          deterministicFixtureClusterId(memberIds);
      } else {
        const representative = candidates[newMembers[0]];
        const dates = newMembers
          .map((idx) => candidates[idx].eventDate)
          .filter((value): value is string => Boolean(value))
          .sort();
        const incidentPlan: NewIncidentPlan = {
          representativeTitle: representative.title,
          body: representative.body,
          eventDateStart: dates[0] ?? null,
          eventDateEnd: dates.at(-1) ?? null,
          embedding: useEmbeddings ? embeddings![newMembers[0]] : null,
          createdRunId: run.id,
        };
        if (useAtomicPublisher) {
          incidentId = opts.clusterIdFactory?.(memberIds) ?? randomUUID();
          incidentPlans.push({ id: incidentId, ...incidentPlan });
        } else {
          incidentId = await persistence!.insertIncident(db, incidentPlan);
        }
      }
      wouldCreateClusters++;
      if (applyAssignments) clustersCreated++;
    } else {
      wouldMatchPersistedIncidents += newMembers.length;
      if (applyAssignments) matchedPersistedIncidents += newMembers.length;
    }
    const matchKind: IncidentAssignmentPlan["matchKind"] = selectedPersisted
      ? "persisted_match"
      : "new";
    assignments.push({
      clusterId: incidentId,
      incidentId,
      memberIds,
      matchKind,
    });
    for (const idx of newMembers) {
      provisionalToIncident.set(incidentCandidates[idx].incidentId, incidentId);
    }

    const sourceIds = new Set(
      newMembers.map((idx) => candidates[idx].sourceId),
    );
    if (sourceIds.size > 1) multiSourceClusters++;
    const sourceFamilyIds = new Set(
      newMembers.map((idx) => candidates[idx].sourceFamilyId),
    );
    if (sourceFamilyIds.size > 1) multiSourceFamilyClusters++;
    const languages = new Set(
      newMembers.map((idx) => candidates[idx].language),
    );
    if (languages.size > 1) multilingualClusters++;
    const provisionalJurisdictions = new Set(
      newMembers.map((idx) => candidates[idx].jurisdictionId ?? "unresolved"),
    );
    if (
      provisionalJurisdictions.size > 1 ||
      provisionalJurisdictions.has("unresolved")
    ) {
      crossJurisdictionClusters++;
    }

    const comparisonTarget = selectedPersisted
      ? incidentCandidates[incidentIndex.get(selectedPersisted.incidentId)!]
      : incidentCandidates[newMembers[0]];
    for (const idx of newMembers) {
      const identity = compareEventIdentities(
        normalizeEventIdentity(candidates[idx].title, candidates[idx].body),
        normalizeEventIdentity(
          comparisonTarget.headline,
          comparisonTarget.body,
        ),
      );
      const semantic = useEmbeddings
        ? Math.max(
            -1,
            Math.min(
              1,
              cosineSimilarity(
                embeddings![idx],
                comparisonTarget.embedding ?? embeddings![idx],
              ),
            ),
          )
        : null;
      if (applyAssignments) {
        if (useIncidentStore) {
          const payload = {
            incidentId,
            rawEventId: candidates[idx].id,
            rawClusterId: incidentId,
            matchKind,
            semanticSimilarity: semantic,
            tokenSimilarity: identity.tokenSimilarity,
            anchorOverlap: identity.anchorOverlap,
            exactNormalizedMatch: identity.exactNormalizedMatch,
            algorithmVersion: PULSE_INCIDENT_ASSIGNMENT_ALGORITHM_VERSION,
            embeddingModel: useEmbeddings ? "stored-pulse-embedding" : null,
            fallbackMode: useEmbeddings
              ? ("semantic" as const)
              : ("conservative_lexical" as const),
            stageRunId: run.id,
            actor: { type: "pipeline", stage: "cluster" },
            rationale: selectedPersisted
              ? "Exact normalized identity matched an active persisted incident inside the 48-hour window."
              : "A new stable incident was created for this incoming report group.",
            assignedAt: now.toISOString(),
          };
          const assignment: IncidentAssignmentPlan = {
            schemaVersion: PULSE_INCIDENT_ASSIGNMENT_SCHEMA_VERSION,
            assignmentKey: buildIncidentAssignmentKey(payload),
            ...payload,
          };
          const evidencePlan = selectedPersisted?.eventId
            ? {
                eventId: selectedPersisted.eventId,
                rawEventId: candidates[idx].id,
                sourceId: candidates[idx].sourceId,
                sourceType: candidates[idx].sourceType ?? "news",
                sourceName: candidates[idx].sourceId,
                sourceUrl: candidates[idx].sourceUrl ?? null,
                stageRunId: run.id,
                attachedAt: now.toISOString(),
                rationale:
                  "PUL-031 attached later evidence to the existing current incident without reclassification.",
              }
            : null;
          if (useAtomicPublisher) {
            assignmentPlans.push({
              assignment,
              embedding: embeddings![idx],
            });
            if (evidencePlan) evidencePlans.push(evidencePlan);
          } else {
            await persistence!.assignReport(db, assignment);
            await db
              .update(rawEvents)
              .set({ embedding: embeddings![idx] })
              .where(eq(rawEvents.id, candidates[idx].id));
            if (evidencePlan) {
              await persistence!.attachEvidence(db, evidencePlan);
            }
          }
        } else {
          await db
            .update(rawEvents)
            .set({
              embedding: useEmbeddings ? embeddings![idx] : null,
              clusterId: incidentId,
              incidentId,
              clusteredAt: now,
              clusterRunId: run.id,
            })
            .where(eq(rawEvents.id, candidates[idx].id));
        }
      }
    }
    wouldCluster += newMembers.length;
    if (applyAssignments) clustered += newMembers.length;
  }

  const retainedCollisionPairs = new Set<string>();
  for (const finding of collisionFindings) {
    const leftIncidentId = provisionalToIncident.get(finding.candidateIds[0]);
    const rightIncidentId = provisionalToIncident.get(finding.candidateIds[1]);
    if (
      !leftIncidentId ||
      !rightIncidentId ||
      leftIncidentId === rightIncidentId
    ) {
      continue;
    }
    const pair = [leftIncidentId, rightIncidentId].sort();
    const pairKey = pair.join(":");
    if (retainedCollisionPairs.has(pairKey)) continue;
    retainedCollisionPairs.add(pairKey);
    const payload = {
      leftIncidentId: pair[0],
      rightIncidentId: pair[1],
      outcome: "candidate" as const,
      canonicalIncidentId: null,
      signals: {
        reasonCode: finding.reasonCode,
        hoursApart: finding.hoursApart,
        exactNormalizedMatch: finding.exactNormalizedMatch,
        exactNormalizedHeadlineMatch: finding.exactNormalizedHeadlineMatch,
        tokenSimilarity: finding.tokenSimilarity,
        anchorOverlap: finding.anchorOverlap,
        semanticSimilarity: finding.semanticSimilarity,
        classificationCompatible: finding.classificationCompatible,
      },
      methodVersion: PULSE_INCIDENT_RESOLUTION_VERSION,
      stageRunId: run.id,
      actor: { type: "pipeline", stage: "post_cluster_collision" },
      rationale:
        "Identity evidence suggests a possible duplicate, but the automatic-merge threshold was not met.",
      evidenceRefs: finding.candidateIds.map(
        (id) => `incident-candidate:${id}`,
      ),
      decidedAt: now.toISOString(),
    };
    const resolution: IncidentResolutionRecordPlan = {
      schemaVersion: PULSE_INCIDENT_RESOLUTION_VERSION,
      resolutionKey: buildIncidentResolutionKey(payload),
      ...payload,
    };
    if (applyAssignments && useIncidentStore) {
      if (useAtomicPublisher) resolutionPlans.push(resolution);
      else await persistence!.appendResolution(db, resolution);
    }
  }

  const completionCounts = {
    candidates: newCandidates.length,
    clustered,
    clustersCreated,
    wouldCluster,
    wouldCreateClusters,
    matchedPersistedIncidents,
    wouldMatchPersistedIncidents,
    collisionCandidates: retainedCollisionPairs.size,
    multiSourceClusters,
    multiSourceFamilyClusters,
    multilingualClusters,
    crossJurisdictionClusters,
    comparisonPairs,
  };
  const atomicPublish = applyAssignments && useAtomicPublisher;
  if (atomicPublish) {
    await publisher(db, {
      runId: run.id,
      incidents: incidentPlans,
      assignments: assignmentPlans,
      evidence: evidencePlans,
      resolutions: resolutionPlans,
      completion: persistRun
        ? {
            runId: run.id,
            counts: completionCounts,
            completedAt: now.toISOString(),
          }
        : null,
    });
  }

  if (persistRun && !atomicPublish) {
    // The no-embedding path deliberately publishes nothing (lexical
    // similarity is not a safe incident identity), but the run row must
    // still finalize honestly — a run stuck at 'running' forever is how the
    // July/August scheduler outage hid for weeks. The environment without
    // the local embedding model (serverless) records a partial run; the
    // owner-Mac runner executes this stage with embeddings available.
    await finishPulsePipelineRun(db, run.id, {
      status: useEmbeddings ? "completed" : "partial",
      counts: completionCounts,
      failures: useEmbeddings
        ? []
        : [
            {
              component: "embedding",
              message:
                "Embedding runtime unavailable; clustering publishes nothing under lexical fallback.",
            },
          ],
    });
  }

  return {
    runId: run.id,
    versionKey: run.versionKey,
    status: useEmbeddings ? "completed" : "partial",
    candidates: newCandidates.length,
    clustered,
    clustersCreated,
    wouldCluster,
    wouldCreateClusters,
    matchedPersistedIncidents,
    wouldMatchPersistedIncidents,
    collisionCandidates: retainedCollisionPairs.size,
    comparisonPairs,
    multiSourceClusters,
    multiSourceFamilyClusters,
    multilingualClusters,
    crossJurisdictionClusters,
    dryRun: opts.dryRun ?? false,
    assignments: assignments.sort((left, right) =>
      left.clusterId.localeCompare(right.clusterId),
    ),
    reused: false,
  };
}
