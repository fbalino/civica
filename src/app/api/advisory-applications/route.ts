import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { advisoryApplications } from "@/lib/db/schema";
import { checkInMemoryRateLimit, getRequestIp } from "@/lib/api/rate-limit";

// Per-IP rate limit: max 5 applications per 30 minutes. Applications are a
// deliberate, one-time act — a tighter window than the contact form's 5/10min.
const RATE_LIMIT_WINDOW_MS = 30 * 60 * 1000;
const RATE_LIMIT_MAX = 5;

const MAX_NAME_LEN = 120;
const MAX_EMAIL_LEN = 254;
const MAX_INSTITUTION_LEN = 200;
const MAX_ROLE_LEN = 160;
const MAX_EXPERTISE_LEN = 160;
const MAX_EXPERIENCE_LEN = 5000;
const MAX_LINKS_LEN = 2000;
const MAX_CV_URL_LEN = 500;

const MIN_EXPERIENCE_LEN = 40;

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/** Accept only http(s) URLs. Applicant-supplied links/CV links must be
 *  real web addresses so an admin can click them safely. */
function isValidHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
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
  const ip = getRequestIp(req);

  const rateLimit = checkInMemoryRateLimit({
    scope: "advisory-applications",
    key: ip,
    max: RATE_LIMIT_MAX,
    windowMs: RATE_LIMIT_WINDOW_MS,
  });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many applications. Please wait before trying again." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  // Honeypot: bots fill this hidden field, humans leave it empty.
  if (body._trap) {
    // Return 200 to avoid tipping off bots, but don't store anything.
    return NextResponse.json({ success: true });
  }

  const { name, email, institution, role, expertiseArea, experience, links, cvUrl } =
    body;

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

  if (!institution || typeof institution !== "string" || institution.trim().length === 0) {
    errors.institution = "Institution is required.";
  } else if (institution.trim().length > MAX_INSTITUTION_LEN) {
    errors.institution = `Institution must be ${MAX_INSTITUTION_LEN} characters or fewer.`;
  }

  if (!role || typeof role !== "string" || role.trim().length === 0) {
    errors.role = "Role or title is required.";
  } else if (role.trim().length > MAX_ROLE_LEN) {
    errors.role = `Role must be ${MAX_ROLE_LEN} characters or fewer.`;
  }

  if (
    !expertiseArea ||
    typeof expertiseArea !== "string" ||
    expertiseArea.trim().length === 0
  ) {
    errors.expertiseArea = "Area of expertise is required.";
  } else if (expertiseArea.trim().length > MAX_EXPERTISE_LEN) {
    errors.expertiseArea = `Area of expertise must be ${MAX_EXPERTISE_LEN} characters or fewer.`;
  }

  if (!experience || typeof experience !== "string" || experience.trim().length === 0) {
    errors.experience = "A short experience statement is required.";
  } else if (experience.trim().length < MIN_EXPERIENCE_LEN) {
    errors.experience = `Please write at least ${MIN_EXPERIENCE_LEN} characters.`;
  } else if (experience.trim().length > MAX_EXPERIENCE_LEN) {
    errors.experience = `Statement must be ${MAX_EXPERIENCE_LEN} characters or fewer.`;
  }

  // Links: optional, but if present must be within length. Free text so a
  // scholar can paste several URLs / handles.
  if (links != null && typeof links !== "string") {
    errors.links = "Links must be text.";
  } else if (typeof links === "string" && links.trim().length > MAX_LINKS_LEN) {
    errors.links = `Links must be ${MAX_LINKS_LEN} characters or fewer.`;
  }

  // CV link: optional. When present, must be a real http(s) URL so it's
  // safely clickable from the admin queue.
  if (cvUrl != null && typeof cvUrl !== "string") {
    errors.cvUrl = "CV link must be text.";
  } else if (typeof cvUrl === "string" && cvUrl.trim().length > 0) {
    if (cvUrl.trim().length > MAX_CV_URL_LEN) {
      errors.cvUrl = `CV link must be ${MAX_CV_URL_LEN} characters or fewer.`;
    } else if (!isValidHttpUrl(cvUrl.trim())) {
      errors.cvUrl = "Enter a valid link starting with http:// or https://.";
    }
  }

  if (Object.keys(errors).length > 0) {
    return NextResponse.json({ errors }, { status: 422 });
  }

  const linksValue =
    typeof links === "string" && links.trim().length > 0 ? links.trim() : null;
  const cvUrlValue =
    typeof cvUrl === "string" && cvUrl.trim().length > 0 ? cvUrl.trim() : null;

  await db.insert(advisoryApplications).values({
    name: (name as string).trim(),
    email: (email as string).trim().toLowerCase(),
    institution: (institution as string).trim(),
    role: (role as string).trim(),
    expertiseArea: (expertiseArea as string).trim(),
    experience: (experience as string).trim(),
    links: linksValue,
    cvUrl: cvUrlValue,
    ipAddress: ip,
    status: "new",
  });

  // Notification: this mirrors the contact form exactly — no transactional
  // email provider is configured, so the owner reads new applications via the
  // authed admin surface (GET /api/admin/advisory-applications and the
  // /admin/advisory-applications page). To add email notifications, set
  // RESEND_API_KEY (or similar) and call the provider here AND in
  // src/app/api/contact/route.ts so both inboxes stay consistent.

  return NextResponse.json({ success: true }, { status: 201 });
}
