import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { correctionLog, jurisdictions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import {
  checkRequestRateLimit,
  rateLimitResponse,
} from "@/lib/api/rate-limit-request";
import { getRequestRateLimitPolicy } from "@/lib/api/rate-limit-runtime-policy";
import {
  JSON_MEDIA_TYPE,
  parseBoundedRequestBody,
} from "@/lib/api/request-body";
import {
  correctionBodySchema,
  REQUEST_BODY_LIMITS,
  type CorrectionBody,
} from "@/lib/api/request-body-schemas";
import { withPrivateSafeJsonErrors } from "@/lib/api/problem-response";
import {
  ATLAS_DATA_ERROR_CATEGORY,
  dataErrorReceiptCode,
  DATA_ERROR_REPORT_NOTICE_VERSION,
} from "@/lib/corrections/data-error-report";
import { isAtlasCorrectionSchemaReady } from "@/lib/corrections/schema-readiness";

const CORRECTION_RATE_LIMIT_POLICY =
  getRequestRateLimitPolicy("correction-form");

export async function POST(request: NextRequest) {
  return withPrivateSafeJsonErrors("api/civica-index/corrections", async () => {
    const rateLimit = await checkRequestRateLimit(
      request,
      CORRECTION_RATE_LIMIT_POLICY,
    );
    if (rateLimit.status !== "allowed") {
      return rateLimitResponse(rateLimit, CORRECTION_RATE_LIMIT_POLICY, {
        limitedMessage:
          "Too many correction submissions. Please wait before trying again.",
      });
    }

    const parsed = await parseBoundedRequestBody<CorrectionBody>(request, {
      maxBytes: REQUEST_BODY_LIMITS.correction,
      media: [{ mediaType: JSON_MEDIA_TYPE, schema: correctionBodySchema }],
    });
    if (!parsed.ok) return parsed.response;
    const body = parsed.data;
    if (body._trap?.trim()) {
      return NextResponse.json(
        { ok: true },
        { status: 201, headers: { "Cache-Control": "no-store" } },
      );
    }

    // --- Server-side validation ---
    const category = body.category;
    const description = body.description.trim();
    if (!description || description.length < 10) {
      return NextResponse.json(
        {
          error: "Description is required (minimum 10 characters).",
          code: "INVALID_DESCRIPTION",
        },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }
    const countrySlug = body.countrySlug?.trim() || null;
    const dimension = body.dimension ?? null;
    const submitterName = body.submitterName?.trim() || null;
    const submitterEmail = body.submitterEmail?.trim() || null;
    const submitterAffiliation = body.submitterAffiliation?.trim() || null;
    const requestPrivacy = body.requestPrivacy;
    const isAtlasReport = category === ATLAS_DATA_ERROR_CATEGORY;

    if (isAtlasReport) {
      const missing = [
        ["entityType", body.entityType],
        ["entityId", body.entityId?.trim()],
        ["fieldPath", body.fieldPath?.trim()],
        ["releaseId", body.releaseId?.trim()],
        ["sourceId", body.sourceId?.trim()],
        ["sourceUrl", body.sourceUrl],
        ["publishedValue", body.publishedValue?.trim()],
      ]
        .filter(([, value]) => !value)
        .map(([field]) => field);
      if (missing.length) {
        return NextResponse.json(
          {
            error:
              "Atlas data reports require an entity type and ID, field, release, source ID and HTTPS URL, and the published value.",
            code: "INCOMPLETE_ATLAS_REPORT",
          },
          { status: 400, headers: { "Cache-Control": "no-store" } },
        );
      }
      if (
        body.noticeAccepted !== true ||
        body.noticeVersion !== DATA_ERROR_REPORT_NOTICE_VERSION
      ) {
        return NextResponse.json(
          {
            error: "Please accept the current data-report privacy notice.",
            code: "NOTICE_REQUIRED",
          },
          { status: 400, headers: { "Cache-Control": "no-store" } },
        );
      }
      if (
        new URL(body.sourceUrl!).protocol !== "https:" ||
        (body.evidenceUrl &&
          new URL(body.evidenceUrl).protocol !== "https:")
      ) {
        return NextResponse.json(
          {
            error: "Source and evidence links must use HTTPS.",
            code: "HTTPS_REQUIRED",
          },
          { status: 400, headers: { "Cache-Control": "no-store" } },
        );
      }
      if (!(await isAtlasCorrectionSchemaReady())) {
        return NextResponse.json(
          {
            error:
              "Atlas data-error intake is temporarily unavailable while its append-only schema is being activated.",
            code: "ATLAS_REPORT_SCHEMA_PENDING",
          },
          { status: 503, headers: { "Cache-Control": "no-store" } },
        );
      }
    }

    // Validate email format if provided
    if (submitterEmail) {
      const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRe.test(submitterEmail)) {
        return NextResponse.json(
          { error: "Invalid email address.", code: "INVALID_EMAIL" },
          { status: 400, headers: { "Cache-Control": "no-store" } },
        );
      }
    }

    // Resolve country slug → id if provided
    let countryId: string | null = null;
    if (countrySlug) {
      const rows = await db
        .select({ id: jurisdictions.id })
        .from(jurisdictions)
        .where(eq(jurisdictions.slug, countrySlug))
        .limit(1);
      if (rows.length === 0) {
        return NextResponse.json(
          { error: "Country not found.", code: "COUNTRY_NOT_FOUND" },
          { status: 400, headers: { "Cache-Control": "no-store" } },
        );
      }
      countryId = rows[0].id;
    }

    // Insert
    const id = randomUUID();
    const acknowledgedAt = new Date();
    const acknowledgmentCode = isAtlasReport
      ? dataErrorReceiptCode(id)
      : null;
    await db.insert(correctionLog).values({
      id,
      countryId,
      category,
      dimension,
      submitterName,
      submitterEmail,
      submitterAffiliation,
      description,
      isPublic: !requestPrivacy,
      status: "open",
      entityType: isAtlasReport ? body.entityType : null,
      entityId: isAtlasReport ? body.entityId?.trim() : null,
      fieldPath: isAtlasReport ? body.fieldPath?.trim() : null,
      affectedReleaseId: isAtlasReport ? body.releaseId?.trim() : null,
      reportedSourceId: isAtlasReport ? body.sourceId?.trim() : null,
      reportedSourceUrl: isAtlasReport ? body.sourceUrl : null,
      publishedValue: isAtlasReport ? body.publishedValue?.trim() : null,
      proposedValue: isAtlasReport ? body.proposedValue?.trim() || null : null,
      evidenceUrl: isAtlasReport ? body.evidenceUrl : null,
      noticeVersion: isAtlasReport ? body.noticeVersion : null,
      noticeAcceptedAt: isAtlasReport ? acknowledgedAt : null,
      acknowledgmentCode,
      acknowledgedAt: isAtlasReport ? acknowledgedAt : null,
    });

    if (isAtlasReport) {
      return NextResponse.json(
        {
          ok: true,
          receipt: acknowledgmentCode,
          status: "open",
          acknowledgedAt: acknowledgedAt.toISOString(),
        },
        { status: 201, headers: { "Cache-Control": "no-store" } },
      );
    }
    return NextResponse.json(
      { ok: true },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  });
}
