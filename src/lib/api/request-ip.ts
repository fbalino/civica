const UNKNOWN_REQUEST_IP = "unknown";

function canonicalizeIpv4(value: string): string | null {
  const octets = value.split(".");
  if (octets.length !== 4) return null;

  const canonical: string[] = [];
  for (const octet of octets) {
    // Avoid alternate numeric forms such as octal-looking leading zeroes.
    if (!/^(?:0|[1-9]\d{0,2})$/.test(octet)) return null;
    const number = Number(octet);
    if (number > 255) return null;
    canonical.push(String(number));
  }

  return canonical.join(".");
}

function canonicalizeIpv6(value: string): string | null {
  if (!value.includes(":") || value.includes("%")) return null;

  try {
    // The Web URL parser validates IPv6 and emits one canonical compressed
    // form. Wrapping the value also rejects brackets, ports, and zone IDs.
    const hostname = new URL(`http://[${value}]/`).hostname;
    if (!hostname.startsWith("[") || !hostname.endsWith("]")) return null;
    return hostname.slice(1, -1).toLowerCase();
  } catch {
    return null;
  }
}

function canonicalizeIp(value: string): string | null {
  const candidate = value.trim();
  if (!candidate || candidate.includes(",")) return null;
  return canonicalizeIpv4(candidate) ?? canonicalizeIpv6(candidate);
}

function resolveFirstPresentHeader(
  request: Request,
  headerNames: readonly string[],
): string {
  for (const headerName of headerNames) {
    const value = request.headers.get(headerName);
    if (value !== null) {
      // A malformed higher-priority header must not downgrade to another
      // client-controlled value or select a hop from a proxy chain.
      return canonicalizeIp(value) ?? UNKNOWN_REQUEST_IP;
    }
  }

  return UNKNOWN_REQUEST_IP;
}

/**
 * Resolve one canonical client IP for rate-limit bucketing.
 *
 * Vercel overwrites forwarded-IP headers at its edge to prevent spoofing. On
 * Vercel, prefer its dedicated header, then the documented aliases. Local and
 * test requests may supply one forwarded value for deterministic tests. An
 * unconfigured non-Vercel production proxy is not trusted. We never choose a
 * left- or right-most address from an arbitrary proxy chain.
 */
export function getRequestIp(request: Request): string {
  if (process.env.VERCEL === "1") {
    return resolveFirstPresentHeader(request, [
      "x-vercel-forwarded-for",
      "x-forwarded-for",
      "x-real-ip",
    ]);
  }

  if (process.env.NODE_ENV === "production") return UNKNOWN_REQUEST_IP;

  return resolveFirstPresentHeader(request, ["x-forwarded-for", "x-real-ip"]);
}
