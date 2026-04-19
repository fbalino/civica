import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { contactSubmissions } from "@/lib/db/schema";

// Per-IP rate limit: max 5 submissions per 10 minutes
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX = 5;

const MAX_NAME_LEN = 100;
const MAX_EMAIL_LEN = 254;
const MAX_SUBJECT_LEN = 200;
const MAX_MESSAGE_LEN = 5000;

function getIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"
  );
}

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  entry.count++;
  return entry.count <= RATE_LIMIT_MAX;
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" },
  });
}

export async function POST(req: NextRequest) {
  const ip = getIp(req);

  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { error: "Too many submissions. Please wait before trying again." },
      { status: 429, headers: { "Retry-After": "600" } }
    );
  }

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
  } else if (email.trim().length > MAX_EMAIL_LEN || !isValidEmail(email.trim())) {
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
