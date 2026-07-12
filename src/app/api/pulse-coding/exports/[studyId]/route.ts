import { NextResponse } from "next/server";
import { getPulseCodingSession } from "@/lib/pulse/v2/coding-session";
import { exportPulseCodingStudy } from "@/lib/pulse/v2/coding-store";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ studyId: string }> },
) {
  const session = await getPulseCodingSession();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { studyId } = await params;
  try {
    const artifact = await exportPulseCodingStudy(session, studyId);
    return NextResponse.json(artifact, {
      headers: {
        "cache-control": "no-store, private",
        "content-disposition": `attachment; filename="pulse-coding-${studyId}.json"`,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Export failed" },
      { status: 403 },
    );
  }
}
