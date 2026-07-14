import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { contactSubmissions } from "@/lib/db/schema";
import {
  checkRequestRateLimit,
  rateLimitResponse,
} from "@/lib/api/rate-limit-request";
import { getRequestRateLimitPolicy } from "@/lib/api/rate-limit-runtime-policy";
import { getRequestIp } from "@/lib/api/request-ip";

const CONTACT_RATE_LIMIT_POLICY = getRequestRateLimitPolicy("contact-form");

const MAX_NAME_LEN = 100;
const MAX_EMAIL_LEN = 254;
const MAX_SUBJECT_LEN = 200;
const MAX_MESSAGE_LEN = 5000;

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
  const rateLimit = await checkRequestRateLimit(req, CONTACT_RATE_LIMIT_POLICY);
  if (rateLimit.status !== "allowed") {
    return rateLimitResponse(rateLimit, CONTACT_RATE_LIMIT_POLICY, {
      limitedMessage: "Too many submissions. Please wait before trying again.",
    });
  }

  // This separately resolved canonical address is retained with the contact
  // row under the existing privacy contract. The limiter receives only its
  // domain-separated HMAC subject through checkRequestRateLimit().
  const ip = getRequestIp(req);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  // Honeypot: bots fill this hidden field, humans leave it empty
  if (body._trap) {
    // Return 200 to avoid tipping off bots, but don't store anything
    return NextResponse.json({ success: true });
  }

  const { name, email, subject, message } = body;

  const errors: Record<string, string> = {};

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    errors.name = "Name is required.";
  } else if (name.trim().length > MAX_NAME_LEN) {
    errors.name = `Name must be ${MAX_NAME_LEN} characters or fewer.`;
  }

  if (!email || typeof email !== "string" || email.trim().length === 0) {
    errors.email = "Email is required.";
  } else if (
    email.trim().length > MAX_EMAIL_LEN ||
    !isValidEmail(email.trim())
  ) {
    errors.email = "A valid email address is required.";
  }

  if (!subject || typeof subject !== "string" || subject.trim().length === 0) {
    errors.subject = "Subject is required.";
  } else if (subject.trim().length > MAX_SUBJECT_LEN) {
    errors.subject = `Subject must be ${MAX_SUBJECT_LEN} characters or fewer.`;
  }

  if (!message || typeof message !== "string" || message.trim().length === 0) {
    errors.message = "Message is required.";
  } else if (message.trim().length > MAX_MESSAGE_LEN) {
    errors.message = `Message must be ${MAX_MESSAGE_LEN} characters or fewer.`;
  }

  if (Object.keys(errors).length > 0) {
    return NextResponse.json({ errors }, { status: 422 });
  }

  await db.insert(contactSubmissions).values({
    name: (name as string).trim(),
    email: (email as string).trim().toLowerCase(),
    subject: (subject as string).trim(),
    message: (message as string).trim(),
    ipAddress: ip,
  });

  // Email notification: no transactional email provider is configured.
  // To add notifications, set RESEND_API_KEY (or similar) and call the
  // provider here. Submissions are readable via GET /api/admin/contact.

  return NextResponse.json({ success: true }, { status: 201 });
}
