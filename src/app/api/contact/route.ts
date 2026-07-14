import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { contactSubmissions } from "@/lib/db/schema";
import {
  checkRequestRateLimit,
  rateLimitResponse,
} from "@/lib/api/rate-limit-request";
import { getRequestRateLimitPolicy } from "@/lib/api/rate-limit-runtime-policy";
import { getRequestIp } from "@/lib/api/request-ip";
import {
  JSON_MEDIA_TYPE,
  parseBoundedRequestBody,
} from "@/lib/api/request-body";
import {
  CONTACT_BODY_LIMITS,
  contactBodySchema,
  REQUEST_BODY_LIMITS,
  type ContactBody,
} from "@/lib/api/request-body-schemas";
import { withSafeJsonErrors } from "@/lib/api/problem-response";

const CONTACT_RATE_LIMIT_POLICY = getRequestRateLimitPolicy("contact-form");

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

export async function POST(req: NextRequest) {
  return withSafeJsonErrors("api/contact", async () => {
    const rateLimit = await checkRequestRateLimit(
      req,
      CONTACT_RATE_LIMIT_POLICY,
    );
    if (rateLimit.status !== "allowed") {
      return rateLimitResponse(rateLimit, CONTACT_RATE_LIMIT_POLICY, {
        limitedMessage:
          "Too many submissions. Please wait before trying again.",
      });
    }

    // This separately resolved canonical address is retained with the contact
    // row under the existing privacy contract. The limiter receives only its
    // domain-separated HMAC subject through checkRequestRateLimit().
    const ip = getRequestIp(req);

    const parsed = await parseBoundedRequestBody<ContactBody>(req, {
      maxBytes: REQUEST_BODY_LIMITS.contact,
      media: [{ mediaType: JSON_MEDIA_TYPE, schema: contactBodySchema }],
    });
    if (!parsed.ok) return parsed.response;
    const body = parsed.data;

    // Honeypot: bots fill this hidden field, humans leave it empty
    if (body._trap) {
      // Return 200 to avoid tipping off bots, but don't store anything
      return NextResponse.json({ success: true });
    }

    const { name, email, subject, message } = body;

    const errors: Record<string, string> = {};

    if (!name || name.trim().length === 0) {
      errors.name = "Name is required.";
    } else if (name.trim().length > CONTACT_BODY_LIMITS.name) {
      errors.name = `Name must be ${CONTACT_BODY_LIMITS.name} characters or fewer.`;
    }

    if (!email || email.trim().length === 0) {
      errors.email = "Email is required.";
    } else if (
      email.trim().length > CONTACT_BODY_LIMITS.email ||
      !isValidEmail(email.trim())
    ) {
      errors.email = "A valid email address is required.";
    }

    if (!subject || subject.trim().length === 0) {
      errors.subject = "Subject is required.";
    } else if (subject.trim().length > CONTACT_BODY_LIMITS.subject) {
      errors.subject = `Subject must be ${CONTACT_BODY_LIMITS.subject} characters or fewer.`;
    }

    if (!message || message.trim().length === 0) {
      errors.message = "Message is required.";
    } else if (message.trim().length > CONTACT_BODY_LIMITS.message) {
      errors.message = `Message must be ${CONTACT_BODY_LIMITS.message} characters or fewer.`;
    }

    if (Object.keys(errors).length > 0) {
      return NextResponse.json(
        { errors, code: "INVALID_CONTACT_FORM" },
        { status: 422, headers: { "Cache-Control": "no-store" } },
      );
    }

    await db.insert(contactSubmissions).values({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      subject: subject.trim(),
      message: message.trim(),
      ipAddress: ip,
    });

    // Email notification: no transactional email provider is configured.
    // To add notifications, set RESEND_API_KEY (or similar) and call the
    // provider here. Submissions are readable via GET /api/admin/contact.

    return NextResponse.json({ success: true }, { status: 201 });
  });
}
