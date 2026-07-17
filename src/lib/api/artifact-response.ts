import { cacheControlFor } from "@/lib/platform/cache-consistency";

export interface ImmutableArtifactOptions {
  operation: string;
  filename: string;
  contentType: string;
  load: () => Promise<Uint8Array>;
}

function artifactUnavailableResponse(): Response {
  return Response.json(
    {
      error: "The requested artifact is temporarily unavailable.",
      code: "ARTIFACT_UNAVAILABLE",
    },
    {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}

/** Serve a checked release artifact without exposing filesystem failures. */
export async function immutableArtifactResponse(
  options: ImmutableArtifactOptions,
): Promise<Response> {
  try {
    const body = await options.load();
    // Fetch accepts ArrayBufferView bodies at runtime; the DOM lib bundled
    // with this TypeScript version narrows BodyInit more than the platform.
    return new Response(body as unknown as BodyInit, {
      headers: {
        "Content-Type": options.contentType,
        "Content-Disposition": `attachment; filename="${options.filename}"`,
        "Cache-Control": cacheControlFor("immutable-release"),
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    // A frozen, shared-cache route must not reach the database-backed error
    // monitor. Keep the fallback fixed and content-free, including in logs.
    console.error("[release-artifact] unavailable");
    return artifactUnavailableResponse();
  }
}
