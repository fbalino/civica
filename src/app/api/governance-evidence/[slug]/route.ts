import { NextResponse } from "next/server";
import { buildGovernanceEvidenceExport } from "@/lib/ci/governance-evidence";
import { GOVERNANCE_EVIDENCE_AVAILABLE_SERIES_TYPES, GOVERNANCE_EVIDENCE_SERIES } from "@/lib/ci/governance-evidence";
import { getGovernanceEvidence } from "@/lib/db/queries-governance-evidence";
import { normalizeCiSeriesType } from "@/lib/ci/series-provenance";

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const requested = new URL(request.url).searchParams.get("series_type");
  let seriesType = GOVERNANCE_EVIDENCE_SERIES.seriesType;
  if (requested) {
    try {
      seriesType = normalizeCiSeriesType(requested);
    } catch {
      return NextResponse.json({ error: "Unknown series_type", allowed: ["as_published_release", "harmonized_backcast"] }, { status: 400 });
    }
  }
  if (!GOVERNANCE_EVIDENCE_AVAILABLE_SERIES_TYPES.includes(seriesType)) {
    return NextResponse.json({
      error: "That series type has no Governance Evidence release",
      requestedSeriesType: seriesType,
      availableSeriesTypes: GOVERNANCE_EVIDENCE_AVAILABLE_SERIES_TYPES,
    }, { status: 404 });
  }
  const evidence = await getGovernanceEvidence(slug, seriesType);

  if (!evidence) {
    return NextResponse.json({ error: "Country not found" }, { status: 404 });
  }

  return NextResponse.json(buildGovernanceEvidenceExport(evidence), {
    headers: {
      "Content-Disposition": `attachment; filename="civica-governance-evidence-${slug}-${evidence.year}-${seriesType}.json"`,
    },
  });
}
