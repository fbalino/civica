/**
 * `publisher-fallback-permission/v1` — when Civica may retrieve a publisher's
 * page through a third-party fetch service after that publisher blocked us.
 *
 * A publisher that answers 401/403/429 has expressed something, even if the
 * block is generic bot protection rather than a decision about Civica.
 * Retrieving the same URL through another network is a different act from
 * fetching an open feed, and this project does not perform it on the strength
 * of "it was technically reachable". The owner's rule (2026-08-18) is that a
 * blocked publisher is routed through the fallback ONLY where Civica holds a
 * recorded permission from that publisher.
 *
 * This registry makes that rule a property of the code rather than of whether
 * an API key happens to be set:
 *
 * - The registry is closed and explicit. A host that is absent is NOT
 *   permitted — the default is refusal, never silent consent.
 * - Only `granted` permits the fallback. `not_requested`, `requested_pending`,
 *   and `denied` all leave the publisher's own error standing, exactly as if
 *   no fetch service were configured at all.
 * - `granted` cannot be written without evidence: the type requires who
 *   granted it, when, and where the record lives. A grant with no paper trail
 *   does not compile.
 *
 * Changing a state here is a rights decision, not a configuration tweak.
 */

export const PUBLISHER_FALLBACK_PERMISSION_VERSION =
  "publisher-fallback-permission/v1" as const;

export const PUBLISHER_FALLBACK_PERMISSION_STATES = [
  /** The publisher told us we may retrieve this way. Requires evidence. */
  "granted",
  /** We have not asked. The fallback stays off. */
  "not_requested",
  /** We asked and have no answer yet. The fallback stays off. */
  "requested_pending",
  /** The publisher said no. The fallback stays off, permanently. */
  "denied",
] as const;

export type PublisherFallbackPermissionState =
  (typeof PUBLISHER_FALLBACK_PERMISSION_STATES)[number];

/**
 * One publisher's standing. `host` is a registrable host without `www.`;
 * subdomains of a registered host inherit its state.
 *
 * The union is deliberate: a `granted` row cannot be written without naming
 * the person or team who granted it, the date, and the file that holds the
 * record. Every other state carries a note saying why the fallback is off and
 * what the chosen path is.
 */
export type PublisherFallbackPermission =
  | {
      readonly host: string;
      readonly state: "granted";
      /** Who granted it, when, and where the record lives. */
      readonly permissionEvidence: string;
    }
  | {
      readonly host: string;
      readonly state: Exclude<PublisherFallbackPermissionState, "granted">;
      /** Why the fallback is off and what the chosen path is. */
      readonly note: string;
    };

/**
 * The closed production registry.
 *
 * No publisher currently permits the fallback. Amnesty International is
 * recorded rather than omitted so the refusal reads as a decision in the run
 * log instead of an unexplained absence.
 */
export const PUBLISHER_FALLBACK_PERMISSIONS: readonly PublisherFallbackPermission[] =
  Object.freeze([
    {
      host: "amnesty.org",
      state: "not_requested",
      note:
        "Amnesty's edge returns HTTP 403 for the whole domain and Civica has " +
        "not asked to be allowlisted. The owner's chosen path is to request " +
        "allowlisting from Amnesty's press/web team; until that is granted " +
        "and recorded, the amnesty connector fails honestly. Background: " +
        "plan/evidence/PUL-040/amnesty-retrieval-block-2026-08-18.md",
    },
  ]);

/**
 * Normalise a URL or bare host to a registrable host for matching. Returns
 * null when the input is not a host we can reason about — an unusable input
 * is never treated as permitted.
 */
export function normalizePublisherHost(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  let host: string;
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) {
    try {
      host = new URL(trimmed).hostname;
    } catch {
      return null;
    }
  } else if (/^[a-z0-9.-]+$/i.test(trimmed) && trimmed.includes(".")) {
    host = trimmed;
  } else {
    return null;
  }

  host = host.toLowerCase().replace(/\.+$/, "");
  if (host.startsWith("www.")) host = host.slice(4);
  return host.length > 0 ? host : null;
}

/** The registry row governing a URL, or null when the host is unregistered. */
export function findPublisherFallbackPermission(
  urlOrHost: string,
  registry: readonly PublisherFallbackPermission[] = PUBLISHER_FALLBACK_PERMISSIONS,
): PublisherFallbackPermission | null {
  const host = normalizePublisherHost(urlOrHost);
  if (!host) return null;
  for (const entry of registry) {
    const registered = normalizePublisherHost(entry.host);
    if (!registered) continue;
    if (host === registered || host.endsWith(`.${registered}`)) return entry;
  }
  return null;
}

export type PublisherFallbackDecision =
  | { readonly allowed: true; readonly host: string; readonly reason: string }
  | { readonly allowed: false; readonly host: string; readonly reason: string };

/**
 * Decide whether a blocked URL may be retried through the retrieval fallback.
 * `reason` is a single log-ready line, so a blocked feed's cause is visible in
 * the run log rather than silent.
 */
export function publisherFallbackDecision(
  urlOrHost: string,
  registry: readonly PublisherFallbackPermission[] = PUBLISHER_FALLBACK_PERMISSIONS,
): PublisherFallbackDecision {
  const host = normalizePublisherHost(urlOrHost) ?? urlOrHost.trim();
  const permission = findPublisherFallbackPermission(urlOrHost, registry);

  if (!permission) {
    return {
      allowed: false,
      host,
      reason: `no recorded permission for ${host} (host is not in ${PUBLISHER_FALLBACK_PERMISSION_VERSION})`,
    };
  }
  if (permission.state === "granted") {
    return {
      allowed: true,
      host,
      reason: `permission granted for ${permission.host} — ${permission.permissionEvidence}`,
    };
  }
  return {
    allowed: false,
    host,
    reason: `permission state "${permission.state}" for ${permission.host} — ${permission.note}`,
  };
}

/** True only for hosts whose recorded state is `granted`. */
export function publisherFallbackPermitted(
  urlOrHost: string,
  registry: readonly PublisherFallbackPermission[] = PUBLISHER_FALLBACK_PERMISSIONS,
): boolean {
  return publisherFallbackDecision(urlOrHost, registry).allowed;
}

/* ------------------------------------------------------------------ */
/*  Direct automated retrieval                                         */
/* ------------------------------------------------------------------ */

/**
 * Some publishers forbid automated retrieval in their own terms, block or no
 * block. Amnesty International's Terms of Use (revised 2026-08-13) prohibit
 * "using automated tools, scraping, data-mining or similar technologies to
 * access, copy, monitor or extract content or data from the site unless we
 * have allowed this", and separately forbid evading their access controls.
 * Their robots.txt does not disallow /en/feed/, but the terms are the
 * stricter instrument and Civica follows the stricter one.
 *
 * So retrieval permission is TWO questions, not one:
 *   - may we fetch this publisher automatically at all?  (this registry)
 *   - may we route around a block?                       (the registry above)
 *
 * A host absent here is treated as ordinarily fetchable: the overwhelming
 * majority of publishers offer feeds precisely to be read by machines, and
 * this list records the specific publishers who have said otherwise.
 */
export type PublisherDirectRetrieval = {
  readonly host: string;
  /**
   * `requires_permission` — the publisher's terms forbid automated access
   * without their say-so, so Civica does not make the request at all.
   * `granted` — they have said yes; requires evidence.
   */
  readonly state: "requires_permission" | "granted";
  /** Terms citation for a refusal, or who granted it and where it is recorded. */
  readonly evidence: string;
};

export const PUBLISHER_DIRECT_RETRIEVAL: readonly PublisherDirectRetrieval[] =
  Object.freeze([
    {
      host: "amnesty.org",
      state: "requires_permission",
      evidence:
        "Terms of Use §3 (revised 2026-08-13): automated tools, scraping or " +
        "similar technologies may not access the site 'unless we have " +
        "allowed this'; §3 also forbids evading access controls. Civica has " +
        "not asked. Owner decision 2026-08-18: request permission rather " +
        "than retrieve. Record: " +
        "plan/evidence/PUL-040/amnesty-retrieval-block-2026-08-18.md",
    },
  ]);

/**
 * True when Civica may automatically retrieve this publisher at all. Absent
 * hosts are permitted; a registered host must be explicitly `granted`.
 */
export function directRetrievalPermitted(
  urlOrHost: string,
  registry: readonly PublisherDirectRetrieval[] = PUBLISHER_DIRECT_RETRIEVAL,
): { permitted: boolean; reason: string } {
  const host = normalizePublisherHost(urlOrHost);
  if (!host) return { permitted: false, reason: "unparseable host" };
  for (const entry of registry) {
    const registered = normalizePublisherHost(entry.host);
    if (!registered) continue;
    if (host === registered || host.endsWith(`.${registered}`)) {
      return entry.state === "granted"
        ? { permitted: true, reason: entry.evidence }
        : { permitted: false, reason: entry.evidence };
    }
  }
  return { permitted: true, reason: "no publisher restriction recorded" };
}
