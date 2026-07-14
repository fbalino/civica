import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { correctionLog, jurisdictions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import {
  checkRequestRateLimit,
  rateLimitResponse,
} from "@/lib/api/rate-limit-request";
import { getRequestRateLimitPolicy } from "@/lib/api/rate-limit-runtime-policy";

const VALID_CATEGORIES = [
  "ci_data_error",
  "ci_methodology",
  "pulse_misclassification",
  "pulse_severity",
  "pulse_false_positive",
  "pulse_missing_event",
  "pulse_duplicate",
  "other",
] as const;

const VALID_DIMENSIONS = [
  "democratic_quality",
  "rule_of_law",
  "human_development",
  "freedoms_rights",
  "corruption_control",
  "stability_security",
];

const CORRECTION_RATE_LIMIT_POLICY =
  getRequestRateLimitPolicy("correction-form");

export async function POST(request: NextRequest) {
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

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  // --- Server-side validation ---
  const category = (body.category as string)?.trim();
  if (
    !category ||
    !VALID_CATEGORIES.includes(category as (typeof VALID_CATEGORIES)[number])
  ) {
    return NextResponse.json(
      { error: "Invalid or missing category." },
      { status: 400 },
    );
  }

  const description = (body.description as string)?.trim();
  if (!description || description.length < 10) {
    return NextResponse.json(
      { error: "Description is required (minimum 10 characters)." },
      { status: 400 },
    );
  }
  if (description.length > 10000) {
    return NextResponse.json(
      { error: "Description must be under 10,000 characters." },
      { status: 400 },
    );
  }

  const countrySlug = (body.countrySlug as string)?.trim() || null;
  const dimension = (body.dimension as string)?.trim() || null;
  const submitterName = (body.submitterName as string)?.trim() || null;
  const submitterEmail = (body.submitterEmail as string)?.trim() || null;
  const submitterAffiliation =
    (body.submitterAffiliation as string)?.trim() || null;
  const requestPrivacy = Boolean(body.requestPrivacy);

  // Validate email format if provided
  if (submitterEmail) {
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRe.test(submitterEmail)) {
      return NextResponse.json(
        { error: "Invalid email address." },
        { status: 400 },
      );
    }
    if (submitterEmail.length > 320) {
      return NextResponse.json({ error: "Email too long." }, { status: 400 });
    }
  }

  // Validate dimension if provided
  if (dimension && !VALID_DIMENSIONS.includes(dimension)) {
    return NextResponse.json(
      { error: "Invalid dimension value." },
      { status: 400 },
    );
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
        { error: "Country not found." },
        { status: 400 },
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
}
