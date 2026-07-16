import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { advisoryApplications } from "@/lib/db/schema";
import {
  checkRequestRateLimit,
  rateLimitResponse,
} from "@/lib/api/rate-limit-request";
import { getRequestRateLimitPolicy } from "@/lib/api/rate-limit-runtime-policy";
import {
  validateAdvisoryApplication,
  type AdvisoryApplicationInput,
} from "@/lib/research/advisory-application";
import {
  JSON_MEDIA_TYPE,
  parseBoundedRequestBody,
} from "@/lib/api/request-body";
import {
  advisoryApplicationBodySchema,
  REQUEST_BODY_LIMITS,
  type AdvisoryApplicationBody,
} from "@/lib/api/request-body-schemas";
import { withPrivateSafeJsonErrors } from "@/lib/api/problem-response";

const ADVISORY_RATE_LIMIT_POLICY = getRequestRateLimitPolicy(
  "advisory-application-form",
);

function json(
  body: unknown,
  status: number,
  headers: Record<string, string> = {},
) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store", ...headers },
  });
}

export async function POST(req: NextRequest) {
  return withPrivateSafeJsonErrors("api/advisory-applications", async () => {
    const rateLimit = await checkRequestRateLimit(
      req,
      ADVISORY_RATE_LIMIT_POLICY,
    );
    if (rateLimit.status !== "allowed") {
      return rateLimitResponse(rateLimit, ADVISORY_RATE_LIMIT_POLICY, {
        limitedMessage:
          "Too many applications. Please wait before trying again.",
      });
    }

    const parsed = await parseBoundedRequestBody<AdvisoryApplicationBody>(req, {
      maxBytes: REQUEST_BODY_LIMITS.advisoryApplication,
      media: [
        { mediaType: JSON_MEDIA_TYPE, schema: advisoryApplicationBodySchema },
      ],
    });
    if (!parsed.ok) return parsed.response;
    const body = parsed.data;

    // Honeypot: bots fill this hidden field, humans leave it empty.
    if (body._trap) {
      // Match the real success response so the endpoint reveals no filter signal.
      return json({ success: true, receipt: "onscreen-only" }, 201);
    }

    const application: AdvisoryApplicationInput = {
      name: body.name,
      email: body.email,
      institution: body.institution,
      role: body.role,
      expertiseArea: body.expertiseArea,
      experience: body.experience,
      links: body.links,
      cvUrl: body.cvUrl,
      consent: body.consent,
    };
    const errors = validateAdvisoryApplication(application);

    if (Object.keys(errors).length > 0) {
      return json({ errors, code: "INVALID_APPLICATION" }, 422);
    }

    try {
      await db.insert(advisoryApplications).values({
        name: application.name.trim(),
        email: application.email.trim().toLowerCase(),
        institution: application.institution.trim(),
        role: application.role.trim(),
        expertiseArea: application.expertiseArea.trim(),
        experience: application.experience.trim(),
        links: application.links.trim() || null,
        cvUrl: application.cvUrl.trim() || null,
        // The rate limiter uses a short-lived hashed bucket; applicant IP is not retained here.
        ipAddress: null,
        status: "new",
      });
    } catch {
      return json(
        {
          error: "The application could not be stored. Please try again later.",
          code: "DATA_UNAVAILABLE",
        },
        503,
      );
    }

    // Notification: this mirrors the contact form exactly — no transactional
    // email provider is configured, so the owner reads new applications via the
    // authed admin surface (GET /api/admin/advisory-applications and the
    // /admin/advisory-applications page). To add email notifications, set
    // RESEND_API_KEY (or similar) and call the provider here AND in
    // src/app/api/contact/route.ts so both inboxes stay consistent.

    return json({ success: true, receipt: "onscreen-only" }, 201);
  });
}
