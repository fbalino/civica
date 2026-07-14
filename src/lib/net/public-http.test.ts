import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import test from "node:test";

import {
  fetchPublicHttpBytes,
  createPublicHttpWireLimit,
  isPublicIpAddress,
  PublicHttpError,
  type PublicHttpDependencies,
  type PublicHttpErrorCode,
  type PublicHttpTransportResponse,
} from "./public-http";

const PUBLIC_V4 = "93.184.216.34";
const PUBLIC_V6 = "2606:4700:4700::1111";

function expectCode(code: PublicHttpErrorCode) {
  return (error: unknown): boolean => {
    assert.ok(error instanceof PublicHttpError);
    assert.equal(error.code, code);
    assert.equal(error.message.includes("http"), false);
    return true;
  };
}

function responseFromChunks(
  chunks: readonly Uint8Array[],
  init: { headers?: HeadersInit; status?: number } = {},
): {
  response: PublicHttpTransportResponse;
  state: { cancelled: boolean; closed: boolean };
} {
  const state = { cancelled: false, closed: false };
  let index = 0;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      const chunk = chunks[index];
      index += 1;
      if (chunk) controller.enqueue(chunk);
      else controller.close();
    },
    cancel() {
      state.cancelled = true;
    },
  });
  return {
    response: {
      status: init.status ?? 200,
      headers: new Headers(init.headers),
      body,
      close: () => {
        state.closed = true;
      },
    },
    state,
  };
}

function textBytes(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

test("IP classification rejects private, link-local, mapped, translated, and reserved ranges", () => {
  const blocked = [
    "0.0.0.0",
    "10.0.0.1",
    "100.64.0.1",
    "127.0.0.1",
    "169.254.169.254",
    "172.31.255.255",
    "192.0.0.9",
    "192.0.2.1",
    "192.168.1.1",
    "198.18.0.1",
    "198.51.100.1",
    "203.0.113.1",
    "224.0.0.1",
    "255.255.255.255",
    "::",
    "::1",
    "::ffff:127.0.0.1",
    "::ffff:0:127.0.0.1",
    "64:ff9b::7f00:1",
    "100::1",
    "2001:db8::1",
    "2002:7f00:1::",
    "3fff::1",
    "4000::1",
    "5f00::1",
    "fc00::1",
    "fe80::1",
    "fec0::1",
    "ff02::1",
  ];
  for (const address of blocked) {
    assert.equal(isPublicIpAddress(address), false, address);
  }
  assert.equal(isPublicIpAddress(PUBLIC_V4), true);
  assert.equal(isPublicIpAddress(PUBLIC_V6), true);
});

test("URL validation rejects schemes, credentials, local names, and odd private IP literals before I/O", async () => {
  let lookups = 0;
  let requests = 0;
  const dependencies: PublicHttpDependencies = {
    lookup: async () => {
      lookups += 1;
      return [{ address: PUBLIC_V4, family: 4 }];
    },
    request: async () => {
      requests += 1;
      return responseFromChunks([]).response;
    },
  };

  const cases: ReadonlyArray<readonly [string, PublicHttpErrorCode]> = [
    ["not a url", "INVALID_URL"],
    ["file:///etc/passwd", "UNSUPPORTED_PROTOCOL"],
    ["ftp://news.civicaatlas.org/story", "UNSUPPORTED_PROTOCOL"],
    [
      "https://user:password@news.civicaatlas.org/story",
      "CREDENTIALS_FORBIDDEN",
    ],
    ["http://localhost/story", "UNSAFE_HOST"],
    ["http://LOCALHOST./story", "UNSAFE_HOST"],
    ["http://news.local/story", "UNSAFE_HOST"],
    ["http://service.internal/story", "UNSAFE_HOST"],
    ["http://127.0.0.1/story", "UNSAFE_ADDRESS"],
    ["http://0/story", "UNSAFE_ADDRESS"],
    ["http://127.1/story", "UNSAFE_ADDRESS"],
    ["http://127.0.1/story", "UNSAFE_ADDRESS"],
    ["http://①②⑦.⓪.⓪.①/story", "UNSAFE_ADDRESS"],
    ["http://2130706433/story", "UNSAFE_ADDRESS"],
    ["http://0x7f000001/story", "UNSAFE_ADDRESS"],
    ["http://0x7f.0.0.1/story", "UNSAFE_ADDRESS"],
    ["http://017700000001/story", "UNSAFE_ADDRESS"],
    ["http://169.254.169.254/latest/meta-data", "UNSAFE_ADDRESS"],
    ["http://10.0.0.1/story", "UNSAFE_ADDRESS"],
    ["http://192.168.1.1/story", "UNSAFE_ADDRESS"],
    ["http://[::1]/story", "UNSAFE_ADDRESS"],
    ["http://[::ffff:127.0.0.1]/story", "UNSAFE_ADDRESS"],
    ["http://[::ffff:0:127.0.0.1]/story", "UNSAFE_ADDRESS"],
    ["http://[64:ff9b::7f00:1]/story", "UNSAFE_ADDRESS"],
    ["http://[fc00::1]/story", "UNSAFE_ADDRESS"],
    ["http://[fe80::1]/story", "UNSAFE_ADDRESS"],
  ];

  for (const [url, code] of cases) {
    await assert.rejects(
      fetchPublicHttpBytes(url, {}, dependencies),
      expectCode(code),
      url,
    );
  }
  assert.equal(lookups, 0);
  assert.equal(requests, 0);
});

test("caller headers are allowlisted so redirects cannot forward secrets", async () => {
  await assert.rejects(
    fetchPublicHttpBytes(
      "https://news.civicaatlas.org/story",
      { headers: { "X-API-Key": "secret" } },
      {
        lookup: async () => [{ address: PUBLIC_V4, family: 4 }],
        request: async () => responseFromChunks([]).response,
      },
    ),
    expectCode("FORBIDDEN_HEADER"),
  );
});

test("a public IP literal skips DNS and remains the pinned transport address", async () => {
  let lookupCalled = false;
  const fixture = responseFromChunks([textBytes("article")], {
    headers: { "content-type": "text/html" },
  });
  const result = await fetchPublicHttpBytes(
    `https://${PUBLIC_V4}/story#fragment`,
    {},
    {
      lookup: async () => {
        lookupCalled = true;
        return [];
      },
      request: async (input) => {
        assert.deepEqual(input.addresses, [{ address: PUBLIC_V4, family: 4 }]);
        assert.equal(input.url.hash, "");
        return fixture.response;
      },
    },
  );

  assert.equal(lookupCalled, false);
  assert.equal(new TextDecoder().decode(result.body), "article");
  assert.equal(result.finalUrl, `https://${PUBLIC_V4}/story`);
  assert.equal(result.ok, true);
  assert.equal(fixture.state.closed, true);
});

test("DNS must return only valid public addresses before the transport is called", async () => {
  for (const addresses of [
    [{ address: "10.0.0.5", family: 4 as const }],
    [
      { address: PUBLIC_V4, family: 4 as const },
      { address: "::1", family: 6 as const },
    ],
  ]) {
    let requests = 0;
    await assert.rejects(
      fetchPublicHttpBytes(
        "https://news.civicaatlas.org/story",
        {},
        {
          lookup: async () => addresses,
          request: async () => {
            requests += 1;
            return responseFromChunks([]).response;
          },
        },
      ),
      expectCode("DNS_UNSAFE_ADDRESS"),
    );
    assert.equal(requests, 0);
  }

  await assert.rejects(
    fetchPublicHttpBytes(
      "https://news.civicaatlas.org/story",
      {},
      {
        lookup: async () => [{ address: PUBLIC_V4, family: 6 }],
        request: async () => responseFromChunks([]).response,
      },
    ),
    expectCode("DNS_INVALID_ADDRESS"),
  );
});

test("every redirect target is revalidated before another request", async () => {
  let requests = 0;
  const redirect = responseFromChunks([], {
    status: 302,
    headers: { location: "http://169.254.169.254/latest/meta-data" },
  });
  await assert.rejects(
    fetchPublicHttpBytes(
      "https://news.civicaatlas.org/story",
      {},
      {
        lookup: async () => [{ address: PUBLIC_V4, family: 4 }],
        request: async () => {
          requests += 1;
          return redirect.response;
        },
      },
    ),
    expectCode("UNSAFE_ADDRESS"),
  );
  assert.equal(requests, 1);
  assert.equal(redirect.state.closed, true);

  requests = 0;
  let lookups = 0;
  await assert.rejects(
    fetchPublicHttpBytes(
      "https://news.civicaatlas.org/story",
      {},
      {
        lookup: async () => {
          lookups += 1;
          return lookups === 1
            ? [{ address: PUBLIC_V4, family: 4 }]
            : [{ address: "10.0.0.8", family: 4 }];
        },
        request: async () => {
          requests += 1;
          return responseFromChunks([], {
            status: 301,
            headers: { location: "https://private.civicaatlas.org/target" },
          }).response;
        },
      },
    ),
    expectCode("DNS_UNSAFE_ADDRESS"),
  );
  assert.equal(lookups, 2);
  assert.equal(requests, 1);
});

test("redirect count is closed and bounded", async () => {
  let requests = 0;
  let closed = 0;
  await assert.rejects(
    fetchPublicHttpBytes(
      "https://news.civicaatlas.org/start",
      { maxRedirects: 2 },
      {
        lookup: async () => [{ address: PUBLIC_V4, family: 4 }],
        request: async () => {
          requests += 1;
          return {
            status: 302,
            headers: new Headers({ location: `/hop-${requests}` }),
            body: null,
            close: () => {
              closed += 1;
            },
          };
        },
      },
    ),
    expectCode("TOO_MANY_REDIRECTS"),
  );
  assert.equal(requests, 3);
  assert.equal(closed, 3);
});

test("decoded chunked and compressed response streams are capped before concatenation", async (t) => {
  const fixtures: ReadonlyArray<{
    name: string;
    headers: Record<string, string>;
  }> = [
    { name: "chunked", headers: {} },
    {
      name: "compressed-decoded",
      headers: { "content-encoding": "gzip", "content-length": "4" },
    },
  ];
  for (const fixture of fixtures) {
    await t.test(fixture.name, async () => {
      const upstream = responseFromChunks(
        [textBytes("12345678"), textBytes("abcdefgh")],
        { headers: fixture.headers },
      );
      await assert.rejects(
        fetchPublicHttpBytes(
          "https://news.civicaatlas.org/story",
          { maxBodyBytes: 10 },
          {
            lookup: async () => [{ address: PUBLIC_V4, family: 4 }],
            request: async () => upstream.response,
          },
        ),
        expectCode("RESPONSE_TOO_LARGE"),
      );
      assert.equal(upstream.state.closed, true);
    });
  }
});

test("compressed wire bytes are capped before decompression", async () => {
  const source = Readable.from([Buffer.alloc(8), Buffer.alloc(8)]).pipe(
    createPublicHttpWireLimit(10),
  );
  await assert.rejects(async () => {
    for await (const _chunk of source) {
      // Drain the bounded wire stream.
    }
  }, expectCode("RESPONSE_TOO_LARGE"));
});

test("the default transport disables shared socket pooling", () => {
  const source = readFileSync(
    path.join(process.cwd(), "src/lib/net/public-http.ts"),
    "utf8",
  );
  assert.match(source, /const options: RequestOptions = \{\s*agent: false,/);
});

test("upstream exception details never enter typed public errors", async () => {
  const secret = "postgres://admin:secret@internal.invalid/database";
  await assert.rejects(
    fetchPublicHttpBytes(
      "https://news.civicaatlas.org/story",
      {},
      {
        lookup: async () => [{ address: PUBLIC_V4, family: 4 }],
        request: async () => {
          throw new Error(secret);
        },
      },
    ),
    (error: unknown) => {
      assert.ok(error instanceof PublicHttpError);
      assert.equal(error.code, "REQUEST_FAILED");
      assert.equal(error.message.includes(secret), false);
      assert.equal(JSON.stringify(error).includes(secret), false);
      return true;
    },
  );
});
