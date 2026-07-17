import { z } from "zod";

import {
  ADVISORY_APPLICATION_LIMITS,
  ADVISORY_APPLICATION_POLICY_VERSION,
} from "@/lib/research/advisory-application";
import {
  PULSE_ADJUDICATION_REASON_CODES,
  PULSE_CODER_OBSERVATION_STATES,
  PULSE_PACKET_OUTCOMES,
} from "@/lib/pulse/v2/coder-protocol";
import {
  ONTOLOGY_EFFECT_DIRECTIONS,
  PULSE_EVENT_ONTOLOGY_VERSION,
} from "@/lib/pulse/v2/event-ontology";
import { PULSE_REVIEW_EXCEPTION_REASONS } from "@/lib/pulse/v2/review-sla-store";

export const REQUEST_BODY_LIMITS = Object.freeze({
  adminAdvisoryMutation: 8_192,
  adminDataDispute: 16_384,
  adminMessageStatus: 8_192,
  adminPulseReview: 32_768,
  adminPulseReviewException: 16_384,
  adminLogin: 8_192,
  advisoryApplication: ADVISORY_APPLICATION_LIMITS.requestBody,
  chat: 16_384,
  contact: 8_192,
  correction: 16_384,
  clientErrorMonitoring: 1_024,
  pulseParticipant: 8_192,
  pulseCodingLogin: 4_096,
  pulseCodingDraft: 262_144,
  pulseCodingAdjudication: 262_144,
});

export const requestUuidSchema = z.string().uuid();
export const optionalIdempotencyKeySchema = z
  .string()
  .regex(/^[A-Za-z0-9._:-]{1,120}$/)
  .nullable();

const withoutNullByte = (value: string) => !value.includes("\0");
const text = (max: number, min = 0) =>
  z.string().min(min).max(max).refine(withoutNullByte);
const optionalText = (max: number) => text(max).optional();
const nullableText = (max: number) => text(max).nullable().optional();
const optionalFormValue = <Schema extends z.ZodType>(schema: Schema) =>
  z.preprocess(
    (value) => (value === "" ? undefined : value),
    schema.optional(),
  );
const redirect = optionalText(2_048);
const formRedirect = optionalFormValue(text(2_048));
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const boundedId = text(300, 1);
const sha256 = z.string().regex(/^[a-f0-9]{64}$/);

export const clientErrorMonitoringBodySchema = z
  .object({
    routePath: z.string().regex(/^\/[A-Za-z0-9/_-]{0,511}$/),
    errorCode: z.enum(["route_boundary", "global_boundary"]),
  })
  .strict();
export type ClientErrorMonitoringBody = z.infer<
  typeof clientErrorMonitoringBodySchema
>;

const ADMIN_ADVISORY_STATUSES = [
  "new",
  "reviewed",
  "contacted",
  "archived",
] as const;

export const adminAdvisoryMutationBodySchema = z
  .object({
    status: z.enum(ADMIN_ADVISORY_STATUSES).optional(),
    redirect,
    intent: z.literal("delete").optional(),
    confirm: z.literal("delete").optional(),
  })
  .strict();
export const adminAdvisoryMutationFormSchema = z
  .object({
    status: optionalFormValue(z.enum(ADMIN_ADVISORY_STATUSES)),
    redirect: formRedirect,
    intent: optionalFormValue(z.literal("delete")),
    confirm: optionalFormValue(z.literal("delete")),
  })
  .strict();
export type AdminAdvisoryMutationBody = z.infer<
  typeof adminAdvisoryMutationBodySchema
>;

export const adminDataDisputeBodySchema = z
  .object({
    action: z.enum(["resolve_a", "resolve_b", "hold", "reject", "reopen"]),
    notes: optionalText(5_000),
    redirect,
  })
  .strict();
export const adminDataDisputeFormSchema = z
  .object({
    action: z.enum(["resolve_a", "resolve_b", "hold", "reject", "reopen"]),
    notes: optionalFormValue(text(5_000)),
    redirect: formRedirect,
  })
  .strict();
export type AdminDataDisputeBody = z.infer<typeof adminDataDisputeBodySchema>;

export const adminMessageStatusBodySchema = z
  .object({
    status: z.enum(["new", "read", "archived"]),
    redirect,
  })
  .strict();
export const adminMessageStatusFormSchema = z
  .object({
    status: z.enum(["new", "read", "archived"]),
    redirect: formRedirect,
  })
  .strict();
export type AdminMessageStatusBody = z.infer<
  typeof adminMessageStatusBodySchema
>;

const adminPulseReviewBase = {
  action: z.enum(["approve", "edit", "reject"]),
  category: optionalText(100),
  dimension: optionalText(100),
  severityTier: optionalText(100),
  notes: optionalText(5_000),
  redirect,
};
const adminPulseReviewFormBase = {
  action: z.enum(["approve", "edit", "reject"]),
  category: optionalFormValue(text(100)),
  dimension: optionalFormValue(text(100)),
  severityTier: optionalFormValue(text(100)),
  notes: optionalFormValue(text(5_000)),
  redirect: formRedirect,
};

export const adminPulseReviewJsonBodySchema = z
  .object({
    ...adminPulseReviewBase,
    severityValue: z.number().int().min(-10).max(10).optional(),
  })
  .strict();
export const adminPulseReviewFormBodySchema = z
  .object({
    ...adminPulseReviewFormBase,
    severityValue: z
      .union([
        z.literal("").transform(() => undefined),
        z
          .string()
          .regex(/^-?(?:0|[1-9]\d*)$/)
          .transform(Number)
          .pipe(z.number().int().min(-10).max(10)),
      ])
      .optional(),
  })
  .strict();
export type AdminPulseReviewBody = z.infer<
  typeof adminPulseReviewJsonBodySchema
>;

export const adminPulseReviewExceptionFormSchema = z
  .object({
    reason: z.enum(PULSE_REVIEW_EXCEPTION_REASONS),
    note: text(5_000),
    expiresAt: text(64, 1),
    redirect,
  })
  .strict();
export type AdminPulseReviewExceptionBody = z.infer<
  typeof adminPulseReviewExceptionFormSchema
>;

export const adminLoginBodySchema = z
  .object({
    username: text(256),
    password: text(4_096),
    redirect: text(2_048).optional(),
  })
  .strict();
export type AdminLoginBody = z.infer<typeof adminLoginBodySchema>;

export const advisoryApplicationBodySchema = z
  .object({
    name: text(ADVISORY_APPLICATION_LIMITS.name),
    email: text(ADVISORY_APPLICATION_LIMITS.email),
    institution: text(ADVISORY_APPLICATION_LIMITS.institution),
    role: text(ADVISORY_APPLICATION_LIMITS.role),
    expertiseArea: text(ADVISORY_APPLICATION_LIMITS.expertiseArea),
    experience: text(ADVISORY_APPLICATION_LIMITS.experienceMax),
    links: text(ADVISORY_APPLICATION_LIMITS.links),
    cvUrl: text(ADVISORY_APPLICATION_LIMITS.cvUrl),
    consent: z.boolean(),
    privacyNoticeVersion: z.literal(ADVISORY_APPLICATION_POLICY_VERSION),
    _trap: text(256).optional(),
  })
  .strict();
export type AdvisoryApplicationBody = z.infer<
  typeof advisoryApplicationBodySchema
>;

const chatContextSchema = z
  .object({
    // PLT-021: resolve all reader-visible facts on the server. The browser
    // may choose only the public country route and a closed display tab; it
    // cannot inject facts, parties, or prose into the model context.
    countrySlug: z
      .string()
      .max(100)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    tab: z
      .enum([
        "factbook",
        "structure",
        "bills",
        "elections",
        "democracy",
        "leaders",
        "constitution",
      ])
      .optional(),
  })
  .strict();
export const chatBodySchema = z
  .object({
    message: text(4_000, 1),
    context: chatContextSchema,
  })
  .strict();
export type ChatBody = z.infer<typeof chatBodySchema>;

export const CORRECTION_CATEGORIES = [
  "ci_data_error",
  "ci_methodology",
  "pulse_misclassification",
  "pulse_severity",
  "pulse_false_positive",
  "pulse_missing_event",
  "pulse_duplicate",
  "other",
] as const;
export const CORRECTION_DIMENSIONS = [
  "democratic_quality",
  "rule_of_law",
  "human_development",
  "freedoms_rights",
  "corruption_control",
  "stability_security",
] as const;
const optionalCountrySlug = z
  .string()
  .max(100)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  .nullable()
  .optional();
export const correctionBodySchema = z
  .object({
    category: z.enum(CORRECTION_CATEGORIES),
    countrySlug: optionalCountrySlug,
    dimension: z.enum(CORRECTION_DIMENSIONS).nullable().optional(),
    submitterName: nullableText(200),
    submitterEmail: nullableText(320),
    submitterAffiliation: nullableText(300),
    description: text(10_000, 10),
    requestPrivacy: z.boolean().optional().default(false),
  })
  .strict();
export type CorrectionBody = z.infer<typeof correctionBodySchema>;

export const CONTACT_BODY_LIMITS = Object.freeze({
  name: 100,
  email: 254,
  subject: 200,
  message: 5_000,
});
export const contactBodySchema = z
  .object({
    name: text(CONTACT_BODY_LIMITS.name),
    email: text(CONTACT_BODY_LIMITS.email),
    subject: text(CONTACT_BODY_LIMITS.subject),
    message: text(CONTACT_BODY_LIMITS.message),
    _trap: text(256).optional(),
  })
  .strict();
export type ContactBody = z.infer<typeof contactBodySchema>;

export const pulseCodingParticipantBodySchema = z
  .object({
    studyId: requestUuidSchema,
    pseudonym: z.string().regex(/^[a-zA-Z0-9 _.-]{2,80}$/),
    slot: z.enum(["coder_a", "coder_b", "adjudicator"]),
    actorType: z.enum(["qualified_human", "agent_dry_pilot"]),
    useStatus: z.enum(["evaluation_candidate", "dry_run_not_gold"]),
  })
  .strict();
export type PulseCodingParticipantBody = z.infer<
  typeof pulseCodingParticipantBodySchema
>;

const evidenceAssessmentSchema = z
  .object({
    evidenceId: boundedId,
    accessState: z.enum(["accessible", "metadata_only", "inaccessible"]),
    dateRelevance: z.enum(["relevant", "not_relevant", "undetermined"]),
    reportedDate: text(64).nullable(),
    sourceFamilyId: boundedId,
    notes: text(5_000),
  })
  .strict();

const addedEvidenceSchema = z
  .object({
    id: boundedId,
    channel: z.enum(["audit_search", "context"]),
    sourceFamilyId: boundedId,
    accessState: z.enum(["accessible", "metadata_only", "inaccessible"]),
    reportedDate: isoDate.nullable(),
    text: text(10_000),
    url: text(2_048),
    title: text(500),
  })
  .strict();

const ontologyLabelSchema = z
  .object({
    categoryId: text(100),
    facetId: text(200),
    effectDirection: z.enum(ONTOLOGY_EFFECT_DIRECTIONS),
    severity: z.enum([
      "not_assessed",
      "limited",
      "material",
      "major",
      "critical",
    ]),
    evidenceIds: z.array(boundedId).max(100),
    rationale: text(5_000),
  })
  .strict();
const ontologyCandidateLabelSchema = z
  .object({ categoryId: text(100), reason: text(5_000) })
  .strict();
const ontologyAnnotationSchema = z
  .object({
    ontologyVersion: z.literal(PULSE_EVENT_ONTOLOGY_VERSION),
    disposition: z.enum([
      "qualifying_event",
      "non_qualifying",
      "insufficient_evidence",
    ]),
    labels: z.array(ontologyLabelSchema).max(5),
    candidateLabels: z.array(ontologyCandidateLabelSchema).max(20),
    ambiguityReason: text(5_000).nullable(),
  })
  .strict();
const codedEventSchema = z
  .object({
    eventId: boundedId,
    eventDate: text(64),
    datePrecision: z.enum(["exact", "bounded"]),
    primaryJurisdiction: text(200),
    affectedJurisdictions: z.array(text(200)).max(50),
    evidenceIds: z.array(boundedId).max(100),
    retrievalStatus: z.enum(["pulse_retained", "audit_search_only"]),
    annotation: ontologyAnnotationSchema,
  })
  .strict();
const candidateEventSchema = z
  .object({
    candidateId: boundedId,
    eventDate: text(64).nullable(),
    evidenceIds: z.array(boundedId).max(100),
    candidateLabels: z
      .array(z.object({ categoryId: text(100), reason: text(5_000) }).strict())
      .max(20),
    ambiguityReason: text(5_000),
  })
  .strict();

export const pulseCoderAnswerSchema = z
  .object({
    packetOutcome: z.enum(PULSE_PACKET_OUTCOMES),
    observationState: z.enum(PULSE_CODER_OBSERVATION_STATES),
    observationRationale: text(10_000),
    events: z.array(codedEventSchema).max(50),
    candidateEvents: z.array(candidateEventSchema).max(50),
    excludedEvidenceIds: z.array(boundedId).max(200),
    coderNotes: text(10_000),
  })
  .strict();

export const pulseCodingDraftSchema = z
  .object({
    evidenceAssessments: z.array(evidenceAssessmentSchema).max(200),
    addedEvidence: z.array(addedEvidenceSchema).max(50),
    answer: pulseCoderAnswerSchema,
  })
  .strict();
export const pulseCodingAssignmentBodySchema = z
  .object({
    action: z.enum(["save", "lock"]),
    draft: pulseCodingDraftSchema,
  })
  .strict();
export type PulseCodingAssignmentBody = z.infer<
  typeof pulseCodingAssignmentBodySchema
>;

const adjudicationResolutionSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("select_submission"),
      coderId: boundedId,
      rationale: text(10_000),
    })
    .strict(),
  z
    .object({
      kind: z.literal("new_annotation"),
      answer: pulseCoderAnswerSchema,
      rationale: text(10_000),
    })
    .strict(),
  z
    .object({
      kind: z.literal("unresolved"),
      rationale: text(10_000),
    })
    .strict(),
]);
export const pulseCodingAdjudicationBodySchema = z
  .object({
    packetId: boundedId,
    comparisonSha256: sha256,
    status: z.enum(["resolved", "unresolved"]),
    reasonCodes: z
      .array(z.enum(PULSE_ADJUDICATION_REASON_CODES))
      .max(PULSE_ADJUDICATION_REASON_CODES.length),
    resolution: adjudicationResolutionSchema,
  })
  .strict();
export type PulseCodingAdjudicationBody = z.infer<
  typeof pulseCodingAdjudicationBodySchema
>;

export const pulseCodingLoginFormSchema = z
  .object({ accessCode: text(200) })
  .strict();
export type PulseCodingLoginBody = z.infer<typeof pulseCodingLoginFormSchema>;
