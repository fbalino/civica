import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { and, eq, gt, isNull, or, sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { getAdminSession } from "@/lib/admin/session";
import { db } from "@/lib/db";
import {
  pulseCodingParticipants,
  pulseCodingStudies,
} from "@/lib/db/schema";
import {
  pulseCodingAccessCodeHash,
  pulseCodingHashesEqual,
  type PulseCodingRole,
} from "./coding-workspace";

export const PULSE_CODING_SESSION_COOKIE = "civica_pulse_coding_session";
const SESSION_TTL_SECONDS = 3 * 24 * 60 * 60;

export interface PulseCodingParticipantSession {
  kind: "participant";
  participantId: string;
  studyId: string;
  studySlug: string;
  pseudonym: string;
  role: Exclude<PulseCodingRole, "study_admin">;
  actorType: "qualified_human" | "agent_dry_pilot";
  useStatus: "evaluation_candidate" | "dry_run_not_gold";
}

export interface PulseCodingAdminSession {
  kind: "admin";
  participantId: null;
  studyId: null;
  studySlug: null;
  pseudonym: string;
  role: "study_admin";
  actorType: "qualified_human";
  useStatus: "dry_run_not_gold";
}

export type PulseCodingSession =
  | PulseCodingParticipantSession
  | PulseCodingAdminSession;

function sessionSecret(): string | null {
  return process.env.PULSE_CODING_SESSION_SECRET?.trim() || null;
}

function hmac(secret: string, payload: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left, "utf8");
  const b = Buffer.from(right, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

function parseCookie(value: string): { participantId: string; expires: number } | null {
  const [participantId, expiresRaw, nonce, presentedMac, extra] = value.split(".");
  if (!participantId || !expiresRaw || !nonce || !presentedMac || extra)
    return null;
  const expires = Number(expiresRaw);
  if (!Number.isSafeInteger(expires) || expires <= Math.floor(Date.now() / 1000))
    return null;
  const secret = sessionSecret();
  if (!secret) return null;
  const payload = `${participantId}.${expiresRaw}.${nonce}`;
  if (!safeEqual(presentedMac, hmac(secret, payload))) return null;
  return { participantId, expires };
}

export function buildPulseCodingCookieHeaders(
  participantId: string,
  participantExpiresAt: Date | null,
): Array<[string, string]> {
  const secret = sessionSecret();
  if (!secret) throw new Error("PULSE_CODING_SESSION_SECRET is not configured");
  const now = Math.floor(Date.now() / 1000);
  const participantExpiry = participantExpiresAt
    ? Math.floor(participantExpiresAt.getTime() / 1000)
    : now + SESSION_TTL_SECONDS;
  const expires = Math.min(now + SESSION_TTL_SECONDS, participantExpiry);
  if (expires <= now) throw new Error("Pulse coding access has expired");
  const nonce = randomBytes(18).toString("hex");
  const payload = `${participantId}.${expires}.${nonce}`;
  const value = `${payload}.${hmac(secret, payload)}`;
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  const common = `Path=/admin/pulse-coding; HttpOnly; SameSite=Lax; Max-Age=${expires - now}`;
  return [["Set-Cookie", `${PULSE_CODING_SESSION_COOKIE}=${encodeURIComponent(value)}; ${common}${secure}`]];
}

export function buildPulseCodingClearCookieHeaders(): Array<[string, string]> {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return [[
    "Set-Cookie",
    `${PULSE_CODING_SESSION_COOKIE}=; Path=/admin/pulse-coding; HttpOnly; SameSite=Lax; Max-Age=0${secure}`,
  ]];
}

export async function getPulseCodingParticipantSession(): Promise<PulseCodingParticipantSession | null> {
  const jar = await cookies();
  const raw = jar.get(PULSE_CODING_SESSION_COOKIE)?.value;
  if (!raw) return null;
  const parsed = parseCookie(raw);
  if (!parsed) return null;

  const rows = await db
    .select({
      participantId: pulseCodingParticipants.id,
      studyId: pulseCodingParticipants.studyId,
      studySlug: pulseCodingStudies.slug,
      pseudonym: pulseCodingParticipants.pseudonym,
      role: pulseCodingParticipants.role,
      actorType: pulseCodingParticipants.actorType,
      useStatus: pulseCodingParticipants.useStatus,
    })
    .from(pulseCodingParticipants)
    .innerJoin(
      pulseCodingStudies,
      eq(pulseCodingParticipants.studyId, pulseCodingStudies.id),
    )
    .where(
      and(
        eq(pulseCodingParticipants.id, parsed.participantId),
        eq(pulseCodingParticipants.status, "active"),
        eq(pulseCodingStudies.status, "active"),
        or(
          isNull(pulseCodingParticipants.expiresAt),
          gt(pulseCodingParticipants.expiresAt, new Date()),
        ),
      ),
    )
    .limit(1);
  const row = rows[0];
  if (!row || !["coder", "adjudicator"].includes(row.role)) return null;
  return {
    kind: "participant",
    participantId: row.participantId,
    studyId: row.studyId,
    studySlug: row.studySlug,
    pseudonym: row.pseudonym,
    role: row.role as PulseCodingParticipantSession["role"],
    actorType: row.actorType as PulseCodingParticipantSession["actorType"],
    useStatus: row.useStatus as PulseCodingParticipantSession["useStatus"],
  };
}

export async function getPulseCodingSession(): Promise<PulseCodingSession | null> {
  const participant = await getPulseCodingParticipantSession();
  if (participant) return participant;
  const admin = await getAdminSession();
  if (!admin) return null;
  return {
    kind: "admin",
    participantId: null,
    studyId: null,
    studySlug: null,
    pseudonym: admin.reviewerId,
    role: "study_admin",
    actorType: "qualified_human",
    useStatus: "dry_run_not_gold",
  };
}

export async function authenticatePulseCodingAccessCode(
  code: string,
  requestId: string,
): Promise<{
  session: PulseCodingParticipantSession;
  cookieHeaders: Array<[string, string]>;
} | null> {
  const normalized = code.trim();
  if (normalized.length < 32 || normalized.length > 200) return null;
  const credentialHash = pulseCodingAccessCodeHash(normalized);
  const rows = await db
    .select({
      participantId: pulseCodingParticipants.id,
      studyId: pulseCodingParticipants.studyId,
      studySlug: pulseCodingStudies.slug,
      pseudonym: pulseCodingParticipants.pseudonym,
      role: pulseCodingParticipants.role,
      actorType: pulseCodingParticipants.actorType,
      useStatus: pulseCodingParticipants.useStatus,
      credentialHash: pulseCodingParticipants.credentialHash,
      expiresAt: pulseCodingParticipants.expiresAt,
    })
    .from(pulseCodingParticipants)
    .innerJoin(
      pulseCodingStudies,
      eq(pulseCodingParticipants.studyId, pulseCodingStudies.id),
    )
    .where(
      and(
        eq(pulseCodingParticipants.credentialHash, credentialHash),
        eq(pulseCodingParticipants.status, "active"),
        eq(pulseCodingStudies.status, "active"),
        or(
          isNull(pulseCodingParticipants.expiresAt),
          gt(pulseCodingParticipants.expiresAt, new Date()),
        ),
      ),
    )
    .limit(1);
  const row = rows[0];
  if (
    !row ||
    !pulseCodingHashesEqual(row.credentialHash, credentialHash) ||
    !["coder", "adjudicator"].includes(row.role)
  )
    return null;

  // Re-check access in the same statement that records the grant. A concurrent
  // participant revocation or study closure must win over a login already in flight.
  const access = await db.execute(sql`
    WITH granted AS (
      UPDATE pulse_coding_participants AS participant
      SET last_access_at = NOW()
      WHERE participant.id = ${row.participantId}
        AND participant.credential_hash = ${credentialHash}
        AND participant.status = 'active'
        AND (participant.expires_at IS NULL OR participant.expires_at > NOW())
        AND EXISTS (
          SELECT 1
          FROM pulse_coding_studies AS study
          WHERE study.id = participant.study_id
            AND study.status = 'active'
        )
      RETURNING participant.id, participant.study_id, participant.role
    ), logged AS (
      INSERT INTO pulse_coding_audit_log (
        study_id, participant_id, actor_id, actor_role, action,
        entity_type, entity_id, request_id, details
      )
      SELECT
        granted.study_id,
        granted.id,
        granted.id::text,
        granted.role,
        'access_granted',
        'participant_session',
        granted.id::text,
        ${requestId},
        '{"method":"random_access_code","credentialRetained":false}'::jsonb
      FROM granted
      RETURNING participant_id
    )
    SELECT participant_id FROM logged
  `);
  if (access.rows.length !== 1) return null;

  const session: PulseCodingParticipantSession = {
    kind: "participant",
    participantId: row.participantId,
    studyId: row.studyId,
    studySlug: row.studySlug,
    pseudonym: row.pseudonym,
    role: row.role as PulseCodingParticipantSession["role"],
    actorType: row.actorType as PulseCodingParticipantSession["actorType"],
    useStatus: row.useStatus as PulseCodingParticipantSession["useStatus"],
  };
  return {
    session,
    cookieHeaders: buildPulseCodingCookieHeaders(
      row.participantId,
      row.expiresAt,
    ),
  };
}
