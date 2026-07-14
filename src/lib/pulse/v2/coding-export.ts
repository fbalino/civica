import { z } from "zod";
import {
  PULSE_CODING_AUDIT_ACTIONS,
  PULSE_CODING_WORKSPACE_VERSION,
  pulseCodingHash,
} from "./coding-workspace";

export const PULSE_CODING_EXPORT_SCHEMA_VERSION =
  "pulse-coding-export/v1" as const;

export const PULSE_CODING_EXPORT_CLAIM_BOUNDARY =
  "This export preserves coding evidence and disagreement. It is not a gold release, model validation result, or governance score." as const;

const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);
const timestampSchema = z
  .union([z.date(), z.iso.datetime()])
  .transform((value) => (value instanceof Date ? value.toISOString() : value));
const nullableTimestampSchema = timestampSchema.nullable();
const jsonObjectSchema = z.record(z.string(), z.json());
const nullableJsonObjectSchema = jsonObjectSchema.nullable();

const studySchema = z.strictObject({
  id: z.uuid(),
  slug: z.string().min(1),
  schemaVersion: z.literal(PULSE_CODING_WORKSPACE_VERSION),
  title: z.string().min(1),
  purpose: z.enum(["instruction_pilot", "evaluation"]),
  protocolVersion: z.string().min(1),
  codebookVersion: z.string().min(1),
  ontologyVersion: z.string().min(1),
  datasetVersion: z.string().min(1),
  packetSetSha256: sha256Schema,
  traceSetSha256: sha256Schema.nullable(),
  status: z.enum(["setup", "active", "closed"]),
  createdBy: z.string().min(1),
  createdAt: timestampSchema,
  closedAt: nullableTimestampSchema,
});

const packetSchema = z.strictObject({
  id: z.uuid(),
  studyId: z.uuid(),
  packetKey: z.string().min(1),
  analysisStatus: z.enum(["analysis_candidate", "reserve", "pilot"]),
  packetSnapshot: jsonObjectSchema,
  packetSnapshotSha256: sha256Schema,
  importedAt: timestampSchema,
});

const participantSchema = z.strictObject({
  id: z.uuid(),
  pseudonym: z.string().min(1),
  role: z.enum(["coder", "adjudicator", "study_admin"]),
  actorType: z.enum(["qualified_human", "agent_dry_pilot"]),
  useStatus: z.enum(["evaluation_candidate", "dry_run_not_gold"]),
  status: z.enum(["active", "revoked"]),
  createdAt: timestampSchema,
  revokedAt: nullableTimestampSchema,
});

const assignmentSchema = z.strictObject({
  id: z.uuid(),
  packetId: z.uuid(),
  participantId: z.uuid(),
  slot: z.enum(["coder_a", "coder_b", "adjudicator"]),
  status: z.enum(["assigned", "draft", "locked"]),
  draft: nullableJsonObjectSchema,
  draftSha256: sha256Schema.nullable(),
  submission: nullableJsonObjectSchema,
  submissionSha256: sha256Schema.nullable(),
  assignedAt: timestampSchema,
  draftUpdatedAt: nullableTimestampSchema,
  lockedAt: nullableTimestampSchema,
});

const comparisonSchema = z.strictObject({
  id: z.uuid(),
  packetId: z.uuid(),
  coderAssignmentAId: z.uuid(),
  coderAssignmentBId: z.uuid(),
  comparison: jsonObjectSchema,
  comparisonSha256: sha256Schema,
  disagreementAxes: z.array(z.string()),
  generatedAt: timestampSchema,
});

const adjudicationSchema = z.strictObject({
  id: z.uuid(),
  comparisonId: z.uuid(),
  adjudicatorAssignmentId: z.uuid(),
  status: z.enum(["pending", "resolved", "unresolved"]),
  resolution: nullableJsonObjectSchema,
  resolutionSha256: sha256Schema.nullable(),
  reasonCodes: z.array(z.string()),
  notes: z.string().nullable(),
  createdAt: timestampSchema,
  resolvedAt: nullableTimestampSchema,
});

const auditSchema = z.strictObject({
  id: z.uuid(),
  studyId: z.uuid().nullable(),
  packetId: z.uuid().nullable(),
  participantId: z.uuid().nullable(),
  actorId: z.string().min(1),
  actorRole: z.enum([
    "coder",
    "adjudicator",
    "study_admin",
    "system",
    "anonymous",
  ]),
  action: z.enum(PULSE_CODING_AUDIT_ACTIONS),
  entityType: z.string().min(1),
  entityId: z.string().nullable(),
  requestId: z.string().nullable(),
  beforeSha256: sha256Schema.nullable(),
  afterSha256: sha256Schema.nullable(),
  details: jsonObjectSchema,
  createdAt: timestampSchema,
});

export const pulseCodingExportBodySchema = z.strictObject({
  schemaVersion: z.literal(PULSE_CODING_EXPORT_SCHEMA_VERSION),
  study: studySchema,
  packets: z.array(packetSchema),
  participants: z.array(participantSchema),
  assignments: z.array(assignmentSchema),
  comparisons: z.array(comparisonSchema),
  adjudications: z.array(adjudicationSchema),
  audit: z.array(auditSchema),
  claimBoundary: z.literal(PULSE_CODING_EXPORT_CLAIM_BOUNDARY),
});

export const pulseCodingExportSchema = z.strictObject({
  ...pulseCodingExportBodySchema.shape,
  exportedAt: timestampSchema,
  semanticSha256: sha256Schema,
});

export type PulseCodingExportBody = z.infer<typeof pulseCodingExportBodySchema>;
export type PulseCodingExport = z.infer<typeof pulseCodingExportSchema>;

export interface PulseCodingExportSourceRows {
  study: unknown;
  packets: readonly unknown[];
  participants: readonly unknown[];
  assignments: readonly unknown[];
  comparisons: readonly unknown[];
  adjudications: readonly unknown[];
  audit: readonly unknown[];
}

const STUDY_FIELDS = [
  "id",
  "slug",
  "schemaVersion",
  "title",
  "purpose",
  "protocolVersion",
  "codebookVersion",
  "ontologyVersion",
  "datasetVersion",
  "packetSetSha256",
  "traceSetSha256",
  "status",
  "createdBy",
  "createdAt",
  "closedAt",
] as const;

const PACKET_FIELDS = [
  "id",
  "studyId",
  "packetKey",
  "analysisStatus",
  "packetSnapshot",
  "packetSnapshotSha256",
  "importedAt",
] as const;

const PARTICIPANT_FIELDS = [
  "id",
  "pseudonym",
  "role",
  "actorType",
  "useStatus",
  "status",
  "createdAt",
  "revokedAt",
] as const;

const ASSIGNMENT_FIELDS = [
  "id",
  "packetId",
  "participantId",
  "slot",
  "status",
  "draft",
  "draftSha256",
  "submission",
  "submissionSha256",
  "assignedAt",
  "draftUpdatedAt",
  "lockedAt",
] as const;

const COMPARISON_FIELDS = [
  "id",
  "packetId",
  "coderAssignmentAId",
  "coderAssignmentBId",
  "comparison",
  "comparisonSha256",
  "disagreementAxes",
  "generatedAt",
] as const;

const ADJUDICATION_FIELDS = [
  "id",
  "comparisonId",
  "adjudicatorAssignmentId",
  "status",
  "resolution",
  "resolutionSha256",
  "reasonCodes",
  "notes",
  "createdAt",
  "resolvedAt",
] as const;

const AUDIT_FIELDS = [
  "id",
  "studyId",
  "packetId",
  "participantId",
  "actorId",
  "actorRole",
  "action",
  "entityType",
  "entityId",
  "requestId",
  "beforeSha256",
  "afterSha256",
  "details",
  "createdAt",
] as const;

function pickFields(
  value: unknown,
  fields: readonly string[],
  label: string,
): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} export row must be an object`);
  }
  const row = value as Record<string, unknown>;
  return Object.fromEntries(fields.map((field) => [field, row[field]]));
}

function projectRows(
  values: readonly unknown[],
  fields: readonly string[],
  label: string,
): Record<string, unknown>[] {
  return values.map((value) => pickFields(value, fields, label));
}

function assertNoCredentialHash(value: unknown, path = "export"): void {
  if (Array.isArray(value)) {
    value.forEach((entry, index) =>
      assertNoCredentialHash(entry, `${path}[${index}]`),
    );
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, nested] of Object.entries(value)) {
    const normalizedKey = key.replace(/[^a-z0-9]/gi, "").toLowerCase();
    if (normalizedKey.includes("credentialhash")) {
      throw new Error(
        `Pulse coding export contains a credential hash at ${path}.${key}`,
      );
    }
    assertNoCredentialHash(nested, `${path}.${key}`);
  }
}

/**
 * Closed pure projection from database-shaped rows into the v1 export body.
 * Unknown and future columns are never copied; the strict parser then rejects
 * missing, mistyped, or otherwise malformed intended fields.
 */
export function projectPulseCodingExportBody(
  input: PulseCodingExportSourceRows,
): PulseCodingExportBody {
  const audit = projectRows(input.audit, AUDIT_FIELDS, "audit").filter(
    (entry) => entry.action !== "export_generated",
  );
  const body = pulseCodingExportBodySchema.parse({
    schemaVersion: PULSE_CODING_EXPORT_SCHEMA_VERSION,
    study: pickFields(input.study, STUDY_FIELDS, "study"),
    packets: projectRows(input.packets, PACKET_FIELDS, "packet"),
    participants: projectRows(
      input.participants,
      PARTICIPANT_FIELDS,
      "participant",
    ),
    assignments: projectRows(
      input.assignments,
      ASSIGNMENT_FIELDS,
      "assignment",
    ),
    comparisons: projectRows(
      input.comparisons,
      COMPARISON_FIELDS,
      "comparison",
    ),
    adjudications: projectRows(
      input.adjudications,
      ADJUDICATION_FIELDS,
      "adjudication",
    ),
    audit,
    claimBoundary: PULSE_CODING_EXPORT_CLAIM_BOUNDARY,
  });
  assertNoCredentialHash(body);
  return body;
}

/** Parse the exact wire artifact and verify that its semantic hash is honest. */
export function parsePulseCodingExport(value: unknown): PulseCodingExport {
  const parsed = pulseCodingExportSchema.parse(value);
  assertNoCredentialHash(parsed);
  const body: PulseCodingExportBody = {
    schemaVersion: parsed.schemaVersion,
    study: parsed.study,
    packets: parsed.packets,
    participants: parsed.participants,
    assignments: parsed.assignments,
    comparisons: parsed.comparisons,
    adjudications: parsed.adjudications,
    audit: parsed.audit,
    claimBoundary: parsed.claimBoundary,
  };
  if (pulseCodingHash(body) !== parsed.semanticSha256) {
    throw new Error(
      "Pulse coding export semantic hash does not match its body",
    );
  }
  return parsed;
}
