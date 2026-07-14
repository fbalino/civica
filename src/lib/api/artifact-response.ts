import { apiProblem } from "./problem-response";

export interface ImmutableArtifactOptions {
  operation: string;
  filename: string;
  contentType: string;
  load: () => Promise<Uint8Array>;
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
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error(`[${options.operation}] release artifact unavailable`, error);
    return apiProblem("ARTIFACT_UNAVAILABLE");
  }
}
