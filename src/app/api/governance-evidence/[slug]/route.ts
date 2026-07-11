import { NextResponse } from "next/server";
import { buildGovernanceEvidenceExport } from "@/lib/ci/governance-evidence";
import { getGovernanceEvidence } from "@/lib/db/queries-governance-evidence";

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const evidence = await getGovernanceEvidence(slug);

  if (!evidence) {
    return NextResponse.json({ error: "Country not found" }, { status: 404 });
  }

  return NextResponse.json(buildGovernanceEvidenceExport(evidence), {
    headers: {
      "Content-Disposition": `attachment; filename="civica-governance-evidence-${slug}-${evidence.year}.json"`,
    },
  });
}
