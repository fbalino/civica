import { NextRequest, NextResponse } from "next/server";
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
import { withSafeJsonErrors } from "@/lib/api/problem-response";

const CORRECTION_RATE_LIMIT_POLICY =
  getRequestRateLimitPolicy("correction-form");

export async function POST(request: NextRequest) {
  return withSafeJsonErrors("api/civica-index/corrections", async () => {
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
    await db.insert(correctionLog).values({
      countryId,
      category,
      dimension,
      submitterName,
      submitterEmail,
      submitterAffiliation,
      description,
      isPublic: !requestPrivacy,
      status: "open",
    });

    return NextResponse.json({ ok: true }, { status: 201 });
  });
}
