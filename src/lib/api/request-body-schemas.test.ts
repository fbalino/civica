import assert from "node:assert/strict";
import test from "node:test";
import type { z } from "zod";

import {
  adminAdvisoryMutationBodySchema,
  adminAdvisoryMutationFormSchema,
  adminCorrectionMutationBodySchema,
  adminCorrectionMutationFormSchema,
  adminDataDisputeBodySchema,
  adminDataDisputeFormSchema,
  adminLoginBodySchema,
  adminMessageStatusBodySchema,
  adminMessageStatusFormSchema,
  adminPulseReviewExceptionFormSchema,
  adminPulseReviewFormBodySchema,
  adminPulseReviewJsonBodySchema,
  advisoryApplicationBodySchema,
  chatBodySchema,
  contactBodySchema,
  correctionBodySchema,
  optionalIdempotencyKeySchema,
  pulseCodingAdjudicationBodySchema,
  pulseCodingAssignmentBodySchema,
  pulseCodingLoginFormSchema,
  pulseCodingParticipantBodySchema,
  requestUuidSchema,
} from "./request-body-schemas";

const UUID = "01900000-0000-7000-8000-000000000001";
const HASH = "a".repeat(64);

const draft = {
  evidenceAssessments: [],
  addedEvidence: [],
  answer: {
    packetOutcome: "insufficient_observation",
    observationState: "undetermined",
    observationRationale: "",
    events: [],
    candidateEvents: [],
    excludedEvidenceIds: [],
    coderNotes: "",
  },
};

const fixtures: Array<{
  name: string;
  schema: z.ZodType;
  body: Record<string, unknown>;
}> = [
  {
    name: "admin advisory mutation",
    schema: adminAdvisoryMutationBodySchema,
    body: { status: "reviewed", redirect: "/admin/advisory-applications" },
  },
  {
    name: "admin Atlas correction",
    schema: adminCorrectionMutationBodySchema,
    body: {
      status: "in_review",
      disposition: null,
      internalNotes: "Checking the retained release row.",
      redactSubmitter: false,
    },
  },
  {
    name: "admin data dispute",
    schema: adminDataDisputeBodySchema,
    body: { action: "hold", notes: "Needs a primary source" },
  },
  {
    name: "admin message status",
    schema: adminMessageStatusBodySchema,
    body: { status: "read" },
  },
  {
    name: "admin Pulse review JSON",
    schema: adminPulseReviewJsonBodySchema,
    body: { action: "edit", severityValue: -2 },
  },
  {
    name: "admin Pulse review form",
    schema: adminPulseReviewFormBodySchema,
    body: { action: "edit", severityValue: "-2" },
  },
  {
    name: "admin Pulse review exception",
    schema: adminPulseReviewExceptionFormSchema,
    body: {
      reason: "evidence_conflict",
      note: "Needs another source",
      expiresAt: "2026-07-31T12:00:00Z",
    },
  },
  {
    name: "admin login",
    schema: adminLoginBodySchema,
    body: { username: "owner", password: "secret" },
  },
  {
    name: "advisory application",
    schema: advisoryApplicationBodySchema,
    body: {
      name: "Researcher",
      email: "researcher@example.org",
      institution: "Independent",
      role: "Scholar",
      expertiseArea: "Comparative government",
      experience: "Long enough for the domain validator to accept this text.",
      links: "",
      cvUrl: "",
      consent: true,
      privacyNoticeVersion: "civica-advisory-application-privacy/v1",
      _trap: "",
    },
  },
  {
    name: "chat",
    schema: chatBodySchema,
    body: {
      message: "How is parliament formed?",
      context: {
        countrySlug: "uruguay",
        tab: "structure",
      },
    },
  },
  {
    name: "correction",
    schema: correctionBodySchema,
    body: {
      category: "ci_data_error",
      countrySlug: "uruguay",
      dimension: "rule_of_law",
      description: "This observation cites the wrong vintage.",
      requestPrivacy: false,
    },
  },
  {
    name: "Atlas data-error report",
    schema: correctionBodySchema,
    body: {
      category: "atlas_data_error",
      countrySlug: "uruguay",
      dimension: null,
      entityType: "fact",
      entityId: UUID,
      fieldPath: "population.value",
      releaseId: "atlas-2026-07-11",
      sourceId: "worldbank",
      sourceUrl: "https://example.org/source",
      publishedValue: "3,499,451",
      proposedValue: null,
      evidenceUrl: null,
      description: "The retained publisher row appears to carry another value.",
      submitterName: null,
      submitterEmail: null,
      submitterAffiliation: null,
      requestPrivacy: true,
      noticeVersion: "civica-data-error-report-notice/2026-07-23",
      noticeAccepted: true,
      _trap: "",
    },
  },
  {
    name: "contact",
    schema: contactBodySchema,
    body: {
      name: "Reader",
      email: "reader@example.org",
      subject: "Source question",
      message: "Could you confirm the source vintage?",
      _trap: "",
    },
  },
  {
    name: "Pulse participant",
    schema: pulseCodingParticipantBodySchema,
    body: {
      studyId: UUID,
      pseudonym: "coder-a",
      slot: "coder_a",
      actorType: "qualified_human",
      useStatus: "evaluation_candidate",
    },
  },
  {
    name: "Pulse assignment",
    schema: pulseCodingAssignmentBodySchema,
    body: { action: "save", draft },
  },
  {
    name: "Pulse adjudication",
    schema: pulseCodingAdjudicationBodySchema,
    body: {
      packetId: "packet-1",
      comparisonSha256: HASH,
      status: "unresolved",
      reasonCodes: ["insufficient_context"],
      resolution: { kind: "unresolved", rationale: "More evidence needed" },
    },
  },
  {
    name: "Pulse login",
    schema: pulseCodingLoginFormSchema,
    body: { accessCode: "code" },
  },
];

test("all tracked body schemas accept their intended bounded shape", () => {
  for (const fixture of fixtures) {
    assert.equal(
      fixture.schema.safeParse(fixture.body).success,
      true,
      fixture.name,
    );
  }
});

test("all tracked object schemas reject unknown top-level fields", () => {
  for (const fixture of fixtures) {
    assert.equal(
      fixture.schema.safeParse({ ...fixture.body, unexpected: true }).success,
      false,
      fixture.name,
    );
  }
});

test("schemas reject wrong types, nested unknown keys, and non-canonical numbers", () => {
  const invalid = [
    adminLoginBodySchema.safeParse({ username: 7, password: "secret" }),
    chatBodySchema.safeParse({
      message: "Question",
      context: { countrySlug: "uruguay", tab: "unknown" },
    }),
    chatBodySchema.safeParse({
      message: "Question",
      context: { countrySlug: "Uruguay" },
    }),
    correctionBodySchema.safeParse({
      category: "ci_data_error",
      description: "Long enough description",
      requestPrivacy: "false",
    }),
    pulseCodingAssignmentBodySchema.safeParse({
      action: "save",
      draft: { ...draft, answer: { ...draft.answer, hidden: true } },
    }),
    pulseCodingAdjudicationBodySchema.safeParse({
      packetId: "packet-1",
      comparisonSha256: HASH,
      status: "unresolved",
      reasonCodes: ["insufficient_context"],
      resolution: {
        kind: "unresolved",
        rationale: "Needs evidence",
        hidden: true,
      },
    }),
    adminPulseReviewFormBodySchema.safeParse({
      action: "edit",
      severityValue: "1e0",
    }),
  ];
  for (const result of invalid) assert.equal(result.success, false);

  const emptySeverity = adminPulseReviewFormBodySchema.parse({
    action: "edit",
    severityValue: "",
  });
  assert.equal(emptySeverity.severityValue, undefined);
});

test("form schemas preserve empty optional-field semantics", () => {
  assert.deepEqual(
    adminAdvisoryMutationFormSchema.parse({
      status: "reviewed",
      redirect: "",
    }),
    { status: "reviewed", redirect: undefined },
  );
  assert.deepEqual(
    adminCorrectionMutationFormSchema.parse({
      status: "in_review",
      disposition: "",
      internalNotes: "",
      redirect: "",
      redactSubmitter: "",
    }),
    {
      status: "in_review",
      disposition: null,
      internalNotes: null,
      redirect: undefined,
      redactSubmitter: false,
    },
  );
  assert.deepEqual(
    adminDataDisputeFormSchema.parse({
      action: "hold",
      notes: "",
      redirect: "",
    }),
    { action: "hold", notes: undefined, redirect: undefined },
  );
  assert.deepEqual(
    adminMessageStatusFormSchema.parse({ status: "read", redirect: "" }),
    { status: "read", redirect: undefined },
  );
  assert.deepEqual(
    adminPulseReviewFormBodySchema.parse({
      action: "approve",
      notes: "",
      severityValue: "",
    }),
    { action: "approve", notes: undefined, severityValue: undefined },
  );
});

test("contact-message deletion requires an explicit confirmed intent", () => {
  assert.deepEqual(
    adminMessageStatusBodySchema.parse({
      intent: "delete",
      confirm: "delete",
    }),
    { intent: "delete", confirm: "delete" },
  );
  assert.equal(
    adminMessageStatusBodySchema.safeParse({ intent: "delete" }).success,
    false,
  );
  assert.equal(
    adminMessageStatusBodySchema.safeParse({
      intent: "delete",
      confirm: "delete",
      status: "archived",
    }).success,
    false,
  );
  assert.equal(
    adminMessageStatusBodySchema.safeParse({
      status: "read",
      confirm: "delete",
    }).success,
    false,
  );
  assert.equal(adminMessageStatusBodySchema.safeParse({}).success, false);
});

test("schema collection ceilings reject oversized structured input", () => {
  assert.equal(
    chatBodySchema.safeParse({
      message: "Question",
      context: {
        countrySlug: "uruguay",
        country: "Client-supplied facts are forbidden",
      },
    }).success,
    false,
  );
  assert.equal(
    pulseCodingAssignmentBodySchema.safeParse({
      action: "save",
      draft: {
        ...draft,
        evidenceAssessments: Array.from({ length: 201 }, () => ({
          evidenceId: "evidence",
          accessState: "accessible",
          dateRelevance: "relevant",
          reportedDate: null,
          sourceFamilyId: "source",
          notes: "",
        })),
      },
    }).success,
    false,
  );
});

test("route identifiers and optional idempotency keys are tightly bounded", () => {
  assert.equal(requestUuidSchema.safeParse(UUID).success, true);
  assert.equal(requestUuidSchema.safeParse("not-a-uuid").success, false);
  assert.equal(optionalIdempotencyKeySchema.safeParse(null).success, true);
  assert.equal(
    optionalIdempotencyKeySchema.safeParse("attempt:one_2.3-4").success,
    true,
  );
  assert.equal(
    optionalIdempotencyKeySchema.safeParse("x".repeat(121)).success,
    false,
  );
  assert.equal(
    optionalIdempotencyKeySchema.safeParse("contains whitespace").success,
    false,
  );
});
