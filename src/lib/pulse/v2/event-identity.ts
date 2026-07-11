import { createHash } from "node:crypto";

/** Versioned, deterministic report-normalization contract used by clustering. */
export const PULSE_EVENT_IDENTITY_VERSION =
  "pulse-event-identity/multilingual-v1";

const TOKEN_ALIASES = new Map<string, string>([
  // Institutions and offices (English, Spanish, French, Portuguese, German, Italian).
  ["cour", "court"],
  ["corte", "court"],
  ["tribunal", "court"],
  ["gericht", "court"],
  ["parlamento", "parliament"],
  ["parlement", "parliament"],
  ["parlament", "parliament"],
  ["gobierno", "government"],
  ["governo", "government"],
  ["gouvernement", "government"],
  ["regierung", "government"],
  ["presidente", "president"],
  ["president", "president"],
  ["ministro", "minister"],
  ["ministre", "minister"],
  ["ministerin", "minister"],
  ["eleccion", "election"],
  ["elecciones", "election"],
  ["eleicao", "election"],
  ["eleicoes", "election"],
  ["elections", "election"],
  ["wahl", "election"],
  ["wahlen", "election"],
  ["electoral", "election"],
  ["comisionado", "commissioner"],
  ["comisario", "commissioner"],
  ["comissario", "commissioner"],
  ["commissaire", "commissioner"],
  // Common governance-event actions.
  ["anula", "annul"],
  ["anulo", "annul"],
  ["anulado", "annul"],
  ["annule", "annul"],
  ["annulled", "annul"],
  ["annuls", "annul"],
  ["annulla", "annul"],
  ["destituye", "remove"],
  ["destituyo", "remove"],
  ["destituido", "remove"],
  ["removed", "remove"],
  ["removes", "remove"],
  ["demet", "remove"],
  ["afasta", "remove"],
  ["entlasst", "remove"],
  ["aprueba", "approve"],
  ["aprobo", "approve"],
  ["aprova", "approve"],
  ["approuve", "approve"],
  ["approves", "approve"],
  ["approved", "approve"],
  ["prohibe", "ban"],
  ["proibiu", "ban"],
  ["interdit", "ban"],
  ["bans", "ban"],
  ["renuncia", "resign"],
  ["renuncio", "resign"],
  ["demissionne", "resign"],
  ["resigns", "resign"],
  ["resigned", "resign"],
  ["tritt", "resign"],
]);

const STOPWORDS = new Set([
  "the",
  "and",
  "for",
  "that",
  "with",
  "from",
  "has",
  "have",
  "was",
  "were",
  "are",
  "his",
  "her",
  "its",
  "their",
  "they",
  "this",
  "after",
  "over",
  "into",
  "amid",
  "says",
  "said",
  "will",
  "who",
  "not",
  "but",
  "out",
  "new",
  "una",
  "uno",
  "las",
  "los",
  "del",
  "por",
  "para",
  "que",
  "con",
  "des",
  "les",
  "une",
  "dans",
  "sur",
  "est",
  "aux",
  "pour",
  "dos",
  "das",
  "uma",
  "com",
  "von",
  "der",
  "die",
  "und",
  "dem",
  "den",
  "ein",
  "eine",
]);

// These describe the event form but do not distinguish one incident from another.
const GENERIC_EVENT_TOKENS = new Set([
  "court",
  "supreme",
  "constitutional",
  "parliament",
  "government",
  "president",
  "minister",
  "commissioner",
  "election",
  "law",
  "bill",
  "vote",
  "ruling",
  "decision",
  "annul",
  "remove",
  "approve",
  "ban",
  "resign",
  "appoint",
  "dismiss",
  "suspend",
  "arrest",
  "charge",
  "protest",
]);

export interface NormalizedEventIdentity {
  version: typeof PULSE_EVENT_IDENTITY_VERSION;
  text: string;
  tokens: string[];
  anchors: string[];
  key: string;
}

function canonicalToken(token: string): string {
  return TOKEN_ALIASES.get(token) ?? token;
}

export function normalizeEventIdentity(
  title: string,
  body: string | null = null,
): NormalizedEventIdentity {
  const ascii = `${title} ${body ?? ""}`
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
  const tokens = Array.from(
    new Set(
      (ascii.match(/[\p{L}\p{N}]{3,}/gu) ?? [])
        .map(canonicalToken)
        .filter((token) => !STOPWORDS.has(token)),
    ),
  ).sort();
  const anchors = tokens
    .filter((token) => !GENERIC_EVENT_TOKENS.has(token))
    .sort();
  const text = tokens.join(" ");
  const key = createHash("sha256")
    .update(`${PULSE_EVENT_IDENTITY_VERSION}\n${text}`)
    .digest("hex");
  return { version: PULSE_EVENT_IDENTITY_VERSION, text, tokens, anchors, key };
}

function jaccard(left: readonly string[], right: readonly string[]): number {
  if (!left.length || !right.length) return 0;
  const a = new Set(left);
  const b = new Set(right);
  let overlap = 0;
  for (const token of a) if (b.has(token)) overlap++;
  return overlap / (a.size + b.size - overlap);
}

function overlapCoefficient(
  left: readonly string[],
  right: readonly string[],
): number {
  if (!left.length || !right.length) return 0;
  const a = new Set(left);
  const b = new Set(right);
  let overlap = 0;
  for (const token of a) if (b.has(token)) overlap++;
  return overlap / Math.min(a.size, b.size);
}

export interface EventIdentityComparison {
  tokenSimilarity: number;
  anchorOverlap: number;
  exactNormalizedMatch: boolean;
  hasIdentityAnchor: boolean;
}

export function compareEventIdentities(
  left: NormalizedEventIdentity,
  right: NormalizedEventIdentity,
): EventIdentityComparison {
  const tokenSimilarity = jaccard(left.tokens, right.tokens);
  const anchorOverlap = overlapCoefficient(left.anchors, right.anchors);
  return {
    tokenSimilarity,
    anchorOverlap,
    exactNormalizedMatch: left.key === right.key,
    hasIdentityAnchor: anchorOverlap >= 0.6,
  };
}
