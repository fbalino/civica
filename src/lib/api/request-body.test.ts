import assert from "node:assert/strict";
import test from "node:test";
import { z } from "zod";

import {
  FORM_MEDIA_TYPE,
  JSON_MEDIA_TYPE,
  parseBoundedRequestBody,
} from "./request-body";

const jsonSchema = z
  .object({ name: z.string().min(1).max(20), enabled: z.boolean() })
  .strict();
const formSchema = z
  .object({
    name: z.string().min(1).max(20),
    count: z
      .string()
      .regex(/^(?:0|[1-9]\d*)$/)
      .transform(Number),
  })
  .strict();

function request(
  body: BodyInit | null,
  contentType: string = JSON_MEDIA_TYPE,
  headers: HeadersInit = {},
): Request {
  return new Request("https://civicaatlas.org/api/test", {
    method: "POST",
    body,
    headers: { "content-type": contentType, ...headers },
  });
}

async function code(response: Response): Promise<string> {
  const body = (await response.json()) as { code: string };
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(Object.keys(body).sort(), ["code", "error"]);
  return body.code;
}

test("accepts strict JSON and URL-encoded schemas with UTF-8 parameters", async () => {
  const json = await parseBoundedRequestBody(
    request(
      JSON.stringify({ name: "Civica", enabled: true }),
      "application/json; charset=UTF-8",
    ),
    {
      maxBytes: 256,
      media: [{ mediaType: JSON_MEDIA_TYPE, schema: jsonSchema }],
    },
  );
  assert.deepEqual(json, {
    ok: true,
    data: { name: "Civica", enabled: true },
    mediaType: JSON_MEDIA_TYPE,
  });

  const form = await parseBoundedRequestBody(
    request("name=Civica+Atlas&count=4", FORM_MEDIA_TYPE),
    {
      maxBytes: 256,
      media: [{ mediaType: FORM_MEDIA_TYPE, schema: formSchema }],
    },
  );
  assert.deepEqual(form, {
    ok: true,
    data: { name: "Civica Atlas", count: 4 },
    mediaType: FORM_MEDIA_TYPE,
  });
});

test("rejects unsupported, missing, or parameter-smuggled media types", async () => {
  for (const contentType of [
    "text/plain",
    "application/problem+json",
    "application/json; profile=unsafe",
    "application/json; charset=iso-8859-1",
    "application/json; charset=utf-8; charset=utf-8",
    `application/json; profile=${"x".repeat(128)}`,
    "",
  ]) {
    const headers: HeadersInit = contentType
      ? { "content-type": contentType }
      : {};
    const result = await parseBoundedRequestBody(
      new Request("https://civicaatlas.org/api/test", {
        method: "POST",
        body: "{}",
        headers,
      }),
      {
        maxBytes: 256,
        media: [{ mediaType: JSON_MEDIA_TYPE, schema: jsonSchema }],
      },
    );
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.response.status, 415);
      assert.equal(await code(result.response), "UNSUPPORTED_MEDIA_TYPE");
    }
  }
});

test("stops a chunked body at the byte ceiling even without Content-Length", async () => {
  let cancelled = false;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array(8).fill(0x61));
      controller.enqueue(new Uint8Array(9).fill(0x62));
    },
    cancel() {
      cancelled = true;
    },
  });
  const oversized = new Request("https://civicaatlas.org/api/test", {
    method: "POST",
    headers: { "content-type": JSON_MEDIA_TYPE },
    body: stream,
    duplex: "half",
  } as RequestInit & { duplex: "half" });
  const result = await parseBoundedRequestBody(oversized, {
    maxBytes: 16,
    media: [{ mediaType: JSON_MEDIA_TYPE, schema: jsonSchema }],
  });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.response.status, 413);
    assert.equal(await code(result.response), "REQUEST_BODY_TOO_LARGE");
  }
  assert.equal(cancelled, true);
});

test("rejects an oversized declaration and malformed Content-Length", async () => {
  const oversized = await parseBoundedRequestBody(
    request("{}", JSON_MEDIA_TYPE, { "content-length": "999" }),
    {
      maxBytes: 16,
      media: [{ mediaType: JSON_MEDIA_TYPE, schema: jsonSchema }],
    },
  );
  assert.equal(oversized.ok, false);
  if (!oversized.ok) {
    assert.equal(oversized.response.status, 413);
    assert.equal(await code(oversized.response), "REQUEST_BODY_TOO_LARGE");
  }

  for (const contentLength of ["-1", "+1", "1, 2", "01", "Infinity"]) {
    const malformed = await parseBoundedRequestBody(
      request("{}", JSON_MEDIA_TYPE, { "content-length": contentLength }),
      {
        maxBytes: 16,
        media: [{ mediaType: JSON_MEDIA_TYPE, schema: jsonSchema }],
      },
    );
    assert.equal(malformed.ok, false);
    if (!malformed.ok) {
      assert.equal(malformed.response.status, 400);
      assert.equal(await code(malformed.response), "MALFORMED_REQUEST_BODY");
    }
  }
});

test("rejects invalid UTF-8 and invalid JSON as malformed", async () => {
  const invalidUtf8 = await parseBoundedRequestBody(
    request(new Uint8Array([0xc3, 0x28])),
    {
      maxBytes: 256,
      media: [{ mediaType: JSON_MEDIA_TYPE, schema: jsonSchema }],
    },
  );
  assert.equal(invalidUtf8.ok, false);
  if (!invalidUtf8.ok) {
    assert.equal(invalidUtf8.response.status, 400);
    assert.equal(await code(invalidUtf8.response), "MALFORMED_REQUEST_BODY");
  }

  for (const body of ["", "{", '{"name":']) {
    const malformed = await parseBoundedRequestBody(request(body), {
      maxBytes: 256,
      media: [{ mediaType: JSON_MEDIA_TYPE, schema: jsonSchema }],
    });
    assert.equal(malformed.ok, false);
    if (!malformed.ok) {
      assert.equal(malformed.response.status, 400);
      assert.equal(await code(malformed.response), "MALFORMED_REQUEST_BODY");
    }
  }
});

test("strict schemas reject null, arrays, wrong types, and unknown keys", async () => {
  for (const value of [
    null,
    [],
    { name: "Civica", enabled: "true" },
    { name: "Civica", enabled: true, role: "admin" },
  ]) {
    const result = await parseBoundedRequestBody(
      request(JSON.stringify(value)),
      {
        maxBytes: 256,
        media: [{ mediaType: JSON_MEDIA_TYPE, schema: jsonSchema }],
      },
    );
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.response.status, 422);
      assert.equal(await code(result.response), "INVALID_REQUEST_BODY");
    }
  }
});

test("JSON parsing rejects duplicate keys at every object depth", async () => {
  for (const body of [
    '{"name":"first","name":"second","enabled":true}',
    '{"name":"first","na\\u006de":"second","enabled":true}',
    '{"name":"Civica","enabled":true,"nested":{"id":1,"id":2}}',
  ]) {
    const result = await parseBoundedRequestBody(request(body), {
      maxBytes: 512,
      media: [{ mediaType: JSON_MEDIA_TYPE, schema: jsonSchema }],
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.response.status, 400);
      assert.equal(await code(result.response), "MALFORMED_REQUEST_BODY");
    }
  }

  const distinctObjects = await parseBoundedRequestBody(
    request('{"name":"Civica","enabled":true}'),
    {
      maxBytes: 512,
      media: [{ mediaType: JSON_MEDIA_TYPE, schema: jsonSchema }],
    },
  );
  assert.equal(distinctObjects.ok, true);
});

test("deep valid JSON fails closed without recursive duplicate-key scanning", async () => {
  const depth = 8_000;
  const body = `${"[".repeat(depth)}0${"]".repeat(depth)}`;
  const result = await parseBoundedRequestBody(request(body), {
    maxBytes: 20_000,
    maxDepth: 32,
    media: [{ mediaType: JSON_MEDIA_TYPE, schema: jsonSchema }],
  });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.response.status, 422);
    assert.equal(await code(result.response), "INVALID_REQUEST_BODY");
  }
});

test("rejects prototype keys, deep structures, and excessive object nodes", async () => {
  const fixtures = [
    '{"name":"Civica","enabled":true,"__proto__":{"polluted":true}}',
    JSON.stringify({
      name: "Civica",
      enabled: true,
      nested: { constructor: { prototype: { polluted: true } } },
    }),
    JSON.stringify({ nested: { deeper: { deepest: true } } }),
    JSON.stringify({ many: [{}, {}, {}, {}] }),
  ];
  for (const [index, body] of fixtures.entries()) {
    const result = await parseBoundedRequestBody(request(body), {
      maxBytes: 1_024,
      maxDepth: index === 2 ? 1 : 32,
      maxNodes: index === 3 ? 3 : 4_096,
      media: [{ mediaType: JSON_MEDIA_TYPE, schema: jsonSchema }],
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.response.status, 422);
      assert.equal(await code(result.response), "INVALID_REQUEST_BODY");
    }
  }
  assert.equal(({} as { polluted?: boolean }).polluted, undefined);
});

test("form parsing rejects duplicate scalars, prototype keys, and bad escapes", async () => {
  for (const body of [
    "name=one&name=two&count=1",
    "__proto__=polluted&name=Civica&count=1",
    "constructor=x&name=Civica&count=1",
    "name=%ZZ&count=1",
    "name=%C3%28&count=1",
  ]) {
    const result = await parseBoundedRequestBody(
      request(body, FORM_MEDIA_TYPE),
      {
        maxBytes: 256,
        media: [{ mediaType: FORM_MEDIA_TYPE, schema: formSchema }],
      },
    );
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.response.status, 400);
      assert.equal(await code(result.response), "MALFORMED_REQUEST_BODY");
    }
  }
});

test("seeded malformed-byte fuzz cases fail closed without throwing", async () => {
  let state = 0x6d2b79f5;
  const nextByte = () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return state & 0xff;
  };

  for (let index = 0; index < 128; index += 1) {
    const bytes = Uint8Array.from({ length: 1 + (nextByte() % 96) }, nextByte);
    const result = await parseBoundedRequestBody(request(bytes), {
      maxBytes: 128,
      media: [{ mediaType: JSON_MEDIA_TYPE, schema: jsonSchema }],
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.ok([400, 422].includes(result.response.status));
      const errorCode = await code(result.response);
      assert.ok(
        ["MALFORMED_REQUEST_BODY", "INVALID_REQUEST_BODY"].includes(errorCode),
      );
    }
  }
});
