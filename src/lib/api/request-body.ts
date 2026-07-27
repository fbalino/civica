import { z } from "zod";

export const JSON_MEDIA_TYPE = "application/json" as const;
export const FORM_MEDIA_TYPE = "application/x-www-form-urlencoded" as const;

export type RequestBodyMediaType =
  typeof JSON_MEDIA_TYPE | typeof FORM_MEDIA_TYPE;

export type RequestInputErrorCode =
  | "INVALID_REQUEST"
  | "MALFORMED_REQUEST_BODY"
  | "INVALID_REQUEST_BODY"
  | "REQUEST_BODY_TOO_LARGE"
  | "UNSUPPORTED_MEDIA_TYPE";

export type RequestBodyParseResult<T> =
  | {
      ok: true;
      data: T;
      mediaType: RequestBodyMediaType;
    }
  | {
      ok: false;
      response: Response;
    };

export interface RequestBodyMediaSchema<T> {
  mediaType: RequestBodyMediaType;
  schema: z.ZodType<T>;
}

export interface BoundedRequestBodyOptions<T> {
  maxBytes: number;
  media: readonly RequestBodyMediaSchema<T>[];
  maxDepth?: number;
  maxNodes?: number;
  maxFormFields?: number;
}

const DEFAULT_MAX_DEPTH = 32;
const DEFAULT_MAX_NODES = 4_096;
const DEFAULT_MAX_FORM_FIELDS = 64;
const FORBIDDEN_KEYS = new Set(["__proto__", "constructor", "prototype"]);

const ERROR_COPY: Record<
  RequestInputErrorCode,
  { status: number; error: string }
> = {
  INVALID_REQUEST: { status: 400, error: "Invalid request." },
  MALFORMED_REQUEST_BODY: {
    status: 400,
    error: "Malformed request body.",
  },
  INVALID_REQUEST_BODY: { status: 422, error: "Invalid request body." },
  REQUEST_BODY_TOO_LARGE: {
    status: 413,
    error: "Request body is too large.",
  },
  UNSUPPORTED_MEDIA_TYPE: {
    status: 415,
    error: "Unsupported request content type.",
  },
};

export function requestInputErrorResponse(
  code: RequestInputErrorCode,
): Response {
  const definition = ERROR_COPY[code];
  return Response.json(
    { error: definition.error, code },
    {
      status: definition.status,
      headers: { "Cache-Control": "no-store" },
    },
  );
}

function parseContentType(raw: string | null): RequestBodyMediaType | null {
  if (!raw || raw.length > 128) return null;
  const parts = raw.split(";").map((part) => part.trim());
  const mediaType = parts.shift()?.toLowerCase();
  if (mediaType !== JSON_MEDIA_TYPE && mediaType !== FORM_MEDIA_TYPE) {
    return null;
  }

  let sawCharset = false;
  for (const parameter of parts) {
    const match = /^charset\s*=\s*(?:"utf-8"|utf-8)$/i.exec(parameter);
    if (!match || sawCharset) return null;
    sawCharset = true;
  }
  return mediaType;
}

function declaredLength(request: Request): number | null | "invalid" {
  const raw = request.headers.get("content-length");
  if (raw === null) return null;
  if (raw.length > 20) return "invalid";
  if (!/^(?:0|[1-9]\d*)$/.test(raw)) return "invalid";
  const parsed = Number(raw);
  return Number.isSafeInteger(parsed) ? parsed : "invalid";
}

async function cancelQuietly(
  reader: ReadableStreamDefaultReader<Uint8Array>,
): Promise<void> {
  try {
    await reader.cancel();
  } catch {
    // The rejection path is already fixed; cancellation is best effort.
  }
}

async function readBoundedBytes(
  request: Request,
  maxBytes: number,
): Promise<
  | { ok: true; bytes: Uint8Array }
  | { ok: false; code: "MALFORMED_REQUEST_BODY" | "REQUEST_BODY_TOO_LARGE" }
> {
  const length = declaredLength(request);
  if (length === "invalid") {
    return { ok: false, code: "MALFORMED_REQUEST_BODY" };
  }
  if (length !== null && length > maxBytes) {
    return { ok: false, code: "REQUEST_BODY_TOO_LARGE" };
  }
  if (!request.body) return { ok: true, bytes: new Uint8Array() };

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await cancelQuietly(reader);
        return { ok: false, code: "REQUEST_BODY_TOO_LARGE" };
      }
      chunks.push(value);
    }
  } catch {
    await cancelQuietly(reader);
    return { ok: false, code: "MALFORMED_REQUEST_BODY" };
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { ok: true, bytes };
}

function decodeUtf8(bytes: Uint8Array): string | null {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

/**
 * JSON.parse accepts duplicate object keys with last-value-wins semantics.
 * Scan the already syntax-valid source so ambiguous keys are rejected at the
 * trust boundary, including escaped spellings such as `"na\\u006de"`.
 */
function hasDuplicateJsonObjectKeys(text: string): boolean {
  let index = 0;
  let duplicate = false;

  type Frame =
    | { kind: "array" }
    | { kind: "object"; expectingKey: boolean; keys: Set<string> };
  const stack: Frame[] = [];

  const readString = (): string => {
    const start = index;
    index += 1;
    let escaped = false;
    while (index < text.length) {
      const character = text[index];
      index += 1;
      if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === '"') {
        break;
      }
    }
    return JSON.parse(text.slice(start, index)) as string;
  };

  while (index < text.length) {
    const character = text[index];
    if (character === "{") {
      index += 1;
      stack.push({ kind: "object", expectingKey: true, keys: new Set() });
    } else if (character === "[") {
      index += 1;
      stack.push({ kind: "array" });
    } else if (character === "}" || character === "]") {
      index += 1;
      stack.pop();
    } else if (character === ",") {
      index += 1;
      const frame = stack.at(-1);
      if (frame?.kind === "object") frame.expectingKey = true;
    } else if (character === ":" || /\s/.test(character)) {
      index += 1;
    } else if (character === '"') {
      const value = readString();
      const frame = stack.at(-1);
      if (frame?.kind === "object" && frame.expectingKey) {
        if (frame.keys.has(value)) duplicate = true;
        frame.keys.add(value);
        frame.expectingKey = false;
      }
    } else {
      while (index < text.length && !/[\s,\]}]/.test(text[index])) index += 1;
    }
  }
  return duplicate;
}

function hasUnsafeStructure(
  root: unknown,
  maxDepth: number,
  maxNodes: number,
): boolean {
  const stack: Array<{ value: unknown; depth: number }> = [
    { value: root, depth: 0 },
  ];
  let nodes = 0;

  while (stack.length > 0) {
    const current = stack.pop()!;
    nodes += 1;
    if (nodes > maxNodes || current.depth > maxDepth) return true;
    if (!current.value || typeof current.value !== "object") continue;

    for (const key of Object.keys(current.value)) {
      if (FORBIDDEN_KEYS.has(key)) return true;
      stack.push({
        value: (current.value as Record<string, unknown>)[key],
        depth: current.depth + 1,
      });
    }
  }
  return false;
}

function decodeFormComponent(raw: string): string | null {
  const plusDecoded = raw.replaceAll("+", " ");
  if (/%(?![0-9a-fA-F]{2})/.test(plusDecoded)) return null;
  try {
    return decodeURIComponent(plusDecoded);
  } catch {
    return null;
  }
}

function parseStrictForm(
  raw: string,
  maxFields: number,
): Record<string, string> | null {
  const output = Object.create(null) as Record<string, string>;
  if (raw === "") return output;
  const pairs = raw.split("&");
  if (pairs.length > maxFields) return null;

  for (const pair of pairs) {
    const separator = pair.indexOf("=");
    const rawKey = separator === -1 ? pair : pair.slice(0, separator);
    const rawValue = separator === -1 ? "" : pair.slice(separator + 1);
    const key = decodeFormComponent(rawKey);
    const value = decodeFormComponent(rawValue);
    if (
      key === null ||
      value === null ||
      key.length === 0 ||
      FORBIDDEN_KEYS.has(key) ||
      Object.hasOwn(output, key)
    ) {
      return null;
    }
    output[key] = value;
  }
  return output;
}

/**
 * Read one JSON or URL-encoded request body without ever buffering more than
 * the route's declared byte ceiling. Syntax and structural failures stay
 * generic; field values and schema internals are never reflected to callers.
 */
export async function parseBoundedRequestBody<T>(
  request: Request,
  options: BoundedRequestBodyOptions<T>,
): Promise<RequestBodyParseResult<T>> {
  if (!Number.isSafeInteger(options.maxBytes) || options.maxBytes < 1) {
    throw new Error("maxBytes must be a positive safe integer");
  }
  const mediaType = parseContentType(request.headers.get("content-type"));
  if (mediaType === null) {
    return {
      ok: false,
      response: requestInputErrorResponse("UNSUPPORTED_MEDIA_TYPE"),
    };
  }
  const media = options.media.find((entry) => entry.mediaType === mediaType);
  if (!media) {
    return {
      ok: false,
      response: requestInputErrorResponse("UNSUPPORTED_MEDIA_TYPE"),
    };
  }

  const bounded = await readBoundedBytes(request, options.maxBytes);
  if (!bounded.ok) {
    return {
      ok: false,
      response: requestInputErrorResponse(bounded.code),
    };
  }
  const text = decodeUtf8(bounded.bytes);
  if (text === null) {
    return {
      ok: false,
      response: requestInputErrorResponse("MALFORMED_REQUEST_BODY"),
    };
  }

  let candidate: unknown;
  if (mediaType === JSON_MEDIA_TYPE) {
    try {
      candidate = JSON.parse(text) as unknown;
    } catch {
      return {
        ok: false,
        response: requestInputErrorResponse("MALFORMED_REQUEST_BODY"),
      };
    }
    if (hasDuplicateJsonObjectKeys(text)) {
      return {
        ok: false,
        response: requestInputErrorResponse("MALFORMED_REQUEST_BODY"),
      };
    }
    if (
      hasUnsafeStructure(
        candidate,
        options.maxDepth ?? DEFAULT_MAX_DEPTH,
        options.maxNodes ?? DEFAULT_MAX_NODES,
      )
    ) {
      return {
        ok: false,
        response: requestInputErrorResponse("INVALID_REQUEST_BODY"),
      };
    }
  } else {
    candidate = parseStrictForm(
      text,
      options.maxFormFields ?? DEFAULT_MAX_FORM_FIELDS,
    );
    if (candidate === null) {
      return {
        ok: false,
        response: requestInputErrorResponse("MALFORMED_REQUEST_BODY"),
      };
    }
  }

  const parsed = media.schema.safeParse(candidate);
  if (!parsed.success) {
    return {
      ok: false,
      response: requestInputErrorResponse("INVALID_REQUEST_BODY"),
    };
  }
  return { ok: true, data: parsed.data, mediaType };
}
