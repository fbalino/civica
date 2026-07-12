import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { advisoryApplications } from "@/lib/db/schema";
import { checkDurableRateLimit, getRequestIp } from "@/lib/api/rate-limit";
import {
  ADVISORY_APPLICATION_LIMITS,
  ADVISORY_APPLICATION_POLICY_VERSION,
  validateAdvisoryApplication,
  type AdvisoryApplicationInput,
} from "@/lib/research/advisory-application";

// Per-IP rate limit: max 5 applications per 30 minutes. Applications are a
// deliberate, one-time act — a tighter window than the contact form's 5/10min.
const RATE_LIMIT_WINDOW_MS = 30 * 60 * 1000;
const RATE_LIMIT_MAX = 5;

function json(body: unknown, status: number, headers: Record<string, string> = {}) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store", ...headers },
  });
}

export async function POST(req: NextRequest) {
  let raw = "";
  try {
    raw = await req.text();
  } catch {
    return json({ error: "Invalid request body." }, 400);
  }
  if (raw.length > ADVISORY_APPLICATION_LIMITS.requestBody) {
    return json({ error: "Request body is too large." }, 413);
  }

  let body: Record<string, unknown>;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("not an object");
    body = parsed as Record<string, unknown>;
  } catch {
    return json({ error: "Invalid JSON body." }, 400);
  }

  // Honeypot: bots fill this hidden field, humans leave it empty.
  if (body._trap) {
    // Match the real success response so the endpoint reveals no filter signal.
    return json({ success: true, receipt: "onscreen-only" }, 201);
  }

  const value = (key: string) => (typeof body[key] === "string" ? body[key] as string : "");
  const application: AdvisoryApplicationInput = {
    name: value("name"),
    email: value("email"),
    institution: value("institution"),
    role: value("role"),
    expertiseArea: value("expertiseArea"),
    experience: value("experience"),
    links: value("links"),
    cvUrl: value("cvUrl"),
    consent: body.consent === true && body.privacyNoticeVersion === ADVISORY_APPLICATION_POLICY_VERSION,
  };
  const errors = validateAdvisoryApplication(application);

  if (Object.keys(errors).length > 0) {
    return json({ errors }, 422);
  }

  const ipKey = createHash("sha256").update(`advisory:${getRequestIp(req)}`).digest("hex");
  const rateLimit = await checkDurableRateLimit({
    scope: "advisory-applications",
    key: ipKey,
    limit: RATE_LIMIT_MAX,
    windowMs: RATE_LIMIT_WINDOW_MS,
  });
  if (!rateLimit.allowed) {
    return json(
      { error: "Too many applications. Please wait before trying again." },
      429,
      { "Retry-After": String(Math.max(1, Math.ceil(rateLimit.retryAfterMs / 1000))) },
    );
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
    return json({ error: "The application could not be stored. Please try again later." }, 503);
  }

  // Notification: this mirrors the contact form exactly — no transactional
  // email provider is configured, so the owner reads new applications via the
  // authed admin surface (GET /api/admin/advisory-applications and the
  // /admin/advisory-applications page). To add email notifications, set
  // RESEND_API_KEY (or similar) and call the provider here AND in
  // src/app/api/contact/route.ts so both inboxes stay consistent.

  return json({ success: true, receipt: "onscreen-only" }, 201);
}
