import { NextResponse } from "next/server";
import { apiProblem } from "@/lib/api/problem-response";
import { requestUuidSchema } from "@/lib/api/request-body-schemas";
import { getPulseCodingSession } from "@/lib/pulse/v2/coding-session";
import { exportPulseCodingStudy } from "@/lib/pulse/v2/coding-store";
import { withResponseCacheProfile } from "@/lib/api/response-cache";

const EXPECTED_EXPORT_PROBLEMS: ReadonlyMap<
  string,
  { error: string; code: string; status: number }
> = new Map([
  [
    "Coding study export requires an adjudicator or study admin",
    {
      error: "This session cannot export coding studies.",
      code: "EXPORT_FORBIDDEN",
      status: 403,
    },
  ],
  [
    "Participant cannot export another study",
    {
      error: "This session cannot export the requested study.",
      code: "EXPORT_FORBIDDEN",
      status: 403,
    },
  ],
  [
    "Pulse coding study not found",
    {
      error: "Pulse coding study not found.",
      code: "STUDY_NOT_FOUND",
      status: 404,
    },
  ],
  [
    "Study admins receive status only until the study is closed and every disagreement is terminal",
    {
      error: "The coding study is not ready for export.",
      code: "STUDY_NOT_READY",
      status: 409,
    },
  ],
  [
    "Adjudicator export is limited to a fully assigned study queue",
    {
      error: "The assigned coding queue is not ready for export.",
      code: "QUEUE_NOT_READY",
      status: 409,
    },
  ],
]);

async function handleExport(
  _request: Request,
  { params }: { params: Promise<{ studyId: string }> },
) {
  let session: Awaited<ReturnType<typeof getPulseCodingSession>>;
  try {
    session = await getPulseCodingSession();
  } catch (error) {
    console.error("[/api/pulse-coding/exports] session failure", error);
    return apiProblem("DATA_UNAVAILABLE");
  }
  if (!session)
    return NextResponse.json(
      { error: "Unauthorized.", code: "UNAUTHORIZED" },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  const { studyId } = await params;
  const parsedStudyId = requestUuidSchema.safeParse(studyId);
  if (!parsedStudyId.success) return apiProblem("INVALID_PATH");
  try {
    const artifact = await exportPulseCodingStudy(session, parsedStudyId.data);
    return NextResponse.json(artifact, {
      headers: {
        "cache-control": "no-store, private",
        "content-disposition": `attachment; filename="pulse-coding-${parsedStudyId.data}.json"`,
      },
    });
  } catch (error) {
    const problem =
      error instanceof Error
        ? EXPECTED_EXPORT_PROBLEMS.get(error.message)
        : undefined;
    if (!problem) {
      console.error("[/api/pulse-coding/exports] export failure", error);
      return apiProblem("DATA_UNAVAILABLE");
    }
    switch (problem.code) {
      case "EXPORT_FORBIDDEN":
        return NextResponse.json(
          {
            error: "This session cannot export the requested coding study.",
            code: "EXPORT_FORBIDDEN",
          },
          {
            status: 403,
            headers: { "Cache-Control": "no-store" },
          },
        );
      case "STUDY_NOT_FOUND":
        return NextResponse.json(
          {
            error: "Pulse coding study not found.",
            code: "STUDY_NOT_FOUND",
          },
          {
            status: 404,
            headers: { "Cache-Control": "no-store" },
          },
        );
      case "QUEUE_NOT_READY":
        return NextResponse.json(
          {
            error: "The assigned coding queue is not ready for export.",
            code: "QUEUE_NOT_READY",
          },
          {
            status: 409,
            headers: { "Cache-Control": "no-store" },
          },
        );
      case "STUDY_NOT_READY":
        return NextResponse.json(
          {
            error: "The coding study is not ready for export.",
            code: "STUDY_NOT_READY",
          },
          {
            status: 409,
            headers: { "Cache-Control": "no-store" },
          },
        );
    }
    return apiProblem("DATA_UNAVAILABLE");
  }
}

export async function GET(
  request: Request,
  context: { params: Promise<{ studyId: string }> },
) {
  return withResponseCacheProfile("private-live", () =>
    handleExport(request, context),
  );
}
