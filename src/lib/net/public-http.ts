/**
 * Node-only bounded HTTP(S) client for fetching user/provider-supplied public
 * URLs. The validated DNS result is pinned into the socket lookup callback so
 * a second resolution cannot redirect the request into a private network.
 */

import { lookup as nodeLookup } from "node:dns/promises";
import {
  request as httpRequest,
  type IncomingHttpHeaders,
  type IncomingMessage,
  type RequestOptions,
} from "node:http";
import { request as httpsRequest } from "node:https";
import { isIP, type LookupFunction } from "node:net";
import { Readable, Transform } from "node:stream";
import { createBrotliDecompress, createGunzip, createInflate } from "node:zlib";

export const DEFAULT_PUBLIC_HTTP_MAX_BODY_BYTES = 1_048_576;
export const DEFAULT_PUBLIC_HTTP_MAX_REDIRECTS = 3;

export type PublicHttpErrorCode =
  | "INVALID_URL"
  | "UNSUPPORTED_PROTOCOL"
  | "CREDENTIALS_FORBIDDEN"
  | "UNSAFE_HOST"
  | "UNSAFE_ADDRESS"
  | "DNS_LOOKUP_FAILED"
  | "DNS_NO_ADDRESS"
  | "DNS_INVALID_ADDRESS"
  | "DNS_UNSAFE_ADDRESS"
  | "FORBIDDEN_HEADER"
  | "INVALID_OPTIONS"
  | "INVALID_REDIRECT"
  | "TOO_MANY_REDIRECTS"
  | "REQUEST_ABORTED"
  | "REQUEST_FAILED"
  | "UNSUPPORTED_CONTENT_ENCODING"
  | "BODY_READ_FAILED"
  | "RESPONSE_TOO_LARGE";

const ERROR_MESSAGES: Record<PublicHttpErrorCode, string> = {
  INVALID_URL: "The remote URL is invalid.",
  UNSUPPORTED_PROTOCOL: "The remote URL protocol is not allowed.",
  CREDENTIALS_FORBIDDEN: "Credentials are not allowed in remote URLs.",
  UNSAFE_HOST: "The remote hostname is not public.",
  UNSAFE_ADDRESS: "The remote address is not public.",
  DNS_LOOKUP_FAILED: "The remote hostname could not be resolved.",
  DNS_NO_ADDRESS: "The remote hostname has no usable address.",
  DNS_INVALID_ADDRESS: "The remote hostname resolved to an invalid address.",
  DNS_UNSAFE_ADDRESS: "The remote hostname resolved to a non-public address.",
  FORBIDDEN_HEADER: "The remote request contains a forbidden header.",
  INVALID_OPTIONS: "The remote request options are invalid.",
  INVALID_REDIRECT: "The remote server returned an invalid redirect.",
  TOO_MANY_REDIRECTS: "The remote server returned too many redirects.",
  REQUEST_ABORTED: "The remote request was cancelled.",
  REQUEST_FAILED: "The remote request failed.",
  UNSUPPORTED_CONTENT_ENCODING:
    "The remote response uses an unsupported content encoding.",
  BODY_READ_FAILED: "The remote response body could not be read.",
  RESPONSE_TOO_LARGE: "The remote response body is too large.",
};

/** A typed error whose message never includes a hostname, IP, URL, or upstream error. */
export class PublicHttpError extends Error {
  readonly code: PublicHttpErrorCode;

  constructor(code: PublicHttpErrorCode) {
    super(ERROR_MESSAGES[code]);
    this.name = "PublicHttpError";
    this.code = code;
  }
}

export interface PublicHttpResolvedAddress {
  address: string;
  family: 4 | 6;
}

export interface PublicHttpTransportRequest {
  url: URL;
  addresses: readonly PublicHttpResolvedAddress[];
  headers: Headers;
  maxWireBytes: number;
  signal?: AbortSignal;
}

/** `body` is the decoded response stream; the byte cap is applied to it. */
export interface PublicHttpTransportResponse {
  status: number;
  headers: Headers;
  body: ReadableStream<Uint8Array> | null;
  close: () => void;
}

export interface PublicHttpDependencies {
  lookup: (hostname: string) => Promise<readonly PublicHttpResolvedAddress[]>;
  request: (
    input: PublicHttpTransportRequest,
  ) => Promise<PublicHttpTransportResponse>;
}

export interface PublicHttpOptions {
  headers?: HeadersInit;
  maxBodyBytes?: number;
  maxWireBytes?: number;
  maxRedirects?: number;
  signal?: AbortSignal;
}

export interface PublicHttpResponse {
  body: Uint8Array;
  finalUrl: string;
  headers: Headers;
  ok: boolean;
  status: number;
}

const BLOCKED_HOST_SUFFIXES = [
  ".localhost",
  ".local",
  ".internal",
  ".home.arpa",
  ".invalid",
  ".test",
  ".example",
];

const ALLOWED_CALLER_REQUEST_HEADERS = new Set([
  "accept",
  "accept-language",
  "user-agent",
]);

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

function ipv4ToNumber(address: string): number | null {
  const octets = address.split(".");
  if (octets.length !== 4) return null;
  let value = 0;
  for (const octet of octets) {
    if (!/^\d{1,3}$/.test(octet)) return null;
    const parsed = Number(octet);
    if (parsed > 255) return null;
    value = value * 256 + parsed;
  }
  return value;
}

function ipv4InCidr(address: number, base: string, prefix: number): boolean {
  const baseNumber = ipv4ToNumber(base);
  if (baseNumber === null) return false;
  const blockSize = 2 ** (32 - prefix);
  return Math.floor(address / blockSize) === Math.floor(baseNumber / blockSize);
}

const BLOCKED_IPV4_CIDRS: ReadonlyArray<readonly [string, number]> = [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.88.99.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
];

function ipv6ToBigInt(address: string): bigint | null {
  if (isIP(address) !== 6 || address.includes("%")) return null;

  const halves = address.toLowerCase().split("::");
  if (halves.length > 2) return null;

  const parseHalf = (half: string): string[] | null => {
    if (half === "") return [];
    const pieces = half.split(":");
    const last = pieces.at(-1);
    if (last?.includes(".")) {
      const ipv4 = ipv4ToNumber(last);
      if (ipv4 === null) return null;
      pieces.splice(
        pieces.length - 1,
        1,
        ((ipv4 >>> 16) & 0xffff).toString(16),
        (ipv4 & 0xffff).toString(16),
      );
    }
    return pieces.every((piece) => /^[0-9a-f]{1,4}$/.test(piece))
      ? pieces
      : null;
  };

  const left = parseHalf(halves[0]);
  const right = parseHalf(halves[1] ?? "");
  if (!left || !right) return null;

  const hasCompression = halves.length === 2;
  const missing = 8 - left.length - right.length;
  if ((!hasCompression && missing !== 0) || (hasCompression && missing < 1)) {
    return null;
  }

  const hextets = [
    ...left,
    ...Array.from({ length: missing }, () => "0"),
    ...right,
  ];
  if (hextets.length !== 8) return null;

  let value = BigInt(0);
  for (const hextet of hextets) {
    value = (value << BigInt(16)) | BigInt(`0x${hextet}`);
  }
  return value;
}

function ipv6InCidr(address: bigint, base: string, prefix: number): boolean {
  const baseNumber = ipv6ToBigInt(base);
  if (baseNumber === null) return false;
  const shift = BigInt(128 - prefix);
  return address >> shift === baseNumber >> shift;
}

const BLOCKED_IPV6_CIDRS: ReadonlyArray<readonly [string, number]> = [
  ["::", 96], // unspecified and deprecated IPv4-compatible forms
  ["::ffff:0:0", 96], // IPv4-mapped forms
  ["::ffff:0:0:0", 96], // IPv4-translated forms
  ["64:ff9b::", 96], // well-known NAT64 translation prefix
  ["64:ff9b:1::", 48], // local-use NAT64 translation prefix
  ["100::", 64], // discard-only
  ["2001::", 23], // IETF special-purpose assignments
  ["2001:db8::", 32], // documentation
  ["2002::", 16], // 6to4, which can encode private IPv4
  ["3fff::", 20], // documentation
  ["5f00::", 16], // segment-routing SIDs
  ["fc00::", 7], // unique-local
  ["fe80::", 10], // link-local
  ["fec0::", 10], // deprecated site-local
  ["ff00::", 8], // multicast
];

/** True only for ordinary globally routable IPv4/IPv6 addresses. */
export function isPublicIpAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) {
    const value = ipv4ToNumber(address);
    return (
      value !== null &&
      !BLOCKED_IPV4_CIDRS.some(([base, prefix]) =>
        ipv4InCidr(value, base, prefix),
      )
    );
  }
  if (family === 6) {
    const value = ipv6ToBigInt(address);
    return (
      value !== null &&
      ipv6InCidr(value, "2000::", 3) && // currently allocated global unicast
      !BLOCKED_IPV6_CIDRS.some(([base, prefix]) =>
        ipv6InCidr(value, base, prefix),
      )
    );
  }
  return false;
}

function normalizedHostname(url: URL): string {
  const withoutBrackets = url.hostname.replace(/^\[|\]$/g, "");
  return withoutBrackets.replace(/\.+$/, "").toLowerCase();
}

function isBlockedHostname(hostname: string): boolean {
  if (!hostname || hostname === "localhost") return true;
  return BLOCKED_HOST_SUFFIXES.some(
    (suffix) => hostname === suffix.slice(1) || hostname.endsWith(suffix),
  );
}

async function defaultLookup(
  hostname: string,
): Promise<readonly PublicHttpResolvedAddress[]> {
  const results = await nodeLookup(hostname, { all: true, verbatim: true });
  return results.map(({ address, family }) => ({
    address,
    family: family === 6 ? 6 : 4,
  }));
}

function withAbort<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise;
  if (signal.aborted) {
    return Promise.reject(new PublicHttpError("REQUEST_ABORTED"));
  }
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(new PublicHttpError("REQUEST_ABORTED"));
    signal.addEventListener("abort", onAbort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener("abort", onAbort);
        resolve(value);
      },
      (error: unknown) => {
        signal.removeEventListener("abort", onAbort);
        reject(error);
      },
    );
  });
}

async function resolvePublicUrl(
  input: string | URL,
  dependencies: PublicHttpDependencies,
  signal?: AbortSignal,
): Promise<{ url: URL; addresses: readonly PublicHttpResolvedAddress[] }> {
  let url: URL;
  try {
    url = new URL(input instanceof URL ? input.href : input);
  } catch {
    throw new PublicHttpError("INVALID_URL");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new PublicHttpError("UNSUPPORTED_PROTOCOL");
  }
  if (url.username || url.password) {
    throw new PublicHttpError("CREDENTIALS_FORBIDDEN");
  }

  url.hash = "";
  const hostname = normalizedHostname(url);
  if (isBlockedHostname(hostname)) {
    throw new PublicHttpError("UNSAFE_HOST");
  }

  const literalFamily = isIP(hostname);
  if (literalFamily !== 0) {
    if (!isPublicIpAddress(hostname)) {
      throw new PublicHttpError("UNSAFE_ADDRESS");
    }
    return {
      url,
      addresses: [{ address: hostname, family: literalFamily === 6 ? 6 : 4 }],
    };
  }

  let addresses: readonly PublicHttpResolvedAddress[];
  try {
    addresses = await withAbort(dependencies.lookup(hostname), signal);
  } catch (error) {
    if (error instanceof PublicHttpError) throw error;
    throw new PublicHttpError("DNS_LOOKUP_FAILED");
  }
  if (addresses.length === 0) {
    throw new PublicHttpError("DNS_NO_ADDRESS");
  }

  const unique = new Map<string, PublicHttpResolvedAddress>();
  for (const result of addresses) {
    const actualFamily = isIP(result.address);
    if (
      actualFamily === 0 ||
      actualFamily !== result.family ||
      (result.family !== 4 && result.family !== 6)
    ) {
      throw new PublicHttpError("DNS_INVALID_ADDRESS");
    }
    if (!isPublicIpAddress(result.address)) {
      throw new PublicHttpError("DNS_UNSAFE_ADDRESS");
    }
    unique.set(`${result.family}:${result.address}`, result);
  }

  return { url, addresses: [...unique.values()] };
}

function headersFromIncoming(headers: IncomingHttpHeaders): Headers {
  const output = new Headers();
  for (const [name, value] of Object.entries(headers)) {
    if (Array.isArray(value)) {
      for (const item of value) output.append(name, item);
    } else if (value !== undefined) {
      output.set(name, value);
    }
  }
  return output;
}

function decodedIncomingBody(
  response: IncomingMessage,
  headers: Headers,
  maxWireBytes: number,
): { body: ReadableStream<Uint8Array>; close: () => void } {
  const contentEncoding = (headers.get("content-encoding") ?? "identity")
    .trim()
    .toLowerCase();
  const boundedWire = response.pipe(createPublicHttpWireLimit(maxWireBytes));
  response.once("error", (error) => boundedWire.destroy(error));
  let decoded: Readable;
  if (contentEncoding === "" || contentEncoding === "identity") {
    decoded = boundedWire;
  } else if (contentEncoding === "gzip" || contentEncoding === "x-gzip") {
    decoded = boundedWire.pipe(createGunzip());
  } else if (contentEncoding === "deflate") {
    decoded = boundedWire.pipe(createInflate());
  } else if (contentEncoding === "br") {
    decoded = boundedWire.pipe(createBrotliDecompress());
  } else {
    boundedWire.destroy();
    response.destroy();
    throw new PublicHttpError("UNSUPPORTED_CONTENT_ENCODING");
  }

  if (decoded !== boundedWire) {
    boundedWire.once("error", (error) => decoded.destroy(error));
  }

  let closed = false;
  return {
    body: Readable.toWeb(decoded) as ReadableStream<Uint8Array>,
    close: () => {
      if (closed) return;
      closed = true;
      decoded.destroy();
      if (decoded !== boundedWire) boundedWire.destroy();
      response.destroy();
    },
  };
}

/** Count compressed/on-the-wire bytes before any decoder can discard them. */
export function createPublicHttpWireLimit(maxWireBytes: number): Transform {
  let total = 0;
  return new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      total += chunk.byteLength;
      if (total > maxWireBytes) {
        callback(new PublicHttpError("RESPONSE_TOO_LARGE"));
        return;
      }
      callback(null, chunk);
    },
  });
}

function requestFromAddress(
  input: PublicHttpTransportRequest,
  resolved: PublicHttpResolvedAddress,
): Promise<PublicHttpTransportResponse> {
  return new Promise((resolve, reject) => {
    const lookup: LookupFunction = (_hostname, options, callback) => {
      if (options.all) {
        callback(null, [resolved]);
      } else {
        callback(null, resolved.address, resolved.family);
      }
    };
    const options: RequestOptions = {
      agent: false,
      family: resolved.family,
      headers: Object.fromEntries(input.headers.entries()),
      lookup,
      method: "GET",
      signal: input.signal,
    };
    const request =
      input.url.protocol === "https:" ? httpsRequest : httpRequest;
    const outgoing = request(input.url, options, (incoming) => {
      try {
        const headers = headersFromIncoming(incoming.headers);
        const decoded = decodedIncomingBody(
          incoming,
          headers,
          input.maxWireBytes,
        );
        resolve({
          status: incoming.statusCode ?? 0,
          headers,
          body: decoded.body,
          close: decoded.close,
        });
      } catch (error) {
        incoming.destroy();
        reject(error);
      }
    });
    outgoing.once("error", reject);
    outgoing.end();
  });
}

async function defaultRequest(
  input: PublicHttpTransportRequest,
): Promise<PublicHttpTransportResponse> {
  for (const address of input.addresses) {
    try {
      return await requestFromAddress(input, address);
    } catch (error) {
      if (error instanceof PublicHttpError) throw error;
      if (input.signal?.aborted) {
        throw new PublicHttpError("REQUEST_ABORTED");
      }
    }
  }
  throw new PublicHttpError("REQUEST_FAILED");
}

const DEFAULT_DEPENDENCIES: PublicHttpDependencies = {
  lookup: defaultLookup,
  request: defaultRequest,
};

function buildRequestHeaders(initial?: HeadersInit): Headers {
  let headers: Headers;
  try {
    headers = new Headers(initial);
  } catch {
    throw new PublicHttpError("FORBIDDEN_HEADER");
  }
  for (const name of headers.keys()) {
    if (!ALLOWED_CALLER_REQUEST_HEADERS.has(name.toLowerCase())) {
      throw new PublicHttpError("FORBIDDEN_HEADER");
    }
  }
  if (!headers.has("accept-encoding")) {
    headers.set("Accept-Encoding", "gzip, deflate, br");
  }
  return headers;
}

async function cancelReaderQuietly(
  reader: ReadableStreamDefaultReader<Uint8Array>,
): Promise<void> {
  try {
    await reader.cancel();
  } catch {
    // The public error is already fixed; cancellation is best effort.
  }
}

async function readBoundedBody(
  response: PublicHttpTransportResponse,
  maxBodyBytes: number,
  signal?: AbortSignal,
): Promise<Uint8Array> {
  const contentEncoding = (response.headers.get("content-encoding") ?? "")
    .trim()
    .toLowerCase();
  const contentLength = response.headers.get("content-length");
  if (
    (!contentEncoding || contentEncoding === "identity") &&
    contentLength !== null &&
    /^\d+$/.test(contentLength) &&
    Number(contentLength) > maxBodyBytes
  ) {
    throw new PublicHttpError("RESPONSE_TOO_LARGE");
  }
  if (!response.body) return new Uint8Array();

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const next = await withAbort(reader.read(), signal);
      if (next.done) break;
      total += next.value.byteLength;
      if (total > maxBodyBytes) {
        throw new PublicHttpError("RESPONSE_TOO_LARGE");
      }
      chunks.push(next.value);
    }
  } catch (error) {
    await cancelReaderQuietly(reader);
    if (error instanceof PublicHttpError) throw error;
    if (signal?.aborted) throw new PublicHttpError("REQUEST_ABORTED");
    throw new PublicHttpError("BODY_READ_FAILED");
  } finally {
    reader.releaseLock();
  }

  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

function validateOptions(options: PublicHttpOptions): {
  maxBodyBytes: number;
  maxWireBytes: number;
  maxRedirects: number;
} {
  const maxBodyBytes =
    options.maxBodyBytes ?? DEFAULT_PUBLIC_HTTP_MAX_BODY_BYTES;
  const maxWireBytes = options.maxWireBytes ?? maxBodyBytes;
  const maxRedirects =
    options.maxRedirects ?? DEFAULT_PUBLIC_HTTP_MAX_REDIRECTS;
  if (
    !Number.isSafeInteger(maxBodyBytes) ||
    maxBodyBytes < 1 ||
    !Number.isSafeInteger(maxWireBytes) ||
    maxWireBytes < 1 ||
    !Number.isSafeInteger(maxRedirects) ||
    maxRedirects < 0
  ) {
    throw new PublicHttpError("INVALID_OPTIONS");
  }
  return { maxBodyBytes, maxWireBytes, maxRedirects };
}

/**
 * Fetch a public HTTP(S) resource with DNS/IP validation, connection pinning,
 * redirect revalidation, and a cap on decoded response bytes.
 */
export async function fetchPublicHttpBytes(
  input: string | URL,
  options: PublicHttpOptions = {},
  dependencies: PublicHttpDependencies = DEFAULT_DEPENDENCIES,
): Promise<PublicHttpResponse> {
  const { maxBodyBytes, maxWireBytes, maxRedirects } = validateOptions(options);
  const headers = buildRequestHeaders(options.headers);
  let current: string | URL = input;
  let redirects = 0;

  while (true) {
    const resolved = await resolvePublicUrl(
      current,
      dependencies,
      options.signal,
    );
    let response: PublicHttpTransportResponse;
    try {
      response = await withAbort(
        dependencies.request({
          url: resolved.url,
          addresses: resolved.addresses,
          headers,
          maxWireBytes,
          signal: options.signal,
        }),
        options.signal,
      );
    } catch (error) {
      if (error instanceof PublicHttpError) throw error;
      if (options.signal?.aborted) {
        throw new PublicHttpError("REQUEST_ABORTED");
      }
      throw new PublicHttpError("REQUEST_FAILED");
    }

    const location = response.headers.get("location");
    if (REDIRECT_STATUSES.has(response.status) && location !== null) {
      response.close();
      if (redirects >= maxRedirects) {
        throw new PublicHttpError("TOO_MANY_REDIRECTS");
      }
      try {
        current = new URL(location, resolved.url);
      } catch {
        throw new PublicHttpError("INVALID_REDIRECT");
      }
      redirects += 1;
      continue;
    }

    try {
      const body = await readBoundedBody(
        response,
        maxBodyBytes,
        options.signal,
      );
      return {
        body,
        finalUrl: resolved.url.href,
        headers: response.headers,
        ok: response.status >= 200 && response.status < 300,
        status: response.status,
      };
    } finally {
      response.close();
    }
  }
}
