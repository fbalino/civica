import { createHash } from "node:crypto";
/**
 * PLT-007 — high-signal secret and sensitive-artifact detectors.
 *
 * Pure, testable core shared by `scripts/scan-secrets.ts`. Patterns favor
 * precision (real credential shapes) over recall so the gate does not drown in
 * false positives; the narrow allowlist below covers the known documentation
 * placeholders. Findings never carry the full matched value — callers redact.
 */

export type SecretPattern = { id: string; description: string; regex: RegExp };

export const SECRET_PATTERNS: SecretPattern[] = [
  {
    id: "anthropic-key",
    description: "Anthropic API key",
    regex: /sk-ant-[a-zA-Z0-9_-]{24,}/g,
  },
  {
    id: "openai-style-key",
    description: "OpenAI/DeepSeek-style secret key",
    regex: /\bsk-(?:proj-)?[a-zA-Z0-9]{32,}\b/g,
  },
  {
    id: "google-oauth-secret",
    description: "Google OAuth client secret",
    regex: /GOCSPX-[a-zA-Z0-9_-]{20,}/g,
  },
  {
    id: "aws-access-key",
    description: "AWS access key id",
    regex: /\bAKIA[0-9A-Z]{16}\b/g,
  },
  {
    id: "github-token",
    description: "GitHub token",
    regex: /\b(?:ghp|gho|ghu|ghs)_[a-zA-Z0-9]{36}\b|\bgithub_pat_[a-zA-Z0-9_]{40,}\b/g,
  },
  {
    id: "slack-token",
    description: "Slack token",
    regex: /\bxox[baprs]-[0-9A-Za-z-]{10,}\b/g,
  },
  {
    id: "private-key-block",
    description: "PEM private key block",
    regex: /-----BEGIN (?:RSA |EC |OPENSSH |PGP |DSA )?PRIVATE KEY-----/g,
  },
  {
    id: "db-url-with-password",
    description: "Connection string with an embedded non-placeholder password",
    regex: /\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?):\/\/[^:@/\s]+:[^@/\s]{6,}@[^\s"']+/g,
  },
  {
    id: "assigned-secret-value",
    description: "Secret-named variable assigned a long literal value",
    regex:
      /\b[A-Z0-9_]*(?:API_KEY|SECRET|TOKEN|PASSWORD_HASH|CLIENT_SECRET|SESSION_SECRET|PRIVATE_KEY)\s*[:=]\s*["'][^"'\s]{20,}["']/g,
  },
];

/** Sensitive artifact filename patterns (database dumps, keys, WAL, creds). */
export const SENSITIVE_FILE_PATTERNS: RegExp[] = [
  /\.(sql\.gz|sql\.zst|dump|pgdump|bak|wal)$/i,
  /\.(pem|key|p12|pfx)$/i,
  /(^|\/)id_rsa($|\.)/,
  /(^|\/)auth\.json$/,
];

/**
 * Substrings that make a match an obvious placeholder/example, not a leak.
 * Kept deliberately generic so documentation and fixtures pass without a
 * per-file exception.
 */
const PLACEHOLDER_MARKERS = [
  "user:password@host",
  "password@host",
  ":password@",
  "demo_key",
  "your-",
  "example",
  "placeholder",
  "changeme",
  "xxxxxxxx",
  "redacted",
  "<your",
  "dummy",
  "fake",
  "test-key",
  "test-secret",
  "sk-ant-xxx",
  "sk-ant-test",
  "0000000000000000",
  // Loopback / obviously-invalid connection targets are never real remote
  // credentials — they only appear in test fixtures.
  "127.0.0.1",
  "localhost",
  "invalid:invalid",
];

export function isPlaceholder(match: string): boolean {
  const lower = match.toLowerCase();
  return PLACEHOLDER_MARKERS.some((marker) => lower.includes(marker));
}

export type SecretFinding = {
  patternId: string;
  description: string;
  /** Redacted preview — first 4 chars then a mask, never the full value. */
  preview: string;
};

/** Redact a matched secret to a short, non-recoverable preview. */
export function redact(match: string): string {
  const head = match.slice(0, 4);
  return `${head}${"*".repeat(Math.min(12, Math.max(3, match.length - 4)))}`;
}

/**
 * Find secret findings in a block of text. Placeholder/example matches are
 * skipped. Returns redacted findings only.
 */
export function findSecrets(
  text: string,
  allowlistedPatternIds: ReadonlySet<string> = new Set(),
  knownExposedHashes: ReadonlySet<string> = new Set(),
): SecretFinding[] {
  const findings: SecretFinding[] = [];
  for (const pattern of SECRET_PATTERNS) {
    if (allowlistedPatternIds.has(pattern.id)) continue;
    const matches = text.match(pattern.regex);
    if (!matches) continue;
    for (const match of matches) {
      if (isPlaceholder(match)) continue;
      // A known, already-tracked historical exposure (queued for rotation) is
      // skipped by its non-reversible hash so it cannot mask a NEW leak.
      if (knownExposedHashes.has(sha256Hex(match))) continue;
      findings.push({
        patternId: pattern.id,
        description: pattern.description,
        preview: redact(match),
      });
    }
  }
  return findings;
}

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function isSensitiveFile(path: string): boolean {
  return SENSITIVE_FILE_PATTERNS.some((regex) => regex.test(path));
}
