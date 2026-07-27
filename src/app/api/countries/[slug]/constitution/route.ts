import { NextResponse } from "next/server";
import { getJurisdictionBySlug, getConstitution } from "@/lib/db/queries";
import { enforceInMemoryRateLimit } from "@/lib/api/rate-limit";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const limited = enforceInMemoryRateLimit(req, {
    scope: "countries-constitution",
  });
  if (limited) return limited;

  const { slug } = await params;
  const jurisdiction = await getJurisdictionBySlug(slug);
  if (!jurisdiction)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const constitution = await getConstitution(jurisdiction.id);

  return NextResponse.json({
    country: jurisdiction.name,
    year: constitution?.year ?? null,
    yearUpdated: constitution?.yearUpdated ?? null,
    hasFullText: !!constitution?.fullTextHtml,
    constituteProjectId: constitution?.constituteProjectId ?? null,
    readerUrl: constitution
      ? `/constitution?c=${encodeURIComponent(slug)}`
      : null,
    source: constitution
      ? {
          id: "constitute_project",
          name: "Constitute Project",
          license: "CC-BY-NC-3.0",
          termsUrl: "https://www.constituteproject.org/content/terms",
          access: "interactive-noncommercial-display-only",
          bulkExport: "blocked",
        }
      : null,
  });
}
